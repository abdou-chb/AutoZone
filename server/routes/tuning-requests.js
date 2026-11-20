const express = require("express");
const db = require("../database");
const { requireAdmin } = require("../admin-middleware");
const { logActivity, notify } = require("../activity");

// Car requests: a visitor asks for the Tuning Zone car they configured. Saved as pending; an admin approves or rejects.
const VEHICLES = ["golf", "rs6", "m3", "tiguan", "c63", "supra"];
const LANGUAGES = ["en", "fr", "ar"];
const STATUSES = ["pending", "approved", "rejected"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GROUP_PATTERN = /^[a-zA-Z]{1,40}$/;
const OPTION_PATTERN = /^[a-z0-9-]{1,40}$/;
const MAX_PRICE = 100000000;
const MAX_LINES = 40;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map();

const normalizePhone = (phone) => String(phone || "").replace(/[\s.()-]/g, "");
const isValidPhone = (phone) => /^\+?\d{9,15}$/.test(normalizePhone(phone));
const text = (value) => (typeof value === "string" ? value.trim() : "");
const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isLabel = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 80;
const isPrice = (value) => Number.isInteger(value) && value >= 0 && value <= MAX_PRICE;
const reference = (id) => `TZ-${id}`;

class Invalid extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

function cleanLine(line, priced) {
  if (
    !isPlainObject(line) ||
    !GROUP_PATTERN.test(line.group || "") ||
    !OPTION_PATTERN.test(line.option || "") ||
    !isLabel(line.groupLabel) ||
    !isLabel(line.optionLabel) ||
    (priced && !isPrice(line.price))
  ) {
    throw new Invalid("The car configuration is not valid.", "configuration");
  }

  const clean = { group: line.group, groupLabel: line.groupLabel.trim(), option: line.option, optionLabel: line.optionLabel.trim() };

  return priced ? { ...clean, price: line.price } : clean;
}

// The configuration as the visitor saw it. Its totals must add up: a total that does not match its lines is refused.
function cleanConfiguration(configuration) {
  if (!isPlainObject(configuration) || !isPlainObject(configuration.setup)) {
    throw new Invalid("The car configuration is not valid.", "configuration");
  }

  const entries = Object.entries(configuration.setup);

  if (entries.length > MAX_LINES || entries.some(([group, option]) => !GROUP_PATTERN.test(group) || typeof option !== "string" || !OPTION_PATTERN.test(option))) {
    throw new Invalid("The car configuration is not valid.", "configuration");
  }

  const lines = configuration.lines ?? [];
  const included = configuration.included ?? [];

  if (!Array.isArray(lines) || !Array.isArray(included) || lines.length > MAX_LINES || included.length > MAX_LINES) {
    throw new Invalid("The car configuration is not valid.", "configuration");
  }

  const paid = lines.map((line) => cleanLine(line, true));
  const free = included.map((line) => cleanLine(line, false));
  const sum = paid.reduce((total, line) => total + line.price, 0);

  if (!isPrice(configuration.optionsTotal) || !isPrice(configuration.total) || configuration.optionsTotal !== sum || configuration.total !== sum) {
    throw new Invalid("The price of the configuration does not add up. Reload the page and try again.", "configuration");
  }

  return {
    setup: Object.fromEntries(entries),
    lines: paid,
    included: free,
    optionsTotal: sum,
    total: sum,
    currency: "DZD",
    illustrative: true,
  };
}

function cleanRequest(body) {
  if (!isPlainObject(body)) {
    throw new Invalid("Please complete all required fields.");
  }

  const fullName = text(body.fullName);
  const phone = text(body.phone);
  const email = text(body.email);
  const wilaya = text(body.wilaya);
  const message = text(body.message);
  const vehicleName = text(body.vehicleName);

  if (!VEHICLES.includes(body.vehicleId) || !vehicleName || vehicleName.length > 80) {
    throw new Invalid("Choose one of the showroom cars.", "vehicleId");
  }

  if (fullName.length < 2 || fullName.length > 80) {
    throw new Invalid("Enter your full name (2 to 80 characters).", "fullName");
  }

  if (!isValidPhone(phone)) {
    throw new Invalid("Please enter a valid phone number.", "phone");
  }

  if (email && (email.length > 120 || !EMAIL_PATTERN.test(email))) {
    throw new Invalid("Enter a valid email address.", "email");
  }

  if (!wilaya || wilaya.length > 60) {
    throw new Invalid("Choose your wilaya.", "wilaya");
  }

  if (message.length > 1000) {
    throw new Invalid("Your message must be 1000 characters or fewer.", "message");
  }

  return {
    vehicleId: body.vehicleId,
    vehicleName,
    configuration: cleanConfiguration(body.configuration),
    fullName,
    phone,
    email,
    wilaya,
    message,
    language: LANGUAGES.includes(body.language) ? body.language : "en",
  };
}

const parseConfiguration = (row) => {
  try {
    return { ...row, configuration: JSON.parse(row.configuration) };
  } catch {
    return { ...row, configuration: {} };
  }
};

const toId = (value) => {
  const id = Number(String(value ?? "").trim().replace(/^TZ-?/i, ""));

  return Number.isInteger(id) && id > 0 ? id : null;
};

// Public: send a request, and follow it with its reference and phone number.
const publicRouter = express.Router();

publicRouter.post("/", (req, res) => {
  const now = Date.now();
  const hits = (recent.get(req.ip) || []).filter((time) => now - time < WINDOW_MS);

  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(req.ip, hits);
    return res.status(429).json({ message: "Too many requests. Try again in a few minutes." });
  }

  let request;

  try {
    request = cleanRequest(req.body);
  } catch (error) {
    if (error instanceof Invalid) {
      return res.status(400).json({ message: error.message, ...(error.field ? { field: error.field } : {}) });
    }

    throw error;
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO tuning_requests (vehicle_id, vehicle_name, configuration, options_total, total, currency, full_name, phone, email, wilaya, message, language)
         VALUES (?, ?, ?, ?, ?, 'DZD', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        request.vehicleId,
        request.vehicleName,
        JSON.stringify(request.configuration),
        request.configuration.optionsTotal,
        request.configuration.total,
        request.fullName,
        request.phone,
        request.email,
        request.wilaya,
        request.message,
        request.language
      );
    const id = Number(result.lastInsertRowid);

    hits.push(now);
    recent.set(req.ip, hits);
    notify("tuning", id, request.vehicleName);

    return res.status(201).json({
      message: "Your request has been sent. Our team will review it.",
      requestId: id,
      reference: reference(id),
      status: "pending",
    });
  } catch (error) {
    console.error("Car request error:", error);

    return res.status(500).json({ message: "Could not save your request." });
  }
});

publicRouter.post("/status", (req, res) => {
  const id = toId(req.body?.reference ?? req.body?.requestId);
  const phone = text(req.body?.phone);

  if (!id || !phone) {
    return res.status(400).json({ message: "Please enter a valid request ID and phone number." });
  }

  try {
    const row = db
      .prepare("SELECT id, vehicle_name, total, currency, phone, status, decision_note, created_at, reviewed_at FROM tuning_requests WHERE id = ?")
      .get(id);

    if (!row || normalizePhone(row.phone) !== normalizePhone(phone)) {
      return res.status(404).json({ message: "No request found with these details." });
    }

    const request = { reference: reference(row.id), ...row };

    delete request.id;
    delete request.phone;

    return res.json({ request });
  } catch (error) {
    console.error("Car request status error:", error);

    return res.status(500).json({ message: "Could not retrieve the request status." });
  }
});

// Admin: review the requests and decide on the pending ones.
const adminRouter = express.Router();

adminRouter.use(requireAdmin);

const LIST_COLUMNS = `r.id, r.vehicle_id, r.vehicle_name, r.options_total, r.total, r.currency, r.full_name, r.phone, r.email, r.wilaya,
  r.message, r.language, r.status, r.decision_note, r.reviewed_at, r.created_at, a.name AS reviewed_by_name`;

adminRouter.get("/", (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : null;
  const rows = db
    .prepare(
      `SELECT ${LIST_COLUMNS} FROM tuning_requests r LEFT JOIN admins a ON a.id = r.reviewed_by
       ${status ? "WHERE r.status = ?" : ""} ORDER BY r.created_at DESC, r.id DESC`
    )
    .all(...(status ? [status] : []));
  const counts = Object.fromEntries(STATUSES.map((key) => [key, 0]));

  db.prepare("SELECT status, COUNT(*) AS count FROM tuning_requests GROUP BY status")
    .all()
    .forEach((row) => {
      counts[row.status] = row.count;
    });

  res.json({ requests: rows.map((row) => ({ ...row, reference: reference(row.id) })), counts });
});

adminRouter.get("/:id", (req, res) => {
  const id = toId(req.params.id);
  const row = id && db.prepare(`SELECT ${LIST_COLUMNS}, r.configuration FROM tuning_requests r LEFT JOIN admins a ON a.id = r.reviewed_by WHERE r.id = ?`).get(id);

  if (!row) {
    return res.status(404).json({ message: "Car request not found." });
  }

  res.json({ request: { ...parseConfiguration(row), reference: reference(row.id) } });
});

adminRouter.patch("/:id/status", (req, res) => {
  const id = toId(req.params.id);
  const status = req.body?.status;
  const note = text(req.body?.note);

  if (!id) {
    return res.status(400).json({ message: "Invalid car request ID." });
  }

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Choose approve or reject." });
  }

  if (note.length > 500) {
    return res.status(400).json({ message: "The note must be 500 characters or fewer.", field: "note" });
  }

  const row = db.prepare("SELECT id, status FROM tuning_requests WHERE id = ?").get(id);

  if (!row) {
    return res.status(404).json({ message: "Car request not found." });
  }

  const result = db
    .prepare("UPDATE tuning_requests SET status = ?, decision_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'")
    .run(status, note, req.admin.id, id);

  if (result.changes === 0) {
    return res.status(409).json({ message: "This request has already been reviewed." });
  }

  logActivity(req, `tuning.${status}`, "tuning", id);

  const updated = db.prepare(`SELECT ${LIST_COLUMNS}, r.configuration FROM tuning_requests r LEFT JOIN admins a ON a.id = r.reviewed_by WHERE r.id = ?`).get(id);

  res.json({
    message: status === "approved" ? "Request approved." : "Request rejected.",
    request: { ...parseConfiguration(updated), reference: reference(id) },
  });
});

module.exports = { publicRouter, adminRouter };
