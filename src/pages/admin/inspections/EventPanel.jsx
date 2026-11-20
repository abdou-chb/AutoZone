import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CircleCheck,
  Clock,
  ExternalLink,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  User,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import StatusBadge from "../../../components/StatusBadge";
import { useI18n } from "../../../i18n/i18n-context";
import { listingPath } from "../../../lib/categories";
import { formatDate, wilayaName } from "../../../lib/format";
import { arrangementLabel, relativeDayPhrase, requestNumber } from "../admin-config";
import AdminDialog from "../AdminDialog";
import ZoneTag from "../ZoneTag";

function Appointment({ request }) {
  const { t } = useI18n();
  const rows = [
    { key: "date", value: formatDate(request.appointment_date) },
    { key: "time", value: request.appointment_time && <span className="ltr">{request.appointment_time}</span> },
    { key: "place", value: request.meeting_location && <bdi>{request.meeting_location}</bdi> },
    { key: "arrangement", value: request.arrangement && arrangementLabel(request.arrangement) },
    { key: "payment", value: request.payment_instructions && <bdi>{request.payment_instructions}</bdi> },
  ].filter((row) => row.value);

  return (
    <div className="admin-appointment">
      <h3 className="admin-appointment__title">
        <CalendarCheck size={16} aria-hidden="true" />
        {t("admin.inspections.appointment")}
      </h3>
      <dl className="admin-appointment__list">
        {rows.map((row) => (
          <div key={row.key} className="admin-appointment__row">
            <dt>{t(`admin.inspections.fields.${row.key}`)}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function EventPanel({ item, busy, onSchedule, onStatus, onVehicle, vehicleMode, onClose }) {
  const { t } = useI18n();
  const open = ["pending", "scheduled", "confirmed"].includes(item.status);
  const hasAppointment = ["scheduled", "confirmed", "completed"].includes(item.status) || Boolean(item.appointment_date);

  function statusButton(status, labelKey, className, Icon) {
    return (
      <button type="button" className={`btn ${className}`} onClick={() => onStatus(item, status)} disabled={Boolean(busy)}>
        {busy === status ? <span className="spinner" aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
        {t(labelKey)}
      </button>
    );
  }

  return (
    <AdminDialog
      title={t("admin.inspections.title", { number: requestNumber(item.id) })}
      onClose={onClose}
      size="drawer"
    >
      <div className="cal-panel" aria-busy={Boolean(busy) || undefined}>
        <div className="cal-panel__status">
          <StatusBadge kind="inspection" status={item.status} />
          {item.created_at && (
            <span className="cal-panel__received">
              <Clock size={16} aria-hidden="true" />
              {relativeDayPhrase("received", item.created_at)}
            </span>
          )}
        </div>

        <section className="cal-panel__section" aria-labelledby={`vehicle-${item.id}`}>
          <h3 id={`vehicle-${item.id}`} className="cal-panel__heading">
            {t("adminInspections.panel.vehicle")}
          </h3>
          <p className="cal-panel__vehicle">
            <a
              className="text-link"
              href={listingPath({ category: item.car_category, id: item.car_id })}
              target="_blank"
              rel="noreferrer"
            >
              {item.car_name} {item.car_year}
              <ExternalLink size={16} aria-hidden="true" className="flip-rtl" />
              <span className="visually-hidden"> {t("admin.newTab")}</span>
            </a>
          </p>
          <p className="cal-panel__meta">
            <ZoneTag category={item.car_category} />
            {item.car_location && (
              <span className="cal-panel__item">
                <MapPin size={16} aria-hidden="true" />
                {wilayaName(item.car_location)}
              </span>
            )}
          </p>
          <div className="cal-panel__links">
            {!vehicleMode && (
              <button type="button" className="btn btn--outline btn--small" onClick={() => onVehicle(item)}>
                <CalendarRange size={16} aria-hidden="true" />
                {t("adminInspections.panel.vehicleCalendar")}
              </button>
            )}
            <Link className="btn btn--ghost btn--small" to={`/admin/listings/${item.car_id}`}>
              <Pencil size={16} aria-hidden="true" />
              {t("adminInspections.panel.editListing")}
            </Link>
          </div>
        </section>

        <section className="cal-panel__section" aria-labelledby={`buyer-${item.id}`}>
          <h3 id={`buyer-${item.id}`} className="cal-panel__heading">
            {t("adminInspections.panel.buyer")}
          </h3>
          <div className="admin-contact">
            <span className="admin-contact__name">
              <User size={16} aria-hidden="true" />
              {item.buyer_full_name}
            </span>
            {item.buyer_phone && (
              <a className="admin-contact__link numeric" href={`tel:${item.buyer_phone.replace(/\s+/g, "")}`}>
                <Phone size={16} aria-hidden="true" />
                <span className="ltr">{item.buyer_phone}</span>
              </a>
            )}
            {item.preferred_date && (
              <span className="admin-contact__item">
                <CalendarDays size={16} aria-hidden="true" />
                {t("admin.inspections.prefers", { date: formatDate(item.preferred_date) })}
              </span>
            )}
          </div>
          {item.message && (
            <div className="admin-message">
              <MessageSquare size={16} aria-hidden="true" />
              <p dir="auto">{item.message}</p>
            </div>
          )}
        </section>

        {hasAppointment && <Appointment request={item} />}

        {open && (
          <div className="cal-panel__actions">
            {item.status === "pending" && (
              <button type="button" className="btn btn--primary" onClick={() => onSchedule(item)} disabled={Boolean(busy)}>
                <CalendarPlus size={18} aria-hidden="true" />
                {t("admin.inspections.actions.schedule")}
              </button>
            )}
            {item.status === "scheduled" &&
              statusButton("confirmed", "admin.inspections.actions.confirm", "btn--success", CircleCheck)}
            {item.status === "confirmed" &&
              statusButton("completed", "admin.inspections.actions.complete", "btn--success", CircleCheck)}
            {item.status !== "pending" && (
              <button type="button" className="btn btn--outline" onClick={() => onSchedule(item)} disabled={Boolean(busy)}>
                <CalendarDays size={18} aria-hidden="true" />
                {t("adminInspections.panel.reschedule")}
              </button>
            )}
            {statusButton("cancelled", "admin.inspections.actions.cancel", "btn--danger", X)}
          </div>
        )}
      </div>
    </AdminDialog>
  );
}
