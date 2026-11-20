const express = require("express");
const db = require("../database");
const { notify } = require("../activity");
const { publicSettings, getSetting } = require("../settings");

const router = express.Router();

const SUBJECTS = ["general", "buying", "selling", "inspection", "partnership", "other"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map();

function brandsByZone() {
  const rows = db
    .prepare("SELECT category, name, logo FROM brands WHERE visible = 1 ORDER BY category, sort_order, name")
    .all();

  return rows.reduce((zones, row) => {
    (zones[row.category] ||= []).push({ name: row.name, logo: row.logo });

    return zones;
  }, {});
}

router.get("/site", (req, res) => {
  res.json({ ...publicSettings(), brands: brandsByZone() });
});

router.post("/messages", (req, res) => {
  if (!getSetting("contact").enabled) {
    return res.status(403).json({ message: "The contact form is closed for now." });
  }

  const { name, email, phone, subject, category, listingId, message, language, website } = req.body || {};

  if (website) {
    return res.status(201).json({ message: "Your message has been sent." });
  }

  const now = Date.now();
  const hits = (recent.get(req.ip) || []).filter((time) => now - time < WINDOW_MS);

  if (hits.length >= MAX_PER_WINDOW) {
    return res.status(429).json({ message: "Too many messages. Try again in a few minutes." });
  }

  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanEmail = typeof email === "string" ? email.trim() : "";
  const cleanPhone = typeof phone === "string" ? phone.replace(/[\s.-]/g, "") : "";
  const body = typeof message === "string" ? message.trim() : "";

  if (cleanName.length < 2 || cleanName.length > 80) {
    return res.status(400).json({ message: "Enter your name." });
  }

  if (!cleanEmail && !cleanPhone) {
    return res.status(400).json({ message: "Give an email address or a phone number so we can answer you." });
  }

  if (cleanEmail && (!EMAIL_PATTERN.test(cleanEmail) || cleanEmail.length > 120)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  if (cleanPhone && !/^\+?\d{9,15}$/.test(cleanPhone)) {
    return res.status(400).json({ message: "Enter a valid phone number." });
  }

  if (!SUBJECTS.includes(subject)) {
    return res.status(400).json({ message: "Choose a subject." });
  }

  if (body.length < 10 || body.length > 2000) {
    return res.status(400).json({ message: "Your message must be between 10 and 2000 characters." });
  }

  const listing = Number.isInteger(Number(listingId)) && Number(listingId) > 0
    ? db.prepare("SELECT id FROM cars WHERE id = ?").get(Number(listingId))
    : null;

  const result = db
    .prepare(
      `INSERT INTO messages (name, email, phone, subject, category, listing_id, body, language)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      cleanName,
      cleanEmail,
      cleanPhone,
      subject,
      typeof category === "string" ? category.slice(0, 20) : "",
      listing ? listing.id : null,
      body,
      ["en", "fr", "ar"].includes(language) ? language : "en"
    );

  hits.push(now);
  recent.set(req.ip, hits);
  notify("message", Number(result.lastInsertRowid), cleanName);

  return res.status(201).json({ message: "Your message has been sent.", id: Number(result.lastInsertRowid) });
});

module.exports = router;
