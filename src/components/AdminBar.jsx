import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, ShieldCheck } from "lucide-react";
import { useI18n } from "../i18n/i18n-context";
import { adminRequest, useAdminPresence } from "../lib/admin-presence";
import "./AdminBar.css";

export default function AdminBar({ maintenance = false }) {
  const { t } = useI18n();
  const admin = useAdminPresence();
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (!admin) {
      return undefined;
    }

    let active = true;

    adminRequest("/api/admin/notifications/summary")
      .then((data) => active && setPending(data.counts.listings))
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [admin]);

  if (!admin) {
    return null;
  }

  return (
    <div className="admin-bar" role="region" aria-label={t("moderation.bar.label")}>
      <div className="container admin-bar__inner">
        <p className="admin-bar__who">
          <ShieldCheck size={16} aria-hidden="true" />
          {t("moderation.bar.signedIn", { name: admin.name })}
          {maintenance && <strong className="admin-bar__maintenance">{t("moderation.bar.maintenance")}</strong>}
        </p>
        <div className="admin-bar__links">
          {pending > 0 && (
            <Link to="/admin/listings?status=pending" className="admin-bar__link admin-bar__link--alert">
              {t("moderation.bar.pending", { count: pending })}
            </Link>
          )}
          <Link to="/admin" className="admin-bar__link">
            <LayoutDashboard size={16} aria-hidden="true" />
            {t("moderation.bar.dashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
