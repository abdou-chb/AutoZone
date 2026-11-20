import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Armchair, ArrowLeft, ArrowRight, CarFront, Check, CircleAlert, CircleCheck, CircleHelp, Cog, Copy, Disc3, ImagePlus, LoaderCircle, Send, Settings2, Snowflake, Waves, X, Zap } from "lucide-react";
import { useI18n } from "../../../i18n/i18n-context";
import { submitRepairRequest } from "../../../lib/api";
import { formatNumber } from "../../../lib/format";
import { vehicleById } from "../vehicles";
import { CATEGORIES, categoryArea, CONTACT, DESCRIPTION_MAX, emptyProblem, MAX_IMAGES, MAX_PROBLEMS, problemReady, SEVERITY, STARTED } from "./repair-areas";
import "./repair.css";

const RepairScene = lazy(() => import("./RepairScene"));

const STEPS = ["vehicle", "problems", "details", "review"];
const CATEGORY_ICONS = { engine: Cog, transmission: Settings2, brakes: Disc3, suspension: Waves, electrical: Zap, ac: Snowflake, bodywork: CarFront, tires: Disc3, interior: Armchair, other: CircleHelp };
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const isValidPhone = (phone) => /^\+?\d{9,15}$/.test(phone.replace(/[\s.()-]/g, ""));
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 120;
const uid = () => Math.random().toString(36).slice(2, 9);

function startQuality() {
  const narrow = window.innerWidth <= 860;
  const memory = navigator.deviceMemory ?? 8;

  return narrow || memory <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4 ? "low" : "high";
}

function Field({ id, label, hint, error, optional, children }) {
  const { t } = useI18n();

  return (
    <div className={`tz-rp-field${error ? " is-invalid" : ""}`}>
      <label className="tz-rp-field__label" htmlFor={id}>
        {label}
        {optional && <span className="tz-rp-field__opt"> · {t("tuning.repair.optional")}</span>}
      </label>
      {children}
      {error ? (
        <p className="tz-rp-field__error" id={`${id}-error`}>
          <CircleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p className="tz-rp-field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function VehicleStep({ vehicle, demo, errors, onChange }) {
  const { t } = useI18n();
  const id = useId();
  const set = (field, value) => onChange({ ...vehicle, [field]: value });

  return (
    <div className="tz-rp-form">
      <fieldset className="tz-rp-choice">
        <legend>{t("tuning.repair.vehicle.which")}</legend>
        <label className={`tz-rp-choice__opt${vehicle.usesDemoModel ? " is-on" : ""}`}>
          <input type="radio" name="tz-rp-which" checked={vehicle.usesDemoModel} onChange={() => onChange({ ...vehicle, usesDemoModel: true, make: demo.make, model: demo.model })} />
          <span className="tz-rp-choice__title">{t("tuning.repair.vehicle.thisCar", { car: `${demo.make} ${demo.model}` })}</span>
          <span className="tz-rp-choice__sub">{t("tuning.repair.vehicle.thisCarSub")}</span>
        </label>
        <label className={`tz-rp-choice__opt${vehicle.usesDemoModel ? "" : " is-on"}`}>
          <input type="radio" name="tz-rp-which" checked={!vehicle.usesDemoModel} onChange={() => onChange({ ...vehicle, usesDemoModel: false })} />
          <span className="tz-rp-choice__title">{t("tuning.repair.vehicle.other")}</span>
          <span className="tz-rp-choice__sub">{t("tuning.repair.vehicle.otherSub")}</span>
        </label>
      </fieldset>

      <div className="tz-rp-grid">
        <Field id={`${id}-make`} label={t("tuning.repair.vehicle.make")} error={errors.make}>
          <input id={`${id}-make`} type="text" value={vehicle.make} maxLength={60} readOnly={vehicle.usesDemoModel} onChange={(event) => set("make", event.target.value)} />
        </Field>
        <Field id={`${id}-model`} label={t("tuning.repair.vehicle.model")} error={errors.model}>
          <input id={`${id}-model`} type="text" value={vehicle.model} maxLength={60} readOnly={vehicle.usesDemoModel} onChange={(event) => set("model", event.target.value)} />
        </Field>
        <Field id={`${id}-year`} label={t("tuning.repair.vehicle.year")} optional>
          <input id={`${id}-year`} type="number" inputMode="numeric" value={vehicle.year} min={1950} max={new Date().getFullYear() + 1} onChange={(event) => set("year", event.target.value)} />
        </Field>
        <Field id={`${id}-engine`} label={t("tuning.repair.vehicle.engine")} optional>
          <input id={`${id}-engine`} type="text" value={vehicle.engine} maxLength={60} placeholder={t("tuning.repair.vehicle.enginePlaceholder")} onChange={(event) => set("engine", event.target.value)} />
        </Field>
        <Field id={`${id}-mileage`} label={t("tuning.repair.vehicle.mileage")} optional>
          <input id={`${id}-mileage`} type="number" inputMode="numeric" value={vehicle.mileage} min={0} onChange={(event) => set("mileage", event.target.value)} />
        </Field>
        <Field id={`${id}-registration`} label={t("tuning.repair.vehicle.registration")} optional>
          <input id={`${id}-registration`} type="text" value={vehicle.registration} maxLength={20} dir="ltr" onChange={(event) => set("registration", event.target.value)} />
        </Field>
        <Field id={`${id}-notes`} label={t("tuning.repair.vehicle.notes")} optional>
          <textarea id={`${id}-notes`} rows={2} value={vehicle.notes} maxLength={1000} onChange={(event) => set("notes", event.target.value)} />
        </Field>
      </div>
      <p className="tz-rp-aside">{t("tuning.repair.vehicle.aside")}</p>
    </div>
  );
}

function ProblemCard({ problem, onChange, onRemove }) {
  const { t } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const set = (field, value) => onChange({ ...problem, [field]: value });
  const area = categoryArea(problem.category);

  return (
    <div className="tz-rp-problem">
      <div className="tz-rp-problem__head">
        <span className="tz-rp-problem__name">{t(`tuning.repair.categories.${problem.category}.name`)}</span>
        {area ? <span className="tz-rp-problem__where">{t("tuning.repair.pinnedTo", { area: t(`tuning.repair.areas.${area}`) })}</span> : <span className="tz-rp-problem__where">{t(`tuning.repair.categories.${problem.category}.where`)}</span>}
        <button type="button" className="tz-rp-icon" onClick={onRemove} aria-label={t("tuning.repair.removeProblem")}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <Field id={`${id}-desc`} label={t("tuning.repair.problem.description")} error={problem._tried && !problemReady(problem) ? t("tuning.repair.problem.descriptionError") : null}>
        <textarea id={`${id}-desc`} rows={2} value={problem.description} maxLength={DESCRIPTION_MAX} placeholder={t(`tuning.repair.categories.${problem.category}.hint`)} onChange={(event) => set("description", event.target.value)} />
      </Field>

      <div className="tz-rp-sev">
        <span className="tz-rp-sev__label">{t("tuning.repair.problem.severity")}</span>
        <div className="tz-rp-chips" role="radiogroup" aria-label={t("tuning.repair.problem.severity")}>
          {SEVERITY.map((level) => (
            <label key={level} className={`tz-rp-chip tz-rp-chip--${level}${problem.severity === level ? " is-on" : ""}`}>
              <input type="radio" name={`${id}-sev`} checked={problem.severity === level} onChange={() => set("severity", level)} />
              <span>{t(`tuning.repair.severity.${level}`)}</span>
            </label>
          ))}
        </div>
      </div>

      {open ? (
        <div className="tz-rp-more">
          <Field id={`${id}-sym`} label={t("tuning.repair.problem.symptoms")} optional>
            <textarea id={`${id}-sym`} rows={2} value={problem.symptoms} maxLength={DESCRIPTION_MAX} placeholder={t("tuning.repair.problem.symptomsPlaceholder")} onChange={(event) => set("symptoms", event.target.value)} />
          </Field>
          <Field id={`${id}-when`} label={t("tuning.repair.problem.started")} optional>
            <div className="tz-rp-chips">
              {STARTED.map((when) => (
                <label key={when} className={`tz-rp-chip${problem.started === when ? " is-on" : ""}`}>
                  <input type="radio" name={`${id}-when`} checked={problem.started === when} onChange={() => set("started", problem.started === when ? "" : when)} />
                  <span>{t(`tuning.repair.started.${when}`)}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field id={`${id}-notes`} label={t("tuning.repair.problem.notes")} optional>
            <input id={`${id}-notes`} type="text" value={problem.notes} maxLength={DESCRIPTION_MAX} onChange={(event) => set("notes", event.target.value)} />
          </Field>
        </div>
      ) : (
        <button type="button" className="tz-rp-more-toggle" onClick={() => setOpen(true)}>
          {t("tuning.repair.problem.addDetail")}
        </button>
      )}
    </div>
  );
}

function ProblemsStep({ problems, images, onProblems, onImages, pinnedRef }) {
  const { t } = useI18n();
  const fileId = useId();
  const chosen = new Set(problems.map((problem) => problem.category));

  function toggleCategory(category) {
    if (chosen.has(category)) {
      onProblems(problems.filter((problem) => problem.category !== category));
    } else if (problems.length < MAX_PROBLEMS) {
      const next = { ...emptyProblem(category), _id: uid() };

      onProblems([...problems, next]);
      pinnedRef.current = categoryArea(category);
    }
  }

  function updateProblem(next) {
    onProblems(problems.map((problem) => (problem._id === next._id ? next : problem)));
  }

  function addImages(files) {
    const room = MAX_IMAGES - images.length;
    const ok = ["image/jpeg", "image/png", "image/webp"];
    const accepted = [...files].filter((file) => ok.includes(file.type) && file.size <= IMAGE_MAX_BYTES).slice(0, room);

    onImages([...images, ...accepted.map((file) => ({ file, url: URL.createObjectURL(file), id: uid() }))]);
  }

  return (
    <div className="tz-rp-form">
      <p className="tz-rp-aside">{t("tuning.repair.problems.lead")}</p>
      <div className="tz-rp-cats" role="group" aria-label={t("tuning.repair.problems.pick")}>
        {CATEGORIES.map(({ id }) => {
          const Icon = CATEGORY_ICONS[id];

          return (
            <button key={id} type="button" className={`tz-rp-cat${chosen.has(id) ? " is-on" : ""}`} aria-pressed={chosen.has(id)} onClick={() => toggleCategory(id)}>
              <Icon size={20} aria-hidden="true" />
              <span>{t(`tuning.repair.categories.${id}.name`)}</span>
              {chosen.has(id) && (
                <span className="tz-rp-cat__check" aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {problems.length === 0 ? (
        <p className="tz-rp-empty">{t("tuning.repair.problems.empty")}</p>
      ) : (
        <div className="tz-rp-problems" onFocusCapture={(event) => {
          const card = event.target.closest?.("[data-area]");

          pinnedRef.current = card?.getAttribute("data-area") || null;
        }}>
          {problems.map((problem) => (
            <div key={problem._id} data-area={categoryArea(problem.category) || ""}>
              <ProblemCard problem={problem} onChange={updateProblem} onRemove={() => toggleCategory(problem.category)} />
            </div>
          ))}
        </div>
      )}

      <div className="tz-rp-photos">
        <span className="tz-rp-field__label">
          {t("tuning.repair.photos.label")} <span className="tz-rp-field__opt">· {t("tuning.repair.optional")}</span>
        </span>
        <p className="tz-rp-field__hint">{t("tuning.repair.photos.hint", { max: MAX_IMAGES })}</p>
        <div className="tz-rp-thumbs">
          {images.map((image) => (
            <span key={image.id} className="tz-rp-thumb">
              <img src={image.url} alt="" />
              <button type="button" onClick={() => onImages(images.filter((other) => other.id !== image.id))} aria-label={t("tuning.repair.photos.remove")}>
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="tz-rp-thumb tz-rp-thumb--add" htmlFor={fileId}>
              <ImagePlus size={20} aria-hidden="true" />
              <input id={fileId} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => { addImages(event.target.files); event.target.value = ""; }} />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailsStep({ customer, errors, onChange }) {
  const { t } = useI18n();
  const id = useId();
  const set = (field, value) => onChange({ ...customer, [field]: value });

  return (
    <div className="tz-rp-form">
      <div className="tz-rp-grid">
        <Field id={`${id}-name`} label={t("tuning.repair.details.fullName")} error={errors.fullName}>
          <input id={`${id}-name`} type="text" autoComplete="name" value={customer.fullName} maxLength={80} onChange={(event) => set("fullName", event.target.value)} />
        </Field>
        <Field id={`${id}-phone`} label={t("tuning.repair.details.phone")} error={errors.phone}>
          <input id={`${id}-phone`} type="tel" inputMode="tel" dir="ltr" autoComplete="tel" value={customer.phone} maxLength={24} placeholder="0550 12 34 56" onChange={(event) => set("phone", event.target.value)} />
        </Field>
        <Field id={`${id}-email`} label={t("tuning.repair.details.email")} optional error={errors.email}>
          <input id={`${id}-email`} type="email" dir="ltr" autoComplete="email" value={customer.email} maxLength={120} onChange={(event) => set("email", event.target.value)} />
        </Field>
        <Field id={`${id}-contact`} label={t("tuning.repair.details.contact")}>
          <div className="tz-rp-chips">
            {CONTACT.map((way) => (
              <label key={way} className={`tz-rp-chip${customer.preferredContact === way ? " is-on" : ""}`}>
                <input type="radio" name={`${id}-contact`} checked={customer.preferredContact === way} onChange={() => set("preferredContact", way)} />
                <span>{t(`tuning.repair.contact.${way}`)}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field id={`${id}-date`} label={t("tuning.repair.details.date")} hint={t("tuning.repair.details.dateHint")} optional error={errors.preferredDate}>
          <input id={`${id}-date`} type="date" value={customer.preferredDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => set("preferredDate", event.target.value)} />
        </Field>
        <Field id={`${id}-time`} label={t("tuning.repair.details.time")} optional>
          <input id={`${id}-time`} type="time" value={customer.preferredTime} onChange={(event) => set("preferredTime", event.target.value)} />
        </Field>
        <Field id={`${id}-comments`} label={t("tuning.repair.details.comments")} optional>
          <textarea id={`${id}-comments`} rows={2} value={customer.comments} maxLength={1000} onChange={(event) => set("comments", event.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function ReviewStep({ vehicle, problems, images, customer }) {
  const { t } = useI18n();
  const line = (label, value) => value && (
    <p className="tz-rp-review__line">
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );

  return (
    <div className="tz-rp-form tz-rp-review">
      <section>
        <h3>{t("tuning.repair.review.vehicle")}</h3>
        {line(t("tuning.repair.vehicle.make"), `${vehicle.make} ${vehicle.model}`)}
        {line(t("tuning.repair.vehicle.year"), vehicle.year)}
        {line(t("tuning.repair.vehicle.engine"), vehicle.engine)}
        {line(t("tuning.repair.vehicle.mileage"), vehicle.mileage && t("common.units.km", { value: formatNumber(Number(vehicle.mileage)) }))}
        {!vehicle.usesDemoModel && <p className="tz-rp-review__tag">{t("tuning.repair.review.ownCar")}</p>}
      </section>
      <section>
        <h3>{t("tuning.repair.review.problems", { count: problems.length })}</h3>
        {problems.map((problem) => (
          <div key={problem._id} className="tz-rp-review__problem">
            <p className="tz-rp-review__line">
              <span>{t(`tuning.repair.categories.${problem.category}.name`)}</span>
              <span className={`tz-rp-sev-tag tz-rp-sev-tag--${problem.severity}`}>{t(`tuning.repair.severity.${problem.severity}`)}</span>
            </p>
            <p className="tz-rp-review__desc">{problem.description}</p>
          </div>
        ))}
        {images.length > 0 && <p className="tz-rp-review__tag">{t("tuning.repair.review.photos", { count: images.length })}</p>}
      </section>
      <section>
        <h3>{t("tuning.repair.review.contact")}</h3>
        {line(t("tuning.repair.details.fullName"), customer.fullName)}
        {line(t("tuning.repair.details.phone"), customer.phone)}
        {line(t("tuning.repair.details.email"), customer.email)}
        {line(t("tuning.repair.details.contact"), t(`tuning.repair.contact.${customer.preferredContact}`))}
        {line(t("tuning.repair.details.date"), customer.preferredDate)}
      </section>
      <p className="tz-rp-aside">{t("tuning.repair.review.note")}</p>
    </div>
  );
}

function Sent({ response, onClose }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const reference = response.reference || `RP-${response.requestId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="tz-rp-sent" role="status">
      <CircleCheck size={40} aria-hidden="true" className="tz-rp-sent__icon" />
      <h2 className="tz-rp__title">{t("tuning.repair.sent.title")}</h2>
      <p className="tz-rp-sent__reference">
        <span>{t("tuning.repair.sent.reference")}</span>
        <strong dir="ltr">{reference}</strong>
        <button type="button" className="tz-rp-icon" onClick={copy} aria-label={t("tuning.repair.sent.copy")}>
          <Copy size={16} aria-hidden="true" />
        </button>
        {copied && <span className="tz-rp-copied">{t("tuning.repair.sent.copied")}</span>}
      </p>
      <p className="tz-rp-status">
        <span className="tz-rp-status__dot" aria-hidden="true" />
        {t("tuning.repair.sent.status")}
      </p>
      <p className="tz-rp-sent__text">{t("tuning.repair.sent.text")}</p>
      <div className="tz-rp-actions">
        <Link className="tz-rp-primary" to={`/track?id=${encodeURIComponent(reference)}`}>
          {t("tuning.repair.sent.track")}
        </Link>
        <button type="button" className="tz-rp-quiet" onClick={onClose}>
          {t("tuning.repair.back")}
        </button>
      </div>
    </div>
  );
}

export default function RepairExperience({ vehicleId, reduceMotion, onClose }) {
  const { t, dir, language } = useI18n();
  const demo = useMemo(() => vehicleById(vehicleId), [vehicleId]);
  const [ready, setReady] = useState(false);
  const [quality, setQuality] = useState(startQuality);
  const [step, setStep] = useState(0);
  const [vehicle, setVehicle] = useState({ usesDemoModel: true, make: demo.make, model: demo.model, year: "", engine: "", mileage: "", registration: "", notes: "" });
  const [problems, setProblems] = useState([]);
  const [images, setImages] = useState([]);
  const [customer, setCustomer] = useState({ fullName: "", phone: "", email: "", preferredContact: "phone", preferredDate: "", preferredTime: "", comments: "" });
  const [errors, setErrors] = useState({});
  const [vehicleErrors, setVehicleErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState("");
  const [sent, setSent] = useState(null);
  const [focusArea, setFocusArea] = useState(null);
  const pinnedRef = useRef(null);
  const rootRef = useRef(null);
  const headingRef = useRef(null);
  const titleId = useId();
  const stepName = STEPS[step];

  const areaLabels = useMemo(() => {
    const labels = {};

    for (const problem of problems) {
      const area = categoryArea(problem.category);

      if (area) labels[area] = t(`tuning.repair.areas.${area}`);
    }

    return labels;
  }, [problems, t]);
  const activeAreas = useMemo(() => [...new Set(problems.map((problem) => categoryArea(problem.category)).filter(Boolean))], [problems]);

  // Clicking a pin on the car adds (or focuses) a problem for that area.
  const onPickArea = useCallback(
    (area) => {
      setStep(1);
      setProblems((current) => {
        const existing = current.find((problem) => categoryArea(problem.category) === area);

        if (existing) return current;
        if (current.length >= MAX_PROBLEMS) return current;

        const category = CATEGORIES.find((item) => item.area === area)?.id;

        return category ? [...current, { ...emptyProblem(category), _id: uid() }] : current;
      });
      setFocusArea(area);
    },
    [],
  );

  // Frame the area of the problem being edited, or the hero when none.
  useEffect(() => {
    if (stepName !== "problems") {
      setFocusArea(null);
      return undefined;
    }

    const timer = setInterval(() => {
      if (pinnedRef.current !== undefined) {
        setFocusArea((current) => (current === pinnedRef.current ? current : pinnedRef.current));
      }
    }, 400);

    return () => clearInterval(timer);
  }, [stepName]);

  useEffect(() => () => images.forEach((image) => URL.revokeObjectURL(image.url)), [images]);

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
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  function validateDetails() {
    const found = {};

    if (customer.fullName.trim().length < 2) found.fullName = t("tuning.repair.details.errors.fullName");
    if (!isValidPhone(customer.phone)) found.phone = t("tuning.repair.details.errors.phone");
    if (customer.email.trim() && !isValidEmail(customer.email.trim())) found.email = t("tuning.repair.details.errors.email");
    if (customer.preferredDate && customer.preferredDate < new Date().toISOString().slice(0, 10)) found.preferredDate = t("tuning.repair.details.errors.date");

    return found;
  }

  function next() {
    if (step === 0) {
      const found = {};

      if (!vehicle.make.trim()) found.make = t("tuning.repair.vehicle.required");
      if (!vehicle.model.trim()) found.model = t("tuning.repair.vehicle.required");
      setVehicleErrors(found);

      if (Object.keys(found).length) return;
    }

    if (step === 1) {
      setProblems((current) => current.map((problem) => ({ ...problem, _tried: true })));

      if (!problems.length || !problems.every(problemReady)) return;
    }

    if (step === 2) {
      const found = validateDetails();

      setErrors(found);

      if (Object.keys(found).length) return;
    }

    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  async function submit() {
    setSending(true);
    setFailure("");

    const payload = {
      vehicle: { usesDemoModel: vehicle.usesDemoModel, make: vehicle.make.trim(), model: vehicle.model.trim(), year: vehicle.year, engine: vehicle.engine.trim(), mileage: vehicle.mileage, registration: vehicle.registration.trim(), notes: vehicle.notes.trim() },
      demoVehicleId: demo.id,
      problems: problems.map((problem) => { const { _id, _tried, ...rest } = problem; void _id; void _tried; return { ...rest, description: rest.description.trim() }; }),
      customer: { ...customer, fullName: customer.fullName.trim(), phone: customer.phone.trim(), email: customer.email.trim() },
      language,
    };
    const form = new FormData();

    form.append("payload", JSON.stringify(payload));
    images.forEach((image) => form.append("images", image.file));

    try {
      setSent(await submitRepairRequest(form));
    } catch (error) {
      const field = error.data?.field;

      if (field === "fullName" || field === "phone" || field === "email" || field === "preferredDate") {
        setErrors((current) => ({ ...current, [field]: error.message }));
        setStep(2);
      } else {
        setFailure(error.message || t("common.errors.generic"));
      }
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && !sending) {
      event.stopPropagation();
      onClose();
    }
  }

  return createPortal(
    <div className="tz-rp" dir={dir} ref={rootRef} role="dialog" aria-modal="true" aria-label={t("tuning.repair.title")} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="tz-rp__stage" aria-hidden="true">
        <Suspense fallback={null}>
          <RepairScene
            vehicleId={demo.id}
            focusArea={focusArea}
            activeAreas={activeAreas}
            reduceMotion={reduceMotion}
            quality={quality}
            onQuality={setQuality}
            onReady={() => setReady(true)}
            onPickArea={onPickArea}
            labels={areaLabels}
          />
        </Suspense>
      </div>

      <button type="button" className="tz-rp__close" onClick={onClose}>
        <ArrowLeft size={18} aria-hidden="true" className="flip-rtl" />
        <span>{t("tuning.repair.back")}</span>
      </button>

      {!ready && (
        <p className="tz-rp__loading">
          <span className="tz-rp__loading-bar" aria-hidden="true" />
          {t("tuning.repair.loading")}
        </p>
      )}

      {ready && (
        <section className="tz-rp__panel" aria-labelledby={titleId}>
          {sent ? (
            <Sent response={sent} onClose={onClose} />
          ) : (
            <>
              <ol className="tz-rp-steps" aria-label={t("tuning.repair.stepsLabel")}>
                {STEPS.map((name, index) => (
                  <li key={name} className={`tz-rp-steps__item${index === step ? " is-active" : ""}${index < step ? " is-done" : ""}`} aria-current={index === step ? "step" : undefined}>
                    <span className="tz-rp-steps__dot">{index < step ? <Check size={12} strokeWidth={3} /> : index + 1}</span>
                    <span className="tz-rp-steps__name">{t(`tuning.repair.steps.${name}`)}</span>
                  </li>
                ))}
              </ol>

              <h2 className="tz-rp__title" id={titleId} ref={headingRef} tabIndex={-1}>
                {t(`tuning.repair.titles.${stepName}`, { car: demo.model })}
              </h2>

              <div className="tz-rp__body" key={stepName}>
                {stepName === "vehicle" && <VehicleStep vehicle={vehicle} demo={demo} errors={vehicleErrors} onChange={setVehicle} />}
                {stepName === "problems" && <ProblemsStep problems={problems} images={images} onProblems={setProblems} onImages={setImages} pinnedRef={pinnedRef} />}
                {stepName === "details" && <DetailsStep customer={customer} errors={errors} onChange={setCustomer} />}
                {stepName === "review" && <ReviewStep vehicle={vehicle} problems={problems} images={images} customer={customer} />}
              </div>

              {failure && (
                <p className="tz-rp-failure" role="alert">
                  <CircleAlert size={16} aria-hidden="true" />
                  {failure}
                </p>
              )}

              <div className="tz-rp__nav">
                {step > 0 ? (
                  <button type="button" className="tz-rp-quiet" onClick={() => setStep((value) => value - 1)} disabled={sending}>
                    <ArrowLeft size={16} aria-hidden="true" className="flip-rtl" />
                    {t("tuning.repair.previous")}
                  </button>
                ) : (
                  <span />
                )}
                {stepName === "review" ? (
                  <button type="button" className="tz-rp-primary" onClick={submit} disabled={sending}>
                    {sending ? <LoaderCircle size={18} aria-hidden="true" className="tz-rp-spin" /> : <Send size={18} aria-hidden="true" className="flip-rtl" />}
                    {sending ? t("tuning.repair.sending") : t("tuning.repair.submit")}
                  </button>
                ) : (
                  <button type="button" className="tz-rp-primary" onClick={next}>
                    {t("tuning.repair.next")}
                    <ArrowRight size={16} aria-hidden="true" className="flip-rtl" />
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>,
    document.body,
  );
}
