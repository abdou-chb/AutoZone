// API checks of car requests against the running server (port 5000): node tools/tests/car-requests-api.mjs
// Creates requests marked "TEST", decides on them as an existing admin (token signed in-process, secret never shown),
// and deletes them at the end. The rate-limit check runs last; touch a server file afterwards to reset the limit.
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
const call = async (path, { method = "GET", body, token, language = "en" } = {}) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "Accept-Language": language, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { status: response.status, data: await response.json().catch(() => ({})) };
};

const valid = () => ({
  vehicleId: "golf",
  vehicleName: "Volkswagen Golf GTI",
  configuration: {
    setup: { paint: "pearl-white", rims: "bronze", calipers: "yellow", ambient: "ice" },
    lines: [
      { group: "paint", groupLabel: "Body colour", option: "pearl-white", optionLabel: "Pearl white", price: 160000 },
      { group: "rims", groupLabel: "Wheel finish", option: "bronze", optionLabel: "Bronze", price: 95000 },
      { group: "calipers", groupLabel: "Brake calipers", option: "yellow", optionLabel: "Yellow", price: 28000 },
    ],
    included: [{ group: "ambient", groupLabel: "Ambient light colour", option: "ice", optionLabel: "Ice" }],
    optionsTotal: 283000,
    total: 283000,
    currency: "DZD",
    illustrative: true,
  },
  fullName: "TEST Request Bot",
  phone: "0555 12 34 56",
  email: "test@example.com",
  wilaya: "Alger",
  message: "TEST request, created by tools/tests/car-requests-api.mjs",
  language: "en",
});

const created = [];
const admin = db.prepare("SELECT id, role, token_version FROM admins WHERE active = 1 ORDER BY id LIMIT 1").get();
const token = signToken(admin);

// 1. Validation: each bad field is refused with its name.
const bad = [
  ["vehicleId", (body) => ({ ...body, vehicleId: "ferrari" })],
  ["fullName", (body) => ({ ...body, fullName: "A" })],
  ["fullName", (body) => ({ ...body, fullName: "x".repeat(81) })],
  ["phone", (body) => ({ ...body, phone: "12ab" })],
  ["email", (body) => ({ ...body, email: "not-an-email" })],
  ["wilaya", (body) => ({ ...body, wilaya: "" })],
  ["wilaya", (body) => ({ ...body, wilaya: "w".repeat(61) })],
  ["message", (body) => ({ ...body, message: "m".repeat(1001) })],
  ["configuration", (body) => ({ ...body, configuration: null })],
  ["configuration", (body) => ({ ...body, configuration: { ...body.configuration, setup: { "bad key!": "x" } } })],
  ["configuration", (body) => ({ ...body, configuration: { ...body.configuration, setup: { paint: "<script>" } } })],
  ["configuration", (body) => ({ ...body, configuration: { ...body.configuration, lines: [{ ...body.configuration.lines[0], price: 1.5 }] } })],
  ["configuration", (body) => ({ ...body, configuration: { ...body.configuration, total: 1 } })],
  ["configuration", (body) => ({ ...body, configuration: { ...body.configuration, optionsTotal: 1, total: 1 } })],
];

for (const [field, make] of bad) {
  const { status, data } = await call("/api/tuning-requests", { method: "POST", body: make(valid()) });

  check(`bad ${field} → 400`, status === 400 && data.field === field, `${status} ${data.field} ${data.message}`);
}

const french = await call("/api/tuning-requests", { method: "POST", body: { ...valid(), wilaya: "" }, language: "fr" });
check("errors are translated", french.data.message === "Choisissez votre wilaya.", french.data.message);

// 2. A valid request is saved pending, never approved, and notifies the admins.
const before = db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE type = 'tuning'").get().c;
const first = await call("/api/tuning-requests", { method: "POST", body: { ...valid(), email: "" } });

created.push(first.data.requestId);
check("valid → 201 pending", first.status === 201 && first.data.status === "pending" && first.data.reference === `TZ-${first.data.requestId}`, JSON.stringify(first.data));
const row = db.prepare("SELECT status, total, options_total, configuration FROM tuning_requests WHERE id = ?").get(first.data.requestId);
check("stored pending with its configuration", row?.status === "pending" && row.total === 283000 && JSON.parse(row.configuration).lines.length === 3);
check("admins notified", db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE type = 'tuning'").get().c === before + 1);

// 3. Tracking needs the right phone.
const tracked = await call("/api/tuning-requests/status", { method: "POST", body: { reference: first.data.reference, phone: "0555123456" } });
check("status with the right phone", tracked.status === 200 && tracked.data.request.status === "pending" && tracked.data.request.phone === undefined, JSON.stringify(tracked.data.request));
const wrong = await call("/api/tuning-requests/status", { method: "POST", body: { reference: first.data.reference, phone: "0666000000" } });
check("status with a wrong phone → 404", wrong.status === 404);

// 4. Admin review.
const anonymous = await call("/api/admin/tuning-requests");
check("admin list needs a login", anonymous.status === 401);
const list = await call("/api/admin/tuning-requests?status=pending", { token });
check("admin list", list.status === 200 && list.data.requests.some((item) => item.id === first.data.requestId) && list.data.counts.pending >= 1);
const detail = await call(`/api/admin/tuning-requests/${first.data.requestId}`, { token });
check("admin detail parses the configuration", detail.data.request?.configuration?.lines?.[1]?.optionLabel === "Bronze");
const summary = await call("/api/admin/notifications/summary", { token });
check("pending count in the admin summary", summary.data.counts?.carRequests >= 1, JSON.stringify(summary.data.counts));
const approved = await call(`/api/admin/tuning-requests/${first.data.requestId}/status`, { method: "PATCH", token, body: { status: "approved", note: "TEST approved" } });
check("approve", approved.status === 200 && approved.data.request.status === "approved" && approved.data.request.reviewed_at);
const again = await call(`/api/admin/tuning-requests/${first.data.requestId}/status`, { method: "PATCH", token, body: { status: "rejected" } });
check("a second decision is refused", again.status === 409, String(again.status));
const second = await call("/api/tuning-requests", { method: "POST", body: valid() });
created.push(second.data.requestId);
const odd = await call(`/api/admin/tuning-requests/${second.data.requestId}/status`, { method: "PATCH", token, body: { status: "pending" } });
check("unknown decision → 400", odd.status === 400);
const rejected = await call(`/api/admin/tuning-requests/${second.data.requestId}/status`, { method: "PATCH", token, body: { status: "rejected", note: "TEST rejected" } });
check("reject", rejected.status === 200 && rejected.data.request.status === "rejected");
const seen = await call("/api/tuning-requests/status", { method: "POST", body: { reference: String(second.data.requestId), phone: "+213 555 12 34 56".replace("+213 ", "0") } });
check("tracking shows the decision and its note", seen.data.request?.status === "rejected" && seen.data.request.decision_note === "TEST rejected");
check("activity logged", db.prepare("SELECT COUNT(*) AS c FROM activity_log WHERE target_type = 'tuning' AND target_id IN (?, ?)").get(...created).c === 2);

// 5. Rate limit: five saved requests per address in ten minutes.
let limited = null;

for (let index = 0; index < 6 && !limited; index += 1) {
  const response = await call("/api/tuning-requests", { method: "POST", body: valid() });

  if (response.status === 201) created.push(response.data.requestId);
  if (response.status === 429) limited = response;
}

check("rate limit → 429", Boolean(limited), limited?.data.message);

// Clean up the test rows and what they left.
const ids = created.filter(Boolean);
const marks = ids.map(() => "?").join(",");

db.prepare(`DELETE FROM notifications WHERE type = 'tuning' AND ref_id IN (${marks})`).run(...ids);
db.prepare(`DELETE FROM activity_log WHERE target_type = 'tuning' AND target_id IN (${marks})`).run(...ids);
db.prepare(`DELETE FROM tuning_requests WHERE id IN (${marks})`).run(...ids);

// With no request left, numbering starts again at TZ-1.
if (db.prepare("SELECT COUNT(*) AS c FROM tuning_requests").get().c === 0) {
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'tuning_requests'").run();
}
console.log("deleted test requests", ids.join(", "));
console.log(`${results.filter(Boolean).length}/${results.length} PASS`);
