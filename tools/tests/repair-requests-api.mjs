// API checks of repair requests against the running server (port 5000): node tools/tests/repair-requests-api.mjs
// Creates TEST requests (admin token signed in-process, secret never shown) and deletes them at the end. The
// rate-limit check runs last; touch a server file afterwards to reset the limit.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const serverDir = join(dirname(fileURLToPath(import.meta.url)), "../../server");
require(join(serverDir, "node_modules/dotenv")).config({ path: join(serverDir, ".env"), quiet: true });
const db = require(join(serverDir, "database.js"));
const { signToken } = require(join(serverDir, "auth.js"));

const API = process.env.API || "http://localhost:5000";
const results = [];
const check = (name, ok, info = "") => {
  results.push(ok);
  console.log(ok ? "PASS" : "FAIL", name, info);
};

// A 1x1 PNG.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

const payload = (over = {}) => ({
  demoVehicleId: "golf",
  vehicle: { usesDemoModel: true, make: "Volkswagen", model: "Golf GTI", year: 2022, engine: "2.0 TSI", mileage: 48000, registration: "12345-116-16", notes: "" },
  problems: [
    { category: "brakes", area: "wheel-fl", description: "Squealing when braking", symptoms: "A high squeal at low speed", started: "weeks", startedNote: "", severity: "high", notes: "" },
    { category: "ac", area: "", description: "Air conditioning blows warm", symptoms: "", started: "months", startedNote: "", severity: "medium", notes: "" },
  ],
  customer: { fullName: "TEST Repair Bot", phone: "0555 12 34 56", email: "test@example.com", preferredContact: "whatsapp", preferredDate: "", preferredTime: "", comments: "TEST request from repair-requests-api.mjs" },
  language: "en",
  ...over,
});

const form = (data, { images = 2 } = {}) => {
  const body = new FormData();
  body.append("payload", JSON.stringify(data));
  for (let i = 0; i < images; i += 1) body.append("images", new Blob([PNG], { type: "image/png" }), `test-${i}.png`);
  return body;
};

const submit = async (data, options, language = "en") => {
  const response = await fetch(`${API}/api/repair-requests`, { method: "POST", headers: { "Accept-Language": language }, body: form(data, options) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};
const call = async (path, { method = "GET", body, token, language = "en" } = {}) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "Accept-Language": language, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};

const created = [];
const admin = db.prepare("SELECT id, role, token_version FROM admins WHERE active = 1 ORDER BY id LIMIT 1").get();
const token = signToken(admin);

// 1. Validation: each bad field is refused with its own name.
const bad = [
  ["make", (p) => ({ ...p, vehicle: { ...p.vehicle, make: "V" } })],
  ["model", (p) => ({ ...p, vehicle: { ...p.vehicle, model: "" } })],
  ["year", (p) => ({ ...p, vehicle: { ...p.vehicle, year: 1800 } })],
  ["mileage", (p) => ({ ...p, vehicle: { ...p.vehicle, mileage: -5 } })],
  ["problems", (p) => ({ ...p, problems: [] })],
  ["problems", (p) => ({ ...p, problems: [{ ...p.problems[0], category: "teleportation" }] })],
  ["problems", (p) => ({ ...p, problems: [{ ...p.problems[0], description: "" }] })],
  ["problems", (p) => ({ ...p, problems: [{ ...p.problems[0], severity: "apocalyptic" }] })],
  ["fullName", (p) => ({ ...p, customer: { ...p.customer, fullName: "X" } })],
  ["phone", (p) => ({ ...p, customer: { ...p.customer, phone: "12" } })],
  ["email", (p) => ({ ...p, customer: { ...p.customer, email: "not-an-email" } })],
  ["preferredContact", (p) => ({ ...p, customer: { ...p.customer, preferredContact: "carrier-pigeon" } })],
  ["preferredDate", (p) => ({ ...p, customer: { ...p.customer, preferredDate: "2000-01-01" } })],
];

for (const [field, make] of bad) {
  const res = await submit(make(payload()), { images: 0 });
  check(`bad ${field} → 400 field=${field}`, res.status === 400 && res.data.field === field, `${res.status} ${res.data.field} ${res.data.message}`);
}

// Too many images.
const many = await submit(payload(), { images: 7 });
check("more than 6 images → 400 field=images", many.status === 400 && many.data.field === "images", `${many.status} ${many.data.field}`);

// A non-image file.
const badFile = new FormData();
badFile.append("payload", JSON.stringify(payload()));
badFile.append("images", new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" }), "x.pdf");
const pdf = await fetch(`${API}/api/repair-requests`, { method: "POST", body: badFile }).then((r) => r.json().catch(() => ({})));
check("a non-image file is refused with field=images", pdf.field === "images", JSON.stringify(pdf).slice(0, 120));

// Translated error (fr).
const frError = await submit(payload({ customer: { ...payload().customer, phone: "1" } }), { images: 0 }, "fr");
check("errors are translated (fr)", frError.status === 400 && /valide/.test(frError.data.message), frError.data.message);

// 2. A valid submission with 2 images → submitted, images stored, notification.
const ok = await submit(payload());
check("valid submit → 201 submitted with RP reference", ok.status === 201 && ok.data.status === "submitted" && /^RP-\d+$/.test(ok.data.reference), JSON.stringify(ok.data).slice(0, 120));
const id = ok.data.requestId;
created.push(id);
const stored = db.prepare("SELECT * FROM repair_requests WHERE id = ?").get(id);
const attachments = JSON.parse(stored.attachments);
check("stored submitted, 2 images, 2 problems", stored.status === "submitted" && attachments.length === 2 && JSON.parse(stored.problems).length === 2);
check("the notification was created", Boolean(db.prepare("SELECT 1 FROM notifications WHERE type = 'repair' AND ref_id = ?").get(id)));

// 3. Status lookup with the right and wrong phone.
const right = await call("/api/repair-requests/status", { method: "POST", body: { reference: ok.data.reference, phone: "0555123456" } });
check("status with right phone → submitted, no price fields", right.status === 200 && right.data.request.status === "submitted" && right.data.request.total === undefined && right.data.request.problem_count === 2);
const wrong = await call("/api/repair-requests/status", { method: "POST", body: { reference: ok.data.reference, phone: "0000000000" } });
check("status with wrong phone → 404", wrong.status === 404);
const lower = await call("/api/repair-requests/status", { method: "POST", body: { reference: `rp${id}`, phone: "0555123456" } });
check("status accepts a lowercase reference", lower.status === 200);

// 4. Admin list and detail (read only; no decision endpoint).
const list = await call("/api/admin/repair-requests?status=submitted", { token });
check("admin list includes it with a problem count", list.data.requests?.some((r) => r.id === id && r.problem_count === 2));
const detail = await call(`/api/admin/repair-requests/${id}`, { token });
check("admin detail has the parsed problems and image URLs", Array.isArray(detail.data.request?.problems) && detail.data.request.attachments[0].startsWith("/uploads/"));
const summary = await call("/api/admin/notifications/summary", { token });
check("the notification summary counts it", summary.data.counts.repairRequests >= 1);
const badStatus = await call(`/api/admin/repair-requests/${id}/status`, { method: "PATCH", token, body: { status: "approved" } });
check("the status endpoint rejects an unknown status", badStatus.status === 400);
const noAuth = await call("/api/admin/repair-requests");
check("admin list needs a token", noAuth.status === 401);

// 5. Rate limit (this IP already has 1 success; 4 more valid, the 6th in the window is 429).
let limited = false;
for (let i = 0; i < 6; i += 1) {
  const res = await submit(payload());
  if (res.status === 201) created.push(res.data.requestId);
  if (res.status === 429) {
    limited = true;
    break;
  }
}
check("rate limit returns 429 after several in the window", limited);

// Clean up.
for (const requestId of created) {
  const row = db.prepare("SELECT attachments FROM repair_requests WHERE id = ?").get(requestId);
  JSON.parse(row?.attachments || "[]").forEach((path) => {
    try {
      require("node:fs").unlinkSync(join(serverDir, path));
    } catch {
      // already gone
    }
  });
  db.prepare("DELETE FROM notifications WHERE type = 'repair' AND ref_id = ?").run(requestId);
  db.prepare("DELETE FROM repair_requests WHERE id = ?").run(requestId);
}
if (!db.prepare("SELECT 1 FROM repair_requests LIMIT 1").get()) {
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'repair_requests'").run();
}

console.log(`\n${results.filter(Boolean).length}/${results.length} PASS (deleted test requests ${created.join(", ")})`);
process.exit(results.every(Boolean) ? 0 : 1);
