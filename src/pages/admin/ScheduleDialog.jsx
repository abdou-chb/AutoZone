import { useId, useRef, useState } from "react";
import { Ban, CircleAlert, Info } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";
import { formatDate, todayISO } from "../../lib/format";
import { ARRANGEMENTS, isolate, requestNumber } from "./admin-config";
import { useAdmin } from "./admin-context";
import { isAbortError, useAdminData } from "./useAdminSession";
import AdminDialog from "./AdminDialog";
import { isISODate, nowMinutes, overlaps, slotTimes, toMinutes } from "./inspections/calendar-utils";
import "./inspections/calendar.css";

const RESCHEDULE_STATUSES = ["scheduled", "confirmed"];

function knownArrangement(value) {
  if (!value) {
    return "";
  }

  const known = ARRANGEMENTS.find((item) => item.value === value || item.aliases?.includes(value));

  return known ? known.value : value;
}

function initialValues(request, today) {
  if (RESCHEDULE_STATUSES.includes(request.status)) {
    return {
      arrangement: knownArrangement(request.arrangement),
      appointmentDate: request.appointment_date >= today ? request.appointment_date : "",
      appointmentTime: request.appointment_date >= today ? request.appointment_time || "" : "",
      meetingLocation: request.meeting_location || "",
      paymentInstructions: request.payment_instructions || "",
    };
  }

  return {
    arrangement: "",
    appointmentDate: request.preferred_date && request.preferred_date >= today ? request.preferred_date : "",
    appointmentTime: "",
    meetingLocation: "",
    paymentInstructions: "",
  };
}

function findClash(time, booked, slotMinutes) {
  return /^\d{2}:\d{2}$/.test(time || "") ? booked.find((item) => overlaps(time, item.appointment_time, slotMinutes)) : null;
}

function validate(values, today, clash) {
  const errors = {};

  if (!values.arrangement) {
    errors.arrangement = { key: "admin.schedule.errors.arrangement" };
  }

  if (!values.appointmentDate) {
    errors.appointmentDate = { key: "admin.schedule.errors.date" };
  } else if (values.appointmentDate < today) {
    errors.appointmentDate = { key: "admin.schedule.errors.pastDate" };
  }

  if (!values.appointmentTime) {
    errors.appointmentTime = { key: "admin.schedule.errors.time" };
  } else if (clash) {
    errors.appointmentTime = { key: "adminInspections.schedule.taken", vars: { time: clash.appointment_time } };
  }

  if (!values.meetingLocation.trim()) {
    errors.meetingLocation = { key: "admin.schedule.errors.place" };
  }

  return errors;
}

function Bookings({ title, icon: Icon, items, tone, showVehicle }) {
  return (
    <div className={`schedule-bookings schedule-bookings--${tone}`}>
      <p className="schedule-bookings__title">
        <Icon size={16} aria-hidden="true" />
        {title}
      </p>
      <ul className="schedule-bookings__list">
        {items.map((item) => (
          <li key={item.id}>
            <span className="ltr numeric schedule-bookings__time">{item.appointment_time}</span>
            <span className="schedule-bookings__who">
              {showVehicle ? `${item.car_name} · ${item.buyer_full_name}` : item.buyer_full_name}
            </span>
            <span className="schedule-bookings__id">{requestNumber(item.id)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ScheduleDialog({ request, onSubmit, onClose }) {
  const { t } = useI18n();
  const admin = useAdmin();
  const [today] = useState(todayISO);
  const [values, setValues] = useState(() => initialValues(request, todayISO()));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [clashError, setClashError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const firstFieldRef = useRef(null);
  const formRef = useRef(null);
  const id = useId();
  const reschedule = RESCHEDULE_STATUSES.includes(request.status);
  const date = isISODate(values.appointmentDate) && values.appointmentDate >= today ? values.appointmentDate : "";
  const availability = useAdminData(
    admin.request,
    date ? `/api/admin/inspections/availability?carId=${request.car_id}&date=${date}` : null
  );
  const slotMinutes = availability.data?.slotMinutes || 60;
  const booked = (availability.data?.vehicle || []).filter((item) => item.id !== request.id);
  const others = availability.data?.others || [];
  const clash = findClash(values.appointmentTime, booked, slotMinutes);
  const now = nowMinutes();
  const arrangementKnown = !values.arrangement || ARRANGEMENTS.some((item) => item.value === values.arrangement);

  function setField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));

    if (name === "appointmentDate" || name === "appointmentTime") {
      setClashError("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate(values, today, clash);
    setErrors(nextErrors);
    setSubmitError("");
    setClashError("");

    const firstInvalid = Object.keys(nextErrors)[0];

    if (firstInvalid) {
      formRef.current.elements.namedItem(firstInvalid)?.focus();
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        arrangement: values.arrangement,
        appointmentDate: values.appointmentDate,
        appointmentTime: values.appointmentTime,
        meetingLocation: values.meetingLocation.trim(),
        paymentInstructions: values.paymentInstructions.trim(),
      });
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (error.status === 409) {
        setClashError(error.message);
        availability.reload();
        formRef.current.elements.namedItem("appointmentTime")?.focus();
      } else {
        setSubmitError(error.message);
      }

      setSubmitting(false);
    }
  }

  function fieldProps(name) {
    const described = [errors[name] && `${id}-${name}-error`, name === "appointmentTime" && clashError && `${id}-clash`]
      .filter(Boolean)
      .join(" ");

    return {
      id: `${id}-${name}`,
      name,
      value: values[name],
      onChange: (event) => setField(name, event.target.value),
      "aria-invalid": errors[name] || (name === "appointmentTime" && clashError) ? "true" : undefined,
      "aria-describedby": described || undefined,
    };
  }

  function fieldError(name) {
    return (
      errors[name] && (
        <span id={`${id}-${name}-error`} className="field__error">
          {t(errors[name].key, errors[name].vars)}
        </span>
      )
    );
  }

  const slots = slotTimes(slotMinutes).map((time) => {
    const taken = findClash(time, booked, slotMinutes);
    const past = date === today && toMinutes(time) <= now;

    return { time, taken, past };
  });

  let slotStatus = "";

  if (date && availability.loading) {
    slotStatus = t("adminInspections.schedule.loadingSlots");
  } else if (date && availability.data) {
    slotStatus = t("adminInspections.schedule.slotSummary", {
      date: formatDate(date, { day: "numeric", month: "long" }),
      free: t("adminInspections.schedule.freeCount", { count: slots.filter((slot) => !slot.taken && !slot.past).length }),
      booked: t("adminInspections.schedule.bookedCount", { count: booked.length }),
    });
  }

  return (
    <AdminDialog
      title={t(reschedule ? "adminInspections.schedule.rescheduleTitle" : "admin.schedule.title", { number: requestNumber(request.id) })}
      description={t("admin.schedule.description", {
        vehicle: isolate(`${request.car_name} ${request.car_year}`),
        buyer: isolate(request.buyer_full_name),
      })}
      onClose={onClose}
      initialFocusRef={firstFieldRef}
      locked={submitting}
      size="medium"
    >
      <form ref={formRef} className="admin-schedule" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-arrangement`}>
            {t("admin.schedule.arrangement")}
          </label>
          <select ref={firstFieldRef} className="select" {...fieldProps("arrangement")}>
            <option value="" disabled>
              {t("admin.schedule.chooseArrangement")}
            </option>
            {ARRANGEMENTS.map((arrangement) => (
              <option key={arrangement.value} value={arrangement.value}>
                {t(arrangement.label)}
              </option>
            ))}
            {!arrangementKnown && <option value={values.arrangement}>{values.arrangement}</option>}
          </select>
          {fieldError("arrangement")}
        </div>

        <div className="admin-schedule__row">
          <div className="field">
            <label className="field__label" htmlFor={`${id}-appointmentDate`}>
              {t("admin.schedule.date")}
            </label>
            <input type="date" className="input" min={today} {...fieldProps("appointmentDate")} />
            {fieldError("appointmentDate")}
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${id}-appointmentTime`}>
              {t("admin.schedule.time")}
            </label>
            <input type="time" className="input" step="300" {...fieldProps("appointmentTime")} />
            {fieldError("appointmentTime")}
          </div>
        </div>

        {clashError && (
          <p id={`${id}-clash`} className="notice notice--stop" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <span>{clashError}</span>
          </p>
        )}

        {request.preferred_date && (
          <p className="schedule-hint">{t("admin.inspections.prefers", { date: formatDate(request.preferred_date) })}</p>
        )}

        <fieldset className="schedule-slots" aria-describedby={`${id}-slot-status`}>
          <legend className="field__label">{t("adminInspections.schedule.slots")}</legend>
          <p id={`${id}-slot-status`} className="schedule-slots__status" role="status">
            {date ? slotStatus : t("adminInspections.schedule.pickDate")}
          </p>
          {date && availability.error && <p className="field__error">{availability.error}</p>}
          {date && availability.data && (
            <div className="schedule-slots__grid">
              {slots.map((slot) => {
                const selected = values.appointmentTime === slot.time;
                let label = slot.time;

                if (slot.taken) {
                  label = t("adminInspections.schedule.slotTaken", { time: slot.time, other: slot.taken.appointment_time });
                } else if (slot.past) {
                  label = t("adminInspections.schedule.slotPast", { time: slot.time });
                }

                return (
                  <button
                    key={slot.time}
                    type="button"
                    className={`schedule-slot ltr numeric${slot.taken ? " is-taken" : ""}${selected ? " is-selected" : ""}`}
                    aria-pressed={selected}
                    aria-label={label}
                    disabled={Boolean(slot.taken) || slot.past || submitting}
                    onClick={() => setField("appointmentTime", slot.time)}
                  >
                    {slot.taken && <Ban size={14} aria-hidden="true" />}
                    {slot.time}
                  </button>
                );
              })}
            </div>
          )}
          {date && booked.length > 0 && (
            <Bookings title={t("adminInspections.schedule.vehicleBooked")} icon={Ban} items={booked} tone="stop" />
          )}
          {date && others.length > 0 && (
            <Bookings title={t("adminInspections.schedule.othersBooked")} icon={Info} items={others} tone="info" showVehicle />
          )}
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor={`${id}-meetingLocation`}>
            {t("admin.schedule.place")}
          </label>
          <input
            type="text"
            className="input"
            autoComplete="off"
            placeholder={t("admin.schedule.placePlaceholder")}
            {...fieldProps("meetingLocation")}
          />
          {fieldError("meetingLocation")}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${id}-paymentInstructions`}>
            {t("admin.schedule.payment")} <span className="field__optional">{t("admin.schedule.optional")}</span>
          </label>
          <textarea
            className="textarea admin-schedule__textarea"
            placeholder={t("admin.schedule.paymentPlaceholder")}
            {...fieldProps("paymentInstructions")}
          />
        </div>

        {submitError && (
          <p className="notice notice--stop" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <span>{submitError}</span>
          </p>
        )}

        <div className="admin-dialog__actions">
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={submitting}>
            {t("common.actions.close")}
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting && <span className="spinner" aria-hidden="true" />}
            {t(submitting ? "admin.schedule.submitting" : reschedule ? "adminInspections.schedule.move" : "admin.schedule.submit")}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
