const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./database");

const ISSUER = "autozone";
const AUDIENCE = "autozone-admin";
const TOKEN_LIFETIME = "8h";
const BCRYPT_COST = 12;
const MIN_PASSWORD = 10;
const MAX_PASSWORD_BYTES = 72;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IP = 10;
const MAX_FAILURES_PER_EMAIL = 5;
const DUMMY_HASH = bcrypt.hashSync("autozone-timing-guard", BCRYPT_COST);

const failures = { ip: new Map(), email: new Map() };

function assertConfiguration() {
  const secret = process.env.JWT_SECRET || "";

  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be set in server/.env and be at least 32 characters long.");
  }
}

function recent(map, key) {
  const now = Date.now();
  const list = (map.get(key) || []).filter((time) => now - time < WINDOW_MS);

  map.set(key, list);

  return list;
}

function isLocked(ip, email) {
  return recent(failures.ip, ip).length >= MAX_FAILURES_PER_IP || (email && recent(failures.email, email).length >= MAX_FAILURES_PER_EMAIL);
}

function recordFailure(ip, email) {
  recent(failures.ip, ip).push(Date.now());

  if (email) {
    recent(failures.email, email).push(Date.now());
  }
}

function clearFailures(ip, email) {
  failures.ip.delete(ip);
  failures.email.delete(email);
}

function passwordProblem(password, email = "") {
  const value = String(password ?? "");

  if (value.length < MIN_PASSWORD) {
    return "The new password must have at least 10 characters.";
  }

  if (Buffer.byteLength(value, "utf8") > MAX_PASSWORD_BYTES) {
    return "The new password is too long.";
  }

  if (email && value.toLowerCase().includes(String(email).split("@")[0].toLowerCase())) {
    return "The password must not contain your email address.";
  }

  return null;
}

function hashPassword(password) {
  return bcrypt.hash(String(password), BCRYPT_COST);
}

async function checkPassword(password, hash) {
  return bcrypt.compare(String(password ?? ""), hash || DUMMY_HASH);
}

function signToken(admin) {
  return jwt.sign({ role: admin.role, ver: admin.token_version }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: TOKEN_LIFETIME,
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: String(admin.id),
  });
}

function verifyToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const admin = db
    .prepare("SELECT id, name, email, role, active, token_version, must_change_password FROM admins WHERE id = ?")
    .get(Number(payload.sub));

  if (!admin || !admin.active || admin.token_version !== payload.ver) {
    return null;
  }

  return admin;
}

function revokeSessions(adminId) {
  db.prepare("UPDATE admins SET token_version = token_version + 1 WHERE id = ?").run(adminId);
}

function publicAdmin(admin) {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    active: admin.active,
    mustChangePassword: Boolean(admin.must_change_password),
  };
}

module.exports = {
  assertConfiguration,
  checkPassword,
  clearFailures,
  hashPassword,
  isLocked,
  passwordProblem,
  publicAdmin,
  recordFailure,
  revokeSessions,
  signToken,
  verifyToken,
};
