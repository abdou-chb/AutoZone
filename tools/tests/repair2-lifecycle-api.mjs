// Phase 2 repair lifecycle against the running server (5000): submit → accept → quote (server recomputes; tampered
// total ignored) → schedule → send → customer accepts → garage stages → completed, plus reject, clarification, and the
// guards (wrong phone, decide when not awaiting, bad transitions, auth). Signs an admin token in-process; deletes its
// test rows. Run: node tools/tests/repair2-lifecycle-api.mjs
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
const admin = db.prepare("SELECT id, role, token_version FROM admins WHERE active = 1 ORDER BY id LIMIT 1").get();
const token = signToken(admin);
const created = [];
const auth = true;

const basePayload = (over = {}) => ({
  demoVehicleId: "golf",
  vehicle: { usesDemoModel: true, make: "Volkswagen", model: "Golf GTI", year: 2022, engine: "2.0 TSI", mileage: 48000, registration: "", notes: "" },
  problems: [{ category: "brakes", area: "wheel-fl", description: "Squeal when braking", symptoms: "", started: "weeks", startedNote: "", severity: "high", notes: "" }],
  customer: { fullName: "TEST Phase2", phone: "0555 99 88 77", email: "", preferredContact: "phone", preferredDate: "", preferredTime: "", comments: "" },
  language: "en",
  ...over,
});
const PHONE = "0555998877";

async function submit(over) {
  const body = new FormData();
  body.append("payload", JSON.stringify(basePayload(over)));
  const res = await fetch(`${API}/api/repair-requests`, { method: "POST", body });
  const data = await res.json();

  if (!data.requestId) {
    throw new Error(`submit failed (${res.status}): ${JSON.stringify(data)} — if 429, the repair rate limit is exhausted; restart the API or run this suite first.`);
  }

  created.push(data.requestId);
  return data;
}
const call = async (path, { method = "GET", body, auth } = {}) => {
  const res = await fetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const adminId = (ref) => Number(ref.replace(/\D/g, ""));

// ---- Happy path ----
const a = await submit();
const id = adminId(a.reference);

check("auth required for admin endpoints", (await call(`/api/admin/repair-requests/${id}/review`, { method: "PATCH", body: { action: "accept" } })).status === 401);

check("accept → under_review", (await call(`/api/admin/repair-requests/${id}/review`, { method: "PATCH", auth, body: { action: "accept" } })).data.request.status === "under_review");

// Quote: server computes amounts, subtotal, tax; a tampered total is ignored.
const quote = await call(`/api/admin/repair-requests/${id}/quotation`, {
  method: "PUT",
  auth,
  body: {
    taxRate: 19,
    total: 1,
    subtotal: 1,
    lines: [
      { label: "Diagnostic", kind: "diagnostic", qty: 1, unitPrice: 2000, amount: 999 },
      { label: "Brake pads", kind: "parts", qty: 2, unitPrice: 4500 },
      { label: "Labour", kind: "labor", qty: 3, unitPrice: 1500 },
    ],
  },
});
const q = quote.data.request.quotation;
const subtotal = 2000 + 2 * 4500 + 3 * 1500; // 15500
check("line amount = qty×unitPrice", q.lines[0].amount === 2000 && q.lines[1].amount === 9000 && q.lines[2].amount === 4500);
check("server recomputes subtotal/tax/total; tampered total ignored", q.subtotal === subtotal && q.tax === Math.round(subtotal * 0.19) && q.total === subtotal + Math.round(subtotal * 0.19), JSON.stringify({ subtotal: q.subtotal, tax: q.tax, total: q.total }));
check("bad line (unitPrice negative) → 400 field=lines", (await call(`/api/admin/repair-requests/${id}/quotation`, { method: "PUT", auth, body: { taxRate: 0, lines: [{ label: "X", kind: "parts", qty: 1, unitPrice: -1 }] } })).data.field === "lines");

check("schedule saved", (await call(`/api/admin/repair-requests/${id}/schedule`, { method: "PUT", auth, body: { arrivalDate: "2026-12-10", arrivalTime: "09:30", startDate: "2026-12-10", durationDays: 2, completionDate: "2026-12-12", instructions: "Bring the key." } })).status === 200);
check("completion before arrival → 400", (await call(`/api/admin/repair-requests/${id}/schedule`, { method: "PUT", auth, body: { arrivalDate: "2026-12-10", completionDate: "2026-12-01" } })).data.field === "completionDate");

// Can't decide before it's sent.
check("decide before sent → 409", (await call("/api/repair-requests/decision", { method: "POST", body: { reference: a.reference, phone: PHONE, decision: "accepted" } })).status === 409);

check("send → awaiting_customer", (await call(`/api/admin/repair-requests/${id}/send`, { method: "POST", auth, body: { canRepair: true, message: "Here is our quote." } })).data.request.status === "awaiting_customer");

// Customer view shows the quote and canDecide.
const view = (await call("/api/repair-requests/status", { method: "POST", body: { reference: a.reference, phone: PHONE } })).data.request;
check("status endpoint exposes quote + schedule + canDecide, no phone", view.canDecide === true && view.quotation.total === q.total && view.schedule.durationDays === 2 && view.phone === undefined && view.response.canRepair === true);
check("decide with wrong phone → 404", (await call("/api/repair-requests/decision", { method: "POST", body: { reference: a.reference, phone: "0000000000", decision: "accepted" } })).status === 404);

check("customer accepts → accepted", (await call("/api/repair-requests/decision", { method: "POST", body: { reference: a.reference, phone: PHONE, decision: "accepted" } })).data.request.status === "accepted");

// Garage stages, in order only.
check("received before scheduled → 409", (await call(`/api/admin/repair-requests/${id}/status`, { method: "PATCH", auth, body: { status: "received" } })).status === 409);
for (const [status] of [["scheduled"], ["received"], ["in_progress"], ["completed"]]) {
  check(`stage → ${status}`, (await call(`/api/admin/repair-requests/${id}/status`, { method: "PATCH", auth, body: { status } })).data.request.status === status);
}
const events = (await call(`/api/admin/repair-requests/${id}`, { auth })).data.request.events.map((e) => e.status);
check("events recorded through the lifecycle", events.includes("submitted") && events.includes("awaiting_customer") && events.includes("accepted") && events.includes("completed"), events.join(","));

// ---- Reject path ----
const b = await submit();
const bid = adminId(b.reference);
check("reject needs a reason", (await call(`/api/admin/repair-requests/${bid}/review`, { method: "PATCH", auth, body: { action: "reject" } })).data.field === "note");
check("reject → rejected with reason", (await call(`/api/admin/repair-requests/${bid}/review`, { method: "PATCH", auth, body: { action: "reject", note: "Out of our scope" } })).data.request.status === "rejected");

// ---- Clarification path ----
const c = await submit();
const cid = adminId(c.reference);
await call(`/api/admin/repair-requests/${cid}/review`, { method: "PATCH", auth, body: { action: "accept" } });
await call(`/api/admin/repair-requests/${cid}/quotation`, { method: "PUT", auth, body: { taxRate: 0, lines: [{ label: "Check", kind: "diagnostic", qty: 1, unitPrice: 2000 }] } });
await call(`/api/admin/repair-requests/${cid}/send`, { method: "POST", auth, body: { canRepair: true, message: "Quote" } });
const clar = await call("/api/repair-requests/decision", { method: "POST", body: { reference: c.reference, phone: PHONE, decision: "clarification", note: "Can you itemise the parts?" } });
check("clarification → info_required, note stored", clar.data.request.status === "info_required" && clar.data.request.customerDecision.value === "clarification");
check("info_request surfaced after customer clarification is admin's info note only", typeof clar.data.request.info_request === "string");

// Cleanup
for (const requestId of created) {
  const row = db.prepare("SELECT attachments FROM repair_requests WHERE id = ?").get(requestId);
  JSON.parse(row?.attachments || "[]").forEach((p) => { try { require("node:fs").unlinkSync(join(serverDir, p)); } catch {} });
  db.prepare("DELETE FROM repair_events WHERE request_id = ?").run(requestId);
  db.prepare("DELETE FROM notifications WHERE type = 'repair' AND ref_id = ?").run(requestId);
  db.prepare("DELETE FROM activity_log WHERE target_type = 'repair' AND target_id = ?").run(requestId);
  db.prepare("DELETE FROM repair_requests WHERE id = ?").run(requestId);
}
if (!db.prepare("SELECT 1 FROM repair_requests LIMIT 1").get()) db.prepare("DELETE FROM sqlite_sequence WHERE name = 'repair_requests'").run();

console.log(`\n${results.filter(Boolean).length}/${results.length} PASS (deleted ${created.join(", ")})`);
process.exit(results.every(Boolean) ? 0 : 1);
