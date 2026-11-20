const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.DB_FILE || path.join(__dirname, "autozone.db");

const db = new Database(dbPath);

const SCHEMA_VERSION = 4;

const listingsTable = (name) => `
  CREATE TABLE ${name} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    category TEXT NOT NULL DEFAULT 'cars',

    seller_first_name TEXT NOT NULL,
    seller_last_name TEXT NOT NULL,
    seller_email TEXT NOT NULL,
    seller_phone TEXT NOT NULL,

    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    price REAL NOT NULL,
    condition TEXT NOT NULL,

    mileage INTEGER,
    fuel TEXT,
    transmission TEXT,
    specs TEXT NOT NULL DEFAULT '{}',

    location TEXT NOT NULL,
    description TEXT NOT NULL,
    issues TEXT DEFAULT '',

    status TEXT NOT NULL DEFAULT 'pending',
    featured INTEGER NOT NULL DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const tableExists = (name) =>
  Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));

const migrateToCategories = () => {
  db.pragma("foreign_keys = OFF");

  db.transaction(() => {
    db.exec(listingsTable("cars_next"));
    db.exec(`
      INSERT INTO cars_next (
        id, category, seller_first_name, seller_last_name, seller_email, seller_phone,
        name, year, price, condition, mileage, fuel, transmission, specs,
        location, description, issues, status, created_at
      )
      SELECT
        id, 'cars', seller_first_name, seller_last_name, seller_email, seller_phone,
        name, year, price, condition, mileage, fuel, transmission, '{}',
        location, description, issues, status, created_at
      FROM cars;
      DROP TABLE cars;
      ALTER TABLE cars_next RENAME TO cars;
    `);
  })();

  const brokenLinks = db.pragma("foreign_key_check");

  if (brokenLinks.length) {
    throw new Error(`Category migration left ${brokenLinks.length} broken references.`);
  }
};

if (!tableExists("cars")) {
  db.exec(listingsTable("cars"));
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
} else {
  if (db.pragma("user_version", { simple: true }) < 1) {
    migrateToCategories();
    db.pragma("user_version = 1");
  }

  if (db.pragma("user_version", { simple: true }) < 2) {
    db.exec("ALTER TABLE cars ADD COLUMN featured INTEGER NOT NULL DEFAULT 0");
    db.pragma("user_version = 2");
  }
}

db.pragma("foreign_keys = ON");

db.exec(`
  DROP INDEX IF EXISTS idx_cars_category_status;
  CREATE INDEX IF NOT EXISTS idx_cars_listing ON cars (status, category, created_at);

  CREATE TABLE IF NOT EXISTS car_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    car_id INTEGER NOT NULL,

    image_path TEXT NOT NULL,

    is_main INTEGER NOT NULL DEFAULT 0,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (car_id) REFERENCES cars(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inspection_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    car_id INTEGER NOT NULL,

    buyer_full_name TEXT NOT NULL,
    buyer_phone TEXT NOT NULL,

    preferred_date TEXT NOT NULL,
    message TEXT DEFAULT '',

    status TEXT NOT NULL DEFAULT 'pending',

    arrangement TEXT DEFAULT '',
    appointment_date TEXT DEFAULT '',
    appointment_time TEXT DEFAULT '',
    meeting_location TEXT DEFAULT '',
    payment_instructions TEXT DEFAULT '',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (car_id) REFERENCES cars(id)
      ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'moderator',
    active INTEGER NOT NULL DEFAULT 1,
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER
  );

  CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    logo TEXT NOT NULL DEFAULT '',
    visible INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (category, name)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    listing_id INTEGER,
    body TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    status TEXT NOT NULL DEFAULT 'new',
    note TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES cars(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    ref_id INTEGER,
    title TEXT NOT NULL,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tuning_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id TEXT NOT NULL,
    vehicle_name TEXT NOT NULL,
    configuration TEXT NOT NULL DEFAULT '{}',
    options_total INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'DZD',
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    wilaya TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'en',
    status TEXT NOT NULL DEFAULT 'pending',
    decision_note TEXT NOT NULL DEFAULT '',
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reviewed_by) REFERENCES admins(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS repair_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    demo_vehicle_id TEXT NOT NULL DEFAULT 'golf',
    uses_demo_model INTEGER NOT NULL DEFAULT 1,
    vehicle_make TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_year INTEGER,
    engine TEXT NOT NULL DEFAULT '',
    mileage INTEGER,
    registration TEXT NOT NULL DEFAULT '',
    vehicle_notes TEXT NOT NULL DEFAULT '',
    problems TEXT NOT NULL DEFAULT '[]',
    attachments TEXT NOT NULL DEFAULT '[]',
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    preferred_contact TEXT NOT NULL DEFAULT 'phone',
    preferred_date TEXT NOT NULL DEFAULT '',
    preferred_time TEXT NOT NULL DEFAULT '',
    comments TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'en',
    status TEXT NOT NULL DEFAULT 'submitted',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS repair_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    actor TEXT NOT NULL DEFAULT 'system',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES repair_requests(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT '',
    target_id INTEGER,
    details TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_status ON messages (status, created_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (read_at, created_at);
  CREATE INDEX IF NOT EXISTS idx_brands_category ON brands (category, sort_order);
`);

if (!db.prepare("SELECT 1 FROM brands LIMIT 1").get()) {
  const config = require("../shared/categories.json");
  const insertBrand = db.prepare("INSERT OR IGNORE INTO brands (category, name, sort_order) VALUES (?, ?, ?)");

  db.transaction(() => {
    config.categories.forEach((category) => {
      category.brands.forEach((name, index) => insertBrand.run(category.key, name, index));
    });
  })();
}

const adminColumns = db.prepare("PRAGMA table_info(admins)").all().map((column) => column.name);

if (!adminColumns.includes("token_version")) {
  db.exec("ALTER TABLE admins ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0");
}

if (!adminColumns.includes("must_change_password")) {
  db.exec("ALTER TABLE admins ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
}

// Phase 2 of the repair workflow: the quotation, schedule, the garage's response and the customer's decision.
const repairColumns = db.prepare("PRAGMA table_info(repair_requests)").all().map((column) => column.name);
const repairAdditions = [
  "decision_note TEXT NOT NULL DEFAULT ''",
  "reject_reason TEXT NOT NULL DEFAULT ''",
  "quotation TEXT NOT NULL DEFAULT ''",
  "schedule TEXT NOT NULL DEFAULT ''",
  "response_message TEXT NOT NULL DEFAULT ''",
  "can_repair INTEGER",
  "quoted_at DATETIME",
  "customer_decision TEXT NOT NULL DEFAULT ''",
  "customer_decision_note TEXT NOT NULL DEFAULT ''",
  "customer_decided_at DATETIME",
  "reviewed_by INTEGER",
  "reviewed_at DATETIME",
];

repairAdditions.forEach((definition) => {
  const name = definition.split(" ")[0];

  if (!repairColumns.includes(name)) {
    db.exec(`ALTER TABLE repair_requests ADD COLUMN ${definition}`);
  }
});

if (!db.prepare("SELECT 1 FROM admins LIMIT 1").get() && process.env.ADMIN_PASSWORD) {
  const bcrypt = require("bcryptjs");
  const secret = process.env.ADMIN_PASSWORD;
  const hash = /^\$2[aby]\$\d{2}\$/.test(secret) ? secret : bcrypt.hashSync(secret, 12);

  db.prepare(
    "INSERT INTO admins (name, email, password_hash, role, must_change_password) VALUES (?, ?, ?, 'owner', 1)"
  ).run("Owner", process.env.ADMIN_EMAIL || "admin@autozone.dz", hash);
}

if (db.pragma("user_version", { simple: true }) < SCHEMA_VERSION) {
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

module.exports = db;
