import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CircleCheck, CircleX, Info, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useI18n } from "../../../i18n/i18n-context";
import { formatDate, formatPrice } from "../../../lib/format";
import { useToast } from "../../../lib/toast-context";
import { isolate } from "../admin-config";
import { useAdmin } from "../admin-context";
import ConfirmDialog from "../ConfirmDialog";
import { isQuietError } from "../listings/listing-helpers";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import { languageName, telHref, whatsappHref } from "../messages/message-utils";
import { referenceText, STATUS_TONES } from "./car-request-utils";

const LONG_DATE = { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" };

// One request under review: who asked, for which car and configuration, and the decision (once, from pending).
export default function CarRequestReader({ id, backHref, focusOnLoad, onChanged }) {
  const { t } = useI18n();
  const showToast = useToast();
  const { request, refreshSummary } = useAdmin();
  const detail = useAdminData(request, `/api/admin/tuning-requests/${id}`);
  const [override, setOverride] = useState(null);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const headingRef = useRef(null);
  const fieldId = useId();
  const item = override || detail.data?.request;

  useEffect(() => {
    if (detail.data?.request && focusOnLoad) {
      headingRef.current?.focus();
    }
  }, [detail.data, focusOnLoad]);

  async function decide(status) {
    setConfirm(null);
    setBusy(true);

    try {
      const data = await request(`/api/admin/tuning-requests/${id}/status`, { method: "PATCH", body: { status, note } });

      setOverride(data.request);
      showToast(t(`adminCarRequests.toasts.${status}`), { tone: "success" });
      refreshSummary();
      onChanged();
    } catch (error) {
      if (!isQuietError(error)) {
        showToast(error.message, { tone: "error" });
      }

      if (error?.status === 409) {
        detail.reload();
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link className="btn btn--ghost btn--small inbox-reader__back" to={backHref}>
      <ArrowLeft size={18} aria-hidden="true" className="flip-rtl" />
      {t("adminCarRequests.back")}
    </Link>
  );

  if (detail.error) {
    return (
      <div className="inbox-reader__state">
        {back}
        <LoadError message={detail.error} onRetry={detail.reload} retrying={detail.refreshing} />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="inbox-reader__state" aria-busy="true">
        {back}
        <p className="visually-hidden" role="status">
          {t("adminCarRequests.loadingRequest")}
        </p>
        <div className="skeleton admin-skeleton-line admin-skeleton-line--title" />
        <div className="skeleton admin-skeleton-line" />
        <div className="skeleton admin-skeleton-line admin-skeleton-line--short" />
      </div>
    );
  }

  const configuration = item.configuration || {};
  const lines = Array.isArray(configuration.lines) ? configuration.lines : [];
  const included = Array.isArray(configuration.included) ? configuration.included : [];
  const whatsapp = whatsappHref(item.phone);
  const pending = item.status === "pending";

  return (
    <article className="inbox-reader__message car-request" aria-labelledby={`${fieldId}-title`} aria-busy={busy || undefined}>
      {back}

      <header className="inbox-reader__head">
        <div className="inbox-reader__tags">
          <span className={`badge badge--${STATUS_TONES[item.status]}`}>{t(`adminCarRequests.status.${item.status}`)}</span>
          <span className="badge numeric">{referenceText(item.reference)}</span>
          <span className="badge inbox-lang" title={t("adminCarRequests.writtenIn", { language: languageName(item.language) })}>
            <span aria-hidden="true">{item.language.toUpperCase()}</span>
            <span className="visually-hidden">{t("adminCarRequests.writtenIn", { language: languageName(item.language) })}</span>
          </span>
        </div>
        <h2 id={`${fieldId}-title`} ref={headingRef} tabIndex={-1} className="inbox-reader__subject">
          {item.vehicle_name}
        </h2>
        <p className="inbox-reader__date">{t("adminCarRequests.received", { date: formatDate(item.created_at, LONG_DATE) })}</p>
      </header>

      <section className="inbox-sender" aria-label={t("adminCarRequests.applicant")}>
        <span className="inbox-sender__avatar" aria-hidden="true">
          {item.full_name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="inbox-sender__main">
          <p className="inbox-sender__name">
            <bdi>{item.full_name}</bdi>
          </p>
          <ul className="inbox-sender__links">
            <li>
              <a className="admin-contact__link numeric" href={telHref(item.phone)}>
                <Phone size={16} aria-hidden="true" />
                <span className="ltr">{item.phone}</span>
              </a>
            </li>
            {item.email && (
              <li>
                <a className="admin-contact__link" href={`mailto:${item.email}`}>
                  <Mail size={16} aria-hidden="true" />
                  <span className="ltr">{item.email}</span>
                </a>
              </li>
            )}
            {whatsapp && (
              <li>
                <a className="admin-contact__link" href={whatsapp} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} aria-hidden="true" />
                  {t("adminCarRequests.whatsapp")}
                  <span className="visually-hidden"> {t("admin.newTab")}</span>
                </a>
              </li>
            )}
            <li className="admin-contact__link">
              <MapPin size={16} aria-hidden="true" />
              <bdi>{item.wilaya}</bdi>
            </li>
          </ul>
        </div>
      </section>

      {item.message && (
        <div className="inbox-body" dir="auto" lang={item.language}>
          {item.message}
        </div>
      )}

      <section className="car-request__config" aria-labelledby={`${fieldId}-config`}>
        <h3 id={`${fieldId}-config`} className="car-request__heading">
          {t("adminCarRequests.configuration")}
        </h3>
        {lines.length > 0 ? (
          <table className="car-request__table">
            <thead>
              <tr>
                <th scope="col">{t("adminCarRequests.part")}</th>
                <th scope="col">{t("adminCarRequests.choice")}</th>
                <th scope="col" className="car-request__price">
                  {t("adminCarRequests.price")}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.group}>
                  <td>
                    <bdi>{line.groupLabel}</bdi>
                  </td>
                  <td>
                    <bdi>{line.optionLabel}</bdi>
                  </td>
                  <td className="car-request__price numeric">{formatPrice(line.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="car-request__muted">{t("adminCarRequests.noPaid")}</p>
        )}
        {included.length > 0 && (
          <>
            <h4 className="car-request__subheading">{t("adminCarRequests.included")}</h4>
            <ul className="car-request__included">
              {included.map((line) => (
                <li key={line.group}>
                  <bdi>{line.groupLabel}</bdi>
                  <bdi>{line.optionLabel}</bdi>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="car-request__total">
          <span>{t("adminCarRequests.total")}</span>
          <strong className="numeric">{formatPrice(item.total)}</strong>
        </p>
        <p className="car-request__note">
          <Info size={16} aria-hidden="true" />
          {t("adminCarRequests.illustrative")}
        </p>
      </section>

      {pending ? (
        <section className="car-request__decide" aria-labelledby={`${fieldId}-decide`}>
          <h3 id={`${fieldId}-decide`} className="car-request__heading">
            {t("adminCarRequests.decide")}
          </h3>
          <label className="field__label" htmlFor={`${fieldId}-note`}>
            {t("adminCarRequests.note.label")}
          </label>
          <p id={`${fieldId}-hint`} className="field__hint">
            {t("adminCarRequests.note.hint")}
          </p>
          <textarea
            id={`${fieldId}-note`}
            className="textarea"
            maxLength={500}
            aria-describedby={`${fieldId}-hint`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="inbox-actions">
            <button type="button" className="btn btn--success" disabled={busy} onClick={() => setConfirm("approved")}>
              {busy ? <span className="spinner" aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}
              {t("adminCarRequests.actions.approve")}
            </button>
            <button type="button" className="btn btn--danger" disabled={busy} onClick={() => setConfirm("rejected")}>
              <CircleX size={18} aria-hidden="true" />
              {t("adminCarRequests.actions.reject")}
            </button>
          </div>
        </section>
      ) : (
        <section className={`car-request__decision car-request__decision--${item.status}`} aria-label={t("adminCarRequests.decision")}>
          <p className="car-request__decision-title">
            {t(`adminCarRequests.decided.${item.status}`, {
              name: isolate(item.reviewed_by_name || t("adminCarRequests.someone")),
              date: formatDate(item.reviewed_at, LONG_DATE),
            })}
          </p>
          {item.decision_note && (
            <p className="car-request__decision-note" dir="auto">
              {item.decision_note}
            </p>
          )}
        </section>
      )}

      {confirm && (
        <ConfirmDialog
          title={t(`adminCarRequests.confirm.${confirm}.title`)}
          description={t(`adminCarRequests.confirm.${confirm}.description`, { name: isolate(item.full_name), car: isolate(item.vehicle_name) })}
          confirmLabel={t(`adminCarRequests.confirm.${confirm}.confirm`)}
          cancelLabel={t("adminCarRequests.confirm.keep")}
          tone={confirm === "approved" ? "success" : "danger"}
          onConfirm={() => decide(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </article>
  );
}
