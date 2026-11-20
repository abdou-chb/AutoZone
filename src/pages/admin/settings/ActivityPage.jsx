import { useSearchParams } from "react-router-dom";
import { CalendarDays, CarFront, FileCheck2, History, Mail, Settings, Tags, Users } from "lucide-react";
import Pagination from "../../../components/Pagination";
import { useI18n } from "../../../i18n/i18n-context";
import { formatDate, formatRelativeDay } from "../../../lib/format";
import { activityLabel } from "../activity-labels";
import { useAdmin } from "../admin-context";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import { CardSkeleton } from "./settings-ui";
import { dayKey, toDate } from "./settings-utils";
import "./settings.css";

const PAGE_SIZE = 40;
const SYSTEM = "system";

const TYPES = {
  listings: { prefixes: ["listing"], icon: CarFront },
  inspections: { prefixes: ["inspection"], icon: CalendarDays },
  messages: { prefixes: ["message"], icon: Mail },
  carRequests: { prefixes: ["tuning"], icon: FileCheck2 },
  brands: { prefixes: ["brand"], icon: Tags },
  settings: { prefixes: ["settings"], icon: Settings },
  team: { prefixes: ["user", "account", "auth"], icon: Users },
};

function typeOf(action) {
  const prefix = action.split(".")[0];

  return Object.keys(TYPES).find((type) => TYPES[type].prefixes.includes(prefix)) || "";
}

function dayTitle(date, value) {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

  if (dayKey(date) === dayKey(today) || dayKey(date) === dayKey(yesterday)) {
    return formatRelativeDay(value);
  }

  return formatDate(value, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function detailText(t, entry) {
  if (entry.action === "settings.update" && entry.details?.key) {
    return t(`adminSettings.activity.settingKeys.${entry.details.key}`);
  }

  if (entry.action === "user.update" && entry.details?.role) {
    return t("adminSettings.activity.userDetails", {
      role: t(`adminShell.roles.${entry.details.role}`),
      state: entry.details.active ? t("adminSettings.team.active") : t("adminSettings.team.inactive"),
    });
  }

  return "";
}

export default function ActivityPage() {
  const { t } = useI18n();
  const { request } = useAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(searchParams.get("page"), 10) || 1);
  const person = searchParams.get("who") || "";
  const type = TYPES[searchParams.get("type")] ? searchParams.get("type") : "";
  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });

  if (person) query.set("adminId", person);
  if (type) query.set("type", type);

  const log = useAdminData(request, `/api/admin/activity?${query}`);
  const shown = log.data?.items || [];
  const people = (log.data?.people || []).map((entry) => ({
    value: entry.id ? String(entry.id) : SYSTEM,
    name: entry.id ? entry.name || `#${entry.id}` : t("adminShell.activity.system"),
  }));
  const filtered = Boolean(person || type);

  const days = shown.reduce((groups, entry) => {
    const date = toDate(entry.created_at);
    const key = date ? dayKey(date) : "";
    const last = groups[groups.length - 1];

    if (last?.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, date, value: entry.created_at, entries: [entry] });
    }

    return groups;
  }, []);

  function setParam(name, value) {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(name, value);
    } else {
      next.delete(name);
    }

    next.delete("page");
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  function hrefFor(target) {
    const next = new URLSearchParams(searchParams);

    next.set("page", String(target));

    return `?${next.toString()}`;
  }

  function goTo(target) {
    const next = new URLSearchParams(searchParams);

    next.set("page", String(target));
    setSearchParams(next);
    document.getElementById("activity-title")?.focus();
  }

  return (
    <div className="set-page">
      <div className="console-head">
        <div>
          <h1 id="activity-title" tabIndex={-1}>
            {t("adminShell.nav.activity")}
          </h1>
          <p>{t("adminSettings.activity.lead")}</p>
        </div>
      </div>

      <div className="set-filters" role="group" aria-label={t("adminSettings.activity.filters")}>
        <div className="field">
          <label className="field__label" htmlFor="activity-who">
            {t("adminSettings.activity.person")}
          </label>
          <select id="activity-who" className="select" value={person} onChange={(event) => setParam("who", event.target.value)}>
            <option value="">{t("adminSettings.activity.everyone")}</option>
            {people.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="activity-type">
            {t("adminSettings.activity.type")}
          </label>
          <select id="activity-type" className="select" value={type} onChange={(event) => setParam("type", event.target.value)}>
            <option value="">{t("adminSettings.activity.allTypes")}</option>
            {Object.keys(TYPES).map((key) => (
              <option key={key} value={key}>
                {t(`adminSettings.activity.types.${key}`)}
              </option>
            ))}
          </select>
        </div>
        {filtered && (
          <button
            type="button"
            className="btn btn--ghost set-filters__clear"
            onClick={() => {
              const next = new URLSearchParams(searchParams);

              next.delete("who");
              next.delete("type");
              next.delete("page");
              setSearchParams(next, { replace: true, preventScrollReset: true });
            }}
          >
            {t("common.actions.clearFilters")}
          </button>
        )}
      </div>

      {log.data && (
        <p className="set-filters__note" aria-live="polite">
          {t("adminSettings.activity.total", { count: log.data.total })}
        </p>
      )}

      {log.error && <LoadError message={log.error} onRetry={log.reload} retrying={log.refreshing} />}
      {log.loading && <CardSkeleton count={2} />}

      {log.data && !shown.length && (
        <div className="console-card set-empty">
          <History size={28} aria-hidden="true" />
          <p>{filtered ? t("adminSettings.activity.noMatch") : t("adminSettings.activity.empty")}</p>
        </div>
      )}

      {days.length > 0 && (
        <div className={`set-timeline${log.refreshing ? " is-busy" : ""}`}>
          {days.map((day) => (
            <section key={day.key} className="set-day" aria-labelledby={`day-${day.key}`}>
              <h2 id={`day-${day.key}`} className="set-day__title">
                {day.date ? dayTitle(day.date, day.value) : "–"}
              </h2>
              <ol className="set-events">
                {day.entries.map((entry) => {
                  const kind = typeOf(entry.action);
                  const Icon = TYPES[kind]?.icon || History;
                  const detail = detailText(t, entry);

                  return (
                    <li key={entry.id ?? `${entry.created_at}-${entry.action}`} className="set-event">
                      <span className={`set-event__icon set-event__icon--${kind || "other"}`} aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <div className="set-event__body">
                        <p className="set-event__text">{activityLabel(t, entry)}</p>
                        {detail && <p className="set-event__detail">{detail}</p>}
                        <p className="set-event__meta">
                          <span>{entry.admin_name || t("adminShell.activity.system")}</span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={toDate(entry.created_at)?.toISOString()} className="numeric">
                            {formatDate(entry.created_at, { hour: "2-digit", minute: "2-digit" })}
                          </time>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {log.data && (
        <Pagination
          page={log.data.page}
          pages={log.data.pages}
          hrefFor={hrefFor}
          onChange={goTo}
          busy={log.refreshing || log.loading}
          label={t("adminSettings.activity.pages")}
        />
      )}
    </div>
  );
}
