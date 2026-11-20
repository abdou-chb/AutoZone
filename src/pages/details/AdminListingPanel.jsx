import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PencilLine, ShieldCheck, Trash2 } from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal";
import StatusBadge from "../../components/StatusBadge";
import { useI18n } from "../../i18n/i18n-context";
import { adminRequest, useAdminPresence } from "../../lib/admin-presence";
import { clearResourceCache } from "../../lib/api";
import { useSavedCars } from "../../lib/saved-context";
import { useToast } from "../../lib/toast-context";
import "./AdminListingPanel.css";

export default function AdminListingPanel({ listing, category }) {
  const { t } = useI18n();
  const admin = useAdminPresence();
  const navigate = useNavigate();
  const showToast = useToast();
  const { removeSaved } = useSavedCars();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deleteRef = useRef(null);

  if (!admin) {
    return null;
  }

  const status = listing.status || "approved";
  const isPublic = status === "approved";

  async function remove() {
    setBusy(true);
    setError("");

    try {
      const result = await adminRequest(`/api/admin/cars/${listing.id}`, { method: "DELETE" });

      clearResourceCache();
      removeSaved(listing.id);
      showToast(
        result.inspectionsRemoved
          ? t("moderation.deletedWithInspections", { name: listing.name, count: result.inspectionsRemoved })
          : t("moderation.deleted", { name: listing.name }),
        { tone: "success" }
      );
      navigate(category.home, { replace: true });
    } catch (failure) {
      setBusy(false);
      setError(failure.status === 401 ? t("moderation.sessionExpired") : failure.message);
    }
  }

  return (
    <section className="admin-listing" aria-labelledby="admin-listing-title">
      <div className="admin-listing__head">
        <ShieldCheck size={18} aria-hidden="true" />
        <h2 id="admin-listing-title">{t("moderation.panel.title")}</h2>
        <StatusBadge status={status} kind="listing" />
        {listing.featured && <span className="badge badge--signal">{t("moderation.panel.featured")}</span>}
      </div>

      <p className="admin-listing__text">{isPublic ? t("moderation.panel.public") : t("moderation.panel.hidden")}</p>

      <div className="admin-listing__actions">
        <Link to={`/admin/listings/${listing.id}`} className="btn btn--outline btn--small">
          <PencilLine size={16} aria-hidden="true" />
          {t("moderation.panel.edit")}
        </Link>
        <button ref={deleteRef} type="button" className="btn btn--danger btn--small" onClick={() => setConfirming(true)}>
          <Trash2 size={16} aria-hidden="true" />
          {t("moderation.panel.delete")}
        </button>
      </div>

      {confirming && (
        <ConfirmModal
          title={t("moderation.confirm.title")}
          confirmLabel={t("moderation.confirm.action")}
          busy={busy}
          error={error}
          onConfirm={remove}
          onClose={() => {
            setConfirming(false);
            setError("");
            window.requestAnimationFrame(() => deleteRef.current?.focus());
          }}
        >
          <p>{t("moderation.confirm.text")}</p>
          <p>
            <strong>
              {listing.name} {listing.year}
            </strong>
          </p>
          <p>{t("moderation.confirm.details")}</p>
        </ConfirmModal>
      )}
    </section>
  );
}
