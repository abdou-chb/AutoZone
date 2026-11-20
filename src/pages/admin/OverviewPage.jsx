import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CarFront, FileCheck2, Mail, Store, Wrench } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";
import { CATEGORIES } from "../../lib/categories";
import { formatDate, formatRelativeDay } from "../../lib/format";
import { activityLabel } from "./activity-labels";
import { useAdmin } from "./admin-context";
import { LoadError } from "./PanelStates";
import { useAdminData } from "./useAdminSession";
import "./overview.css";

function parseDetails(entry) {
  if (typeof entry.details !== "string") {
    return entry;
  }

  try {
    return { ...entry, details: JSON.parse(entry.details) };
  } catch {
    return { ...entry, details: {} };
  }
}

function Spark({ title, total, values, tone }) {
  const max = Math.max(1, ...values.map((point) => point.value));

  return (
    <figure className={`spark spark--${tone}`}>
      <figcaption>
        <span className="spark__title">{title}</span>
        <strong className="spark__total numeric">{total}</strong>
      </figcaption>
      <div className="spark__bars" role="img" aria-label={`${title}: ${total}`}>
        {values.map((point) => (
          <span
            key={point.day}
            className="spark__bar"
            style={{ "--h": point.value / max }}
            title={`${formatDate(point.day, { day: "numeric", month: "short" })}: ${point.value}`}
          />
        ))}
      </div>
    </figure>
  );
}

export default function OverviewPage() {
  const { t } = useI18n();
  const { request, me, summary } = useAdmin();
  const overview = useAdminData(request, "/api/admin/overview");
  const { reload } = overview;
  const lastId = summary?.lastId;
  const seenLastId = useRef(lastId);
  const data = overview.data;

  useEffect(() => {
    if (lastId === undefined || lastId === seenLastId.current) {
      return;
    }

    const known = seenLastId.current !== undefined;

    seenLastId.current = lastId;

    if (known) {
      reload();
    }
  }, [lastId, reload]);

  const byStatus = data?.listings.byStatus || {};
  const tiles = [
    { to: "/admin/listings?status=pending", icon: CarFront, label: "toReview", value: byStatus.pending, urgent: true },
    { to: "/admin/inspections?status=pending", icon: CalendarDays, label: "toSchedule", value: data?.inspections.pending, urgent: true },
    { to: "/admin/messages?status=new", icon: Mail, label: "newMessages", value: data?.messages.new, urgent: true },
    { to: "/admin/car-requests", icon: FileCheck2, label: "carRequests", value: data?.carRequests?.pending, urgent: true },
    { to: "/admin/repair-requests", icon: Wrench, label: "repairRequests", value: data?.repairRequests?.submitted, urgent: true },
    { to: "/admin/listings?status=approved", icon: Store, label: "live", value: byStatus.approved },
  ];

  const series = data?.series || [];
  const sum = (key) => series.reduce((total, point) => total + point[key], 0);

  return (
    <div className="overview">
      <div className="console-head">
        <div>
          <h1>{me ? t("adminShell.overview.hello", { name: me.name.split(" ")[0] }) : t("adminShell.nav.overview")}</h1>
          <p>{t("adminShell.overview.lead")}</p>
        </div>
      </div>

      {overview.error && <LoadError message={overview.error} onRetry={overview.reload} retrying={overview.refreshing} />}

      <ul className="overview__tiles">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const value = tile.value || 0;

          return (
            <li key={tile.label}>
              <Link to={tile.to} className={`overview-tile${tile.urgent && value > 0 ? " is-urgent" : ""}`}>
                <span className="overview-tile__icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="overview-tile__value numeric">{data ? value : "–"}</span>
                <span className="overview-tile__label">{t(`adminShell.overview.tiles.${tile.label}`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="console-card overview__activity" aria-labelledby="overview-trend">
        <div className="console-card__head">
          <h2 id="overview-trend">{t("adminShell.overview.last30")}</h2>
        </div>
        <div className="console-card__body overview__sparks">
          <Spark
            title={t("adminShell.overview.series.listings")}
            total={sum("listings")}
            tone="listings"
            values={series.map((point) => ({ day: point.day, value: point.listings }))}
          />
          <Spark
            title={t("adminShell.overview.series.inspections")}
            total={sum("inspections")}
            tone="inspections"
            values={series.map((point) => ({ day: point.day, value: point.inspections }))}
          />
          <Spark
            title={t("adminShell.overview.series.messages")}
            total={sum("messages")}
            tone="messages"
            values={series.map((point) => ({ day: point.day, value: point.messages }))}
          />
        </div>
      </section>

      <div className="overview__grid">
        <section className="console-card" aria-labelledby="overview-zones">
          <div className="console-card__head">
            <h2 id="overview-zones">{t("adminShell.overview.zones")}</h2>
            <Link to="/admin/listings" className="admin-link-btn">
              {t("adminShell.overview.seeListings")}
            </Link>
          </div>
          <div className="overview__table-wrap">
            <table className="overview__table">
              <thead>
                <tr>
                  <th scope="col">{t("adminShell.overview.zone")}</th>
                  {["approved", "pending", "sold", "rejected"].map((status) => (
                    <th scope="col" key={status} className="numeric">
                      {t(`adminShell.overview.status.${status}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((zone) => {
                  const Icon = zone.icon;
                  const counts = data?.listings.byZone[zone.key] || {};

                  return (
                    <tr key={zone.key}>
                      <th scope="row">
                        <Link to={`/admin/listings?zone=${zone.key}`} className="overview__zone" style={{ "--zone": zone.theme.accent }}>
                          <Icon size={16} aria-hidden="true" />
                          {zone.brand}
                        </Link>
                      </th>
                      {["approved", "pending", "sold", "rejected"].map((status) => (
                        <td key={status} className="numeric">
                          {counts[status] || 0}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="console-card" aria-labelledby="overview-upcoming">
          <div className="console-card__head">
            <h2 id="overview-upcoming">{t("adminShell.overview.upcoming")}</h2>
            <Link to="/admin/inspections" className="admin-link-btn">
              {t("adminShell.overview.openCalendar")}
            </Link>
          </div>
          {data?.upcoming.length ? (
            <ul className="overview__list">
              {data.upcoming.map((item) => (
                <li key={item.id}>
                  <Link to={`/admin/inspections?request=${item.id}`} className="overview__appointment">
                    <span className="overview__date">
                      <strong className="numeric">{formatDate(item.appointment_date, { day: "numeric" })}</strong>
                      <span>{formatDate(item.appointment_date, { month: "short" })}</span>
                    </span>
                    <span className="overview__appointment-text">
                      <strong>
                        {item.car_name} {item.car_year}
                      </strong>
                      <span className="overview__meta">
                        <span className="ltr">{item.appointment_time}</span>
                        <span>{item.buyer_full_name}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview__empty">{t("adminShell.overview.noUpcoming")}</p>
          )}
        </section>

        <section className="console-card overview__recent" aria-labelledby="overview-recent">
          <div className="console-card__head">
            <h2 id="overview-recent">{t("adminShell.overview.recent")}</h2>
            <Link to="/admin/activity" className="admin-link-btn">
              {t("adminShell.overview.seeActivity")}
            </Link>
          </div>
          {data?.activity.length ? (
            <ul className="overview__list">
              {data.activity.map(parseDetails).map((entry) => (
                <li key={entry.id} className="overview__entry">
                  <span>{activityLabel(t, entry)}</span>
                  <span className="overview__meta">
                    <span>{entry.admin_name || t("adminShell.activity.system")}</span>
                    <span>{formatRelativeDay(entry.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview__empty">{t("adminShell.overview.noActivity")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
