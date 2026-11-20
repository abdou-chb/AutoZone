// Admin review of car requests and the track page, in headless Chrome (dev servers on 5173 and 5000):
// node tools/tests/browser/car-requests-ui.mjs 1440x900 en. Test rows are deleted at the end.
import { createRequire } from "node:module";
import { launch } from "./cdp.mjs";

const APP = new URL("../../../", import.meta.url).pathname.replace(/\/$/, "");
const require = createRequire(`${APP}/server/package.json`);
require("dotenv").config({ path: `${APP}/server/.env`, quiet: true });
const db = require(`${APP}/server/database.js`);
const { signToken } = require(`${APP}/server/auth.js`);

const [w, h] = (process.argv[2] || "1440x900").split("x").map(Number);
const lang = process.argv[3] || "en";
const tag = `car-requests-${w}-${lang}`;
const results = [];
const check = (name, ok, info = "") => {
  results.push(ok);
  console.log(ok ? "PASS" : "FAIL", name, info);
};

const body = (name, note) => ({
  vehicleId: "rs6",
  vehicleName: "Audi RS 6 Avant",
  configuration: {
    setup: { paint: "graphite", stance: "lowered-35", ledColor: "ice-blue" },
    lines: [
      { group: "paint", groupLabel: "Body colour", option: "graphite", optionLabel: "Graphite", price: 140000 },
      { group: "stance", groupLabel: "Ride height", option: "lowered-35", optionLabel: "−35 mm", price: 320000 },
    ],
    included: [{ group: "ledColor", groupLabel: "LED colour", option: "ice-blue", optionLabel: "Ice blue 9000 K" }],
    optionsTotal: 460000,
    total: 460000,
    currency: "DZD",
    illustrative: true,
  },
  fullName: `TEST ${name}`,
  phone: "0661 23 45 67",
  email: "",
  wilaya: "Oran",
  message: note,
  language: lang,
});
const ids = [];
let browser;
// Navigate and wait for the new page itself (not the previous page's DOM) to show `ready`.
async function open(path, ready) {
  await browser.eval(`document.body.dataset.leaving = "1"; true`).catch(() => {});
  await browser.goto(`http://localhost:5173${path}`);
  await browser.waitFor(`!document.body.dataset.leaving && document.readyState === "complete" && (${ready})`, 40000);
  await browser.sleep(400);
}

// Rows like the API saves them (the API itself is covered by tools/tests/car-requests-api.mjs, which also hits its rate limit).
for (const [name, note] of [["Approve Me", "TEST: please call after 18:00."], ["Reject Me", ""]]) {
  const request = body(name, note);
  const result = db
    .prepare(
      `INSERT INTO tuning_requests (vehicle_id, vehicle_name, configuration, options_total, total, full_name, phone, email, wilaya, message, language)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(request.vehicleId, request.vehicleName, JSON.stringify(request.configuration), 460000, 460000, request.fullName, request.phone, "", request.wilaya, note, lang);
  const id = Number(result.lastInsertRowid);

  db.prepare("INSERT INTO notifications (type, ref_id, title) VALUES ('tuning', ?, ?)").run(id, request.vehicleName);
  ids.push(id);
}

check("two test requests created", ids.every(Boolean), ids.join(","));

const admin = db.prepare("SELECT id, role, token_version FROM admins WHERE active = 1 AND role = 'owner' ORDER BY id LIMIT 1").get();
const b = await launch({ port: 9444 });
browser = b;

try {
  await b.size(w, h, w < 700);
  await b.goto(`http://localhost:5173/admin/login?lang=${lang}`);
  await b.eval(`sessionStorage.setItem("adminToken", ${JSON.stringify(signToken(admin))}); localStorage.setItem("autozone:lang", "${lang}"); true`);
  await open(`/admin/car-requests?lang=${lang}`, `document.querySelectorAll(".inbox-list .inbox-item").length >= 2`);
  await b.sleep(600);

  const navCount = await b.eval(`[...document.querySelectorAll(".console__link")].find((a) => a.getAttribute("href") === "/admin/car-requests")?.textContent`);
  check("nav item with its pending count", /\d/.test(navCount || ""), navCount);
  const rows = await b.eval(`[...document.querySelectorAll(".inbox-list .inbox-item")].map((a) => a.textContent)`);
  check("pending list shows the requests", ids.every((id) => rows.some((row) => row.includes(`TZ-${id}`))), rows.length + " rows");
  await b.shot(`${tag}-list.jpg`);

  async function decide(id, action, note) {
    await open(`/admin/car-requests/${id}?lang=${lang}`, `!!document.querySelector(".car-request__decide")`);
    await b.sleep(400);
    const config = await b.eval(`({ rows: document.querySelectorAll(".car-request__table tbody tr").length, total: document.querySelector(".car-request__total strong")?.textContent, tel: document.querySelector(".inbox-sender a[href^='tel:']")?.getAttribute("href") })`);
    check(`TZ-${id}: configuration and contact shown`, config.rows === 2 && /460/.test(config.total) && config.tel === "tel:0661234567", JSON.stringify(config));
    if (note) {
      await b.eval(`(() => { const area = document.querySelector(".car-request__decide textarea"); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; set.call(area, ${JSON.stringify(note)}); area.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
    }
    await b.eval(`document.querySelector(".car-request__decide .btn--${action === "approved" ? "success" : "danger"}").click()`);
    await b.waitFor(`!!document.querySelector("dialog[open]")`, 5000);
    await b.shot(`${tag}-${action}-dialog.jpg`);
    await b.eval(`document.querySelector("dialog[open] .admin-dialog__actions .btn:last-child").click()`);
    await b.waitFor(`!!document.querySelector(".car-request__decision")`, 10000);
    await b.sleep(500);
    const shown = await b.eval(`({ badge: document.querySelector(".inbox-reader__tags .badge")?.textContent, decision: document.querySelector(".car-request__decision")?.textContent })`);
    const row = db.prepare("SELECT status, decision_note, reviewed_by FROM tuning_requests WHERE id = ?").get(id);
    check(`TZ-${id}: ${action}`, row.status === action && row.reviewed_by === admin.id && row.decision_note === (note || ""), JSON.stringify(shown));
    await b.shot(`${tag}-${action}.jpg`);
  }

  await decide(ids[0], "approved", "");
  await decide(ids[1], "rejected", "TEST: this model is not available this month.");

  await open(`/admin/car-requests?status=all&lang=${lang}`, `document.querySelectorAll(".inbox-list .inbox-item").length >= 2`);
  const tabs = await b.eval(`[...document.querySelectorAll(".inbox-tab")].map((a) => a.textContent)`);
  check("status tabs with counts", tabs.length === 4 && tabs.every((x) => /\d/.test(x)), tabs.join(" | "));

  // Notification bell entry opens the request.
  await open(`/admin?lang=${lang}`, `!!document.querySelector(".overview-tile")`);
  await b.sleep(1500);
  const tile = await b.eval(`[...document.querySelectorAll(".overview-tile")].find((a) => a.getAttribute("href") === "/admin/car-requests")?.textContent`);
  check("overview tile", Boolean(tile), tile);
  await b.eval(`document.querySelector(".admin-bell > button").click(); true`);
  await b.waitFor(`!!document.querySelector(".admin-bell__item")`, 10000);
  const bellText = await b.eval(`document.querySelector(".admin-bell__item .admin-bell__text span").textContent`);
  await b.eval(`document.querySelector(".admin-bell__item").click(); true`);
  await b.waitFor(`location.pathname.startsWith("/admin/car-requests/")`, 10000).catch(() => {});
  const link = await b.eval(`location.pathname`);
  check("notification names the car and opens the request", link === `/admin/car-requests/${ids[1]}` && bellText.includes("Audi RS 6"), `${bellText} -> ${link}`);
  await b.shot(`${tag}-bell-open.jpg`);

  // Activity log labels.
  await open(`/admin/activity?lang=${lang}`, `document.body.textContent.includes("TZ-${ids[1]}")`).catch(() => {});
  const activity = await b.eval(`document.body.textContent.includes("TZ-${ids[0]}") && document.body.textContent.includes("TZ-${ids[1]}")`);
  check("activity log names both decisions", activity);

  // Track page: car request with its note, wrong phone, and an inspection request unchanged.
  const fill = (selector, value) => b.eval(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
  await open(`/track?id=TZ-${ids[1]}&lang=${lang}`, `!!document.querySelector(".track-form")`);
  const prefilled = await b.eval(`document.querySelector("[name=requestId]").value`);
  await fill("[name=phone]", "0661234567");
  await b.eval(`document.querySelector(".track-form__submit").click()`);
  await b.waitFor(`!!document.querySelector(".track-result")`, 10000);
  const track = await b.eval(`document.querySelector(".track-result").textContent`);
  check("track TZ reference shows status and note", prefilled === `TZ-${ids[1]}` && track.includes("TEST: this model") && track.includes("Audi RS 6"), track.slice(0, 160));
  await b.shot(`${tag}-track-car.jpg`);
  await fill("[name=phone]", "0770000000");
  await b.eval(`document.querySelector(".track-form__submit").click()`);
  await b.waitFor(`!!document.querySelector(".track-outcome .notice--stop")`, 10000);
  check("track with the wrong phone shows not found", true);

  const inspection = db.prepare("SELECT id, buyer_phone FROM inspection_requests ORDER BY id DESC LIMIT 1").get();
  if (inspection) {
    await fill("[name=requestId]", String(inspection.id));
    await fill("[name=phone]", inspection.buyer_phone);
    await b.eval(`document.querySelector(".track-form__submit").click()`);
    await b.waitFor(`!!document.querySelector(".track-result .track-steps, .track-result .notice--stop")`, 10000);
    check("inspection tracking unchanged", await b.eval(`!!document.querySelector(".track-result .track-result__year")`));
    await b.shot(`${tag}-track-inspection.jpg`);
  }
  await fill("[name=requestId]", "AB-3");
  await b.eval(`document.querySelector(".track-form__submit").click()`);
  await b.sleep(300);
  check("bad reference refused in the form", await b.eval(`!!document.querySelector("#track-requestId[aria-invalid=true]") || document.body.textContent.includes("TZ-12")`));

  check("no console errors", b.errors.length === 0, JSON.stringify(b.errors).slice(0, 300));
} finally {
  await b.close();
  const marks = ids.map(() => "?").join(",");

  db.prepare(`DELETE FROM notifications WHERE type = 'tuning' AND ref_id IN (${marks})`).run(...ids);
  db.prepare(`DELETE FROM activity_log WHERE target_type = 'tuning' AND target_id IN (${marks})`).run(...ids);
  db.prepare(`DELETE FROM tuning_requests WHERE id IN (${marks})`).run(...ids);
  if (db.prepare("SELECT COUNT(*) AS c FROM tuning_requests").get().c === 0) db.prepare("DELETE FROM sqlite_sequence WHERE name = 'tuning_requests'").run();
  console.log("deleted test requests", ids.join(", "));
  console.log(`${tag}: ${results.filter(Boolean).length}/${results.length} PASS`);
}
