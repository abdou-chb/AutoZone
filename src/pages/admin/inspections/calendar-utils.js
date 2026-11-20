import { getLocale } from "../../../i18n/core";

export const VIEWS = ["month", "week", "day", "agenda"];
export const STATUSES = ["pending", "scheduled", "confirmed", "completed", "cancelled"];
export const DEFAULT_STATUSES = ["pending", "scheduled", "confirmed", "completed"];
export const DAY_START = 8 * 60;
export const DAY_END = 19 * 60;
export const SLOT_FIRST = 8 * 60;
export const SLOT_LAST = 18 * 60;

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value) {
  if (!ISO_PATTERN.test(value || "")) {
    return false;
  }

  return toISO(parseISO(value)) === value;
}

export function parseISO(value) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

export function toISO(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function addDays(value, count) {
  const date = parseISO(value);

  date.setDate(date.getDate() + count);

  return toISO(date);
}

export function addMonths(value, count) {
  const date = parseISO(value);
  const day = date.getDate();

  date.setDate(1);
  date.setMonth(date.getMonth() + count);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));

  return toISO(date);
}

export function weekday(value) {
  return parseISO(value).getDay();
}

export function isWeekend(value) {
  return [5, 6].includes(weekday(value));
}

export function startOfWeek(value) {
  return addDays(value, -weekday(value));
}

export function startOfMonth(value) {
  return `${value.slice(0, 8)}01`;
}

export function endOfMonth(value) {
  const date = parseISO(value);

  return toISO(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function daysBetween(from, to) {
  const days = [];

  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);
  }

  return days;
}

export function rangeFor(view, date) {
  if (view === "month") {
    return { from: startOfWeek(startOfMonth(date)), to: addDays(startOfWeek(endOfMonth(date)), 6) };
  }

  if (view === "week") {
    const from = startOfWeek(date);

    return { from, to: addDays(from, 6) };
  }

  if (view === "day") {
    return { from: date, to: date };
  }

  return { from: startOfMonth(date), to: endOfMonth(date) };
}

export function stepDate(view, date, direction) {
  if (view === "week") {
    return addDays(date, 7 * direction);
  }

  if (view === "day") {
    return addDays(date, direction);
  }

  return addMonths(date, direction);
}

export function rangeTitle(view, date) {
  const locale = getLocale();

  if (view === "month" || view === "agenda") {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(parseISO(date));
  }

  if (view === "day") {
    return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
      parseISO(date)
    );
  }

  const { from, to } = rangeFor("week", date);

  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).formatRange(
    parseISO(from),
    parseISO(to)
  );
}

export function formatDay(value, options) {
  return new Intl.DateTimeFormat(getLocale(), options).format(parseISO(value));
}

export function toMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);

  return hours * 60 + minutes;
}

export function toTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function overlaps(time, other, slotMinutes) {
  return Math.abs(toMinutes(time) - toMinutes(other)) < slotMinutes;
}

export function slotTimes(slotMinutes, first = SLOT_FIRST, last = SLOT_LAST) {
  const times = [];

  for (let minutes = first; minutes <= last; minutes += slotMinutes) {
    times.push(toTime(minutes));
  }

  return times;
}

export function nowMinutes() {
  const now = new Date();

  return now.getHours() * 60 + now.getMinutes();
}

export function eventDay(item) {
  if (item.status === "pending") {
    return item.preferred_date;
  }

  return item.appointment_date || item.preferred_date;
}

export function isTimed(item) {
  return item.status !== "pending" && Boolean(item.appointment_time);
}

export function layoutLanes(items, slotMinutes) {
  const sorted = [...items].sort((a, b) => toMinutes(a.appointment_time) - toMinutes(b.appointment_time));
  const placed = [];
  let cluster = [];
  let clusterEnd = -1;
  let laneEnds = [];

  function closeCluster() {
    const lanes = laneEnds.length;

    cluster.forEach((entry) => placed.push({ ...entry, lanes }));
    cluster = [];
    laneEnds = [];
  }

  sorted.forEach((item) => {
    const start = toMinutes(item.appointment_time);
    const end = start + slotMinutes;

    if (start >= clusterEnd) {
      closeCluster();
    }

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);

    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }

    clusterEnd = Math.max(clusterEnd, end);
    cluster.push({ item, start, lane });
  });
  closeCluster();

  return placed;
}

export function fold(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
