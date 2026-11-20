// The whole car request, as a visitor and then as the admin: configure, open the request scene from the price
// breakdown and from the Summary, the form's validation, send, the confirmation, the stored request (pending, the right
// car, configuration and total), the admin decision, tracking, back to the workshop with the setup kept, Escape.
// Requests it creates are marked TEST and deleted at the end. Needs the dev servers on 5173 and 5000.
//   node tools/tests/browser/request-flow.mjs 1440x900 en
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./cdp.mjs";

const require = createRequire(import.meta.url);
const serverDir = join(dirname(fileURLToPath(import.meta.url)), "../../../server");
require(join(serverDir, "node_modules/dotenv")).config({ path: join(serverDir, ".env"), quiet: true });
const db = require(join(serverDir, "database.js"));
const { signToken } = require(join(serverDir, "auth.js"));

const [w, h] = (process.argv[2] || "1440x900").split("x").map(Number);
const lang = process.argv[3] || "en";
const tag = `${w}-${lang}`;
const API = "http://localhost:5000";
const b = await launch({ port: Number(process.env.PORT || 9333) });
const S = (js) => b.eval(js);
const results = [];
const check = (name, ok, info = "") => {
  results.push(ok);
  console.log(ok ? "PASS" : "FAIL", name, info);
};
const created = [];

await b.size(w, h, w < 700);
await b.goto(`http://localhost:5173/tuning?lang=${lang}`);
await S("Object.keys(localStorage).filter((k) => k.startsWith('autozone:tuning-setup')).forEach((k) => localStorage.removeItem(k)); true");
await b.goto(`http://localhost:5173/tuning?lang=${lang}`);
await b.waitFor(`document.querySelector(".tz-canvas canvas") && !document.querySelector(".tz-loader")`);
await b.sleep(3000);

// Pearl white paint (paid) and yellow calipers (paid).
await S(`document.querySelector(".tz-section.is-active input[name=paint][value=pearl-white]").click()`);
// The total counts up for half a second.
await b.sleep(1200);
const total = await S(`document.querySelector(".tz-quote__amount")?.textContent`);

// 1. From the price breakdown.
await S(`document.querySelector(".tz-quote__pill").click()`);
await b.sleep(300);
check("the breakdown offers the request", await S(`!!document.querySelector(".tz-quote__request")`));
await S(`document.querySelector(".tz-quote__request").click()`);
await b.waitFor(`document.querySelector(".tz-req") && !document.querySelector(".tz-req.is-loading")`, 60000);
check("the configurator's 3D view is put away", await S(`!document.querySelector(".tz-canvas")`));
check("one WebGL canvas on the page", (await S(`document.querySelectorAll("canvas").length`)) === 1);
await S(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); document.querySelector(".tz-req").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); true`);
await b.sleep(800);
check("Escape closes the scene", await S(`!document.querySelector(".tz-req")`));
await b.waitFor(`!!document.querySelector(".tz-canvas canvas")`, 30000).catch(async (error) => {
  console.log("stage:", await S(`document.querySelector(".tz-stage")?.outerHTML.slice(0, 400)`), "errors:", JSON.stringify(b.errors).slice(0, 800));
  throw error;
});
await b.sleep(1500);
check("back in the workshop, setup kept", (await S(`document.querySelector(".tz-quote__amount")?.textContent`)) === total, total);

// 2. From the Summary, then the form.
await S(`[...document.querySelectorAll(".tz-step")].at(-1).click()`);
await b.sleep(2500);
await S(`document.querySelector(".tz-summary__request-btn").click()`);
await b.waitFor(`!!document.querySelector(".tz-req.is-form")`, 60000);
await b.sleep(1200);
await b.shot(`flow-${tag}-0-form.jpg`);
check("the form names the car and its total", await S(`document.querySelector(".tz-req-car").textContent.includes("Golf GTI") && document.querySelector(".tz-req-car").textContent.includes(${JSON.stringify(total)})`), total);

await S(`document.querySelector(".tz-req-submit").click()`);
await b.sleep(400);
const errors = await S(`[...document.querySelectorAll(".tz-req-field__error")].length`);
check("empty form: name, phone and wilaya errors", errors === 3, String(errors));
check("focus on the first wrong field", await S(`document.activeElement?.autocomplete === "name"`));
await b.shot(`flow-${tag}-1-errors.jpg`);

const type = async (selector, text) => {
  await S(`document.querySelector(${JSON.stringify(selector)}).focus(); true`);
  await b.send("Input.insertText", { text });
};

await type(".tz-req-field input[autocomplete=name]", "Test Visitor");
await type(".tz-req-field input[type=tel]", "123");
await type(".tz-req-field input[type=email]", "not-an-email");
await S(`document.querySelector(".tz-req-submit").click()`);
await b.sleep(300);
check("bad phone and email are explained", (await S(`[...document.querySelectorAll(".tz-req-field__error")].map((x) => x.textContent).join(" | ")`)).split("|").length === 3);

await S(`(() => { const set = (el, v) => { Object.getOwnPropertyDescriptor(el.constructor.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }; set(document.querySelector(".tz-req-field input[type=tel]"), "0550 12 34 56"); set(document.querySelector(".tz-req-field input[type=email]"), "test.visitor@example.com"); const select = document.querySelector(".tz-req-field select"); set(select, select.options[16].value); set(document.querySelector(".tz-req-field textarea"), "TEST request from the automated check, please ignore."); return true; })()`);
await b.sleep(200);
check("no errors once corrected", (await S(`document.querySelectorAll(".tz-req-field__error").length`)) === 0);
await S(`document.querySelector(".tz-req-submit").click()`);
await b.waitFor(`!!document.querySelector(".tz-req-sent")`, 20000);
await b.sleep(900);
await b.shot(`flow-${tag}-2-sent.jpg`);

const reference = await S(`document.querySelector(".tz-req-sent__reference strong").textContent`);
const id = Number(reference.replace(/\D/g, ""));

created.push(id);
check("confirmation with a TZ reference and pending status", /^TZ-\d+$/.test(reference) && (await S(`!!document.querySelector(".tz-req-status")`)), reference);
check("the track link carries the reference", (await S(`document.querySelector(".tz-req-sent a").getAttribute("href")`)) === `/track?id=${reference}`);

// 3. Stored as sent, pending, never approved by itself.
const row = db.prepare("SELECT * FROM tuning_requests WHERE id = ?").get(id);
const configuration = JSON.parse(row.configuration);

check("stored pending", row.status === "pending");
check("stored for the Golf with the applicant", row.vehicle_id === "golf" && row.full_name === "Test Visitor" && row.wilaya.length > 0 && row.email === "test.visitor@example.com");
check("configuration kept (paint pearl white, its price, total)", configuration.setup.paint === "pearl-white" && configuration.lines.some((line) => line.group === "paint" && line.price === 160000) && row.total === 160000, `${row.total}`);

const call = async (path, { method = "GET", body, token } = {}) => {
  const response = await fetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });

  return { status: response.status, data: await response.json().catch(() => ({})) };
};
const tracked = await call("/api/tuning-requests/status", { method: "POST", body: { reference, phone: "0550123456" } });

check("tracking shows pending review", tracked.status === 200 && tracked.data.request.status === "pending");

const admin = db.prepare("SELECT id, role, token_version FROM admins WHERE active = 1 ORDER BY id LIMIT 1").get();
const token = signToken(admin);
const listed = await call("/api/admin/tuning-requests?status=pending", { token });

check("the admin sees it in Pending", listed.data.requests?.some((request) => request.id === id));

const decided = await call(`/api/admin/tuning-requests/${id}/status`, { method: "PATCH", token, body: { status: "approved", note: "TEST" } });
const after = await call("/api/tuning-requests/status", { method: "POST", body: { reference, phone: "0550123456" } });

check("the admin's decision reaches tracking", decided.status === 200 && after.data.request.status === "approved");

// 4. Back to the workshop.
await S(`document.querySelector(".tz-req-sent .tz-req-quiet").click()`);
await b.sleep(800);
check("the scene closes", await S(`!document.querySelector(".tz-req")`));
await b.waitFor(`!!document.querySelector(".tz-canvas canvas")`, 30000);
check("no console errors", b.errors.length === 0, JSON.stringify(b.errors).slice(0, 300));

for (const requestId of created) {
  db.prepare("DELETE FROM notifications WHERE type = 'tuning' AND ref_id = ?").run(requestId);
  db.prepare("DELETE FROM activity_log WHERE target_type = 'tuning' AND target_id = ?").run(requestId);
  db.prepare("DELETE FROM tuning_requests WHERE id = ?").run(requestId);
}

console.log(`${tag}: ${results.filter(Boolean).length}/${results.length} PASS (test requests ${created.join(", ")} deleted)`);
await b.close();
