const { verifyToken } = require("./auth");

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  res.set("Cache-Control", "no-store");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      message: "Access denied. Please login as admin.",
    });
  }

  try {
    const admin = verifyToken(token);

    if (!admin) {
      return res.status(401).json({
        message: "Invalid or expired token.",
      });
    }

    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

function requireOwner(req, res, next) {
  if (req.admin?.role !== "owner") {
    return res.status(403).json({
      message: "Only the owner can do this.",
    });
  }

  next();
}

module.exports = requireAdmin;
module.exports.requireAdmin = requireAdmin;
module.exports.requireOwner = requireOwner;
