const express = require("express");
const db = require("../database");
const { requireAdmin, requireOwner } = require("../admin-middleware");
const { logActivity } = require("../activity");
const { checkPassword, hashPassword, passwordProblem, publicAdmin, revokeSessions, signToken } = require("../auth");
const { readAttributes, isCategory } = require("../categories");
const { getAllSettings, saveSetting, getSetting } = require("../settings");
const { attachImages, fold, LIST_COLUMNS } = require("../listing-query");
const {
  brandsDirectory,
  imageUpload,
  looksLikeImage,
  publicPath,
  removeFiles,
  removeUpload,
  uploadErrorMessage,
} = require("../uploads");

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LISTING_STATUSES = ["pending", "approved", "rejected", "sold"];
const MESSAGE_STATUSES = ["new", "read", "replied", "archived"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

router.use(requireAdmin);

const toId = (value) => {
  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
};

const paging = (query, fallback = 20) => {
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || fallback));
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);

  return { page, pageSize, offset: (page - 1) * pageSize };
};

const paged = (rows, total, { page, pageSize }) => ({
  items: rows,
  total,
  page,
  pageSize,
  pages: Math.max(1, Math.ceil(total / pageSize)),
});

const withUpload = (middleware, maxFiles) => (req, res, next) =>
  middleware(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: uploadErrorMessage(error, maxFiles) });
    }

    // Confirm each stored file is really an image (and not just a forged Content-Type).
    const files = req.files || (req.file ? [req.file] : []);

    if (files.some((file) => !looksLikeImage(file.path))) {
      removeFiles(req.files || req.file);
      return res.status(400).json({ message: "Only real image files are allowed." });
    }

    next();
  });

router.get("/me", (req, res) => {
  res.json({ admin: publicAdmin(req.admin) });
});

router.post("/me/sign-out-everywhere", (req, res) => {
  revokeSessions(req.admin.id);
  logActivity(req, "auth.sign_out_everywhere", "admin", req.admin.id);

  res.json({ ok: true });
});

router.put("/me", async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body || {};
  const admin = db.prepare("SELECT * FROM admins WHERE id = ?").get(req.admin.id);
  const changes = {};

  if (typeof name === "string" && name.trim()) {
    changes.name = name.trim().slice(0, 80);
  }

  if (typeof email === "string" && email.trim() && email.trim() !== admin.email) {
    if (!EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    changes.email = email.trim();
  }

  if (newPassword) {
    if (!(await checkPassword(currentPassword, admin.password_hash))) {
      return res.status(400).json({ message: "Your current password is not correct.", field: "currentPassword" });
    }

    const problem = passwordProblem(newPassword, changes.email || admin.email);

    if (problem) {
      return res.status(400).json({ message: problem, field: "newPassword" });
    }

    if (await checkPassword(newPassword, admin.password_hash)) {
      return res.status(400).json({ message: "Choose a password different from the current one.", field: "newPassword" });
    }

    changes.password_hash = await hashPassword(newPassword);
    changes.must_change_password = 0;
    changes.token_version = admin.token_version + 1;
  }

  if (!Object.keys(changes).length) {
    return res.json({ admin: publicAdmin(req.admin) });
  }

  try {
    db.prepare(
      `UPDATE admins SET ${Object.keys(changes).map((key) => `${key} = @${key}`).join(", ")} WHERE id = @id`
    ).run({ ...changes, id: admin.id });
  } catch {
    return res.status(409).json({ message: "This email is already used by another account." });
  }

  logActivity(req, "account.update", "admin", admin.id, {
    fields: Object.keys(changes).filter((key) => ["name", "email"].includes(key)).concat(changes.password_hash ? ["password"] : []),
  });

  const updated = db.prepare("SELECT * FROM admins WHERE id = ?").get(admin.id);

  res.json({
    admin: publicAdmin(updated),
    token: changes.password_hash ? signToken(updated) : undefined,
    message: "Your account has been updated.",
  });
});

router.get("/overview", (req, res) => {
  const byStatus = Object.fromEntries(
    db.prepare("SELECT status, COUNT(*) AS count FROM cars GROUP BY status").all().map((row) => [row.status, row.count])
  );
  const byZone = db
    .prepare("SELECT category, status, COUNT(*) AS count FROM cars GROUP BY category, status")
    .all()
    .reduce((zones, row) => {
      (zones[row.category] ||= {})[row.status] = row.count;

      return zones;
    }, {});
  const inspections = Object.fromEntries(
    db.prepare("SELECT status, COUNT(*) AS count FROM inspection_requests GROUP BY status").all().map((row) => [row.status, row.count])
  );
  const messages = Object.fromEntries(
    db.prepare("SELECT status, COUNT(*) AS count FROM messages GROUP BY status").all().map((row) => [row.status, row.count])
  );
  const carRequests = Object.fromEntries(
    db.prepare("SELECT status, COUNT(*) AS count FROM tuning_requests GROUP BY status").all().map((row) => [row.status, row.count])
  );
  const repairRequests = Object.fromEntries(
    db.prepare("SELECT status, COUNT(*) AS count FROM repair_requests GROUP BY status").all().map((row) => [row.status, row.count])
  );

  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (29 - index));

    return date.toISOString().slice(0, 10);
  });
  const series = (table) =>
    Object.fromEntries(
      db
        .prepare(`SELECT date(created_at) AS day, COUNT(*) AS count FROM ${table} WHERE created_at >= date('now', '-29 days') GROUP BY day`)
        .all()
        .map((row) => [row.day, row.count])
    );
  const listingsPerDay = series("cars");
  const inspectionsPerDay = series("inspection_requests");
  const messagesPerDay = series("messages");

  const upcoming = db
    .prepare(
      `SELECT r.id, r.status, r.appointment_date, r.appointment_time, r.buyer_full_name, c.id AS car_id, c.name AS car_name, c.year AS car_year, c.category AS car_category
       FROM inspection_requests r JOIN cars c ON c.id = r.car_id
       WHERE r.status IN ('scheduled', 'confirmed') AND r.appointment_date >= date('now')
       ORDER BY r.appointment_date, r.appointment_time LIMIT 6`
    )
    .all();

  const activity = db
    .prepare(
      `SELECT a.id, a.action, a.target_type, a.target_id, a.details, a.created_at, ad.name AS admin_name
       FROM activity_log a LEFT JOIN admins ad ON ad.id = a.admin_id WHERE a.action NOT LIKE 'auth.%' ORDER BY a.id DESC LIMIT 8`
    )
    .all();

  res.json({
    listings: { byStatus, byZone, featured: db.prepare("SELECT COUNT(*) AS c FROM cars WHERE featured = 1 AND status = 'approved'").get().c },
    inspections,
    messages,
    carRequests,
    repairRequests,
    series: days.map((day) => ({
      day,
      listings: listingsPerDay[day] || 0,
      inspections: inspectionsPerDay[day] || 0,
      messages: messagesPerDay[day] || 0,
    })),
    upcoming,
    activity,
  });
});

router.get("/notifications/summary", (req, res) => {
  const unread = db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE read_at IS NULL").get().c;
  const latest = db.prepare("SELECT * FROM notifications ORDER BY id DESC LIMIT 8").all();

  res.json({
    unread,
    latest,
    lastId: latest[0]?.id || 0,
    counts: {
      messages: db.prepare("SELECT COUNT(*) AS c FROM messages WHERE status = 'new'").get().c,
      listings: db.prepare("SELECT COUNT(*) AS c FROM cars WHERE status = 'pending'").get().c,
      inspections: db.prepare("SELECT COUNT(*) AS c FROM inspection_requests WHERE status = 'pending'").get().c,
      carRequests: db.prepare("SELECT COUNT(*) AS c FROM tuning_requests WHERE status = 'pending'").get().c,
      repairRequests: db.prepare("SELECT COUNT(*) AS c FROM repair_requests WHERE status IN ('submitted', 'under_review', 'info_required', 'accepted')").get().c,
    },
  });
});

router.get("/notifications", (req, res) => {
  const page = paging(req.query, 30);
  const where = req.query.unread === "1" ? "WHERE read_at IS NULL" : "";
  const total = db.prepare(`SELECT COUNT(*) AS c FROM notifications ${where}`).get().c;
  const rows = db.prepare(`SELECT * FROM notifications ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(page.pageSize, page.offset);

  res.json(paged(rows, total, page));
});

router.post("/notifications/read", (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(toId).filter(Boolean) : [];

  if (ids.length) {
    db.prepare(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL AND id IN (${ids.map(() => "?").join(",")})`
    ).run(...ids);
  } else {
    db.prepare("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL").run();
  }

  res.json({ ok: true });
});

router.get("/messages", (req, res) => {
  const page = paging(req.query);
  const where = [];
  const params = [];

  if (MESSAGE_STATUSES.includes(req.query.status)) {
    where.push("status = ?");
    params.push(req.query.status);
  } else if (req.query.status !== "all") {
    where.push("status != 'archived'");
  }

  if (typeof req.query.q === "string" && req.query.q.trim()) {
    where.push("(name LIKE ? OR email LIKE ? OR phone LIKE ? OR body LIKE ?)");
    params.push(...Array(4).fill(`%${req.query.q.trim()}%`));
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) AS c FROM messages ${clause}`).get(...params).c;
  const rows = db
    .prepare(
      `SELECT m.*, c.name AS listing_name, c.year AS listing_year, c.category AS listing_category
       FROM messages m LEFT JOIN cars c ON c.id = m.listing_id
       ${clause.replace(/\b(status|name|email|phone|body)\b/g, "m.$1")}
       ORDER BY m.id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, page.pageSize, page.offset);
  const counts = Object.fromEntries(
    db.prepare("SELECT status, COUNT(*) AS c FROM messages GROUP BY status").all().map((row) => [row.status, row.c])
  );

  res.json({ ...paged(rows, total, page), counts });
});

router.get("/messages/:id", (req, res) => {
  const id = toId(req.params.id);
  const message =
    id &&
    db
      .prepare(
        `SELECT m.*, c.name AS listing_name, c.year AS listing_year, c.category AS listing_category
         FROM messages m LEFT JOIN cars c ON c.id = m.listing_id WHERE m.id = ?`
      )
      .get(id);

  if (!message) {
    return res.status(404).json({ message: "Message not found." });
  }

  if (message.status === "new") {
    db.prepare("UPDATE messages SET status = 'read' WHERE id = ?").run(id);
    db.prepare("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE type = 'message' AND ref_id = ? AND read_at IS NULL").run(id);
    message.status = "read";
  }

  res.json({ message });
});

router.patch("/messages/:id", (req, res) => {
  const id = toId(req.params.id);
  const { status, note } = req.body || {};
  const message = id && db.prepare("SELECT * FROM messages WHERE id = ?").get(id);

  if (!message) {
    return res.status(404).json({ message: "Message not found." });
  }

  if (status !== undefined && !MESSAGE_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid message status." });
  }

  db.prepare("UPDATE messages SET status = ?, note = ? WHERE id = ?").run(
    status ?? message.status,
    typeof note === "string" ? note.slice(0, 2000) : message.note,
    id
  );
  logActivity(req, "message.update", "message", id, { status: status ?? message.status });

  res.json({ message: db.prepare("SELECT * FROM messages WHERE id = ?").get(id) });
});

router.delete("/messages/:id", (req, res) => {
  const id = toId(req.params.id);
  const result = id ? db.prepare("DELETE FROM messages WHERE id = ?").run(id) : { changes: 0 };

  if (!result.changes) {
    return res.status(404).json({ message: "Message not found." });
  }

  db.prepare("DELETE FROM notifications WHERE type = 'message' AND ref_id = ?").run(id);
  logActivity(req, "message.delete", "message", id);

  res.json({ ok: true });
});

function adminListing(id) {
  const row = db
    .prepare(
      `SELECT ${LIST_COLUMNS}, cars.status, cars.seller_first_name, cars.seller_last_name, cars.seller_email, cars.seller_phone
       FROM cars WHERE id = ?`
    )
    .get(id);

  return row ? attachImages(db, [row])[0] : null;
}

router.get("/cars/:id", (req, res) => {
  const listing = adminListing(Number(req.params.id));

  if (!listing) {
    return res.status(404).json({ message: "Listing not found." });
  }

  const inspections = db
    .prepare("SELECT id, status, buyer_full_name, appointment_date, appointment_time FROM inspection_requests WHERE car_id = ? ORDER BY id DESC")
    .all(listing.id);

  res.json({ car: listing, inspections });
});

router.put("/cars/:id", (req, res) => {
  const id = Number(req.params.id);
  const current = db.prepare("SELECT * FROM cars WHERE id = ?").get(id);

  if (!current) {
    return res.status(404).json({ message: "Listing not found." });
  }

  const body = req.body || {};
  const category = body.category ?? current.category;
  const year = Number(body.year ?? current.year);
  const price = Number(body.price ?? current.price);
  const name = String(body.name ?? current.name).trim();
  const location = String(body.location ?? current.location).trim();
  const condition = body.condition ?? current.condition;
  const status = body.status ?? current.status;
  const issues = Array.isArray(body.issues) ? body.issues.join("\n") : String(body.issues ?? current.issues ?? "");
  const seller = body.seller || {};

  if (!isCategory(category)) return res.status(400).json({ message: "Choose a valid category." });
  if (name.length < 2 || name.length > 120) return res.status(400).json({ message: "Enter the vehicle name." });
  if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
    return res.status(400).json({ message: "Enter a valid year." });
  }
  if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ message: "Enter a valid price." });
  if (!["New", "Used"].includes(condition)) return res.status(400).json({ message: "Condition must be New or Used." });
  if (!location) return res.status(400).json({ message: "Choose a wilaya." });
  if (!LISTING_STATUSES.includes(status)) return res.status(400).json({ message: "Invalid listing status." });
  if (seller.email && !EMAIL_PATTERN.test(String(seller.email).trim())) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  let columns = { mileage: current.mileage, fuel: current.fuel, transmission: current.transmission };
  let specs = current.specs;

  if (body.attributes || category !== current.category) {
    const attributes = readAttributes(category, body.attributes || {});

    if (attributes.error) {
      return res.status(400).json({ message: attributes.error });
    }

    columns = attributes.columns;
    specs = JSON.stringify(attributes.specs);
  }

  db.prepare(
    `UPDATE cars SET
      category = @category, name = @name, year = @year, price = @price, condition = @condition,
      mileage = @mileage, fuel = @fuel, transmission = @transmission, specs = @specs,
      location = @location, description = @description, issues = @issues, status = @status,
      featured = @featured,
      seller_first_name = @firstName, seller_last_name = @lastName, seller_email = @email, seller_phone = @phone
     WHERE id = @id`
  ).run({
    id,
    category,
    name,
    year,
    price,
    condition,
    ...columns,
    specs,
    location: location.slice(0, 80),
    description: String(body.description ?? current.description).trim().slice(0, 4000),
    issues: issues.trim().slice(0, 2000),
    status,
    featured: status === "approved" && (body.featured ?? Boolean(current.featured)) ? 1 : 0,
    firstName: String(seller.firstName ?? current.seller_first_name).trim(),
    lastName: String(seller.lastName ?? current.seller_last_name).trim(),
    email: String(seller.email ?? current.seller_email).trim(),
    phone: String(seller.phone ?? current.seller_phone).trim(),
  });

  logActivity(req, "listing.edit", "listing", id, { name });

  res.json({ car: adminListing(id), message: "Listing saved." });
});

function deleteListing(id) {
  const removed = db.transaction(() => {
    const listing = db.prepare("SELECT id, name, year, category, status FROM cars WHERE id = ?").get(id);

    if (!listing) {
      return null;
    }

    const images = db.prepare("SELECT image_path FROM car_images WHERE car_id = ?").all(id);
    const inspections = db.prepare("SELECT id FROM inspection_requests WHERE car_id = ?").all(id).map((row) => row.id);

    db.prepare("DELETE FROM notifications WHERE type = 'listing' AND ref_id = ?").run(id);

    if (inspections.length) {
      db.prepare(
        `DELETE FROM notifications WHERE type = 'inspection' AND ref_id IN (${inspections.map(() => "?").join(",")})`
      ).run(...inspections);
    }

    db.prepare("DELETE FROM cars WHERE id = ?").run(id);

    return { listing, images, inspectionsRemoved: inspections.length };
  })();

  if (removed) {
    removed.images.forEach((image) => removeUpload(image.image_path));
  }

  return removed;
}

router.delete("/cars/:id", (req, res) => {
  const id = toId(req.params.id);
  const removed = id ? deleteListing(id) : null;

  if (!removed) {
    return res.status(404).json({ message: "Listing not found." });
  }

  const { listing, inspectionsRemoved } = removed;

  logActivity(req, "listing.delete", "listing", id, {
    name: `${listing.name} ${listing.year}`,
    category: listing.category,
    status: listing.status,
    inspectionsRemoved,
  });

  res.json({ ok: true, id, inspectionsRemoved, message: "Listing deleted." });
});

router.post("/cars/bulk", (req, res) => {
  const { ids, action } = req.body || {};
  const list = (Array.isArray(ids) ? ids : []).map(toId).filter(Boolean).slice(0, 200);
  const updates = {
    approve: "UPDATE cars SET status = 'approved' WHERE id = ? AND status = 'pending'",
    reject: "UPDATE cars SET status = 'rejected' WHERE id = ? AND status = 'pending'",
    sold: "UPDATE cars SET status = 'sold', featured = 0 WHERE id = ? AND status = 'approved'",
    feature: "UPDATE cars SET featured = 1 WHERE id = ? AND status = 'approved' AND featured = 0",
    unfeature: "UPDATE cars SET featured = 0 WHERE id = ? AND featured = 1",
  };

  if (!list.length || !(action in updates || action === "delete")) {
    return res.status(400).json({ message: "Choose listings and an action." });
  }

  const changed = db.transaction(() =>
    list.reduce((count, id) => count + (action === "delete" ? Number(Boolean(deleteListing(id))) : db.prepare(updates[action]).run(id).changes), 0)
  )();

  logActivity(req, `listing.bulk.${action}`, "listing", null, { ids: list, changed });

  res.json({ changed });
});

router.post(
  "/cars/:id/images",
  withUpload(imageUpload().array("images", 9), 9),
  (req, res) => {
    const id = Number(req.params.id);
    const files = req.files || [];
    const existing = db.prepare("SELECT COUNT(*) AS c, MAX(sort_order) AS last FROM car_images WHERE car_id = ?").get(id);
    const maxPhotos = getSetting("listings").maxPhotos;

    if (!db.prepare("SELECT 1 FROM cars WHERE id = ?").get(id)) {
      removeFiles(files);
      return res.status(404).json({ message: "Listing not found." });
    }

    if (!files.length || existing.c + files.length > maxPhotos) {
      removeFiles(files);
      return res.status(400).json({ message: `You can upload a maximum of ${maxPhotos} images.` });
    }

    const insert = db.prepare("INSERT INTO car_images (car_id, image_path, is_main, sort_order) VALUES (?, ?, ?, ?)");

    files.forEach((file, index) => insert.run(id, publicPath(file), existing.c === 0 && index === 0 ? 1 : 0, (existing.last ?? -1) + index + 1));
    logActivity(req, "listing.photos.add", "listing", id, { count: files.length });

    res.status(201).json({ car: adminListing(id) });
  }
);

router.patch("/cars/:id/images/:imageId/main", (req, res) => {
  const id = Number(req.params.id);
  const imageId = Number(req.params.imageId);

  if (!db.prepare("SELECT 1 FROM car_images WHERE id = ? AND car_id = ?").get(imageId, id)) {
    return res.status(404).json({ message: "Photo not found." });
  }

  db.transaction(() => {
    db.prepare("UPDATE car_images SET is_main = 0 WHERE car_id = ?").run(id);
    db.prepare("UPDATE car_images SET is_main = 1 WHERE id = ?").run(imageId);
  })();
  logActivity(req, "listing.photos.cover", "listing", id);

  res.json({ car: adminListing(id) });
});

router.delete("/cars/:id/images/:imageId", (req, res) => {
  const id = Number(req.params.id);
  const image = db.prepare("SELECT * FROM car_images WHERE id = ? AND car_id = ?").get(Number(req.params.imageId), id);

  if (!image) {
    return res.status(404).json({ message: "Photo not found." });
  }

  if (db.prepare("SELECT COUNT(*) AS c FROM car_images WHERE car_id = ?").get(id).c <= 1) {
    return res.status(400).json({ message: "A listing needs at least one photo." });
  }

  db.transaction(() => {
    db.prepare("DELETE FROM car_images WHERE id = ?").run(image.id);

    if (image.is_main) {
      db.prepare("UPDATE car_images SET is_main = 1 WHERE id = (SELECT id FROM car_images WHERE car_id = ? ORDER BY sort_order LIMIT 1)").run(id);
    }
  })();
  removeUpload(image.image_path);
  logActivity(req, "listing.photos.delete", "listing", id);

  res.json({ car: adminListing(id) });
});

router.get("/inspections/calendar", (req, res) => {
  const from = DATE_PATTERN.test(req.query.from || "") ? req.query.from : new Date().toISOString().slice(0, 10);
  const to = DATE_PATTERN.test(req.query.to || "") ? req.query.to : from;
  const carId = toId(req.query.carId);

  const rows = db
    .prepare(
      `SELECT r.id, r.status, r.appointment_date, r.appointment_time, r.meeting_location, r.arrangement,
              r.buyer_full_name, r.buyer_phone, r.preferred_date, r.message, r.payment_instructions, r.created_at,
              c.id AS car_id, c.name AS car_name, c.year AS car_year, c.category AS car_category, c.location AS car_location
       FROM inspection_requests r JOIN cars c ON c.id = r.car_id
       WHERE ((r.status IN ('scheduled', 'confirmed', 'completed', 'cancelled') AND r.appointment_date BETWEEN @from AND @to)
          OR (r.status IN ('pending', 'cancelled') AND r.appointment_date = '' AND r.preferred_date BETWEEN @from AND @to))
         AND (@carId IS NULL OR c.id = @carId)
       ORDER BY COALESCE(NULLIF(r.appointment_date, ''), r.preferred_date), r.appointment_time`
    )
    .all({ from, to, carId });

  res.json({ from, to, slotMinutes: getSetting("inspections").slotMinutes, events: rows });
});

router.get("/inspections/availability", (req, res) => {
  const carId = toId(req.query.carId);
  const date = DATE_PATTERN.test(req.query.date || "") ? req.query.date : null;

  if (!carId || !date) {
    return res.status(400).json({ message: "Choose a vehicle and a date." });
  }

  const booked = db
    .prepare(
      `SELECT r.id, r.appointment_time, r.status, r.buyer_full_name, c.id AS car_id, c.name AS car_name
       FROM inspection_requests r JOIN cars c ON c.id = r.car_id
       WHERE r.appointment_date = ? AND r.status IN ('scheduled', 'confirmed') AND r.appointment_time != ''
       ORDER BY r.appointment_time`
    )
    .all(date);

  res.json({
    date,
    slotMinutes: getSetting("inspections").slotMinutes,
    vehicle: booked.filter((row) => row.car_id === carId),
    others: booked.filter((row) => row.car_id !== carId),
  });
});

function brandCounts(category) {
  const names = db
    .prepare("SELECT fold(name) AS folded, status FROM cars WHERE category = ?")
    .all(category);

  return (brand) => {
    const folded = fold(brand);

    return names.filter((row) => row.status === "approved" && (row.folded === folded || row.folded.startsWith(`${folded} `))).length;
  };
}

router.get("/brands", (req, res) => {
  const category = isCategory(req.query.category) ? req.query.category : "cars";
  const count = brandCounts(category);
  const brands = db
    .prepare("SELECT * FROM brands WHERE category = ? ORDER BY sort_order, name")
    .all(category)
    .map((brand) => ({ ...brand, visible: Boolean(brand.visible), listings: count(brand.name) }));

  res.json({ category, brands });
});

router.post("/brands", (req, res) => {
  const { category, name, visible = true } = req.body || {};
  const cleanName = typeof name === "string" ? name.trim().slice(0, 40) : "";

  if (!isCategory(category) || cleanName.length < 1) {
    return res.status(400).json({ message: "Enter a brand name." });
  }

  try {
    const last = db.prepare("SELECT MAX(sort_order) AS m FROM brands WHERE category = ?").get(category).m ?? -1;
    const result = db
      .prepare("INSERT INTO brands (category, name, visible, sort_order) VALUES (?, ?, ?, ?)")
      .run(category, cleanName, visible ? 1 : 0, last + 1);

    logActivity(req, "brand.create", "brand", Number(result.lastInsertRowid), { category, name: cleanName });

    res.status(201).json({ brand: db.prepare("SELECT * FROM brands WHERE id = ?").get(result.lastInsertRowid) });
  } catch {
    res.status(409).json({ message: "This brand already exists in this zone." });
  }
});

router.put("/brands/order", (req, res) => {
  const { category, ids } = req.body || {};

  if (!isCategory(category) || !Array.isArray(ids)) {
    return res.status(400).json({ message: "Invalid brand order." });
  }

  const update = db.prepare("UPDATE brands SET sort_order = ? WHERE id = ? AND category = ?");

  db.transaction(() => ids.map(toId).filter(Boolean).forEach((id, index) => update.run(index, id, category)))();
  logActivity(req, "brand.reorder", "brand", null, { category });

  res.json({ ok: true });
});

router.put("/brands/:id", (req, res) => {
  const id = Number(req.params.id);
  const brand = db.prepare("SELECT * FROM brands WHERE id = ?").get(id);
  const { name, visible, logo } = req.body || {};

  if (!brand) {
    return res.status(404).json({ message: "Brand not found." });
  }

  const nextLogo = logo === "" ? "" : brand.logo;

  if (logo === "" && brand.logo) {
    removeUpload(brand.logo);
  }

  try {
    db.prepare("UPDATE brands SET name = ?, visible = ?, logo = ? WHERE id = ?").run(
      typeof name === "string" && name.trim() ? name.trim().slice(0, 40) : brand.name,
      visible === undefined ? brand.visible : visible ? 1 : 0,
      nextLogo,
      id
    );
  } catch {
    return res.status(409).json({ message: "This brand already exists in this zone." });
  }

  logActivity(req, "brand.update", "brand", id, { name: name ?? brand.name });

  res.json({ brand: db.prepare("SELECT * FROM brands WHERE id = ?").get(id) });
});

router.post(
  "/brands/:id/logo",
  withUpload(imageUpload({ directory: brandsDirectory, maxFiles: 1, allowSvg: true }).single("logo"), 1),
  (req, res) => {
    const id = Number(req.params.id);
    const brand = db.prepare("SELECT * FROM brands WHERE id = ?").get(id);

    if (!brand || !req.file) {
      removeFiles(req.file);
      return res.status(brand ? 400 : 404).json({ message: brand ? "Choose an image." : "Brand not found." });
    }

    removeUpload(brand.logo);
    db.prepare("UPDATE brands SET logo = ? WHERE id = ?").run(publicPath(req.file, "brands"), id);
    logActivity(req, "brand.logo", "brand", id, { name: brand.name });

    res.json({ brand: db.prepare("SELECT * FROM brands WHERE id = ?").get(id) });
  }
);

router.delete("/brands/:id", (req, res) => {
  const id = Number(req.params.id);
  const brand = db.prepare("SELECT * FROM brands WHERE id = ?").get(id);

  if (!brand) {
    return res.status(404).json({ message: "Brand not found." });
  }

  db.prepare("DELETE FROM brands WHERE id = ?").run(id);
  removeUpload(brand.logo);
  logActivity(req, "brand.delete", "brand", id, { category: brand.category, name: brand.name });

  res.json({ ok: true });
});

router.get("/settings", (req, res) => {
  res.json({ settings: getAllSettings() });
});

router.put("/settings/:key", (req, res, next) => (req.params.key === "zones" ? next() : requireOwner(req, res, next)), (req, res) => {
  const saved = saveSetting(req.params.key, req.body, req.admin.id);

  if (!saved) {
    return res.status(400).json({ message: "Unknown setting." });
  }

  logActivity(req, "settings.update", "settings", null, { key: req.params.key });

  res.json({ key: req.params.key, value: saved, message: "Settings saved." });
});

router.get("/users", requireOwner, (req, res) => {
  res.json({
    users: db.prepare("SELECT id, name, email, role, active, last_login_at, created_at FROM admins ORDER BY id").all(),
  });
});

router.post("/users", requireOwner, async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ message: "Enter a name." });
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) return res.status(400).json({ message: "Enter a valid email address." });
  const problem = passwordProblem(password, email);

  if (problem) {
    return res.status(400).json({ message: problem });
  }

  try {
    const result = db
      .prepare("INSERT INTO admins (name, email, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, 1)")
      .run(name.trim().slice(0, 80), email.trim().toLowerCase(), await hashPassword(password), role === "owner" ? "owner" : "moderator");

    logActivity(req, "user.create", "admin", Number(result.lastInsertRowid), { email: email.trim() });

    res.status(201).json({
      user: db.prepare("SELECT id, name, email, role, active, last_login_at, created_at FROM admins WHERE id = ?").get(result.lastInsertRowid),
    });
  } catch {
    res.status(409).json({ message: "This email is already used by another account." });
  }
});

const ownersLeft = (exceptId) =>
  db.prepare("SELECT COUNT(*) AS c FROM admins WHERE role = 'owner' AND active = 1 AND id != ?").get(exceptId).c;

router.put("/users/:id", requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare("SELECT * FROM admins WHERE id = ?").get(id);
  const { name, email, role, active, password } = req.body || {};

  if (!user) return res.status(404).json({ message: "Account not found." });

  const nextRole = role === undefined ? user.role : role === "owner" ? "owner" : "moderator";
  const nextActive = active === undefined ? user.active : active ? 1 : 0;

  if (user.role === "owner" && (nextRole !== "owner" || !nextActive) && ownersLeft(id) === 0) {
    return res.status(400).json({ message: "Keep at least one active owner." });
  }

  if (email !== undefined && !EMAIL_PATTERN.test(String(email).trim())) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  const problem = password ? passwordProblem(password, email ?? user.email) : null;

  if (problem) {
    return res.status(400).json({ message: problem });
  }

  const revoke = Boolean(password) || (user.active && !nextActive) || nextRole !== user.role;

  try {
    db.prepare(
      `UPDATE admins SET name = ?, email = ?, role = ?, active = ?, password_hash = ?,
       must_change_password = ?, token_version = token_version + ? WHERE id = ?`
    ).run(
      typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : user.name,
      email !== undefined ? String(email).trim().toLowerCase() : user.email,
      nextRole,
      nextActive,
      password ? await hashPassword(password) : user.password_hash,
      password ? 1 : user.must_change_password,
      revoke && id !== req.admin.id ? 1 : 0,
      id
    );
  } catch {
    return res.status(409).json({ message: "This email is already used by another account." });
  }

  logActivity(req, "user.update", "admin", id, { role: nextRole, active: Boolean(nextActive) });

  res.json({ user: db.prepare("SELECT id, name, email, role, active, last_login_at, created_at FROM admins WHERE id = ?").get(id) });
});

router.delete("/users/:id", requireOwner, (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare("SELECT * FROM admins WHERE id = ?").get(id);

  if (!user) return res.status(404).json({ message: "Account not found." });
  if (id === req.admin.id) return res.status(400).json({ message: "You cannot delete your own account." });
  if (user.role === "owner" && ownersLeft(id) === 0) return res.status(400).json({ message: "Keep at least one active owner." });

  db.prepare("DELETE FROM admins WHERE id = ?").run(id);
  logActivity(req, "user.delete", "admin", id, { email: user.email });

  res.json({ ok: true });
});

router.get("/activity", (req, res) => {
  const page = paging(req.query, 30);
  const where = [];
  const params = [];
  const adminId = toId(req.query.adminId);
  const types = {
    listings: ["listing"],
    inspections: ["inspection"],
    messages: ["message"],
    brands: ["brand"],
    settings: ["settings"],
    team: ["user", "account", "auth"],
  };

  if (req.query.adminId === "system") {
    where.push("a.admin_id IS NULL");
  } else if (adminId) {
    where.push("a.admin_id = ?");
    params.push(adminId);
  }

  if (types[req.query.type]) {
    where.push(`(${types[req.query.type].map(() => "a.action LIKE ?").join(" OR ")})`);
    params.push(...types[req.query.type].map((prefix) => `${prefix}.%`));
  }

  if (req.admin.role !== "owner") {
    where.push("a.action NOT LIKE 'auth.%'");
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) AS c FROM activity_log a ${clause}`).get(...params).c;
  const rows = db
    .prepare(
      `SELECT a.*, ad.name AS admin_name FROM activity_log a LEFT JOIN admins ad ON ad.id = a.admin_id
       ${clause} ORDER BY a.id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, page.pageSize, page.offset)
    .map((row) => ({ ...row, details: JSON.parse(row.details || "{}") }));
  const people = db
    .prepare(
      `SELECT DISTINCT a.admin_id AS id, ad.name FROM activity_log a LEFT JOIN admins ad ON ad.id = a.admin_id ORDER BY ad.name`
    )
    .all();

  res.json({ ...paged(rows, total, page), people });
});

module.exports = router;
