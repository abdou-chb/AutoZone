// Phase 2 admin management in headless Chrome (dev servers on 5173 + 5000): open a seeded request, accept it, build a
// server-priced quotation, set a schedule, and send it to the customer. Seeds + deletes its own data.
//   node tools/tests/browser/repair2-admin-ui.mjs 1440x900 en
import { createRequire } from "node:module";
import { launch } from "./cdp.mjs";

const APP = new URL("../../../", import.meta.url).pathname.replace(/\/$/, "");
const require = createRequire(`${APP}/server/package.json`);
require("dotenv").config({ path: `${APP}/server/.env`, quiet: true });
const db = require(`${APP}/server/database.js`);
const { signToken } = require(`${APP}/server/auth.js`);

const [w, h] = (process.argv[2] || "1440x900").split("x").map(Number);
const lang = process.argv[3] || "en";
const tag = `repair2-admin-${w}-${lang}`;
const results = [];
const check = (name, ok, info = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, info); };

const result = db
  .prepare(
    `INSERT INTO repair_requests (demo_vehicle_id, uses_demo_model, vehicle_make, vehicle_model, vehicle_year, engine, mileage,
      registration, vehicle_notes, problems, attachments, full_name, phone, email, preferred_contact, preferred_date, preferred_time, comments, language, status)
     VALUES ('golf', 1, 'Volkswagen', 'Golf GTI', 2021, '2.0 TSI', 62000, '', '', @problems, '[]', 'TEST Phase2 Admin', '0661 00 11 22', '', 'phone', '', '', '', @lang, 'submitted')`
  )
  .run({ problems: JSON.stringify([{ category: "brakes", area: "wheel-fl", description: "TEST squeal", symptoms: "", started: "weeks", startedNote: "", severity: "high", notes: "" }]), lang });
const id = Number(result.lastInsertRowid);
db.prepare("INSERT INTO repair_events (request_id, type, status, actor) VALUES (?, 'submitted', 'submitted', 'customer')").run(id);
db.prepare("INSERT INTO notifications (type, ref_id, title) VALUES ('repair', ?, 'Volkswagen Golf GTI')").run(id);

const admin = db.prepare("SELECT id, role, token_version FROM admins WHERE active = 1 AND role = 'owner' ORDER BY id LIMIT 1").get();
const b = await launch({ port: 9444 });
const S = (js) => b.eval(js);
const setValue = (sel, v) => S(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);

try {
  await b.size(w, h, w < 700);
  await b.goto(`http://localhost:5173/admin/login?lang=${lang}`);
  await b.eval(`sessionStorage.setItem("adminToken", ${JSON.stringify(signToken(admin))}); localStorage.setItem("autozone:lang", "${lang}"); true`);
  await b.goto(`http://localhost:5173/admin/repair-requests/${id}?lang=${lang}`);
  await b.waitFor(`!!document.querySelector(".repair-request") && !!document.querySelector(".repair-work")`, 40000);
  await b.sleep(500);
  check("a new request shows the review actions", await S(`!!document.querySelector(".repair-work .btn--primary")`));
  await b.shot(`${tag}-1-review.jpg`);

  // Accept → the quotation editor appears.
  await S(`document.querySelector(".repair-work .btn--primary").click()`);
  await b.waitFor(`!!document.querySelector(".repair-quote-editor")`, 15000);
  check("accept opens the quotation editor", await S(`!!document.querySelector(".repair-quote-editor")`));

  // Build a quote: line 1 = 2000, add line 2 = 2×4500, tax 19%.
  await setValue(".repair-quote-line__label", "Diagnostic");
  await setValue(".repair-quote-line__qty", "1");
  await setValue(".repair-quote-line__price", "2000");
  await S(`[...document.querySelectorAll(".repair-quote-editor__foot .btn")].find((x) => x).click()`); // Add line
  await b.sleep(300);
  await setValue(".repair-quote-line:nth-child(2) .repair-quote-line__label", "Brake pads");
  await setValue(".repair-quote-line:nth-child(2) .repair-quote-line__qty", "2");
  await setValue(".repair-quote-line:nth-child(2) .repair-quote-line__price", "4500");
  await setValue(".repair-quote-tax input", "19");
  await S(`document.querySelector(".repair-quote-editor > .btn--primary").click()`);
  await b.waitFor(`document.querySelector(".repair-totals__grand dd")?.textContent.replace(/\\D/g, "").length > 0`, 15000);
  await b.sleep(400);
  const total = await S(`document.querySelector(".repair-totals__grand dd").textContent`);
  const subtotal = 2000 + 2 * 4500; // 11000, +19% tax = 13090
  check("saved quote shows the server total in DA", /\d/.test(total) && total.replace(/\D/g, "") === String(subtotal + Math.round(subtotal * 0.19)), total);
  const stored = JSON.parse(db.prepare("SELECT quotation FROM repair_requests WHERE id = ?").get(id).quotation);
  check("server stored computed totals", stored.total === subtotal + Math.round(subtotal * 0.19) && stored.lines[1].amount === 9000, JSON.stringify({ total: stored.total }));

  // Schedule.
  await setValue(".repair-schedule input[type=date]", "2026-12-15");
  await S(`document.querySelector(".repair-schedule .btn--outline").click()`);
  await b.sleep(600);
  check("schedule stored", Boolean(JSON.parse(db.prepare("SELECT schedule FROM repair_requests WHERE id = ?").get(id).schedule || "{}").arrivalDate));
  await b.shot(`${tag}-2-quote.jpg`);

  // Send → confirm dialog → awaiting_customer.
  await S(`[...document.querySelectorAll(".repair-work .btn--primary")].at(-1).click()`);
  await b.waitFor(`!!document.querySelector(".admin-dialog__actions")`, 8000);
  await S(`document.querySelector(".admin-dialog__actions .btn--primary").click()`);
  await b.waitFor(`!!document.querySelector(".repair-quote-view")`, 15000);
  await b.sleep(400);
  check("after send: status awaiting_customer", db.prepare("SELECT status FROM repair_requests WHERE id = ?").get(id).status === "awaiting_customer");
  check("after send: the quote is shown read-only and a timeline exists", (await S(`!!document.querySelector(".repair-quote-view") && document.querySelectorAll(".repair-event").length >= 2`)));
  await b.shot(`${tag}-3-sent.jpg`);

  check("no console errors", b.errors.length === 0, JSON.stringify(b.errors).slice(0, 300));
} finally {
  db.prepare("DELETE FROM repair_events WHERE request_id = ?").run(id);
  db.prepare("DELETE FROM notifications WHERE type = 'repair' AND ref_id = ?").run(id);
  db.prepare("DELETE FROM activity_log WHERE target_type = 'repair' AND target_id = ?").run(id);
  db.prepare("DELETE FROM repair_requests WHERE id = ?").run(id);
  if (!db.prepare("SELECT 1 FROM repair_requests LIMIT 1").get()) db.prepare("DELETE FROM sqlite_sequence WHERE name = 'repair_requests'").run();
  await b.close();
}

console.log(`\n${tag}: ${results.filter(Boolean).length}/${results.length} PASS (deleted ${id})`);
process.exit(results.every(Boolean) ? 0 : 1);
