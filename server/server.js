require("dotenv").config();

const db = require("./database");
const express = require("express");
const cors = require("cors");

const verifyAdmin = require("./admin-middleware");
const {
  assertConfiguration,
  checkPassword,
  clearFailures,
  isLocked,
  publicAdmin,
  recordFailure,
  signToken,
} = require("./auth");
const { notify, logActivity } = require("./activity");
const { getSetting } = require("./settings");
const { imageUpload, removeFiles, uploadErrorMessage, uploadsDirectory } = require("./uploads");
const adminPanel = require("./routes/admin-panel");
const publicSite = require("./routes/public-site");
const tuningRequests = require("./routes/tuning-requests");
const repairRequests = require("./routes/repair-requests");
const { translateResponses } = require("./i18n");
const {
  DEFAULT_CATEGORY,
  parseSpecs,
  readAttributes,
} = require("./categories");
const {
  LIST_COLUMNS,
  QueryError,
  findListings,
  listingOverview,
  registerFunctions,
} = require("./listing-query");

registerFunctions(db);

assertConfiguration();

const app = express();

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  next();
});
const PORT = process.env.PORT || 5000;

const allowedOrigins = (
  process.env.CLIENT_ORIGIN ||
  "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(translateResponses);
app.use(express.json({ limit: "100kb" }));

app.use("/uploads", express.static(uploadsDirectory));

const uploadCarImages = imageUpload().fields([
  {
    name: "mainImage",
    maxCount: 1,
  },
  {
    name: "additionalImages",
    maxCount: 8,
  },
]);

const handleCarImageUpload = (req, res, next) => {
  uploadCarImages(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: uploadErrorMessage(error) });
    }

    next();
  });
};

const deleteUploadedFiles = removeFiles;

const getCarImages = (carId) => {
  return db.prepare(`
    SELECT
      id,
      image_path,
      is_main,
      sort_order
    FROM car_images
    WHERE car_id = ?
    ORDER BY is_main DESC, sort_order ASC, id ASC
  `).all(carId);
};

const attachCarImages = (car) => {
  const images = getCarImages(car.id);

  return {
    ...car,
    specs: parseSpecs(car.specs),
    mainImage:
      images.find((image) => image.is_main === 1)?.image_path || null,
    images,
  };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizePhone = (phone) =>
  String(phone || "").replace(/[\s.()-]/g, "");

const isValidPhone = (phone) => /^\+?\d{9,15}$/.test(normalizePhone(phone));

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to AutoZone API",
    status: "running",
  });
});

const sendQueryError = (res, error, fallback) => {
  if (error instanceof QueryError) {
    return res.status(400).json({ message: error.message });
  }

  console.error(fallback, error);

  return res.status(500).json({ message: fallback });
};

app.get("/api/cars", (req, res) => {
  try {
    res.json(findListings(db, req.query));
  } catch (error) {
    sendQueryError(res, error, "Failed to retrieve listings.");
  }
});

app.get("/api/cars/batch", (req, res) => {
  const queries = [req.query.query ?? []].flat().slice(0, 10);

  try {
    res.json({
      results: queries.map((search) => {
        const query = Object.fromEntries(new URLSearchParams(String(search)));

        if (Number(query.pageSize) > 8) {
          throw new QueryError("Page size must be 8 or less in a batch.");
        }

        const { cars, total } = findListings(db, { pageSize: 4, ...query, page: 1 });

        return { cars, total };
      }),
    });
  } catch (error) {
    sendQueryError(res, error, "Failed to retrieve listings.");
  }
});

app.get("/api/cars/available", (req, res) => {
  try {
    const { cars } = findListings(db, { ids: req.query.ids, pageSize: 100 }, { columns: "cars.id" });
    const asked = String(req.query.ids || "")
      .split(",")
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0)
      .slice(0, 100);
    const existing = new Set(
      asked.length
        ? db.prepare(`SELECT id FROM cars WHERE id IN (${asked.map(() => "?").join(",")})`).all(...asked).map((row) => row.id)
        : []
    );

    res.json({ ids: cars.map((car) => car.id), deleted: asked.filter((id) => !existing.has(id)) });
  } catch (error) {
    sendQueryError(res, error, "Failed to check saved listings.");
  }
});

app.get("/api/cars/overview", (req, res) => {
  try {
    res.json(listingOverview(db, req.query));
  } catch (error) {
    sendQueryError(res, error, "Failed to retrieve the overview.");
  }
});

app.get("/api/cars/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid car ID.",
    });
  }

  try {
    const car = db.prepare(`
      SELECT
        id, category, name, year, price, mileage, condition,
        fuel, transmission, specs, location, description,
        issues, created_at
      FROM cars
      WHERE id = ? AND status = 'approved'
    `).get(id);

    if (!car) {
      return res.status(404).json({
        message: "Listing not found.",
      });
    }

    res.json({
      car: attachCarImages(car),
    });
  } catch (error) {
    console.error("Error retrieving car:", error);

    res.status(500).json({
      message: "Failed to retrieve car details.",
    });
  }
});

app.post(
  "/api/cars",
  handleCarImageUpload,
  (req, res) => {
    const files = req.files;

    try {
      const mainImage = files?.mainImage?.[0];

      if (!mainImage) {
        deleteUploadedFiles(files);

        return res.status(400).json({
          message: "A cover photo is required.",
        });
      }

      let seller;
      let car;

      try {
        seller = JSON.parse(req.body.seller);
        car = JSON.parse(req.body.car);
      } catch {
        deleteUploadedFiles(files);

        return res.status(400).json({
          message: "Invalid seller or car information.",
        });
      }

      if (
        !seller ||
        typeof seller !== "object" ||
        !car ||
        typeof car !== "object"
      ) {
        deleteUploadedFiles(files);

        return res.status(400).json({
          message: "Seller and car information are required.",
        });
      }

      const requiredSellerFields = [
        seller.firstName,
        seller.lastName,
        seller.email,
        seller.phone,
      ];

      const requiredCarFields = [
        car.name,
        car.year,
        car.price,
        car.condition,
        car.location,
        car.description,
      ];

      if (
        [...requiredSellerFields, ...requiredCarFields].some(
          (value) =>
            value === undefined ||
            value === null ||
            String(value).trim() === ""
        )
      ) {
        deleteUploadedFiles(files);

        return res.status(400).json({
          message: "Please complete all required fields.",
        });
      }

      if (!EMAIL_PATTERN.test(String(seller.email).trim())) {
        deleteUploadedFiles(files);

        return res.status(400).json({
          message: "Please enter a valid email address.",
        });
      }

      if (!isValidPhone(seller.phone)) {
        deleteUploadedFiles(files);

        return res.status(400).json({
          message: "Please enter a valid phone number.",
        });
      }

      const year = Number(car.year);
      const price = Number(car.price);

      if (
        !Number.isInteger(year) ||
        year < 1950 ||
        year > new Date().getFullYear() + 1 ||
        !Number.isFinite(price) ||
        price <= 0
      ) {
        deleteUploadedFiles(files);

        return res.status(400).json({
          message: "Please enter valid vehicle information.",
        });
      }

      if (!["New", "Used"].includes(car.condition)) {
        deleteUploadedFiles(files);

        return res.status(400).json({
          message: "Invalid vehicle options.",
        });
      }

      const category = car.category ?? DEFAULT_CATEGORY;
      const attributes = readAttributes(category, car);

      if (attributes.error) {
        deleteUploadedFiles(files);

        return res.status(400).json({
          message: attributes.error,
        });
      }

      const additionalImages = files.additionalImages || [];
      const listingRules = getSetting("listings");

      if (1 + additionalImages.length > listingRules.maxPhotos) {
        deleteUploadedFiles(files);

        return res.status(400).json({
          message: `You can upload a maximum of ${listingRules.maxPhotos} images.`,
        });
      }

      const initialStatus = listingRules.requireApproval ? "pending" : "approved";

      const saveListing = db.transaction(() => {
        const statement = db.prepare(`
          INSERT INTO cars (
            category,
            seller_first_name,
            seller_last_name,
            seller_email,
            seller_phone,
            name,
            year,
            price,
            mileage,
            condition,
            fuel,
            transmission,
            specs,
            location,
            description,
            issues,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = statement.run(
          category,
          seller.firstName.trim(),
          seller.lastName.trim(),
          seller.email.trim(),
          seller.phone.trim(),
          car.name.trim(),
          year,
          price,
          attributes.columns.mileage,
          car.condition,
          attributes.columns.fuel,
          attributes.columns.transmission,
          JSON.stringify(attributes.specs),
          car.location.trim(),
          car.description.trim(),
          typeof car.issues === "string"
            ? car.issues.trim()
            : "",
          initialStatus
        );

        const carId = Number(result.lastInsertRowid);

        const insertImage = db.prepare(`
          INSERT INTO car_images (
            car_id,
            image_path,
            is_main,
            sort_order
          )
          VALUES (?, ?, ?, ?)
        `);

        insertImage.run(
          carId,
          `/uploads/${mainImage.filename}`,
          1,
          0
        );

        additionalImages.forEach((image, index) => {
          insertImage.run(
            carId,
            `/uploads/${image.filename}`,
            0,
            index + 1
          );
        });

        return carId;
      });

      const carId = saveListing();

      notify("listing", carId, `${car.name.trim()} ${year}`);

      return res.status(201).json({
        message: initialStatus === "pending" ? "Your listing has been submitted for review." : "Your listing is now live.",
        id: carId,
        status: initialStatus,
        imageCount: 1 + additionalImages.length,
      });
    } catch (error) {
      console.error("Error saving car listing:", error);

      deleteUploadedFiles(files);

      return res.status(500).json({
        message: "Something went wrong while saving your listing.",
      });
    }
  }
);

// Per-IP rate limit for public inspection submissions, matching the other public request endpoints.
const INSPECTION_WINDOW_MS = 10 * 60 * 1000;
const INSPECTION_MAX_PER_WINDOW = 5;
const inspectionSubmits = new Map();

app.post("/api/inspection-requests", (req, res) => {
  if (!getSetting("inspections").enabled) {
    return res.status(403).json({
      message: "Inspection requests are paused for now.",
    });
  }

  const now = Date.now();
  const hits = (inspectionSubmits.get(req.ip) || []).filter((time) => now - time < INSPECTION_WINDOW_MS);

  if (hits.length >= INSPECTION_MAX_PER_WINDOW) {
    return res.status(429).json({
      message: "Too many requests. Try again in a few minutes.",
    });
  }

  const {
    carId,
    fullName,
    phone,
    preferredDate,
    message,
  } = req.body;

  if (
    !carId ||
    typeof fullName !== "string" ||
    !fullName.trim() ||
    typeof phone !== "string" ||
    !phone.trim() ||
    typeof preferredDate !== "string" ||
    !preferredDate.trim()
  ) {
    return res.status(400).json({
      message: "Please complete all required fields.",
    });
  }

  if (fullName.trim().length < 2 || fullName.trim().length > 80) {
    return res.status(400).json({
      message: "Please enter your full name (2 to 80 characters).",
    });
  }

  if (typeof message === "string" && message.length > 1000) {
    return res.status(400).json({
      message: "The message is too long (1000 characters maximum).",
    });
  }

  const id = Number(carId);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid car ID.",
    });
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({
      message: "Please enter a valid phone number.",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
    return res.status(400).json({
      message: "Invalid preferred date.",
    });
  }

  const [year, month, day] = preferredDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return res.status(400).json({
      message: "Invalid preferred date.",
    });
  }

  const today = new Date();

  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (preferredDate < todayString) {
    return res.status(400).json({
      message: "The preferred date cannot be in the past.",
    });
  }

  try {
    const car = db.prepare(`
      SELECT id, name, year
      FROM cars
      WHERE id = ? AND status = 'approved'
    `).get(id);

    if (!car) {
      return res.status(404).json({
        message: "This listing is not available.",
      });
    }

    const result = db.prepare(`
      INSERT INTO inspection_requests (
        car_id,
        buyer_full_name,
        buyer_phone,
        preferred_date,
        message
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      fullName.trim(),
      phone.trim(),
      preferredDate,
      typeof message === "string" ? message.trim() : ""
    );

    notify("inspection", Number(result.lastInsertRowid), `${car.name} ${car.year}`);
    hits.push(now);
    inspectionSubmits.set(req.ip, hits);

    return res.status(201).json({
      message: "Your inspection request has been submitted successfully.",
      requestId: result.lastInsertRowid,
      status: "pending",
    });
  } catch (error) {
    console.error("Inspection request error:", error);

    return res.status(500).json({
      message: "Could not save your inspection request.",
    });
  }
});

app.post("/api/inspection-requests/status", (req, res) => {
  const { requestId, phone } = req.body;
  const id = Number(requestId);

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    typeof phone !== "string" ||
    !phone.trim()
  ) {
    return res.status(400).json({
      message: "Please enter a valid request ID and phone number.",
    });
  }

  try {
    const request = db.prepare(`
      SELECT
        inspection_requests.id,
        inspection_requests.buyer_full_name,
        inspection_requests.buyer_phone,
        inspection_requests.preferred_date,
        inspection_requests.status,
        inspection_requests.arrangement,
        inspection_requests.appointment_date,
        inspection_requests.appointment_time,
        inspection_requests.meeting_location,
        inspection_requests.payment_instructions,
        cars.name AS car_name,
        cars.year AS car_year,
        cars.category AS car_category,
        cars.location AS car_location
      FROM inspection_requests
      INNER JOIN cars
        ON inspection_requests.car_id = cars.id
      WHERE inspection_requests.id = ?
    `).get(id);

    if (!request || normalizePhone(request.buyer_phone) !== normalizePhone(phone)) {
      return res.status(404).json({
        message: "No request found with these details.",
      });
    }

    const publicRequest = { ...request };
    delete publicRequest.buyer_phone;

    return res.json({ request: publicRequest });
  } catch (error) {
    console.error("Inspection status error:", error);

    return res.status(500).json({
      message: "Could not retrieve inspection status.",
    });
  }
});

const toMinutes = (time) => {
  const [hours, minutes] = String(time).split(":").map(Number);

  return hours * 60 + minutes;
};

const findScheduleClash = (carId, date, time, exceptId) => {
  const slot = getSetting("inspections").slotMinutes;

  return db
    .prepare(`
      SELECT id, appointment_time
      FROM inspection_requests
      WHERE car_id = ? AND appointment_date = ? AND id != ?
        AND status IN ('scheduled', 'confirmed') AND appointment_time != ''
    `)
    .all(carId, date, exceptId)
    .find((other) => Math.abs(toMinutes(other.appointment_time) - toMinutes(time)) < slot);
};

app.post("/api/admin/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (isLocked(req.ip, email)) {
    return res.status(429).json({
      message: "Too many failed attempts. Try again in 15 minutes.",
    });
  }

  if (!email || !password) {
    return res.status(400).json({
      message: "Enter your email and password.",
    });
  }

  try {
    const admin = db.prepare("SELECT * FROM admins WHERE email = ?").get(email);
    const passwordMatches = await checkPassword(password, admin?.password_hash);

    if (!admin || !admin.active || !passwordMatches) {
      recordFailure(req.ip, email);
      logActivity({ admin: null }, "auth.login_failed", "admin", admin?.id ?? null, { email });

      return res.status(401).json({
        message: "Incorrect email or password.",
      });
    }

    clearFailures(req.ip, email);
    db.prepare("UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").run(admin.id);
    logActivity({ admin }, "auth.login", "admin", admin.id);

    res.json({
      message: "Admin login successful.",
      token: signToken(admin),
      admin: publicAdmin(admin),
    });
  } catch (error) {
    console.error("Admin login error:", error);

    res.status(500).json({
      message: "Login failed.",
    });
  }
});

app.get("/api/admin/cars", verifyAdmin, (req, res) => {
  const { status = "pending", ...query } = req.query;

  if (!["pending", "approved", "rejected", "sold"].includes(status)) {
    return res.status(400).json({
      message: "Invalid listing status.",
    });
  }

  try {
    res.json(
      findListings(db, query, {
        status,
        columns: `${LIST_COLUMNS}, cars.status, cars.seller_first_name, cars.seller_last_name,
          cars.seller_email, cars.seller_phone`,
      })
    );
  } catch (error) {
    sendQueryError(res, error, "Could not retrieve listings.");
  }
});

app.get("/api/admin/inspection-requests", verifyAdmin, (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT
        inspection_requests.id,
        inspection_requests.car_id,
        inspection_requests.buyer_full_name,
        inspection_requests.buyer_phone,
        inspection_requests.preferred_date,
        inspection_requests.message,
        inspection_requests.status,
        inspection_requests.arrangement,
        inspection_requests.appointment_date,
        inspection_requests.appointment_time,
        inspection_requests.meeting_location,
        inspection_requests.payment_instructions,
        inspection_requests.created_at,
        cars.name AS car_name,
        cars.year AS car_year,
        cars.category AS car_category,
        cars.location AS car_location
      FROM inspection_requests
      INNER JOIN cars
        ON inspection_requests.car_id = cars.id
      ORDER BY inspection_requests.created_at DESC
    `).all();

    res.json({ requests });
  } catch (error) {
    console.error("Inspection requests error:", error);

    res.status(500).json({
      message: "Could not retrieve inspection requests.",
    });
  }
});

app.patch(
  "/api/admin/inspection-requests/:id/schedule",
  verifyAdmin,
  (req, res) => {
    const id = Number(req.params.id);

    const {
      arrangement,
      appointmentDate,
      appointmentTime,
      meetingLocation,
      paymentInstructions,
    } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid inspection request ID.",
      });
    }

    if (
      typeof arrangement !== "string" ||
      !arrangement.trim() ||
      typeof appointmentDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) ||
      typeof appointmentTime !== "string" ||
      !/^\d{2}:\d{2}$/.test(appointmentTime) ||
      typeof meetingLocation !== "string" ||
      !meetingLocation.trim()
    ) {
      return res.status(400).json({
        message: "Please complete all required appointment details.",
      });
    }

    const [year, month, day] = appointmentDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return res.status(400).json({
        message: "Invalid appointment date.",
      });
    }

    const [hours, minutes] = appointmentTime.split(":").map(Number);

    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours > 23 ||
      minutes > 59
    ) {
      return res.status(400).json({
        message: "Invalid appointment time.",
      });
    }

    try {
      const request = db
        .prepare("SELECT id, car_id, status FROM inspection_requests WHERE id = ?")
        .get(id);

      if (!request || !["pending", "scheduled", "confirmed"].includes(request.status)) {
        return res.status(404).json({
          message: "Pending inspection request not found.",
        });
      }

      const clash = findScheduleClash(request.car_id, appointmentDate, appointmentTime, id);

      if (clash) {
        return res.status(409).json({
          message: `This vehicle already has an inspection at ${clash.appointment_time} that day (request #${clash.id}).`,
          clash: { id: clash.id, time: clash.appointment_time },
        });
      }

      const result = db.prepare(`
        UPDATE inspection_requests
        SET
          status = 'scheduled',
          arrangement = ?,
          appointment_date = ?,
          appointment_time = ?,
          meeting_location = ?,
          payment_instructions = ?
        WHERE id = ? AND status IN ('pending', 'scheduled', 'confirmed')
      `).run(
        arrangement.trim(),
        appointmentDate,
        appointmentTime,
        meetingLocation.trim(),
        typeof paymentInstructions === "string"
          ? paymentInstructions.trim()
          : "",
        id
      );

      if (result.changes === 0) {
        return res.status(404).json({
          message: "Pending inspection request not found.",
        });
      }

      logActivity(req, request.status === "pending" ? "inspection.schedule" : "inspection.reschedule", "inspection", id, {
        date: appointmentDate,
        time: appointmentTime,
      });

      return res.json({
        message: "Inspection appointment scheduled successfully.",
        requestId: id,
        status: "scheduled",
      });
    } catch (error) {
      console.error("Schedule inspection error:", error);

      return res.status(500).json({
        message: "Could not schedule the inspection.",
      });
    }
  }
);

app.patch(
  "/api/admin/inspection-requests/:id/status",
  verifyAdmin,
  (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
      "confirmed",
      "completed",
      "cancelled",
    ];

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid inspection request ID.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid inspection status.",
      });
    }

    try {
      const request = db.prepare(`
        SELECT status
        FROM inspection_requests
        WHERE id = ?
      `).get(id);

      if (!request) {
        return res.status(404).json({
          message: "Inspection request not found.",
        });
      }

      const allowedTransitions = {
        pending: ["cancelled"],
        scheduled: ["confirmed", "cancelled"],
        confirmed: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      };

      if (!allowedTransitions[request.status]?.includes(status)) {
        return res.status(400).json({
          message: `Cannot change status from ${request.status} to ${status}.`,
        });
      }

      db.prepare(`
        UPDATE inspection_requests
        SET status = ?
        WHERE id = ?
      `).run(status, id);

      logActivity(req, `inspection.${status}`, "inspection", id);

      return res.json({
        message: "Inspection request status updated successfully.",
        requestId: id,
        status,
      });
    } catch (error) {
      console.error("Update inspection status error:", error);

      return res.status(500).json({
        message: "Could not update inspection request status.",
      });
    }
  }
);

app.get("/api/admin/stats", verifyAdmin, (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold
      FROM cars
    `).get();

    res.json({
      total: stats.total,
      pending: stats.pending || 0,
      approved: stats.approved || 0,
      rejected: stats.rejected || 0,
      sold: stats.sold || 0,
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error);

    res.status(500).json({
      message: "Could not retrieve dashboard statistics.",
    });
  }
});

app.patch("/api/admin/cars/:id/:action", verifyAdmin, (req, res) => {
  const id = Number(req.params.id);
  const action = req.params.action;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid car ID.",
    });
  }

  const transitions = {
    approve: { from: "pending", to: "approved" },
    reject: { from: "pending", to: "rejected" },
    sold: { from: "approved", to: "sold" },
  };

  const flags = { feature: 1, unfeature: 0 };

  if (action in flags) {
    try {
      const result = db
        .prepare("UPDATE cars SET featured = ? WHERE id = ? AND status = 'approved'")
        .run(flags[action], id);

      if (result.changes === 0) {
        return res.status(404).json({
          message: "Only live listings can be featured.",
        });
      }

      logActivity(req, `listing.${action}`, "listing", id);

      return res.json({ id, featured: Boolean(flags[action]) });
    } catch (error) {
      console.error("Feature listing error:", error);

      return res.status(500).json({
        message: "Could not update listing.",
      });
    }
  }

  const transition = transitions[action];

  if (!transition) {
    return res.status(400).json({
      message: "Invalid action.",
    });
  }

  const status = transition.to;

  try {
    const result = db.prepare(`
      UPDATE cars
      SET status = ?, featured = CASE WHEN ? = 'sold' THEN 0 ELSE featured END
      WHERE id = ? AND status = ?
    `).run(status, status, id, transition.from);

    if (result.changes === 0) {
      return res.status(404).json({
        message: "Listing not found or already updated.",
      });
    }

    logActivity(req, `listing.${action}`, "listing", id);

    res.json({
      message: `Car ${id} has been ${status}.`,
      id,
      status,
    });
  } catch (error) {
    console.error("Review listing error:", error);

    res.status(500).json({
      message: "Could not update listing.",
    });
  }
});

app.use("/api/tuning-requests", tuningRequests.publicRouter);
app.use("/api/admin/tuning-requests", tuningRequests.adminRouter);
app.use("/api/repair-requests", repairRequests.publicRouter);
app.use("/api/admin/repair-requests", repairRequests.adminRouter);
app.use("/api", publicSite);
app.use("/api/admin", adminPanel);

app.listen(PORT, () => {
  console.log(`AutoZone server running on http://localhost:${PORT}`);
});
