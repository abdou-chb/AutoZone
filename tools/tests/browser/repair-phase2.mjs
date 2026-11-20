// Phase 2 end to end: create a repair request, drive the admin (accept, quote with server-recomputed totals,
// schedule, send) by signed token, then on the customer Track page see the quote + schedule + timeline and ACCEPT,
// and walk the repair stages to completed. Deletes its test row. Needs dev servers on 5173 + 5000.
//   node tools/tests/browser/repair-phase2.mjs 1440x900 en
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
const API = "http://localhost:5000";
const admin = db.prepare("SELECT id, role, token_version FROM admins WHERE active = 1 ORDER BY id LIMIT 1").get();
const token = signToken(admin);
const results = [];
const check = (n, ok, info = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", n, info); };
const call = async (path, { method = "GET", body, auth = false } = {}) => {
  const res = await fetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const PHONE = "0551 90 90 90";
const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
let id = null;

// 1. Create a repair request (multipart, no image)
const form = new FormData();
form.append("payload", JSON.stringify({
  demoVehicleId: "golf",
  vehicle: { usesDemoModel: true, make: "Volkswagen", model: "Golf GTI", year: "2021", engine: "2.0 TSI", mileage: "60000", registration: "", notes: "" },
  problems: [{ category: "brakes", area: "front-wheel", description: "Squealing when braking.", symptoms: "", started: "weeks", startedNote: "", severity: "high", notes: "" }],
  customer: { fullName: "Phase2 Tester", phone: PHONE, email: "", preferredContact: "phone", preferredDate: "", preferredTime: "", comments: "" },
  language: lang,
}));
const created = await (await fetch(`${API}/api/repair-requests`, { method: "POST", body: form })).json();
const reference = created.reference;
id = created.requestId;
check("request created, submitted", created.status === "submitted" && /^RP-\d+$/.test(reference || ""), reference);

// 2. Admin: accept -> quote (tampered totals must be ignored) -> schedule -> send
const accepted = await call(`/api/admin/repair-requests/${id}/review`, { method: "PATCH", auth: true, body: { action: "accept", note: "" } });
check("admin accept", accepted.status === 200);
const quote = await call(`/api/admin/repair-requests/${id}/quotation`, { method: "PUT", auth: true, body: {
  taxRate: 19,
  lines: [
    { label: "Brake pads", kind: "parts", qty: 1, unitPrice: 50000, amount: 999, _bogus: true },
    { label: "Labour", kind: "labor", qty: 2, unitPrice: 30000 },
  ],
  subtotal: 1, tax: 1, total: 1,
} });
const q = quote.data.quotation || quote.data.request?.quotation;
check("server recomputed the quote (ignored tampering)", q && q.subtotal === 110000 && q.tax === Math.round(110000 * 0.19) && q.total === 110000 + Math.round(110000 * 0.19), JSON.stringify(q && { s: q.subtotal, t: q.tax, g: q.total }));
check("line amount = qty*unitPrice", q && q.lines[0].amount === 50000 && q.lines[1].amount === 60000);
const sched = await call(`/api/admin/repair-requests/${id}/schedule`, { method: "PUT", auth: true, body: { arrivalDate: future(7), arrivalTime: "09:30", startDate: future(7), durationDays: 3, completionDate: future(10), instructions: "Bring the registration." } });
check("admin schedule", sched.status === 200);
const sent = await call(`/api/admin/repair-requests/${id}/send`, { method: "POST", auth: true, body: { canRepair: true, message: "We can fix this." } });
check("admin send -> awaiting customer", sent.status === 200);

// 3. Status endpoint now exposes quote + schedule + canDecide
const status1 = await call("/api/repair-requests/status", { method: "POST", body: { reference, phone: PHONE } });
const r1 = status1.data.request;
check("status shows awaiting_customer + canDecide", r1?.status === "awaiting_customer" && r1?.canDecide === true);
check("status carries the quote total + schedule", r1?.quotation?.total === q.total && Boolean(r1?.schedule?.arrivalDate));

// 4. Customer accepts on the Track page
const b = await launch({ port: Number(process.env.PORT || 9333) });
const S = (js) => b.eval(js);
await b.size(w, h, w < 700);
await b.goto(`http://localhost:5173/track?id=${reference}&lang=${lang}`);
await b.waitFor(`!!document.querySelector("input[name=phone]")`, 30000);
await S(`(() => { const p = document.querySelector("input[name=phone]"); Object.getOwnPropertyDescriptor(p.constructor.prototype, "value").set.call(p, ${JSON.stringify(PHONE)}); p.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
await S(`document.querySelector(".track-form__submit").click()`);
await b.waitFor(`!!document.querySelector(".track-decide")`, 20000);
await b.sleep(500);
await b.shot(`repair2-${w}-${lang}-quote.jpg`);
const total = String(q.total);
check("quote total shown on the track page", (await S(`document.querySelector(".track-quote").textContent.replace(/\\s/g, "")`)).includes(total), total);
check("timeline + schedule shown", await S(`!!document.querySelector(".track-steps") && !!document.querySelector(".track-appointment")`));
await S(`[...document.querySelectorAll(".track-decide__actions .btn")].find((x) => x.className.includes("primary")).click()`);
await b.waitFor(`!document.querySelector(".track-decide")`, 15000);
await b.sleep(500);
await b.shot(`repair2-${w}-${lang}-accepted.jpg`);
check("accepted state shown, decision controls gone", await S(`document.body.textContent.includes("${lang === "ar" ? "مقبول" : lang === "fr" ? "accept" : "accept"}".toLowerCase()) || !document.querySelector(".track-decide")`));
check("no console errors", b.errors.length === 0, JSON.stringify(b.errors).slice(0, 300));

// 5. Server has the acceptance; admin walks the stages to completed
const after = await call("/api/repair-requests/status", { method: "POST", body: { reference, phone: PHONE } });
check("server recorded the acceptance", after.data.request?.status === "accepted" && after.data.request?.customerDecision?.value === "accepted");
for (const st of ["scheduled", "received", "in_progress", "completed"]) {
  const step = await call(`/api/admin/repair-requests/${id}/status`, { method: "PATCH", auth: true, body: { status: st, note: "" } });
  if (step.status !== 200) check(`advance to ${st}`, false, JSON.stringify(step.data).slice(0, 120));
}
const done = await call("/api/repair-requests/status", { method: "POST", body: { reference, phone: PHONE } });
check("reaches completed", done.data.request?.status === "completed");

// Cleanup
db.prepare("DELETE FROM repair_events WHERE request_id = ?").run(id);
db.prepare("DELETE FROM notifications WHERE type = 'repair' AND ref_id = ?").run(id);
db.prepare("DELETE FROM repair_requests WHERE id = ?").run(id);

console.log(`${w}-${lang}: ${results.filter(Boolean).length}/${results.length} PASS (test ${reference} deleted)`);
await b.close();
