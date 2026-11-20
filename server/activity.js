const db = require("./database");

function notify(type, refId, title) {
  db.prepare("INSERT INTO notifications (type, ref_id, title) VALUES (?, ?, ?)").run(type, refId ?? null, title);
}

function logActivity(req, action, targetType = "", targetId = null, details = {}) {
  db.prepare("INSERT INTO activity_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)").run(
    req.admin?.id ?? null,
    action,
    targetType,
    targetId,
    JSON.stringify(details)
  );
}

module.exports = { notify, logActivity };
