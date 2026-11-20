import { useEffect, useRef } from "react";
import { CalendarClock } from "lucide-react";
import EmptyState from "../../../components/EmptyState";
import { useI18n } from "../../../i18n/i18n-context";
import { getLanguage } from "../../../i18n/core";
import { isolate } from "../admin-config";
import {
  DAY_END,
  DAY_START,
  addDays,
  formatDay,
  isTimed,
  isWeekend,
  layoutLanes,
  nowMinutes,
  overlaps,
  toMinutes,
  toTime,
} from "./calendar-utils";

const MONTH_LIMIT = 3;

function vehicleOf(item) {
  return `${item.car_name} ${item.car_year}`;
}

function useEventLabel() {
  const { t } = useI18n();

  return (item) => {
    const values = {
      vehicle: isolate(vehicleOf(item)),
      buyer: isolate(item.buyer_full_name),
      status: t(`adminInspections.status.${item.status}`),
    };

    if (isTimed(item)) {
      return t("adminInspections.event.label", { ...values, time: item.appointment_time });
    }

    return t("adminInspections.event.requested", values);
  };
}

export function EventButton({ item, variant, onOpen, style, showVehicle = true }) {
  const { t } = useI18n();
  const label = useEventLabel();
  const timed = isTimed(item);

  return (
    <button
      type="button"
      className={`cal-event cal-event--${item.status} cal-event--${variant}${timed ? "" : " is-untimed"}`}
      style={style}
      onClick={() => onOpen(item)}
      aria-label={label(item)}
      data-event={item.id}
    >
      <span className="cal-event__time ltr numeric">{timed ? item.appointment_time : t("adminInspections.event.requestedShort")}</span>
      {showVehicle && <bdi className="cal-event__vehicle">{vehicleOf(item)}</bdi>}
      <bdi className="cal-event__buyer">{item.buyer_full_name}</bdi>
      {variant === "row" && (
        <span className="cal-event__status" aria-hidden="true">
          {t(`adminInspections.status.${item.status}`)}
        </span>
      )}
    </button>
  );
}

function sortEvents(items) {
  return [...items].sort((a, b) => {
    const timedA = isTimed(a) ? 0 : 1;
    const timedB = isTimed(b) ? 0 : 1;

    return timedA - timedB || String(a.appointment_time).localeCompare(String(b.appointment_time)) || a.id - b.id;
  });
}

function moveFocus(event, root) {
  const steps = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
  let step = steps[event.key];

  if (!step) {
    return;
  }

  if (getLanguage() === "ar" && Math.abs(step) === 1) {
    step = -step;
  }

  const target = root?.querySelector(`[data-day="${addDays(event.currentTarget.dataset.day, step)}"]`);

  if (target) {
    event.preventDefault();
    target.focus();
  }
}

export function MonthView({ days, month, today, events, onOpen, onDay, title }) {
  const { t } = useI18n();
  const byDay = groupByDay(events);
  const weeks = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return (
    <div className="cal-month-wrap">
      <table className="cal-month" aria-label={title}>
        <thead>
          <tr>
            {days.slice(0, 7).map((day) => (
              <th key={day} scope="col" abbr={formatDay(day, { weekday: "long" })} className={isWeekend(day) ? "is-weekend" : ""}>
                {formatDay(day, { weekday: "short" })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const items = sortEvents(byDay[day] || []);
                const shown = items.slice(0, MONTH_LIMIT);
                const classes = [
                  "cal-month__cell",
                  day.slice(0, 7) !== month ? "is-outside" : "",
                  day === today ? "is-today" : "",
                  isWeekend(day) ? "is-weekend" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <td key={day} className={classes}>
                    <button
                      type="button"
                      className="cal-month__day numeric"
                      data-day={day}
                      aria-current={day === today ? "date" : undefined}
                      aria-label={t("adminInspections.month.dayLabel", {
                        date: formatDay(day, { weekday: "long", day: "numeric", month: "long" }),
                        count: items.length,
                      })}
                      onClick={() => onDay(day)}
                      onKeyDown={(event) => moveFocus(event, event.currentTarget.closest("table"))}
                    >
                      <span className="cal-month__num">{formatDay(day, { day: "numeric" })}</span>
                    </button>
                    {items.length > 0 && (
                      <>
                        <ul className="cal-month__events">
                          {shown.map((item) => (
                            <li key={item.id}>
                              <EventButton item={item} variant="chip" onOpen={onOpen} />
                            </li>
                          ))}
                        </ul>
                        {items.length > MONTH_LIMIT && (
                          <button type="button" className="cal-month__more" onClick={() => onDay(day)}>
                            {t("adminInspections.month.more", { count: items.length - MONTH_LIMIT })}
                          </button>
                        )}
                        <span className="cal-month__dots" aria-hidden="true">
                          {items.slice(0, 4).map((item) => (
                            <span key={item.id} className={`cal-dot cal-dot--${item.status}`} />
                          ))}
                        </span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupByDay(events) {
  return events.reduce((groups, item) => {
    (groups[item.day] ||= []).push(item);

    return groups;
  }, {});
}

function gridBounds(events, slotMinutes) {
  let start = DAY_START;
  let end = DAY_END;

  events.filter(isTimed).forEach((item) => {
    const minutes = toMinutes(item.appointment_time);

    start = Math.min(start, Math.floor(minutes / 60) * 60);
    end = Math.max(end, Math.ceil((minutes + slotMinutes) / 60) * 60);
  });

  return { start, end: Math.min(end, 24 * 60) };
}

export function TimeGrid({ days, today, events, slotMinutes, onOpen, onDay, vehicleMode, title }) {
  const { t } = useI18n();
  const byDay = groupByDay(events);
  const { start, end } = gridBounds(events, slotMinutes);
  const rows = Math.ceil((end - start) / slotMinutes);
  const slots = Array.from({ length: rows }, (_, index) => start + index * slotMinutes);
  const untimed = days.some((day) => (byDay[day] || []).some((item) => !isTimed(item)));
  const now = nowMinutes();
  const single = days.length === 1;
  const wrapRef = useRef(null);
  const firstDay = days[0];

  useEffect(() => {
    const wrap = wrapRef.current;
    const column = wrap?.querySelector(".cal-grid__day.is-today");

    if (!column || wrap.scrollWidth <= wrap.clientWidth) {
      return;
    }

    const offset = column.getBoundingClientRect().left - wrap.getBoundingClientRect().left;

    wrap.scrollBy({ left: getLanguage() === "ar" ? offset - wrap.clientWidth + column.offsetWidth + 58 : offset - 58 });
  }, [firstDay]);

  function isFree(day, minutes, booked) {
    if (day < today || (day === today && minutes < now)) {
      return false;
    }

    return !booked.some((item) => overlaps(toTime(minutes), item.appointment_time, slotMinutes));
  }

  return (
    <div ref={wrapRef} className={`cal-grid-wrap${single ? " is-single" : ""}`}>
      <div className="cal-grid" style={{ "--cols": days.length, "--rows": rows }} role="group" aria-label={title}>
        <div className="cal-grid__head">
          <span className="cal-grid__corner" />
          {days.map((day) => (
            <div key={day} className={`cal-grid__day${day === today ? " is-today" : ""}${isWeekend(day) ? " is-weekend" : ""}`}>
              {single ? (
                <span className="cal-grid__day-name">{formatDay(day, { weekday: "long", day: "numeric", month: "long" })}</span>
              ) : (
                <button
                  type="button"
                  className="cal-grid__day-btn"
                  onClick={() => onDay(day)}
                  aria-current={day === today ? "date" : undefined}
                  aria-label={t("adminInspections.week.openDay", {
                    date: formatDay(day, { weekday: "long", day: "numeric", month: "long" }),
                  })}
                >
                  <span className="cal-grid__weekday">{formatDay(day, { weekday: "short" })}</span>
                  <span className="cal-grid__date numeric">{formatDay(day, { day: "numeric" })}</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {untimed && (
          <div className="cal-grid__untimed">
            <span className="cal-grid__untimed-label">{t("adminInspections.week.toSchedule")}</span>
            {days.map((day) => (
              <ul key={day} className="cal-grid__untimed-list" aria-label={t("adminInspections.week.toScheduleOn", { date: formatDay(day, { day: "numeric", month: "long" }) })}>
                {(byDay[day] || [])
                  .filter((item) => !isTimed(item))
                  .map((item) => (
                    <li key={item.id}>
                      <EventButton item={item} variant="chip" onOpen={onOpen} showVehicle={!vehicleMode} />
                    </li>
                  ))}
              </ul>
            ))}
          </div>
        )}

        <div className="cal-grid__body">
          <div className="cal-grid__times" aria-hidden="true">
            {slots.map((minutes) => (
              <span key={minutes} className="cal-grid__time ltr numeric">
                {toTime(minutes)}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const timed = (byDay[day] || []).filter(isTimed);
            const booked = timed.filter((item) => ["scheduled", "confirmed"].includes(item.status));
            const free = vehicleMode ? slots.filter((minutes) => isFree(day, minutes, booked)) : [];
            const label = vehicleMode
              ? t("adminInspections.week.vehicleColumn", {
                  date: formatDay(day, { weekday: "long", day: "numeric", month: "long" }),
                  booked: t("adminInspections.week.booked", { count: booked.length }),
                  free: t("adminInspections.week.free", { count: free.length }),
                })
              : t("adminInspections.week.column", {
                  date: formatDay(day, { weekday: "long", day: "numeric", month: "long" }),
                  count: timed.length,
                });

            return (
              <div
                key={day}
                role="group"
                aria-label={label}
                className={`cal-grid__col${day === today ? " is-today" : ""}${isWeekend(day) ? " is-weekend" : ""}`}
              >
                {slots.map((minutes) => (
                  <span
                    key={minutes}
                    className={`cal-grid__slot${vehicleMode && free.includes(minutes) ? " is-free" : ""}`}
                    aria-hidden="true"
                  >
                    {single && free.includes(minutes) && <span className="cal-grid__free">{t("adminInspections.week.freeSlot")}</span>}
                  </span>
                ))}

                {layoutLanes(timed, slotMinutes).map(({ item, start: begin, lane, lanes }) => (
                  <EventButton
                    key={item.id}
                    item={item}
                    variant="block"
                    onOpen={onOpen}
                    showVehicle={!vehicleMode}
                    style={{
                      "--top": (begin - start) / slotMinutes,
                      "--lane": lane,
                      "--lanes": lanes,
                    }}
                  />
                ))}

                {day === today && now >= start && now <= end && (
                  <span className="cal-grid__now" style={{ "--top": (now - start) / slotMinutes }} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AgendaView({ days, today, events, onOpen, emptyTitle, emptyText }) {
  const { t } = useI18n();
  const byDay = groupByDay(events);
  const shown = days.filter((day) => byDay[day]?.length);

  if (!shown.length) {
    return (
      <EmptyState icon={CalendarClock} title={emptyTitle}>
        {emptyText}
      </EmptyState>
    );
  }

  return (
    <ol className="cal-agenda">
      {shown.map((day) => (
        <li key={day} className={`cal-agenda__day${day === today ? " is-today" : ""}`}>
          <h3 className="cal-agenda__date">
            <span className="cal-agenda__num numeric">{formatDay(day, { day: "numeric" })}</span>
            <span>
              <span className="cal-agenda__weekday">{formatDay(day, { weekday: "long" })}</span>
              <span className="cal-agenda__month">{formatDay(day, { month: "long", year: "numeric" })}</span>
              {day === today && <span className="badge badge--signal cal-agenda__today">{t("adminInspections.today")}</span>}
            </span>
          </h3>
          <ul className="cal-agenda__list">
            {sortEvents(byDay[day]).map((item) => (
              <li key={item.id}>
                <EventButton item={item} variant="row" onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
