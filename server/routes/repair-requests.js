const express = require("express");
const db = require("../database");
const { requireAdmin } = require("../admin-middleware");
const { notify, logActivity } = require("../activity");
const { imageUpload, looksLikeImage, publicPath, removeFiles, removeUpload, uploadErrorMessage } = require("../uploads");

// Repair requests: a visitor reports problems on their vehicle from the 3D Zone (Phase 1); the garage then prices,
// schedules and answers, and the customer accepts or declines (Phase 2). Money is always computed on the server.
const DEMO_VEHICLES = ["golf", "rs6", "m3", "tiguan", "c63", "supra"];
const CATEGORIES = ["engine", "transmission", "brakes", "suspension", "electrical", "ac", "bodywork", "tires", "interior", "other"];
const SEVERITIES = ["low", "medium", "high", "urgent"];
const STARTED = ["today", "days", "weeks", "months", "long", ""];
const CONTACTS = ["phone", "whatsapp", "email"];
const LANGUAGES = ["en", "fr", "ar"];
// The repair lifecycle. "awaiting_customer" is where the quote is in the customer's hands.
const STATUSES = ["submitted", "under_review", "info_required", "awaiting_customer", "accepted", "declined", "scheduled", "received", "in_progress", "completed", "rejected", "cancelled"];
const KINDS = ["diagnostic", "parts", "labor", "service"];
const CANCELLABLE = ["submitted", "under_review", "info_required", "awaiting_customer", "accepted", "scheduled", "received", "in_progress"];
// Admin repair stages after the customer has accepted: each step only from the one before it.
const STAGE_FROM = { scheduled: "accepted", received: "scheduled", in_progress: "received", completed: "in_progress" };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AREA_PATTERN = /^[a-z0-9-]{0,40}$/;
const MAX_IMAGES = 6;
const MAX_PROBLEMS = 10;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map();

const normalizePhone = (phone) => String(phone || "").replace(/[\s.()-]/g, "");
const isValidPhone = (phone) => /^\+?\d{9,15}$/.test(normalizePhone(phone));
const text = (value) => (typeof value === "string" ? value.trim() : "");
const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const reference = (id) => `RP-${id}`;

class Invalid extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

const bounded = (value, max, field, message) => {
  const string = text(value);

  if (string.length > max) {
    throw new Invalid(message, field);
  }

  return string;
};

// An optional whole number in a range, or null. Rejects a value that is present but not a clean integer.
function optionalInt(value, min, max, field, message) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Invalid(message, field);
  }

  return number;
}

function cleanProblem(problem) {
  if (!isPlainObject(problem) || !CATEGORIES.includes(problem.category)) {
    throw new Invalid("Choose a problem area for each item.", "problems");
  }

  const description = text(problem.description);

  if (description.length < 1 || description.length > 1000) {
    throw new Invalid("Describe each problem (up to 1000 characters).", "problems");
  }

  const area = text(problem.area);

  if (!AREA_PATTERN.test(area)) {
    throw new Invalid("The selected area is not valid.", "problems");
  }

  if (!SEVERITIES.includes(problem.severity) || !STARTED.includes(problem.started ?? "")) {
    throw new Invalid("Choose how urgent each problem is.", "problems");
  }

  return {
    category: problem.category,
    area,
    description,
    symptoms: bounded(problem.symptoms, 1000, "problems", "Keep each description to 1000 characters or fewer."),
    started: problem.started ?? "",
    startedNote: bounded(problem.startedNote, 80, "problems", "Keep the timing note short."),
    severity: problem.severity,
    notes: bounded(problem.notes, 1000, "problems", "Keep each note to 1000 characters or fewer."),
  };
}

function cleanPayload(raw) {
  let body;

  try {
    body = JSON.parse(raw);
  } catch {
    throw new Invalid("Please complete all required fields.");
  }

  if (!isPlainObject(body)) {
    throw new Invalid("Please complete all required fields.");
  }

  const vehicle = isPlainObject(body.vehicle) ? body.vehicle : {};
  const customer = isPlainObject(body.customer) ? body.customer : {};
  const make = text(vehicle.make);
  const model = text(vehicle.model);

  if (make.length < 2 || make.length > 60) {
    throw new Invalid("Enter the vehicle make.", "make");
  }

  if (model.length < 2 || model.length > 60) {
    throw new Invalid("Enter the vehicle model.", "model");
  }

  const nextYear = new Date().getFullYear() + 1;
  const year = optionalInt(vehicle.year, 1950, nextYear, "year", "Enter a valid year.");
  const mileage = optionalInt(vehicle.mileage, 0, 2000000, "mileage", "Enter a valid mileage.");

  const problems = Array.isArray(body.problems) ? body.problems : [];

  if (problems.length < 1 || problems.length > MAX_PROBLEMS) {
    throw new Invalid("Report at least one problem.", "problems");
  }

  const fullName = text(customer.fullName);

  if (fullName.length < 2 || fullName.length > 80) {
    throw new Invalid("Enter your full name (2 to 80 characters).", "fullName");
  }

  const phone = text(customer.phone);

  if (!isValidPhone(phone)) {
    throw new Invalid("Please enter a valid phone number.", "phone");
  }

  const email = text(customer.email);

  if (email && (email.length > 120 || !EMAIL_PATTERN.test(email))) {
    throw new Invalid("Enter a valid email address.", "email");
  }

  if (!CONTACTS.includes(customer.preferredContact ?? "phone")) {
    throw new Invalid("Choose how we should contact you.", "preferredContact");
  }

  const preferredDate = text(customer.preferredDate);

  if (preferredDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || Number.isNaN(Date.parse(preferredDate))) {
      throw new Invalid("Choose a valid date.", "preferredDate");
    }

    if (preferredDate < new Date().toISOString().slice(0, 10)) {
      throw new Invalid("The preferred date cannot be in the past.", "preferredDate");
    }
  }

  const preferredTime = text(customer.preferredTime);

  if (preferredTime && !/^\d{2}:\d{2}$/.test(preferredTime)) {
    throw new Invalid("Choose a valid time.", "preferredDate");
  }

  return {
    demoVehicleId: DEMO_VEHICLES.includes(body.demoVehicleId) ? body.demoVehicleId : "golf",
    usesDemoModel: vehicle.usesDemoModel === false ? 0 : 1,
    make,
    model,
    year,
    engine: bounded(vehicle.engine, 60, "engine", "Keep the engine field short."),
    mileage,
    registration: bounded(vehicle.registration, 20, "registration", "Keep the registration short."),
    vehicleNotes: bounded(vehicle.notes, 1000, "notes", "Keep the vehicle notes to 1000 characters or fewer."),
    problems: problems.map(cleanProblem),
    fullName,
    phone,
    email,
    preferredContact: customer.preferredContact ?? "phone",
    preferredDate,
    preferredTime,
    comments: bounded(customer.comments, 1000, "comments", "Keep your comments to 1000 characters or fewer."),
    language: LANGUAGES.includes(body.language) ? body.language : "en",
  };
}

const parseJson = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toId = (value) => {
  const id = Number(String(value ?? "").trim().replace(/^RP-?/i, ""));

  return Number.isInteger(id) && id > 0 ? id : null;
};

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

// A quotation computed entirely on the server: line amounts, the subtotal, the tax and the total. Any total the client
// sends is ignored. Returns the stored shape, or throws Invalid.
function buildQuotation(raw) {
  const lines = Array.isArray(raw?.lines) ? raw.lines : [];

  if (lines.length < 1 || lines.length > 30) {
    throw new Invalid("A quotation needs between 1 and 30 lines.", "lines");
  }

  const taxRate = Number(raw?.taxRate ?? 0);

  if (!Number.isInteger(taxRate) || taxRate < 0 || taxRate > 100) {
    throw new Invalid("The tax rate must be a whole percentage from 0 to 100.", "taxRate");
  }

  const clean = lines.map((line) => {
    const label = text(line?.label);
    const qty = Number(line?.qty);
    const unitPrice = Number(line?.unitPrice);

    if (label.length < 1 || label.length > 80) {
      throw new Invalid("Each line needs a short label.", "lines");
    }

    if (!KINDS.includes(line?.kind)) {
      throw new Invalid("Choose a type for each line.", "lines");
    }

    if (!Number.isInteger(qty) || qty < 0 || qty > 999 || !Number.isInteger(unitPrice) || unitPrice < 0 || unitPrice > 100000000) {
      throw new Invalid("Check the quantity and unit price on each line.", "lines");
    }

    return { label, kind: line.kind, qty, unitPrice, amount: qty * unitPrice };
  });
  const subtotal = clean.reduce((sum, line) => sum + line.amount, 0);
  const tax = Math.round((subtotal * taxRate) / 100);

  return { currency: "DZD", taxRate, lines: clean, subtotal, tax, total: subtotal + tax };
}

const recordEvent = db.prepare("INSERT INTO repair_events (request_id, type, status, note, actor) VALUES (?, ?, ?, ?, ?)");
const event = (id, type, status = "", note = "", actor = "system") => recordEvent.run(id, type, status, note, actor);

const setStatus = db.prepare("UPDATE repair_requests SET status = ? WHERE id = ?");

// The latest note the garage asked the customer for more information with.
const lastInfoNote = (id) => db.prepare("SELECT note FROM repair_events WHERE request_id = ? AND type = 'info_required' ORDER BY id DESC LIMIT 1").get(id)?.note || "";

// The customer-facing view of a request: its state, the quote and schedule once sent, the garage's answer, the
// customer's own decision, and the history. No admin-only fields (no phone, no reviewer).
function publicRequest(row) {
  // A quote and schedule are drafts until the garage sends its response; the customer only sees them from then on.
  const sent = Boolean(row.quoted_at);
  const quotation = parseJson(row.quotation, null);
  const schedule = parseJson(row.schedule, null);
  const events = db
    .prepare("SELECT type, status, note, actor, created_at AS at FROM repair_events WHERE request_id = ? ORDER BY id ASC")
    .all(row.id);

  return {
    reference: reference(row.id),
    demo_vehicle_id: row.demo_vehicle_id,
    uses_demo_model: row.uses_demo_model,
    vehicle_make: row.vehicle_make,
    vehicle_model: row.vehicle_model,
    vehicle_year: row.vehicle_year,
    problem_count: parseJson(row.problems, []).length,
    status: row.status,
    reject_reason: row.reject_reason || "",
    info_request: row.status === "info_required" ? lastInfoNote(row.id) : "",
    quotation: sent && quotation && quotation.lines ? quotation : null,
    schedule: sent && schedule && (schedule.arrivalDate || schedule.instructions || schedule.durationDays) ? schedule : null,
    response: row.can_repair === null || row.can_repair === undefined ? null : { canRepair: Boolean(row.can_repair), message: row.response_message || "" },
    customerDecision: row.customer_decision ? { value: row.customer_decision, note: row.customer_decision_note || "", at: row.customer_decided_at } : null,
    canDecide: row.status === "awaiting_customer",
    events,
    created_at: row.created_at,
  };
}

const loadRow = (id) => db.prepare("SELECT * FROM repair_requests WHERE id = ?").get(id);

// Save the images and parse + validate the payload. On any failure the uploaded files are removed so none are orphaned.
const uploadImages = imageUpload({ maxFiles: MAX_IMAGES });

const handleUpload = (req, res, next) => {
  uploadImages.array("images", MAX_IMAGES)(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: uploadErrorMessage(error, MAX_IMAGES), field: "images" });
    }

    // Reject files whose declared image type doesn't match their actual bytes.
    if ((req.files || []).some((file) => !looksLikeImage(file.path))) {
      removeFiles(req.files);
      return res.status(400).json({ message: "Only real JPG, PNG and WEBP images are allowed.", field: "images" });
    }

    next();
  });
};

const publicRouter = express.Router();

publicRouter.post("/", handleUpload, (req, res) => {
  const now = Date.now();
  const hits = (recent.get(req.ip) || []).filter((time) => now - time < WINDOW_MS);

  if (hits.length >= MAX_PER_WINDOW) {
    removeFiles(req.files);
    recent.set(req.ip, hits);
    return res.status(429).json({ message: "Too many requests. Try again in a few minutes." });
  }

  let payload;

  try {
    payload = cleanPayload(req.body?.payload);
  } catch (error) {
    removeFiles(req.files);

    if (error instanceof Invalid) {
      return res.status(400).json({ message: error.message, ...(error.field ? { field: error.field } : {}) });
    }

    throw error;
  }

  const attachments = (req.files || []).map((file) => publicPath(file));

  try {
    const result = db
      .prepare(
        `INSERT INTO repair_requests (demo_vehicle_id, uses_demo_model, vehicle_make, vehicle_model, vehicle_year, engine, mileage,
          registration, vehicle_notes, problems, attachments, full_name, phone, email, preferred_contact, preferred_date,
          preferred_time, comments, language)
         VALUES (@demoVehicleId, @usesDemoModel, @make, @model, @year, @engine, @mileage, @registration, @vehicleNotes,
          @problems, @attachments, @fullName, @phone, @email, @preferredContact, @preferredDate, @preferredTime, @comments, @language)`
      )
      .run({
        ...payload,
        problems: JSON.stringify(payload.problems),
        attachments: JSON.stringify(attachments),
      });
    const id = Number(result.lastInsertRowid);

    event(id, "submitted", "submitted", "", "customer");
    hits.push(now);
    recent.set(req.ip, hits);
    notify("repair", id, `${payload.make} ${payload.model}`);

    return res.status(201).json({
      message: "Your repair request has been sent. Our team will review it and get back to you.",
      requestId: id,
      reference: reference(id),
      status: "submitted",
    });
  } catch (error) {
    attachments.forEach(removeUpload);
    console.error("Repair request error:", error);

    return res.status(500).json({ message: "Could not save your repair request." });
  }
});

publicRouter.post("/status", (req, res) => {
  const id = toId(req.body?.reference ?? req.body?.requestId);
  const phone = text(req.body?.phone);

  if (!id || !phone) {
    return res.status(400).json({ message: "Please enter a valid request number and phone number." });
  }

  try {
    const row = loadRow(id);

    if (!row || normalizePhone(row.phone) !== normalizePhone(phone)) {
      return res.status(404).json({ message: "No request found with these details." });
    }

    return res.json({ request: publicRequest(row) });
  } catch (error) {
    console.error("Repair request status error:", error);

    return res.status(500).json({ message: "Could not retrieve the request status." });
  }
});

// The customer's own decision on the garage's quote: accept, decline, or ask for clarification. Guarded by the same
// reference + phone, and only while the quote is in their hands; it never confirms anything by itself.
const DECISIONS = { accepted: "accepted", declined: "declined", clarification: "info_required" };

publicRouter.post("/decision", (req, res) => {
  const id = toId(req.body?.reference ?? req.body?.requestId);
  const phone = text(req.body?.phone);
  const decision = req.body?.decision;

  if (!id || !phone) {
    return res.status(400).json({ message: "Please enter a valid request number and phone number." });
  }

  if (!Object.keys(DECISIONS).includes(decision)) {
    return res.status(400).json({ message: "Choose a valid response.", field: "decision" });
  }

  let note;

  try {
    note = bounded(req.body?.note, 1000, "note", "Keep your note to 1000 characters or fewer.");
  } catch (error) {
    return res.status(400).json({ message: error.message, field: error.field });
  }

  if (decision === "clarification" && !note) {
    return res.status(400).json({ message: "Tell the garage what you would like clarified.", field: "note" });
  }

  try {
    const row = loadRow(id);

    if (!row || normalizePhone(row.phone) !== normalizePhone(phone)) {
      return res.status(404).json({ message: "No request found with these details." });
    }

    if (row.status !== "awaiting_customer") {
      return res.status(409).json({ message: "This request is not waiting for your answer." });
    }

    const nextStatus = DECISIONS[decision];

    db.prepare("UPDATE repair_requests SET status = ?, customer_decision = ?, customer_decision_note = ?, customer_decided_at = CURRENT_TIMESTAMP WHERE id = ?").run(nextStatus, decision, note, id);
    event(id, `customer_${decision}`, nextStatus, note, "customer");
    notify("repair", id, `${row.vehicle_make} ${row.vehicle_model}`);

    return res.json({ request: publicRequest(loadRow(id)) });
  } catch (error) {
    console.error("Repair decision error:", error);

    return res.status(500).json({ message: "Could not save your response." });
  }
});

// Admin: view the incoming repair requests (read only in Phase 1).
const adminRouter = express.Router();

adminRouter.use(requireAdmin);

const LIST_COLUMNS = `id, demo_vehicle_id, uses_demo_model, vehicle_make, vehicle_model, vehicle_year, full_name, phone, email,
  preferred_contact, preferred_date, preferred_time, language, status, problems, created_at`;

const summarise = (row) => ({
  ...row,
  reference: reference(row.id),
  problem_count: parseJson(row.problems, []).length,
});

adminRouter.get("/", (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : null;
  const rows = db
    .prepare(`SELECT ${LIST_COLUMNS} FROM repair_requests ${status ? "WHERE status = ?" : ""} ORDER BY created_at DESC, id DESC`)
    .all(...(status ? [status] : []));
  const counts = Object.fromEntries(STATUSES.map((key) => [key, 0]));

  db.prepare("SELECT status, COUNT(*) AS count FROM repair_requests GROUP BY status")
    .all()
    .forEach((row) => {
      counts[row.status] = row.count;
    });

  res.json({
    requests: rows.map((row) => {
      const summary = summarise(row);

      delete summary.problems;

      return summary;
    }),
    counts,
  });
});

// The admin's full view of a request, including the draft quotation, schedule and the whole event history.
function adminDetail(row) {
  return {
    ...row,
    reference: reference(row.id),
    problems: parseJson(row.problems, []),
    attachments: parseJson(row.attachments, []),
    quotation: parseJson(row.quotation, null),
    schedule: parseJson(row.schedule, null),
    response: row.can_repair === null || row.can_repair === undefined ? null : { canRepair: Boolean(row.can_repair), message: row.response_message || "" },
    customerDecision: row.customer_decision ? { value: row.customer_decision, note: row.customer_decision_note || "", at: row.customer_decided_at } : null,
    events: db.prepare("SELECT type, status, note, actor, created_at AS at FROM repair_events WHERE request_id = ? ORDER BY id ASC").all(row.id),
  };
}

adminRouter.get("/:id", (req, res) => {
  const id = toId(req.params.id);
  const row = id && loadRow(id);

  if (!row) {
    return res.status(404).json({ message: "Repair request not found." });
  }

  res.json({ request: adminDetail(row) });
});

// Load the request for an admin mutation, or answer 404 and return null.
function adminRow(req, res) {
  const id = toId(req.params.id);
  const row = id && loadRow(id);

  if (!row) {
    res.status(404).json({ message: "Repair request not found." });

    return null;
  }

  return row;
}

const fail = (res, error) => {
  if (error instanceof Invalid) {
    return res.status(400).json({ message: error.message, ...(error.field ? { field: error.field } : {}) });
  }

  console.error("Repair admin error:", error);

  return res.status(500).json({ message: "Could not update the repair request." });
};

const touchReview = db.prepare("UPDATE repair_requests SET reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?");

// Accept the request for quoting, reject it, or ask the customer for more information.
const REVIEW_FROM = {
  accept: ["submitted", "under_review", "info_required"],
  reject: ["submitted", "under_review", "info_required", "awaiting_customer"],
  request_info: ["submitted", "under_review", "info_required", "awaiting_customer"],
};

adminRouter.patch("/:id/review", (req, res) => {
  const row = adminRow(req, res);

  if (!row) {
    return undefined;
  }

  const action = req.body?.action;

  if (!REVIEW_FROM[action]) {
    return res.status(400).json({ message: "Choose a valid action.", field: "action" });
  }

  if (!REVIEW_FROM[action].includes(row.status)) {
    return res.status(409).json({ message: "This request cannot change from its current state." });
  }

  try {
    const note = bounded(req.body?.note, 1000, "note", "Keep the note to 1000 characters or fewer.");

    if ((action === "reject" || action === "request_info") && !note) {
      return res.status(400).json({ message: action === "reject" ? "Give a reason for rejecting." : "Say what information you need.", field: "note" });
    }

    const next = action === "accept" ? "under_review" : action === "reject" ? "rejected" : "info_required";

    if (action === "reject") {
      db.prepare("UPDATE repair_requests SET status = ?, reject_reason = ? WHERE id = ?").run(next, note, row.id);
    } else {
      setStatus.run(next, row.id);
    }

    touchReview.run(req.admin.id, row.id);
    event(row.id, action === "accept" ? "review_accept" : action === "reject" ? "rejected" : "info_required", next, note, "admin");
    logActivity(req, `repair.${action}`, "repair", row.id);

    return res.json({ request: adminDetail(loadRow(row.id)) });
  } catch (error) {
    return fail(res, error);
  }
});

// Save (or re-save) the draft quotation. The totals are computed here; a client-sent total is ignored. No status
// change and no customer-visible event until it is sent.
adminRouter.put("/:id/quotation", (req, res) => {
  const row = adminRow(req, res);

  if (!row) {
    return undefined;
  }

  if (!["under_review", "info_required", "awaiting_customer"].includes(row.status)) {
    return res.status(409).json({ message: "A quotation can only be prepared while the request is under review." });
  }

  try {
    const quotation = buildQuotation(req.body);

    db.prepare("UPDATE repair_requests SET quotation = ? WHERE id = ?").run(JSON.stringify(quotation), row.id);
    logActivity(req, "repair.quotation", "repair", row.id, { total: quotation.total });

    return res.json({ request: adminDetail(loadRow(row.id)) });
  } catch (error) {
    return fail(res, error);
  }
});

adminRouter.put("/:id/schedule", (req, res) => {
  const row = adminRow(req, res);

  if (!row) {
    return undefined;
  }

  try {
    const body = req.body || {};
    const arrivalDate = text(body.arrivalDate);
    const startDate = text(body.startDate);
    const completionDate = text(body.completionDate);
    const arrivalTime = text(body.arrivalTime);

    for (const [value, field] of [[arrivalDate, "arrivalDate"], [startDate, "startDate"], [completionDate, "completionDate"]]) {
      if (value && !isDate(value)) {
        throw new Invalid("Choose a valid date.", field);
      }
    }

    if (arrivalTime && !/^\d{2}:\d{2}$/.test(arrivalTime)) {
      throw new Invalid("Choose a valid time.", "arrivalTime");
    }

    if (arrivalDate && completionDate && completionDate < arrivalDate) {
      throw new Invalid("The completion date cannot be before the arrival date.", "completionDate");
    }

    const durationDays = optionalInt(body.durationDays, 0, 365, "durationDays", "Enter a valid number of days.");
    const schedule = {
      arrivalDate,
      arrivalTime,
      startDate,
      durationDays,
      completionDate,
      instructions: bounded(body.instructions, 1000, "instructions", "Keep the instructions short."),
    };

    db.prepare("UPDATE repair_requests SET schedule = ? WHERE id = ?").run(JSON.stringify(schedule), row.id);
    logActivity(req, "repair.schedule", "repair", row.id);

    return res.json({ request: adminDetail(loadRow(row.id)) });
  } catch (error) {
    return fail(res, error);
  }
});

// Send the garage's answer to the customer: the quote and proposed date (canRepair true), or that the garage cannot
// take it on (canRepair false). The quote is then in the customer's hands.
adminRouter.post("/:id/send", (req, res) => {
  const row = adminRow(req, res);

  if (!row) {
    return undefined;
  }

  if (!["under_review", "info_required"].includes(row.status)) {
    return res.status(409).json({ message: "This request is not ready to send." });
  }

  const canRepair = req.body?.canRepair !== false;

  try {
    const message = bounded(req.body?.message, 1000, "message", "Keep the message to 1000 characters or fewer.");

    if (canRepair && !parseJson(row.quotation, null)?.lines) {
      return res.status(409).json({ message: "Prepare a quotation before sending.", field: "quotation" });
    }

    const next = canRepair ? "awaiting_customer" : "rejected";

    db.prepare("UPDATE repair_requests SET status = ?, can_repair = ?, response_message = ?, quoted_at = CURRENT_TIMESTAMP WHERE id = ?").run(next, canRepair ? 1 : 0, message, row.id);
    touchReview.run(req.admin.id, row.id);
    event(row.id, canRepair ? "quote_sent" : "declined_by_garage", next, message, "admin");
    logActivity(req, canRepair ? "repair.sent" : "repair.declined", "repair", row.id);

    return res.json({ request: adminDetail(loadRow(row.id)) });
  } catch (error) {
    return fail(res, error);
  }
});

// Move the repair through its garage stages once the customer has accepted (or cancel it).
adminRouter.patch("/:id/status", (req, res) => {
  const row = adminRow(req, res);

  if (!row) {
    return undefined;
  }

  const status = req.body?.status;

  if (status !== "cancelled" && !STAGE_FROM[status]) {
    return res.status(400).json({ message: "Choose a valid status.", field: "status" });
  }

  const allowed = status === "cancelled" ? CANCELLABLE.includes(row.status) : row.status === STAGE_FROM[status];

  if (!allowed) {
    return res.status(409).json({ message: `This request cannot move to ${status} from ${row.status}.` });
  }

  try {
    const note = bounded(req.body?.note, 1000, "note", "Keep the note short.");

    setStatus.run(status, row.id);
    event(row.id, "stage", status, note, "admin");
    logActivity(req, `repair.${status}`, "repair", row.id);

    return res.json({ request: adminDetail(loadRow(row.id)) });
  } catch (error) {
    return fail(res, error);
  }
});

module.exports = { publicRouter, adminRouter };
