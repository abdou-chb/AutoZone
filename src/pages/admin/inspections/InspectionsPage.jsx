import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Pencil,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "../../../i18n/i18n-context";
import { CATEGORIES, getCategory, isCategoryKey, listingPath } from "../../../lib/categories";
import { formatDate, todayISO, wilayaName } from "../../../lib/format";
import { useToast } from "../../../lib/toast-context";
import useMediaQuery from "../../../lib/useMediaQuery";
import { isolate, requestNumber } from "../admin-config";
import { useAdmin } from "../admin-context";
import ConfirmDialog from "../ConfirmDialog";
import { LoadError, SkeletonRows } from "../PanelStates";
import ScheduleDialog from "../ScheduleDialog";
import { isQuietError } from "../listings/listing-helpers";
import { useAdminData } from "../useAdminSession";
import ZoneTag from "../ZoneTag";
import { AgendaView, MonthView, TimeGrid } from "./CalendarViews";
import {
  DEFAULT_STATUSES,
  STATUSES,
  VIEWS,
  daysBetween,
  eventDay,
  isISODate,
  rangeFor,
  rangeTitle,
  stepDate,
} from "./calendar-utils";
import EventPanel from "./EventPanel";
import VehiclePicker from "./VehiclePicker";
import "./calendar.css";

const TRAY_LIMIT = 6;
const VIEW_ICONS = { month: CalendarDays, week: CalendarRange, day: CalendarDays, agenda: CalendarRange };

function readStatuses(value) {
  if (!value) {
    return DEFAULT_STATUSES;
  }

  const list = value.split(",").filter((status) => STATUSES.includes(status));

  return list.length ? list : DEFAULT_STATUSES;
}

function collectVehicles(requests) {
  const byId = new Map();

  requests.forEach((item) => {
    const vehicle = byId.get(item.car_id) || {
      id: item.car_id,
      name: item.car_name,
      year: item.car_year,
      category: item.car_category,
      location: item.car_location,
      count: 0,
    };

    vehicle.count += 1;
    byId.set(item.car_id, vehicle);
  });

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

function Tray({ items, today, open, onToggle, onOpen, onSchedule, vehicleMode }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const shown = expanded ? items : items.slice(0, TRAY_LIMIT);

  return (
    <section className="cal-tray console-card" aria-labelledby={`${id}-title`}>
      <div className="console-card__head">
        <h2 id={`${id}-title`} className="cal-tray__title">
          {t("adminInspections.tray.title")}
          <span className={`badge ${items.length ? "badge--wait" : ""} numeric`}>{items.length}</span>
        </h2>
        {items.length > 0 && (
          <button type="button" className="admin-link-btn cal-tray__toggle" aria-expanded={open} aria-controls={`${id}-list`} onClick={onToggle}>
            {t(open ? "adminInspections.tray.hide" : "adminInspections.tray.show")}
          </button>
        )}
      </div>
      {items.length === 0 && <p className="cal-tray__empty">{t("adminInspections.tray.empty")}</p>}
      {items.length > 0 && (
        <div id={`${id}-list`} hidden={!open} className="cal-tray__body">
          <ul className="cal-tray__list">
            {shown.map((item) => {
              const late = item.preferred_date && item.preferred_date < today;

              return (
                <li key={item.id} className="cal-tray__item">
                  <button type="button" className="cal-tray__open" onClick={() => onOpen(item)}>
                    <span className="cal-tray__buyer">{item.buyer_full_name}</span>
                    {!vehicleMode && (
                      <span className="cal-tray__vehicle">
                        {item.car_name} {item.car_year}
                      </span>
                    )}
                    <span className={`cal-tray__date${late ? " is-late" : ""}`}>
                      {t(late ? "adminInspections.tray.late" : "adminInspections.tray.requestedFor", {
                        date: formatDate(item.preferred_date, { day: "numeric", month: "short" }),
                      })}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary btn--small"
                    onClick={() => onSchedule(item)}
                    aria-label={t("adminInspections.tray.scheduleLabel", {
                      number: requestNumber(item.id),
                      buyer: isolate(item.buyer_full_name),
                    })}
                  >
                    <CalendarPlus size={16} aria-hidden="true" />
                    {t("admin.inspections.actions.schedule")}
                  </button>
                </li>
              );
            })}
          </ul>
          {items.length > TRAY_LIMIT && (
            <button type="button" className="admin-link-btn cal-tray__more" onClick={() => setExpanded((value) => !value)}>
              {expanded ? t("adminInspections.tray.less") : t("adminInspections.tray.all", { count: items.length })}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function VehicleBanner({ vehicle, stats, onClear }) {
  const { t } = useI18n();
  const { icon: Icon, theme } = getCategory(vehicle.category);

  return (
    <section className="cal-vehicle console-card" aria-label={t("adminInspections.vehicle.calendar")}>
      <span className="cal-vehicle__icon" aria-hidden="true">
        <Icon size={24} color={theme.accent} />
      </span>
      <div className="cal-vehicle__main">
        <p className="cal-vehicle__eyebrow">{t("adminInspections.vehicle.calendar")}</p>
        <h2 className="cal-vehicle__name">
          {vehicle.name} {vehicle.year}
        </h2>
        <p className="cal-vehicle__meta">
          <ZoneTag category={vehicle.category} />
          {vehicle.location && (
            <span className="cal-panel__item">
              <MapPin size={16} aria-hidden="true" />
              {wilayaName(vehicle.location)}
            </span>
          )}
          <span>{t("adminInspections.vehicle.upcoming", { count: stats.upcoming })}</span>
          <span>{t("adminInspections.vehicle.toSchedule", { count: stats.pending })}</span>
        </p>
      </div>
      <div className="cal-vehicle__actions">
        <a className="btn btn--ghost btn--small" href={listingPath({ category: vehicle.category, id: vehicle.id })} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" className="flip-rtl" />
          {t("adminInspections.vehicle.public")}
          <span className="visually-hidden"> {t("admin.newTab")}</span>
        </a>
        <Link className="btn btn--ghost btn--small" to={`/admin/listings/${vehicle.id}`}>
          <Pencil size={16} aria-hidden="true" />
          {t("adminInspections.panel.editListing")}
        </Link>
        <button type="button" className="btn btn--outline btn--small" onClick={onClear}>
          <X size={16} aria-hidden="true" />
          {t("adminInspections.vehicle.clear")}
        </button>
      </div>
    </section>
  );
}

export default function InspectionsPage() {
  const { t } = useI18n();
  const showToast = useToast();
  const { request, refreshSummary, summary } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const phone = useMediaQuery("(max-width: 640px)");
  const [today] = useState(todayISO);
  const [busy, setBusy] = useState({});
  const [scheduling, setScheduling] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [trayOpen, setTrayOpen] = useState(null);
  const openedRef = useRef(null);
  const seenLastId = useRef(summary?.lastId);

  const viewParam = searchParams.get("view");
  const view = VIEWS.includes(viewParam) ? viewParam : phone ? "agenda" : "month";
  const date = isISODate(searchParams.get("date")) ? searchParams.get("date") : today;
  const statusParam = searchParams.get("status");
  const statuses = readStatuses(statusParam);
  const zone = isCategoryKey(searchParams.get("zone")) ? searchParams.get("zone") : "";
  const carId = Number.parseInt(searchParams.get("car"), 10) || null;
  const requestId = Number.parseInt(searchParams.get("request"), 10) || null;
  const range = rangeFor(view, date);
  const title = rangeTitle(view, date);

  const requests = useAdminData(request, "/api/admin/inspection-requests");
  const calendar = useAdminData(
    request,
    `/api/admin/inspections/calendar?from=${range.from}&to=${range.to}${carId ? `&carId=${carId}` : ""}`
  );
  const { reload: reloadRequests } = requests;
  const { reload: reloadCalendar } = calendar;

  const allRequests = requests.data?.requests || [];
  const byId = new Map(allRequests.map((item) => [item.id, item]));
  const slotMinutes = calendar.data?.slotMinutes || 60;
  const inZone = (item) => !zone || item.car_category === zone;
  const forCar = (item) => !carId || item.car_id === carId;

  const cancelled = statuses.includes("cancelled")
    ? allRequests.filter((item) => item.status === "cancelled" && forCar(item))
    : [];
  const events = [...(calendar.data?.events || []).map((item) => ({ ...item, ...byId.get(item.id) })), ...cancelled]
    .map((item) => ({ ...item, day: eventDay(item) }))
    .filter((item) => item.day >= range.from && item.day <= range.to)
    .filter((item) => statuses.includes(item.status) && inZone(item));

  const vehicles = collectVehicles(allRequests);
  const vehicle = carId ? vehicles.find((item) => item.id === carId) : null;
  const tray = allRequests
    .filter((item) => item.status === "pending" && inZone(item) && forCar(item))
    .sort((a, b) => String(a.preferred_date).localeCompare(String(b.preferred_date)) || a.id - b.id);
  const selected = requestId ? byId.get(requestId) : null;
  const showTray = trayOpen ?? (statusParam === "pending" || !phone);

  const updateParams = useCallback(
    (changes) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);

          Object.entries(changes).forEach(([key, value]) => {
            if (value) next.set(key, value);
            else next.delete(key);
          });

          return next;
        },
        { replace: true, preventScrollReset: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    const list = requests.data?.requests;

    if (!requestId || !list || openedRef.current === requestId) {
      return;
    }

    openedRef.current = requestId;
    const target = list.find((item) => item.id === requestId);

    if (!target) {
      updateParams({ request: "" });
      return;
    }

    const day = eventDay(target);

    if (isISODate(day)) {
      updateParams({ date: day });
    }
  }, [requestId, requests.data, updateParams]);

  const lastId = summary?.lastId;

  useEffect(() => {
    if (lastId === undefined || lastId === seenLastId.current) {
      return;
    }

    const known = seenLastId.current !== undefined;

    seenLastId.current = lastId;

    if (known) {
      reloadRequests();
      reloadCalendar();
    }
  }, [lastId, reloadRequests, reloadCalendar]);

  useEffect(() => {
    const list = requests.data?.requests;

    if (carId && list && !list.some((item) => item.car_id === carId)) {
      updateParams({ car: "" });
    }
  }, [carId, requests.data, updateParams]);

  function openItem(item, changes = {}) {
    openedRef.current = item.id;
    updateParams({ ...changes, request: String(item.id) });
  }

  function closeItem() {
    openedRef.current = null;
    updateParams({ request: "" });
  }

  function reloadAll() {
    reloadRequests();
    reloadCalendar();
    refreshSummary();
  }

  async function changeStatus(item, status) {
    setBusy((current) => ({ ...current, [item.id]: status }));

    try {
      await request(`/api/admin/inspection-requests/${item.id}/status`, { method: "PATCH", body: { status } });
      showToast(t(`admin.inspections.toasts.${status}`), { tone: "success" });
      reloadAll();
    } catch (error) {
      if (!isQuietError(error)) {
        showToast(error.message, { tone: "error" });
      }
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[item.id];

        return next;
      });
    }
  }

  function handleStatus(item, status) {
    if (status === "cancelled") {
      setCancelling(item);
    } else {
      changeStatus(item, status);
    }
  }

  async function handleSchedule(values) {
    const item = scheduling;

    await request(`/api/admin/inspection-requests/${item.id}/schedule`, { method: "PATCH", body: values });
    setScheduling(null);
    showToast(t(item.status === "pending" ? "admin.inspections.toasts.scheduled" : "adminInspections.toasts.moved"), {
      tone: "success",
    });
    updateParams({ date: values.appointmentDate });
    reloadAll();
  }

  function toggleStatus(status) {
    const next = statuses.includes(status) ? statuses.filter((item) => item !== status) : [...statuses, status];
    const ordered = STATUSES.filter((item) => next.includes(item));
    const isDefault = ordered.join(",") === DEFAULT_STATUSES.join(",");

    updateParams({ status: isDefault || !ordered.length ? "" : ordered.join(",") });
  }

  const loading = requests.loading || calendar.loading;
  const error = requests.error || calendar.error;
  const days = daysBetween(range.from, range.to);
  const viewProps = { today, events, onOpen: openItem, onDay: (day) => updateParams({ view: "day", date: day }), title };
  const vehicleStats = {
    upcoming: allRequests.filter((item) => forCar(item) && ["scheduled", "confirmed"].includes(item.status) && item.appointment_date >= today).length,
    pending: tray.length,
  };

  return (
    <div className="cal-page">
      <div className="console-head">
        <div>
          <h1>{t("adminInspections.title")}</h1>
          <p>{t("adminInspections.lead")}</p>
        </div>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {loading ? t("adminInspections.loading") : t("adminInspections.announce", { count: events.length, range: title })}
      </p>

      <div className="cal-controls console-card">
        <div className="cal-toolbar">
          <div className="cal-nav">
            <button type="button" className="btn btn--outline btn--small" onClick={() => updateParams({ date: "" })}>
              {t("adminInspections.today")}
            </button>
            <button
              type="button"
              className="admin-icon-btn"
              aria-label={t(`adminInspections.nav.previous.${view}`)}
              onClick={() => updateParams({ date: stepDate(view, date, -1) })}
            >
              <ChevronLeft size={20} aria-hidden="true" className="flip-rtl" />
            </button>
            <button
              type="button"
              className="admin-icon-btn"
              aria-label={t(`adminInspections.nav.next.${view}`)}
              onClick={() => updateParams({ date: stepDate(view, date, 1) })}
            >
              <ChevronRight size={20} aria-hidden="true" className="flip-rtl" />
            </button>
            <h2 className="cal-title">{title}</h2>
          </div>
          <div className="admin-segmented cal-views" role="group" aria-label={t("adminInspections.views.label")}>
            {VIEWS.map((item) => {
              const Icon = VIEW_ICONS[item];

              return (
                <button
                  key={item}
                  type="button"
                  className="admin-filter"
                  aria-pressed={view === item}
                  onClick={() => updateParams({ view: item })}
                >
                  <Icon size={16} aria-hidden="true" className="cal-views__icon" />
                  {t(`adminInspections.views.${item}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="cal-filters">
          {!vehicle && <VehiclePicker vehicles={vehicles.filter(inZone)} onSelect={(item) => updateParams({ car: String(item.id) })} />}
          <label className="visually-hidden" htmlFor="cal-zone">
            {t("adminInspections.filters.zone")}
          </label>
          <select id="cal-zone" className="select cal-zone" value={zone} onChange={(event) => updateParams({ zone: event.target.value })}>
            <option value="">{t("adminInspections.filters.allZones")}</option>
            {CATEGORIES.map((category) => (
              <option key={category.key} value={category.key}>
                {category.brand}
              </option>
            ))}
          </select>
          <div className="admin-chips cal-statuses" role="group" aria-label={t("adminInspections.filters.status")}>
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className="admin-filter"
                aria-pressed={statuses.includes(status)}
                onClick={() => toggleStatus(status)}
              >
                <span className={`cal-dot cal-dot--${status}`} aria-hidden="true" />
                {t(`adminInspections.status.${status}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {vehicle && <VehicleBanner vehicle={vehicle} stats={vehicleStats} onClear={() => updateParams({ car: "" })} />}

      {requests.data?.requests && (
        <Tray
          items={tray}
          today={today}
          open={showTray}
          onToggle={() => setTrayOpen(!showTray)}
          onOpen={(item) => openItem(item, isISODate(item.preferred_date) ? { date: item.preferred_date } : {})}
          onSchedule={setScheduling}
          vehicleMode={Boolean(vehicle)}
        />
      )}

      <div className="cal-body console-card" aria-busy={calendar.refreshing || undefined}>
        {loading && <SkeletonRows count={2} />}
        {!loading && error && (
          <LoadError
            message={error}
            onRetry={() => {
              reloadRequests();
              reloadCalendar();
            }}
            retrying={requests.refreshing || calendar.refreshing}
          />
        )}
        {!loading && !error && view === "month" && <MonthView {...viewProps} days={days} month={date.slice(0, 7)} />}
        {!loading && !error && (view === "week" || view === "day") && (
          <TimeGrid {...viewProps} days={days} slotMinutes={slotMinutes} vehicleMode={Boolean(vehicle)} />
        )}
        {!loading && !error && view === "agenda" && (
          <AgendaView
            {...viewProps}
            days={days}
            emptyTitle={t("adminInspections.empty.title")}
            emptyText={t(vehicle ? "adminInspections.empty.vehicle" : "adminInspections.empty.text")}
          />
        )}
      </div>

      <ul className="cal-legend" aria-label={t("adminInspections.legend")}>
        {STATUSES.map((status) => (
          <li key={status}>
            <span className={`cal-dot cal-dot--${status}`} aria-hidden="true" />
            {t(`adminInspections.status.${status}`)}
          </li>
        ))}
      </ul>

      {selected && (
        <EventPanel
          item={selected}
          busy={busy[selected.id]}
          vehicleMode={Boolean(vehicle)}
          onClose={closeItem}
          onSchedule={setScheduling}
          onStatus={handleStatus}
          onVehicle={(item) => updateParams({ car: String(item.car_id), request: "" })}
        />
      )}

      {cancelling && (
        <ConfirmDialog
          title={t("admin.inspections.cancelDialog.title", { number: requestNumber(cancelling.id) })}
          description={t("admin.inspections.cancelDialog.description", {
            vehicle: isolate(`${cancelling.car_name} ${cancelling.car_year}`),
            buyer: isolate(cancelling.buyer_full_name),
          })}
          confirmLabel={t("admin.inspections.cancelDialog.confirm")}
          cancelLabel={t("admin.inspections.cancelDialog.keep")}
          onConfirm={() => {
            const item = cancelling;

            setCancelling(null);
            changeStatus(item, "cancelled");
          }}
          onClose={() => setCancelling(null)}
        />
      )}

      {scheduling && <ScheduleDialog request={scheduling} onSubmit={handleSchedule} onClose={() => setScheduling(null)} />}
    </div>
  );
}
