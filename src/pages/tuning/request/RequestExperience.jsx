import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ArrowLeft, CircleAlert, CircleCheck, Copy, LoaderCircle, Send } from "lucide-react";
import { useI18n } from "../../../i18n/i18n-context";
import { submitCarRequest } from "../../../lib/api";
import { formatNumber, wilayaName } from "../../../lib/format";
import { WILAYAS } from "../../sell/wilayas";
import { optionKey } from "../options";
import { CURRENCY, ILLUSTRATIVE, money } from "../pricing";
import "./request.css";

const RequestScene = lazy(() => import("./RequestScene"));

const MESSAGE_MAX = 1000;
const FIELDS = ["fullName", "phone", "email", "wilaya", "message"];
const EMPTY = { fullName: "", phone: "", email: "", wilaya: "", message: "" };

const isValidPhone = (phone) => /^\+?\d{9,15}$/.test(phone.replace(/[\s.()-]/g, ""));
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 120;

function validate(values, t) {
  const errors = {};
  const name = values.fullName.trim();

  if (!name) errors.fullName = t("tuning.request.errors.fullName");
  else if (name.length < 2 || name.length > 80) errors.fullName = t("tuning.request.errors.fullNameLength");

  if (!values.phone.trim()) errors.phone = t("tuning.request.errors.phone");
  else if (!isValidPhone(values.phone)) errors.phone = t("tuning.request.errors.phoneFormat");

  if (values.email.trim() && !isValidEmail(values.email.trim())) errors.email = t("tuning.request.errors.email");
  if (!values.wilaya) errors.wilaya = t("tuning.request.errors.wilaya");
  if (values.message.length > MESSAGE_MAX) errors.message = t("tuning.request.errors.message", { max: formatNumber(MESSAGE_MAX) });

  return errors;
}

// Weaker GPUs (phones, low memory) start without the floor reflection and with less fog; any device steps down on
// its own if its frame rate drops (PerformanceMonitor in the scene).
function startQuality() {
  const narrow = window.innerWidth <= 860;
  const memory = navigator.deviceMemory ?? 8;

  return narrow || memory <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4 ? "low" : "high";
}

function Field({ id, label, hint, error, children }) {
  return (
    <div className={`tz-req-field${error ? " is-invalid" : ""}`}>
      <label className="tz-req-field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="tz-req-field__error" id={`${id}-error`}>
          <CircleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p className="tz-req-field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

// The configuration the request carries: what the visitor chose and what it costs, with the labels they saw.
function configurationOf(vehicle, setup, quote, t) {
  const label = (group, option) => ({ group, groupLabel: t(`tuning.groups.${group}`), option, optionLabel: t(optionKey(group, option, vehicle)) });

  return {
    setup: { ...setup },
    lines: quote.paid.map((line) => ({ ...label(line.group, line.option), price: line.price })),
    included: quote.included.map((line) => label(line.group, line.option)),
    optionsTotal: quote.options,
    total: quote.total,
    currency: CURRENCY,
    illustrative: ILLUSTRATIVE,
  };
}

function RequestForm({ vehicle, setup, quote, onSent, onClose }) {
  const { t, language } = useI18n();
  const formId = useId();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState("");
  const refs = useRef({});
  const car = `${vehicle.make} ${vehicle.model}`;
  const count = quote.paid.length + quote.included.length;

  function update(field, value) {
    const next = { ...values, [field]: value };

    setValues(next);

    if (tried) setErrors(validate(next, t));
  }

  async function submit(event) {
    event.preventDefault();
    setTried(true);
    setFailure("");

    const found = validate(values, t);

    setErrors(found);

    const first = FIELDS.find((field) => found[field]);

    if (first) {
      refs.current[first]?.focus();
      return;
    }

    setSending(true);

    try {
      const response = await submitCarRequest({
        vehicleId: vehicle.id,
        vehicleName: car,
        configuration: configurationOf(vehicle, setup, quote, t),
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        wilaya: values.wilaya,
        message: values.message.trim(),
        language,
      });

      onSent(response);
    } catch (error) {
      const field = error.data?.field;

      if (field && FIELDS.includes(field)) {
        setErrors((current) => ({ ...current, [field]: error.message }));
        refs.current[field]?.focus();
      } else {
        setFailure(error.message || t("common.errors.generic"));
      }
    } finally {
      setSending(false);
    }
  }

  const described = (field, hint) => (errors[field] ? `${formId}-${field}-error` : hint ? `${formId}-${field}-hint` : undefined);
  const input = (field, extra = {}) => ({
    id: `${formId}-${field}`,
    ref: (node) => {
      refs.current[field] = node;
    },
    value: values[field],
    onChange: (event) => update(field, event.target.value),
    "aria-invalid": Boolean(errors[field]) || undefined,
    disabled: sending,
    ...extra,
  });

  return (
    <form className="tz-req-form" onSubmit={submit} noValidate>
      <details className="tz-req-car">
        <summary>
          <span className="tz-req-car__name">{car}</span>
          <span className="tz-req-car__price">
            {count ? t("tuning.request.configuration", { count }) : t("tuning.request.factory")}
            <strong className="numeric">{money(t, quote.total)}</strong>
          </span>
        </summary>
        <div className="tz-req-car__lines">
          {quote.paid.map((line) => (
            <p key={line.group}>
              <span>
                {t(`tuning.groups.${line.group}`)} · {t(optionKey(line.group, line.option, vehicle))}
              </span>
              <span className="numeric">{money(t, line.price)}</span>
            </p>
          ))}
          {quote.included.map((line) => (
            <p key={line.group}>
              <span>
                {t(`tuning.groups.${line.group}`)} · {t(optionKey(line.group, line.option, vehicle))}
              </span>
              <span>{t("tuning.pricing.included")}</span>
            </p>
          ))}
          {!count && <p>{t("tuning.request.factoryText")}</p>}
          <p className="tz-req-car__note">{t("tuning.pricing.note")}</p>
        </div>
      </details>

      <div className="tz-req-grid">
        <Field id={`${formId}-fullName`} label={t("tuning.request.fields.fullName")} error={errors.fullName}>
          <input type="text" autoComplete="name" maxLength={80} {...input("fullName", { "aria-describedby": described("fullName") })} />
        </Field>
        <Field id={`${formId}-phone`} label={t("tuning.request.fields.phone")} error={errors.phone}>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder={t("tuning.request.fields.phonePlaceholder")}
            maxLength={24}
            {...input("phone", { "aria-describedby": described("phone") })}
          />
        </Field>
        <Field id={`${formId}-email`} label={t("tuning.request.fields.email")} error={errors.email}>
          <input type="email" autoComplete="email" dir="ltr" maxLength={120} {...input("email", { "aria-describedby": described("email") })} />
        </Field>
        <Field id={`${formId}-wilaya`} label={t("tuning.request.fields.wilaya")} error={errors.wilaya}>
          <select {...input("wilaya", { "aria-describedby": described("wilaya") })}>
            <option value="">{t("tuning.request.fields.wilayaPlaceholder")}</option>
            {WILAYAS.map((wilaya) => (
              <option key={wilaya.code} value={wilaya.name}>
                {wilaya.code} {wilayaName(wilaya.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${formId}-message`} label={t("tuning.request.fields.message")} error={errors.message}>
          <textarea rows={2} placeholder={t("tuning.request.fields.messagePlaceholder")} {...input("message", { "aria-describedby": described("message") })} />
        </Field>
      </div>

      {failure && (
        <p className="tz-req-failure" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          {failure}
        </p>
      )}

      <div className="tz-req-actions">
        <button type="submit" className="tz-req-submit" disabled={sending}>
          {sending ? <LoaderCircle size={18} aria-hidden="true" className="tz-req-spin" /> : <Send size={18} aria-hidden="true" className="flip-rtl" />}
          {sending ? t("tuning.request.sending") : t("tuning.request.submit")}
        </button>
        <button type="button" className="tz-req-quiet" onClick={onClose} disabled={sending}>
          {t("tuning.request.cancel")}
        </button>
      </div>
      <p className="tz-req-privacy">{t("tuning.request.privacy")}</p>
    </form>
  );
}

function Sent({ response, onClose }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const reference = response.reference || `TZ-${response.requestId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="tz-req-sent" role="status">
      <CircleCheck size={40} aria-hidden="true" className="tz-req-sent__icon" />
      <p className="tz-req-sent__reference">
        <span>{t("tuning.request.sent.reference")}</span>
        <strong dir="ltr">{reference}</strong>
        <button type="button" className="tz-req-copy" onClick={copy} aria-label={t("tuning.request.sent.copy")} title={t("tuning.request.sent.copy")}>
          <Copy size={16} aria-hidden="true" />
        </button>
        {copied && <span className="tz-req-copied">{t("tuning.request.sent.copied")}</span>}
      </p>
      <p className="tz-req-status">
        <span className="tz-req-status__dot" aria-hidden="true" />
        {t("tuning.request.sent.status")}
      </p>
      <p className="tz-req-sent__text">{t("tuning.request.sent.text")}</p>
      <div className="tz-req-actions">
        <Link className="tz-req-submit" to={`/track?id=${encodeURIComponent(reference)}`}>
          {t("tuning.request.sent.track")}
        </Link>
        <button type="button" className="tz-req-quiet" onClick={onClose}>
          {t("tuning.request.back")}
        </button>
      </div>
    </div>
  );
}

// The request experience: a full-screen night showroom (RequestScene) with the form in the middle of it. The car
// stays the hero: the picture slides so the cars sit under the form on wide screens and above it on phones.
export default function RequestExperience({ vehicle, setup, quote, reduceMotion, onClose }) {
  const { t, dir } = useI18n();
  const [stage, setStage] = useState("loading");
  const [formShown, setFormShown] = useState(false);
  const [quality, setQuality] = useState(startQuality);
  const [sent, setSent] = useState(null);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [announcement, setAnnouncement] = useState(t("tuning.request.loading"));
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const headingRef = useRef(null);
  const layoutRef = useRef({ carsY: 0.5 });
  const titleId = useId();
  const car = `${vehicle.make} ${vehicle.model}`;

  const onCue = useCallback(
    (cue) => {
      if (cue === "start") {
        setStage("playing");
        setAnnouncement(t("tuning.request.starting", { car }));
      } else if (cue === "form") {
        setFormShown(true);
        setAnnouncement(t("tuning.request.ready"));
      }
    },
    [t, car],
  );

  // Where the cars go: under the form on wide screens, in the space above it on phones.
  const measure = useCallback(() => {
    const panel = panelRef.current;

    if (!panel) return;

    const box = panel.getBoundingClientRect();
    const height = window.innerHeight;
    const phone = window.innerWidth <= 860;
    const carsY = phone ? Math.max(0.16, box.top / 2 / height) : Math.min(0.84, Math.max(0.62, (box.bottom + height) / 2 / height + 0.015));

    layoutRef.current = { carsY };
  }, []);

  useLayoutEffect(() => {
    measure();

    const observer = new ResizeObserver(measure);

    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, formShown, sent]);

  // A dialog over the page: the page behind does not scroll, Escape and the back button close it, Tab stays inside.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    const opener = document.activeElement;

    root.style.overflow = "hidden";
    rootRef.current?.focus({ preventScroll: true });

    return () => {
      root.style.overflow = previous;
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (formShown && !sent) headingRef.current?.focus({ preventScroll: true });
  }, [formShown, sent]);

  function onKeyDown(event) {
    if (event.key === "Escape" && !rootRef.current?.querySelector(".tz-req-submit:disabled")) {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = [...rootRef.current.querySelectorAll("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary")].filter(
      (node) => node.offsetParent !== null,
    );
    const first = focusable[0];
    const last = focusable.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function onSent(response) {
    setSent(response);
    setCelebrateKey((key) => key + 1);
    setAnnouncement(t("tuning.request.sent.announce", { reference: response.reference || `TZ-${response.requestId}` }));
  }

  return createPortal(
    <div
      className={`tz-req${formShown ? " is-form" : ""}${stage === "loading" ? " is-loading" : ""}`}
      dir={dir}
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("tuning.request.title", { car: vehicle.model })}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="tz-req__stage" aria-hidden="true">
        <Suspense fallback={null}>
          <RequestScene vehicle={vehicle} setup={setup} layoutRef={layoutRef} reduceMotion={reduceMotion} quality={quality} onQuality={setQuality} onCue={onCue} celebrateKey={celebrateKey} />
        </Suspense>
      </div>

      <button type="button" className="tz-req__close" onClick={onClose}>
        <ArrowLeft size={18} aria-hidden="true" className="flip-rtl" />
        <span>{t("tuning.request.back")}</span>
      </button>

      {stage === "loading" && (
        <p className="tz-req__loading">
          <span className="tz-req__loading-bar" aria-hidden="true" />
          {t("tuning.request.loading")}
        </p>
      )}

      <section className="tz-req__panel" ref={panelRef} hidden={!formShown} aria-labelledby={titleId}>
        <h2 className="tz-req__title" id={titleId} ref={headingRef} tabIndex={-1}>
          {sent ? t("tuning.request.sent.title") : t("tuning.request.title", { car: vehicle.model })}
        </h2>
        {!sent && <p className="tz-req__lead">{t("tuning.request.lead")}</p>}
        {sent ? <Sent response={sent} onClose={onClose} /> : <RequestForm vehicle={vehicle} setup={setup} quote={quote} onSent={onSent} onClose={onClose} />}
      </section>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </div>,
    document.body,
  );
}
