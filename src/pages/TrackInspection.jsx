import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, CalendarDays, Check, CircleAlert, CircleCheck, Clock, LoaderCircle, MapPin, ReceiptText, Wallet, Wrench } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import { apiRequest, decideRepairRequest, trackCarRequest, trackRepairRequest } from "../lib/api";
import { getCategory } from "../lib/categories";
import { formatDate, formatPrice, wilayaName } from "../lib/format";
import { INSPECTION_STEPS } from "../lib/status";
import { useI18n } from "../i18n/i18n-context";
import { arrangementLabel } from "./admin/admin-config";
import Field from "../components/Field";
import "./TrackInspection.css";

function isValidPhone(phone) {
  return /^\+?\d{9,15}$/.test(phone.replace(/[\s.()-]/g, ""));
}

// A car request from the Tuning Zone has a "TZ-" reference, a repair request an "RP-" one; a plain number is an
// inspection request.
const CAR_REFERENCE = /^TZ-?([1-9]\d*)$/i;
const REPAIR_REFERENCE = /^RP-?([1-9]\d*)$/i;
const SPECIAL_REFERENCE = /^(?:TZ|RP)-?[1-9]\d*$/i;

const carReference = (value) => {
  const found = value.trim().match(CAR_REFERENCE);

  return found ? `TZ-${found[1]}` : null;
};

const repairReference = (value) => {
  const found = value.trim().match(REPAIR_REFERENCE);

  return found ? `RP-${found[1]}` : null;
};

function validate(values, t) {
  const errors = {};
  const number = values.requestId.trim().replace(/^#/, "");

  if (!number) {
    errors.requestId = t("track.errors.requestId");
  } else if (!/^[1-9]\d*$/.test(number) && !SPECIAL_REFERENCE.test(number)) {
    errors.requestId = t("track.errors.requestIdFormat");
  }

  if (!values.phone.trim()) {
    errors.phone = t("track.errors.phone");
  } else if (!isValidPhone(values.phone)) {
    errors.phone = t("track.errors.phoneFormat");
  }

  return errors;
}

function Timeline({ status }) {
  const { t } = useI18n();
  const current = INSPECTION_STEPS.indexOf(status);

  return (
    <ol className="track-steps">
      {INSPECTION_STEPS.map((step, index) => {
        const done = index < current || status === "completed";
        const active = index === current && status !== "completed";
        const state = done ? "is-done" : active ? "is-current" : "is-todo";

        return (
          <li key={step} className={`track-step ${state}`} aria-current={index === current ? "step" : undefined}>
            <span className="track-step__marker display" aria-hidden="true">
              {done ? <Check size={16} strokeWidth={3} /> : index + 1}
            </span>
            <span className="track-step__label">
              {t(`common.status.inspection.${step}`)}
              <span className="visually-hidden">
                {t(`track.result.step.${done ? "done" : active ? "current" : "todo"}`)}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Result({ request }) {
  const { t } = useI18n();
  const cancelled = request.status === "cancelled";
  const hasAppointment = Boolean(request.appointment_date);
  const category = getCategory(request.car_category);
  const ZoneIcon = category.icon;

  return (
    <section className="panel track-result" aria-labelledby="track-result-title">
      <div className="track-result__head">
        <div>
          <p className="track-result__ref">{t("track.result.ref", { id: request.id })}</p>
          <h2 id="track-result-title">
            {request.car_name} <span className="track-result__year">{request.car_year}</span>
          </h2>
          <p className="track-result__zone" style={{ "--zone": category.theme.accent }}>
            <ZoneIcon size={16} aria-hidden="true" />
            {category.brand}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {cancelled ? (
        <div className="notice notice--stop">
          <CircleAlert size={18} aria-hidden="true" />
          <p>{t("track.result.cancelled")}</p>
        </div>
      ) : (
        <>
          <Timeline status={request.status} />
          <p className="track-result__state">{t(`track.result.state.${request.status}`)}</p>
        </>
      )}

      {hasAppointment && !cancelled && (
        <div className="track-appointment">
          <h3>{t("track.result.appointment.title")}</h3>
          <dl className="track-appointment__list">
            <div>
              <dt>
                <CalendarDays size={16} aria-hidden="true" />
                {t("track.result.appointment.date")}
              </dt>
              <dd>
                {formatDate(request.appointment_date, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
            {request.appointment_time && (
              <div>
                <dt>
                  <Clock size={16} aria-hidden="true" />
                  {t("track.result.appointment.time")}
                </dt>
                <dd className="numeric">
                  <bdi className="ltr">{request.appointment_time}</bdi>
                </dd>
              </div>
            )}
            {request.meeting_location && (
              <div>
                <dt>
                  <MapPin size={16} aria-hidden="true" />
                  {t("track.result.appointment.place")}
                </dt>
                <dd>{request.meeting_location}</dd>
              </div>
            )}
            {request.arrangement && (
              <div>
                <dt>
                  <ZoneIcon size={16} aria-hidden="true" />
                  {t("track.result.appointment.arrangement")}
                </dt>
                <dd>{arrangementLabel(request.arrangement)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {request.payment_instructions && !cancelled && (
        <div className="notice notice--wait track-payment">
          <Wallet size={18} aria-hidden="true" />
          <div>
            <h3>{t("track.result.payment")}</h3>
            <p>{request.payment_instructions}</p>
          </div>
        </div>
      )}

      <dl className="track-meta">
        <div>
          <dt>{t("track.result.preferredDate")}</dt>
          <dd>{formatDate(request.preferred_date)}</dd>
        </div>
        <div>
          <dt>{t("track.result.location")}</dt>
          <dd>{wilayaName(request.car_location)}</dd>
        </div>
      </dl>
    </section>
  );
}

const CAR_TONES = { pending: "wait", approved: "go", rejected: "stop" };

function CarResult({ request }) {
  const { t } = useI18n();

  return (
    <section className="panel track-result" aria-labelledby="track-result-title">
      <div className="track-result__head">
        <div>
          <p className="track-result__ref">{t("track.car.ref", { reference: `\u2066${request.reference}\u2069` })}</p>
          <h2 id="track-result-title">{request.vehicle_name}</h2>
          <p className="track-result__zone">
            <Wrench size={16} aria-hidden="true" />
            TuningZone
          </p>
        </div>
        <span className={`badge badge--${CAR_TONES[request.status] || ""}`}>{t(`track.car.status.${request.status}`)}</span>
      </div>

      <p className="track-result__state">{t(`track.car.state.${request.status}`)}</p>

      {request.decision_note && (
        <div className={`notice track-payment ${request.status === "rejected" ? "notice--stop" : "notice--wait"}`}>
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <h3>{t("track.car.note")}</h3>
            <p dir="auto">{request.decision_note}</p>
          </div>
        </div>
      )}

      <dl className="track-meta">
        <div>
          <dt>{t("track.car.sent")}</dt>
          <dd>{formatDate(request.created_at)}</dd>
        </div>
        <div>
          <dt>{t("track.car.total")}</dt>
          <dd className="numeric">{formatPrice(request.total)}</dd>
        </div>
      </dl>
    </section>
  );
}

const REPAIR_TONES = {
  submitted: "wait",
  under_review: "wait",
  info_required: "signal",
  awaiting_customer: "info",
  accepted: "go",
  scheduled: "go",
  received: "go",
  in_progress: "go",
  completed: "go",
  rejected: "stop",
  declined: "stop",
  cancelled: "dark",
};

// The stages the customer sees, and where each status sits on them. Terminal statuses leave the timeline and show a
// banner instead.
const REPAIR_STAGES = ["submitted", "under_review", "awaiting_customer", "accepted", "scheduled", "received", "in_progress", "completed"];
const STAGE_OF = { submitted: 0, under_review: 1, info_required: 1, awaiting_customer: 2, accepted: 3, scheduled: 4, received: 5, in_progress: 6, completed: 7 };
const TERMINAL = new Set(["rejected", "declined", "cancelled"]);

function RepairTimeline({ status }) {
  const { t } = useI18n();
  const current = STAGE_OF[status] ?? 0;

  return (
    <ol className="track-steps">
      {REPAIR_STAGES.map((stage, index) => {
        const done = index < current || status === "completed";
        const active = index === current && status !== "completed";
        const state = done ? "is-done" : active ? "is-current" : "is-todo";

        return (
          <li key={stage} className={`track-step ${state}`} aria-current={active ? "step" : undefined}>
            <span className="track-step__marker display" aria-hidden="true">{done ? <Check size={16} strokeWidth={3} /> : index + 1}</span>
            <span className="track-step__label">
              {t(`track.repair.stages.${stage}`)}
              <span className="visually-hidden">{t(`track.result.step.${done ? "done" : active ? "current" : "todo"}`)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Quotation({ quotation }) {
  const { t } = useI18n();

  return (
    <div className="track-quote">
      <h3>
        <ReceiptText size={18} aria-hidden="true" />
        {t("track.repair.quote.title")}
      </h3>
      <ul className="track-quote__lines">
        {quotation.lines.map((line, index) => (
          <li key={index}>
            <span className="track-quote__label">
              <bdi>{line.label}</bdi>
              <span className="track-quote__kind">{t(`track.repair.quote.kinds.${line.kind}`)}</span>
            </span>
            <span className="track-quote__amount numeric">{formatPrice(line.amount)}</span>
          </li>
        ))}
      </ul>
      <dl className="track-quote__totals">
        <div>
          <dt>{t("track.repair.quote.subtotal")}</dt>
          <dd className="numeric">{formatPrice(quotation.subtotal)}</dd>
        </div>
        {quotation.tax > 0 && (
          <div>
            <dt>{t("track.repair.quote.tax", { rate: quotation.taxRate })}</dt>
            <dd className="numeric">{formatPrice(quotation.tax)}</dd>
          </div>
        )}
        <div className="track-quote__grand">
          <dt>{t("track.repair.quote.total")}</dt>
          <dd className="numeric">{formatPrice(quotation.total)}</dd>
        </div>
      </dl>
      <p className="track-quote__note">{t("track.repair.quote.note")}</p>
    </div>
  );
}

function RepairSchedule({ schedule }) {
  const { t } = useI18n();
  const longDate = (value) => formatDate(value, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="track-appointment">
      <h3>
        <CalendarClock size={18} aria-hidden="true" />
        {t("track.repair.schedule.title")}
      </h3>
      <dl className="track-appointment__list">
        {schedule.arrivalDate && (
          <div>
            <dt><CalendarDays size={16} aria-hidden="true" />{t("track.repair.schedule.arrival")}</dt>
            <dd>{longDate(schedule.arrivalDate)}{schedule.arrivalTime ? <> · <bdi className="ltr">{schedule.arrivalTime}</bdi></> : null}</dd>
          </div>
        )}
        {schedule.durationDays ? (
          <div>
            <dt><Clock size={16} aria-hidden="true" />{t("track.repair.schedule.duration")}</dt>
            <dd>{t("track.repair.schedule.days", { count: schedule.durationDays })}</dd>
          </div>
        ) : null}
        {schedule.completionDate && (
          <div>
            <dt><CircleCheck size={16} aria-hidden="true" />{t("track.repair.schedule.completion")}</dt>
            <dd>{longDate(schedule.completionDate)}</dd>
          </div>
        )}
        {schedule.instructions && (
          <div>
            <dt><Wrench size={16} aria-hidden="true" />{t("track.repair.schedule.instructions")}</dt>
            <dd dir="auto">{schedule.instructions}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function DecisionControls({ reference, phone, onUpdate }) {
  const { t } = useI18n();
  const [mode, setMode] = useState(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send(decision) {
    setSending(true);
    setError("");

    try {
      const data = await decideRepairRequest(reference, phone, decision, note.trim());

      onUpdate(data.request);
    } catch (problem) {
      setError(problem.status === 409 ? t("track.repair.decide.tooLate") : problem.status === 404 ? t("track.errors.notFound") : problem.message || t("common.errors.generic"));
      setSending(false);
    }
  }

  return (
    <div className="track-decide">
      <h3>{t("track.repair.decide.title")}</h3>
      <p>{t("track.repair.decide.lead")}</p>
      {mode ? (
        <div className="track-decide__form">
          <label htmlFor="track-decide-note">{t(mode === "clarification" ? "track.repair.decide.questionLabel" : "track.repair.decide.noteLabel")}</label>
          <textarea id="track-decide-note" rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="track-decide__actions">
            <button type="button" className="btn btn--primary" disabled={sending || (mode === "clarification" && !note.trim())} onClick={() => send(mode)}>
              {sending && <LoaderCircle size={16} aria-hidden="true" className="track-spin" />}
              {t(`track.repair.decide.confirm.${mode}`)}
            </button>
            <button type="button" className="btn" disabled={sending} onClick={() => { setMode(null); setNote(""); setError(""); }}>
              {t("track.repair.decide.back")}
            </button>
          </div>
        </div>
      ) : (
        <div className="track-decide__actions">
          <button type="button" className="btn btn--primary" disabled={sending} onClick={() => send("accepted")}>
            {sending && <LoaderCircle size={16} aria-hidden="true" className="track-spin" />}
            {t("track.repair.decide.accept")}
          </button>
          <button type="button" className="btn" onClick={() => setMode("declined")}>{t("track.repair.decide.decline")}</button>
          <button type="button" className="btn" onClick={() => setMode("clarification")}>{t("track.repair.decide.ask")}</button>
        </div>
      )}
      {error && (
        <p className="track-decide__error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

function RepairResult({ request, phone, onUpdate }) {
  const { t } = useI18n();
  const vehicle = `${request.vehicle_make} ${request.vehicle_model}${request.vehicle_year ? ` (${request.vehicle_year})` : ""}`;
  const terminal = TERMINAL.has(request.status);
  const declinedService = request.response && request.response.canRepair === false;

  return (
    <section className="panel track-result" aria-labelledby="track-result-title">
      <div className="track-result__head">
        <div>
          <p className="track-result__ref">{t("track.repair.ref", { reference: `⁦${request.reference}⁩` })}</p>
          <h2 id="track-result-title"><bdi>{vehicle}</bdi></h2>
          <p className="track-result__zone">
            <Wrench size={16} aria-hidden="true" />
            {t("track.repair.garage")}
          </p>
        </div>
        <span className={`badge badge--${REPAIR_TONES[request.status] || "wait"}`}>{t(`track.repair.status.${request.status}`)}</span>
      </div>

      {terminal ? (
        <div className="notice notice--stop">
          <CircleAlert size={18} aria-hidden="true" />
          <p>{t(`track.repair.state.${request.status}`)}</p>
        </div>
      ) : (
        <>
          <RepairTimeline status={request.status} />
          <p className="track-result__state">{t(`track.repair.state.${request.status}`)}</p>
        </>
      )}

      {request.status === "rejected" && request.reject_reason && (
        <div className="notice notice--stop track-payment">
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <h3>{t("track.repair.rejectReason")}</h3>
            <p dir="auto">{request.reject_reason}</p>
          </div>
        </div>
      )}

      {request.status === "info_required" && request.info_request && (
        <div className="notice notice--wait track-payment">
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <h3>{t("track.repair.infoTitle")}</h3>
            <p dir="auto">{request.info_request}</p>
          </div>
        </div>
      )}

      {request.response && request.response.message && (
        <div className="notice notice--wait track-payment">
          <Wrench size={18} aria-hidden="true" />
          <div>
            <h3>{t("track.repair.garageMessage")}</h3>
            <p dir="auto">{request.response.message}</p>
          </div>
        </div>
      )}

      {request.quotation && !declinedService && <Quotation quotation={request.quotation} />}
      {request.schedule && !terminal && <RepairSchedule schedule={request.schedule} />}

      {request.canDecide && !declinedService && <DecisionControls reference={request.reference} phone={phone} onUpdate={onUpdate} />}

      {request.customerDecision && (
        <div className={`notice ${request.customerDecision.value === "declined" ? "notice--stop" : "notice--go"} track-payment`}>
          <CircleCheck size={18} aria-hidden="true" />
          <div>
            <h3>{t(`track.repair.decided.${request.customerDecision.value}`)}</h3>
            {request.customerDecision.note && <p dir="auto">{request.customerDecision.note}</p>}
          </div>
        </div>
      )}

      {!terminal && !request.quotation && (
        <div className="notice track-payment notice--wait">
          <Clock size={18} aria-hidden="true" />
          <div>
            <h3>{t("track.repair.next")}</h3>
            <p>{t("track.repair.nextText")}</p>
          </div>
        </div>
      )}

      <dl className="track-meta">
        <div>
          <dt>{t("track.repair.sent")}</dt>
          <dd>{formatDate(request.created_at)}</dd>
        </div>
        <div>
          <dt>{t("track.repair.problems")}</dt>
          <dd>{t("track.repair.problemCount", { count: request.problem_count })}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function TrackInspection() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState(() => {
    const id = searchParams.get("id") || "";

    return { requestId: /^\d+$/.test(id) || SPECIAL_REFERENCE.test(id) ? id : "", phone: "" };
  });
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const formRef = useRef(null);
  const controllerRef = useRef(null);

  const errors = validate(values, t);
  const errorFor = (name) => (submitted ? errors[name] : undefined);

  useEffect(() => {
    document.title = t("track.pageTitle", { brand: "AutoZone" });
  }, [t]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);

    const firstInvalid = ["requestId", "phone"].find((name) => errors[name]);

    if (firstInvalid) {
      formRef.current?.querySelector(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setChecking(true);
    setOutcome(null);

    try {
      const repair = repairReference(values.requestId);

      if (repair) {
        const data = await trackRepairRequest(repair, values.phone.trim(), { signal: controller.signal });

        setOutcome({ repairRequest: data.request, phone: values.phone.trim() });
        return;
      }

      const reference = carReference(values.requestId);

      if (reference) {
        const data = await trackCarRequest(reference, values.phone.trim(), { signal: controller.signal });

        setOutcome({ carRequest: data.request });
        return;
      }

      const data = await apiRequest("/api/inspection-requests/status", {
        method: "POST",
        body: { requestId: Number(values.requestId.trim().replace(/^#/, "")), phone: values.phone.trim() },
        signal: controller.signal,
      });

      setOutcome({ request: data.request });
    } catch (error) {
      if (error.name !== "AbortError") {
        setOutcome({ error: error.status === 404 ? t("track.errors.notFound") : error.message });
      }
    } finally {
      if (!controller.signal.aborted) {
        setChecking(false);
      }
    }
  };

  return (
    <div className="container page track-page">
      <header className="page-heading">
        <h1>{t("track.title")}</h1>
        <p>{t("track.lead")}</p>
      </header>

      <section className="panel track-form-panel" aria-label={t("track.form.label")}>
        <form ref={formRef} className="track-form" onSubmit={handleSubmit} noValidate>
          <div className="track-form__fields">
            <Field id="track-requestId" label={t("track.form.requestId")} error={errorFor("requestId")}>
              {(props) => (
                <input
                  {...props}
                  name="requestId"
                  className="input numeric"
                  dir="ltr"
                  autoComplete="off"
                  placeholder={t("track.form.requestIdPlaceholder")}
                  value={values.requestId}
                  onChange={handleChange}
                />
              )}
            </Field>
            <Field id="track-phone" label={t("track.form.phone")} error={errorFor("phone")}>
              {(props) => (
                <input
                  {...props}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  className="input"
                  dir="ltr"
                  autoComplete="tel"
                  placeholder={t("track.form.phonePlaceholder")}
                  value={values.phone}
                  onChange={handleChange}
                />
              )}
            </Field>
          </div>
          <button type="submit" className="btn btn--primary btn--large track-form__submit" disabled={checking}>
            {checking && <span className="spinner" aria-hidden="true" />}
            {checking ? t("track.form.checking") : t("track.form.submit")}
          </button>
        </form>
      </section>

      <div className="track-outcome" aria-live="polite">
        {outcome?.error && (
          <div className="notice notice--stop">
            <CircleAlert size={18} aria-hidden="true" />
            <p>{outcome.error}</p>
          </div>
        )}
        {outcome?.request && <Result request={outcome.request} />}
        {outcome?.carRequest && <CarResult request={outcome.carRequest} />}
        {outcome?.repairRequest && <RepairResult request={outcome.repairRequest} phone={outcome.phone} onUpdate={(updated) => setOutcome((current) => ({ ...current, repairRequest: updated }))} />}
      </div>
    </div>
  );
}
