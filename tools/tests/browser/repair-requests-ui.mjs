// Admin review (read only) of repair requests and the track page, in headless Chrome (dev servers on 5173 and 5000):
// node tools/tests/browser/repair-requests-ui.mjs 1440x900 en. The test request is created through the real API
// (with images) and deleted at the end.
import { createRequire } from "node:module";
import { join } from "node:path";
import { launch } from "./cdp.mjs";

const APP = new URL("../../../", import.meta.url).pathname.replace(/\/$/, "");
const require = createRequire(`${APP}/server/package.json`);
require("dotenv").config({ path: `${APP}/server/.env`, quiet: true });
const db = require(`${APP}/server/database.js`);
const { signToken } = require(`${APP}/server/auth.js`);
const fs = require("node:fs");

const [w, h] = (process.argv[2] || "1440x900").split("x").map(Number);
const lang = process.argv[3] || "en";
const tag = `repair-requests-${w}-${lang}`;
const results = [];
const check = (name, ok, info = "") => {
  results.push(ok);
  console.log(ok ? "PASS" : "FAIL", name, info);
};

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const payload = {
  demoVehicleId: "golf",
  vehicle: { usesDemoModel: true, make: "Volkswagen", model: "Golf GTI", year: 2021, engine: "2.0 TSI", mileage: 62000, registration: "00123-116-16", notes: "TEST vehicle notes." },
  problems: [
    { category: "brakes", area: "wheel-fl", description: "TEST squealing when braking hard", symptoms: "A high squeal", started: "weeks", startedNote: "", severity: "high", notes: "Worse when cold" },
    { category: "ac", area: "", description: "TEST A/C blows warm", symptoms: "", started: "months", startedNote: "", severity: "medium", notes: "" },
  ],
  customer: { fullName: "TEST Repair Visitor", phone: "0661 23 45 67", email: "test@example.com", preferredContact: "whatsapp", preferredDate: "", preferredTime: "", comments: "TEST comments." },
  language: lang,
};

// Inserted straight into the DB (the API path, including the images and the rate limit, is covered by
// tools/tests/repair-requests-api.mjs). Two real image files back the gallery.
const uploads = `${APP}/server/uploads`;
const files = [`test-repair-${Date.now()}-a.png`, `test-repair-${Date.now()}-b.png`];
files.forEach((name) => fs.writeFileSync(join(uploads, name), Buffer.from(PNG)));
const attachments = files.map((name) => `/uploads/${name}`);
const result = db
  .prepare(
    `INSERT INTO repair_requests (demo_vehicle_id, uses_demo_model, vehicle_make, vehicle_model, vehicle_year, engine, mileage,
      registration, vehicle_notes, problems, attachments, full_name, phone, email, preferred_contact, preferred_date,
      preferred_time, comments, language)
     VALUES (@demoVehicleId, 1, @make, @model, @year, @engine, @mileage, @registration, @notes, @problems, @attachments,
      @fullName, @phone, @email, @preferredContact, '', '', @comments, @language)`
  )
  .run({
    demoVehicleId: payload.demoVehicleId,
    make: payload.vehicle.make,
    model: payload.vehicle.model,
    year: payload.vehicle.year,
    engine: payload.vehicle.engine,
    mileage: payload.vehicle.mileage,
    registration: payload.vehicle.registration,
    notes: payload.vehicle.notes,
    problems: JSON.stringify(payload.problems),
    attachments: JSON.stringify(attachments),
    fullName: payload.customer.fullName,
    phone: payload.customer.phone,
    email: payload.customer.email,
    preferredContact: payload.customer.preferredContact,
    comments: payload.customer.comments,
    language: lang,
  });
const id = Number(result.lastInsertRowid);
const reference = `RP-${id}`;
db.prepare("INSERT INTO notifications (type, ref_id, title) VALUES ('repair', ?, ?)").run(id, `${payload.vehicle.make} ${payload.vehicle.model}`);

check("a test repair request was created with images", Boolean(id), reference);

const admin = db.prepare("SELECT id, role, token_version FROM admins WHERE active = 1 AND role = 'owner' ORDER BY id LIMIT 1").get();
const b = await launch({ port: 9444 });
let browser = b;

async function open(path, ready) {
  await browser.eval(`document.body.dataset.leaving = "1"; true`).catch(() => {});
  await browser.goto(`http://localhost:5173${path}`);
  await browser.waitFor(`!document.body.dataset.leaving && document.readyState === "complete" && (${ready})`, 40000);
  await browser.sleep(400);
}

try {
  await b.size(w, h, w < 700);
  await b.goto(`http://localhost:5173/admin/login?lang=${lang}`);
  await b.eval(`sessionStorage.setItem("adminToken", ${JSON.stringify(signToken(admin))}); localStorage.setItem("autozone:lang", "${lang}"); true`);

  // Nav + list.
  await open(`/admin/repair-requests?lang=${lang}`, `[...document.querySelectorAll(".inbox-list .inbox-item")].some((x) => x.textContent.includes("RP-${id}"))`);
  const navCount = await b.eval(`[...document.querySelectorAll(".console__link")].find((a) => a.getAttribute("href") === "/admin/repair-requests")?.textContent`);
  check("nav item with its count", /\d/.test(navCount || ""), navCount);
  const row = await b.eval(`[...document.querySelectorAll(".inbox-list .inbox-item")].find((x) => x.textContent.includes("RP-${id}"))?.textContent`);
  check("list shows the vehicle and the problem count", Boolean(row) && /Golf/.test(row) && row.length > 20, row);
  await b.shot(`${tag}-list.jpg`);

  // Detail (read only).
  await open(`/admin/repair-requests/${id}?lang=${lang}`, `!!document.querySelector(".repair-request")`);
  await b.sleep(400);
  const detail = await b.eval(`({
    problems: document.querySelectorAll(".repair-problem").length,
    severities: document.querySelectorAll(".repair-problem .badge").length,
    photos: document.querySelectorAll(".repair-gallery__thumb").length,
    tel: document.querySelector(".inbox-sender a[href^='tel:']")?.getAttribute("href"),
    whatsapp: !!document.querySelector(".inbox-sender a[href*='wa.me'], .inbox-sender a[href*='whatsapp']"),
    engine: document.body.textContent.includes("2.0 TSI"),
    reviewActions: !!document.querySelector(".repair-work .btn--primary"),
  })`);
  check("detail shows both problems with severity badges", detail.problems === 2 && detail.severities >= 2, JSON.stringify(detail));
  check("detail shows the vehicle, contact and the two photos", detail.photos === 2 && detail.tel === "tel:0661234567" && detail.engine, JSON.stringify(detail));
  check("a new request shows the review actions", detail.reviewActions);
  await b.shot(`${tag}-detail.jpg`);

  // Lightbox opens from a thumbnail.
  await b.eval(`document.querySelector(".repair-gallery__thumb").click(); true`);
  await b.waitFor(`!!document.querySelector("[class*='lightbox'], [role='dialog'] img")`, 5000).catch(() => {});
  const lightbox = await b.eval(`!!document.querySelector("img[alt*='Golf'], [role='dialog'] img, .lightbox")`);
  check("a photo opens in the lightbox", lightbox);
  await b.eval(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); true`);

  // Overview tile + notification bell.
  await open(`/admin?lang=${lang}`, `!!document.querySelector(".overview-tile")`);
  await b.sleep(1200);
  const tile = await b.eval(`[...document.querySelectorAll(".overview-tile")].find((a) => a.getAttribute("href") === "/admin/repair-requests")?.textContent`);
  check("overview tile for repair requests", Boolean(tile), tile);
  await b.eval(`document.querySelector(".admin-bell > button").click(); true`);
  await b.waitFor(`!!document.querySelector(".admin-bell__item")`, 10000);
  const bellText = await b.eval(`[...document.querySelectorAll(".admin-bell__item .admin-bell__text span")].map((s) => s.textContent).join(" | ")`);
  check("a notification names the vehicle", /Golf/.test(bellText), bellText);
  await b.shot(`${tag}-bell.jpg`);

  // Track page: the RP reference with the right phone, prefilled from the URL.
  await open(`/track?id=${reference}&lang=${lang}`, `!!document.querySelector("input[name='requestId']")`);
  const prefilled = await b.eval(`document.querySelector("input[name='requestId']").value`);
  check("track prefills the RP reference", prefilled === reference, prefilled);
  await b.eval(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const p = document.querySelector("input[name='phone']"); set.call(p, "0661234567"); p.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
  await b.eval(`document.querySelector(".track-form").requestSubmit(); true`);
  await b.waitFor(`!!document.querySelector(".track-result") || !!document.querySelector(".notice--stop")`, 10000);
  const tracked = await b.eval(`({ result: !!document.querySelector(".track-result"), text: document.querySelector(".track-result")?.textContent || "" })`);
  check("track shows the repair request status and problems", tracked.result && /Golf/.test(tracked.text) && /2/.test(tracked.text), tracked.text.slice(0, 120));
  await b.shot(`${tag}-track.jpg`);

  // Wrong phone → not found.
  await b.eval(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const p = document.querySelector("input[name='phone']"); set.call(p, "0000000000"); p.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
  await b.eval(`document.querySelector(".track-form").requestSubmit(); true`);
  await b.waitFor(`!!document.querySelector(".notice--stop")`, 10000);
  check("track with the wrong phone is refused", await b.eval(`!!document.querySelector(".notice--stop") && !document.querySelector(".track-result")`));

  // An inspection-style number still validates (no format error), and a bad RP is refused.
  await b.eval(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; const r = document.querySelector("input[name='requestId']"); set.call(r, "123"); r.dispatchEvent(new Event("input", { bubbles: true })); const p = document.querySelector("input[name='phone']"); set.call(p, "0661234567"); p.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
  await b.eval(`document.querySelector(".track-form").requestSubmit(); true`);
  await b.sleep(1200);
  const inspectionFormat = await b.eval(`[...document.querySelectorAll(".field__error, .track-form [role='alert']")].map((e) => e.textContent).join(" ")`);
  check("a plain inspection number is still accepted by the form", !/RP-|TZ-|format/i.test(inspectionFormat), inspectionFormat.slice(0, 80));

  const errors = await b.eval(`JSON.stringify(window.__consoleErrors || [])`).catch(() => "[]");
  check("no fatal admin errors", b.errors.filter((e) => !/favicon|ResizeObserver/.test(e)).length === 0, b.errors.join(" | ").slice(0, 200));
  console.log(`\n${tag}: ${results.filter(Boolean).length}/${results.length} PASS`);
} finally {
  await b.close();
  const stored = db.prepare("SELECT attachments FROM repair_requests WHERE id = ?").get(id);
  JSON.parse(stored?.attachments || "[]").forEach((p) => {
    try {
      fs.unlinkSync(join(`${APP}/server`, p));
    } catch {
      // gone
    }
  });
  db.prepare("DELETE FROM notifications WHERE type = 'repair' AND ref_id = ?").run(id);
  db.prepare("DELETE FROM repair_requests WHERE id = ?").run(id);
  if (!db.prepare("SELECT 1 FROM repair_requests LIMIT 1").get()) {
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'repair_requests'").run();
  }
  console.log(`deleted test request ${id}`);
}
process.exit(results.every(Boolean) ? 0 : 1);
