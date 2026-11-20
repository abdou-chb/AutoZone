import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Car, Check, CircleCheck, CircleX, Clock, Gauge, HelpCircle, Mail, MessageCircle, Phone, Plus, Send, Trash2, Wrench } from "lucide-react";
import Lightbox from "../../Lightbox";
import { useI18n } from "../../../i18n/i18n-context";
import { formatDate, formatNumber, formatPrice } from "../../../lib/format";
import { imageUrl } from "../../../lib/api";
import { useToast } from "../../../lib/toast-context";
import { useAdmin } from "../admin-context";
import ConfirmDialog from "../ConfirmDialog";
import { isQuietError } from "../listings/listing-helpers";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import { languageName, telHref, whatsappHref } from "../messages/message-utils";
import { categoryKey, contactKey, kindKey, KINDS, referenceText, severityKey, startedKey, statusKey, STATUS_TONES, SEVERITY_TONES } from "./repair-request-utils";

const LONG_DATE = { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" };
const DAY = { weekday: "long", day: "numeric", month: "long" };
const EVENT_DATE = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
const uid = () => Math.random().toString(36).slice(2, 9);
const NEXT_STAGE = { accepted: "scheduled", scheduled: "received", received: "in_progress", in_progress: "completed" };

function Fact({ icon: Icon, label, value }) {
  if (!value && value !== 0) {
    return null;
  }

  return (
    <div className="repair-fact">
      <dt>
        {Icon ? <Icon size={15} aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd>
        <bdi>{value}</bdi>
      </dd>
    </div>
  );
}

function Totals({ quotation }) {
  const { t } = useI18n();

  return (
    <dl className="repair-totals">
      <div>
        <dt>{t("adminRepairRequests.quote.subtotal")}</dt>
        <dd className="numeric">{formatPrice(quotation.subtotal)}</dd>
      </div>
      {quotation.taxRate > 0 && (
        <div>
          <dt>
            {t("adminRepairRequests.quote.taxLine")} ({quotation.taxRate}%)
          </dt>
          <dd className="numeric">{formatPrice(quotation.tax)}</dd>
        </div>
      )}
      <div className="repair-totals__grand">
        <dt>{t("adminRepairRequests.quote.total")}</dt>
        <dd className="numeric">{formatPrice(quotation.total)}</dd>
      </div>
    </dl>
  );
}

// Read-only quotation (once sent / accepted / finished).
function QuoteView({ quotation }) {
  const { t } = useI18n();

  return (
    <div className="repair-quote-view">
      <table className="repair-quote-table">
        <tbody>
          {quotation.lines.map((line, index) => (
            <tr key={index}>
              <td>
                <bdi>{line.label}</bdi>
                <span className="repair-quote-table__kind">{t(kindKey(line.kind))}</span>
              </td>
              <td className="numeric">{line.qty} × {formatNumber(line.unitPrice)}</td>
              <td className="numeric repair-quote-table__amount">{formatPrice(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Totals quotation={quotation} />
    </div>
  );
}

function QuoteEditor({ quotation, busy, onSave }) {
  const { t } = useI18n();
  const id = useId();
  const [lines, setLines] = useState(() => (quotation?.lines?.length ? quotation.lines.map((line) => ({ ...line, _k: uid() })) : [{ _k: uid(), label: "", kind: "diagnostic", qty: 1, unitPrice: 0 }]));
  const [taxRate, setTaxRate] = useState(quotation?.taxRate ?? 0);
  const setLine = (key, field, value) => setLines((current) => current.map((line) => (line._k === key ? { ...line, [field]: value } : line)));
  const subtotal = lines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.unitPrice) || 0), 0);
  const tax = Math.round((subtotal * (Number(taxRate) || 0)) / 100);
  const valid = lines.every((line) => line.label.trim() && Number(line.qty) >= 0 && Number(line.unitPrice) >= 0);

  function save() {
    onSave({ taxRate: Number(taxRate) || 0, lines: lines.map(({ label, kind, qty, unitPrice }) => ({ label: label.trim(), kind, qty: Number(qty) || 0, unitPrice: Number(unitPrice) || 0 })) });
  }

  return (
    <div className="repair-quote-editor">
      <ul className="repair-quote-lines">
        {lines.map((line) => (
          <li key={line._k} className="repair-quote-line">
            <input className="repair-quote-line__label" type="text" value={line.label} maxLength={80} placeholder={t("adminRepairRequests.quote.label")} aria-label={t("adminRepairRequests.quote.label")} onChange={(event) => setLine(line._k, "label", event.target.value)} />
            <select className="repair-quote-line__kind" value={line.kind} aria-label={t("adminRepairRequests.quote.kind")} onChange={(event) => setLine(line._k, "kind", event.target.value)}>
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(kindKey(kind))}
                </option>
              ))}
            </select>
            <input className="repair-quote-line__qty numeric" type="number" min={0} max={999} value={line.qty} aria-label={t("adminRepairRequests.quote.qty")} onChange={(event) => setLine(line._k, "qty", event.target.value)} />
            <input className="repair-quote-line__price numeric" type="number" min={0} value={line.unitPrice} aria-label={t("adminRepairRequests.quote.unit")} onChange={(event) => setLine(line._k, "unitPrice", event.target.value)} />
            <span className="repair-quote-line__amount numeric">{formatPrice((Number(line.qty) || 0) * (Number(line.unitPrice) || 0))}</span>
            <button type="button" className="btn-icon" aria-label={t("adminRepairRequests.quote.remove")} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item._k !== line._k))}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="repair-quote-editor__foot">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setLines((current) => [...current, { _k: uid(), label: "", kind: "parts", qty: 1, unitPrice: 0 }])}>
          <Plus size={15} aria-hidden="true" />
          {t("adminRepairRequests.quote.add")}
        </button>
        <label className="repair-quote-tax" htmlFor={`${id}-tax`}>
          {t("adminRepairRequests.quote.tax")}
          <input id={`${id}-tax`} className="numeric" type="number" min={0} max={100} value={taxRate} onChange={(event) => setTaxRate(event.target.value)} />
        </label>
      </div>
      <Totals quotation={{ subtotal, tax, taxRate: Number(taxRate) || 0, total: subtotal + tax }} />
      <button type="button" className="btn btn--primary btn--small" disabled={!valid || busy} onClick={save}>
        {t("adminRepairRequests.quote.save")}
      </button>
    </div>
  );
}

function ScheduleForm({ schedule, preferredDate, busy, onSave }) {
  const { t } = useI18n();
  const id = useId();
  const [form, setForm] = useState({
    arrivalDate: schedule?.arrivalDate || "",
    arrivalTime: schedule?.arrivalTime || "",
    startDate: schedule?.startDate || "",
    durationDays: schedule?.durationDays ?? "",
    completionDate: schedule?.completionDate || "",
    instructions: schedule?.instructions || "",
  });
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="repair-schedule">
      <p className="repair-schedule__preferred">
        <Clock size={15} aria-hidden="true" />
        {preferredDate ? t("adminRepairRequests.schedule.preferred", { date: formatDate(preferredDate, DAY) }) : t("adminRepairRequests.schedule.preferredAny")}
      </p>
      <div className="repair-grid">
        <label className="field" htmlFor={`${id}-arr`}>
          <span className="field__label">{t("adminRepairRequests.schedule.arrivalDate")}</span>
          <input id={`${id}-arr`} type="date" value={form.arrivalDate} onChange={(event) => set("arrivalDate", event.target.value)} />
        </label>
        <label className="field" htmlFor={`${id}-time`}>
          <span className="field__label">{t("adminRepairRequests.schedule.arrivalTime")}</span>
          <input id={`${id}-time`} type="time" value={form.arrivalTime} onChange={(event) => set("arrivalTime", event.target.value)} />
        </label>
        <label className="field" htmlFor={`${id}-start`}>
          <span className="field__label">{t("adminRepairRequests.schedule.startDate")}</span>
          <input id={`${id}-start`} type="date" value={form.startDate} onChange={(event) => set("startDate", event.target.value)} />
        </label>
        <label className="field" htmlFor={`${id}-dur`}>
          <span className="field__label">{t("adminRepairRequests.schedule.duration")}</span>
          <input id={`${id}-dur`} type="number" min={0} max={365} value={form.durationDays} onChange={(event) => set("durationDays", event.target.value)} />
        </label>
        <label className="field" htmlFor={`${id}-done`}>
          <span className="field__label">{t("adminRepairRequests.schedule.completion")}</span>
          <input id={`${id}-done`} type="date" value={form.completionDate} onChange={(event) => set("completionDate", event.target.value)} />
        </label>
      </div>
      <label className="field" htmlFor={`${id}-ins`}>
        <span className="field__label">{t("adminRepairRequests.schedule.instructions")}</span>
        <textarea id={`${id}-ins`} rows={2} value={form.instructions} maxLength={1000} onChange={(event) => set("instructions", event.target.value)} />
      </label>
      <button type="button" className="btn btn--outline btn--small" disabled={busy} onClick={() => onSave(form)}>
        {t("adminRepairRequests.schedule.save")}
      </button>
    </div>
  );
}

function ScheduleView({ schedule }) {
  const { t } = useI18n();
  const rows = [
    [t("adminRepairRequests.schedule.arrivalDate"), schedule.arrivalDate && `${formatDate(schedule.arrivalDate, DAY)}${schedule.arrivalTime ? ` · ${schedule.arrivalTime}` : ""}`],
    [t("adminRepairRequests.schedule.duration"), schedule.durationDays || schedule.durationDays === 0 ? String(schedule.durationDays) : ""],
    [t("adminRepairRequests.schedule.completion"), schedule.completionDate && formatDate(schedule.completionDate, DAY)],
  ].filter(([, value]) => value);

  if (!rows.length && !schedule.instructions) {
    return null;
  }

  return (
    <div className="repair-schedule-view">
      <dl className="repair-facts">
        {rows.map(([label, value]) => (
          <div className="repair-fact" key={label}>
            <dt>{label}</dt>
            <dd>
              <bdi>{value}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      {schedule.instructions && (
        <p className="repair-notes" dir="auto">
          {schedule.instructions}
        </p>
      )}
    </div>
  );
}

function Timeline({ events }) {
  const { t } = useI18n();

  if (!events?.length) {
    return null;
  }

  return (
    <section className="repair-section repair-timeline">
      <h3 className="car-request__heading">
        <Clock size={18} aria-hidden="true" />
        {t("adminRepairRequests.timeline.title")}
      </h3>
      <ol className="repair-events">
        {events.map((item, index) => (
          <li key={index} className={`repair-event repair-event--${item.actor}`}>
            <span className="repair-event__dot" aria-hidden="true" />
            <div>
              <p className="repair-event__label">{t(`adminRepairRequests.timeline.types.${item.type}`)}</p>
              {item.note && (
                <p className="repair-event__note" dir="auto">
                  {item.note}
                </p>
              )}
              <p className="repair-event__meta">
                {t(`adminRepairRequests.timeline.actor.${item.actor}`)} · {formatDate(item.at, EVENT_DATE)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// One repair request: who asked, which vehicle, the reported problems and photos, then the garage workflow —
// accept/reject, a server-priced quotation, a schedule, sending the response, the customer's decision, and the stages.
export default function RepairRequestReader({ id, backHref, focusOnLoad, onChanged }) {
  const { t } = useI18n();
  const showToast = useToast();
  const { request, refreshSummary } = useAdmin();
  const detail = useAdminData(request, `/api/admin/repair-requests/${id}`);
  const [override, setOverride] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(null);
  const headingRef = useRef(null);
  const fieldId = useId();
  const item = override || detail.data?.request;

  useEffect(() => {
    if (detail.data?.request && focusOnLoad) {
      headingRef.current?.focus();
    }
  }, [detail.data, focusOnLoad]);

  async function act(url, options, toastKey) {
    setBusy(true);

    try {
      const data = await request(`/api/admin/repair-requests/${id}${url}`, options);

      setOverride(data.request);
      setNote("");

      if (toastKey) {
        showToast(t(`adminRepairRequests.toasts.${toastKey}`), { tone: "success" });
      }

      refreshSummary();
      onChanged?.();

      return true;
    } catch (error) {
      if (!isQuietError(error)) {
        showToast(error.message, { tone: "error" });
      }

      if (error?.status === 409) {
        detail.reload();
        onChanged?.();
      }

      return false;
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link className="btn btn--ghost btn--small inbox-reader__back" to={backHref}>
      <ArrowLeft size={18} aria-hidden="true" className="flip-rtl" />
      {t("adminRepairRequests.back")}
    </Link>
  );

  if (detail.error) {
    return (
      <div className="inbox-reader__state">
        {back}
        <LoadError message={detail.error} onRetry={detail.reload} retrying={detail.refreshing} />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="inbox-reader__state" aria-busy="true">
        {back}
        <p className="visually-hidden" role="status">
          {t("adminRepairRequests.loadingRequest")}
        </p>
        <div className="skeleton admin-skeleton-line admin-skeleton-line--title" />
        <div className="skeleton admin-skeleton-line" />
        <div className="skeleton admin-skeleton-line admin-skeleton-line--short" />
      </div>
    );
  }

  const whatsapp = whatsappHref(item.phone);
  const images = (item.attachments || []).map(imageUrl);
  const vehicle = `${item.vehicle_make} ${item.vehicle_model}${item.vehicle_year ? ` (${item.vehicle_year})` : ""}`;
  const { status } = item;
  const quoting = status === "under_review" || status === "info_required";
  const inStages = ["accepted", "scheduled", "received", "in_progress"].includes(status);
  const terminal = ["completed", "rejected", "declined", "cancelled"].includes(status);
  const review = (action) => act("/review", { method: "PATCH", body: { action, note } }, action);
  const stage = (next) => act("/status", { method: "PATCH", body: { status: next, note } }, next);

  return (
    <article className="inbox-reader__message car-request repair-request" aria-labelledby={`${fieldId}-title`}>
      {back}

      <header className="inbox-reader__head">
        <div className="inbox-reader__tags">
          <span className={`badge badge--${STATUS_TONES[item.status] || ""}`}>{t(statusKey(item.status))}</span>
          <span className="badge numeric">{referenceText(item.reference)}</span>
          <span className="badge inbox-lang" title={t("adminRepairRequests.writtenIn", { language: languageName(item.language) })}>
            <span aria-hidden="true">{item.language.toUpperCase()}</span>
            <span className="visually-hidden">{t("adminRepairRequests.writtenIn", { language: languageName(item.language) })}</span>
          </span>
        </div>
        <h2 id={`${fieldId}-title`} ref={headingRef} tabIndex={-1} className="inbox-reader__subject">
          <bdi>{vehicle}</bdi>
        </h2>
        <p className="inbox-reader__date">{t("adminRepairRequests.received", { date: formatDate(item.created_at, LONG_DATE) })}</p>
      </header>

      <section className="inbox-sender" aria-label={t("adminRepairRequests.applicant")}>
        <span className="inbox-sender__avatar" aria-hidden="true">
          {item.full_name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="inbox-sender__main">
          <p className="inbox-sender__name">
            <bdi>{item.full_name}</bdi>
            <span className="repair-preferred">{t("adminRepairRequests.prefers", { via: t(contactKey(item.preferred_contact)) })}</span>
          </p>
          <ul className="inbox-sender__links">
            <li>
              <a className="admin-contact__link numeric" href={telHref(item.phone)}>
                <Phone size={16} aria-hidden="true" />
                <span className="ltr">{item.phone}</span>
              </a>
            </li>
            {item.email && (
              <li>
                <a className="admin-contact__link" href={`mailto:${item.email}`}>
                  <Mail size={16} aria-hidden="true" />
                  <span className="ltr">{item.email}</span>
                </a>
              </li>
            )}
            {whatsapp && (
              <li>
                <a className="admin-contact__link" href={whatsapp} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} aria-hidden="true" />
                  {t("adminRepairRequests.whatsapp")}
                  <span className="visually-hidden"> {t("admin.newTab")}</span>
                </a>
              </li>
            )}
          </ul>
        </div>
      </section>

      {item.comments && (
        <div className="repair-preference">
          <p className="repair-preference__comments" dir="auto" lang={item.language}>
            {item.comments}
          </p>
        </div>
      )}

      <section className="repair-section" aria-labelledby={`${fieldId}-vehicle`}>
        <h3 id={`${fieldId}-vehicle`} className="car-request__heading">
          <Car size={18} aria-hidden="true" />
          {t("adminRepairRequests.vehicle")}
        </h3>
        <p className={`repair-source repair-source--${item.uses_demo_model ? "demo" : "other"}`}>
          {t(item.uses_demo_model ? "adminRepairRequests.isDemoModel" : "adminRepairRequests.notDemoModel")}
        </p>
        <dl className="repair-facts">
          <Fact icon={Car} label={t("adminRepairRequests.facts.make")} value={`${item.vehicle_make} ${item.vehicle_model}`} />
          <Fact label={t("adminRepairRequests.facts.year")} value={item.vehicle_year} />
          <Fact label={t("adminRepairRequests.facts.engine")} value={item.engine} />
          <Fact icon={Gauge} label={t("adminRepairRequests.facts.mileage")} value={item.mileage || item.mileage === 0 ? t("adminRepairRequests.km", { value: formatNumber(item.mileage) }) : ""} />
          <Fact label={t("adminRepairRequests.facts.registration")} value={item.registration} />
        </dl>
        {item.vehicle_notes && (
          <p className="repair-notes" dir="auto" lang={item.language}>
            {item.vehicle_notes}
          </p>
        )}
      </section>

      <section className="repair-section" aria-labelledby={`${fieldId}-problems`}>
        <h3 id={`${fieldId}-problems`} className="car-request__heading">
          {t("adminRepairRequests.problems", { count: item.problems.length })}
        </h3>
        <ol className="repair-problems">
          {item.problems.map((problem, index) => (
            <li key={index} className="repair-problem">
              <div className="repair-problem__head">
                <span className="repair-problem__category">{t(categoryKey(problem.category))}</span>
                <span className={`badge badge--${SEVERITY_TONES[problem.severity] || ""}`}>{t(severityKey(problem.severity))}</span>
                {problem.area && <span className="badge repair-problem__area">{t("adminRepairRequests.area", { area: problem.area })}</span>}
              </div>
              <p className="repair-problem__desc" dir="auto" lang={item.language}>
                {problem.description}
              </p>
              <dl className="repair-problem__meta">
                {problem.symptoms && (
                  <div>
                    <dt>{t("adminRepairRequests.symptoms")}</dt>
                    <dd dir="auto">{problem.symptoms}</dd>
                  </div>
                )}
                {(problem.started || problem.startedNote) && (
                  <div>
                    <dt>{t("adminRepairRequests.when")}</dt>
                    <dd>{[startedKey(problem.started) && t(startedKey(problem.started)), problem.startedNote].filter(Boolean).join(" · ")}</dd>
                  </div>
                )}
                {problem.notes && (
                  <div>
                    <dt>{t("adminRepairRequests.notes")}</dt>
                    <dd dir="auto">{problem.notes}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ol>
      </section>

      {images.length > 0 && (
        <section className="repair-section" aria-labelledby={`${fieldId}-photos`}>
          <h3 id={`${fieldId}-photos`} className="car-request__heading">
            {t("adminRepairRequests.photos", { count: images.length })}
          </h3>
          <ul className="repair-gallery">
            {images.map((src, index) => (
              <li key={src}>
                <button type="button" className="repair-gallery__thumb" onClick={() => setLightbox(index)}>
                  <img src={src} alt={t("adminRepairRequests.photo", { index: index + 1 })} loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Workflow */}
      {item.customerDecision && (
        <div className={`repair-decision repair-decision--${item.customerDecision.value}`}>
          <p className="repair-decision__head">
            {item.customerDecision.value === "accepted" ? <CircleCheck size={18} aria-hidden="true" /> : item.customerDecision.value === "declined" ? <CircleX size={18} aria-hidden="true" /> : <HelpCircle size={18} aria-hidden="true" />}
            {t(`adminRepairRequests.decision.${item.customerDecision.value === "clarification" ? "clarification" : item.customerDecision.value}`)}
            <span className="repair-decision__on">{t("adminRepairRequests.decision.on", { date: formatDate(item.customerDecision.at, DAY) })}</span>
          </p>
          {item.customerDecision.note && (
            <p className="repair-decision__note" dir="auto">
              {item.customerDecision.note}
            </p>
          )}
        </div>
      )}

      {status === "submitted" && (
        <section className="repair-section repair-work" aria-labelledby={`${fieldId}-review`}>
          <h3 id={`${fieldId}-review`} className="car-request__heading">
            <Wrench size={18} aria-hidden="true" />
            {t("adminRepairRequests.review.title")}
          </h3>
          <p className="repair-work__lead">{t("adminRepairRequests.review.lead")}</p>
          <label className="field" htmlFor={`${fieldId}-note`}>
            <span className="field__label">{t("adminRepairRequests.review.noteLabel")}</span>
            <textarea id={`${fieldId}-note`} rows={2} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="repair-actions">
            <button type="button" className="btn btn--primary btn--small" disabled={busy} onClick={() => review("accept")}>
              <Check size={15} aria-hidden="true" />
              {t("adminRepairRequests.review.accept")}
            </button>
            <button type="button" className="btn btn--outline btn--small" disabled={busy || !note.trim()} onClick={() => review("request_info")}>
              {t("adminRepairRequests.review.requestInfo")}
            </button>
            <button type="button" className="btn btn--ghost btn--small repair-actions__danger" disabled={busy || !note.trim()} onClick={() => setConfirm("reject")}>
              {t("adminRepairRequests.review.reject")}
            </button>
          </div>
        </section>
      )}

      {quoting && (
        <section className="repair-section repair-work" aria-labelledby={`${fieldId}-quote`}>
          <h3 id={`${fieldId}-quote`} className="car-request__heading">
            {t("adminRepairRequests.quote.title")}
          </h3>
          <p className="repair-work__lead">{t("adminRepairRequests.quote.lead")}</p>
          <QuoteEditor quotation={item.quotation} busy={busy} onSave={(body) => act("/quotation", { method: "PUT", body }, "quotation")} />

          <h3 className="car-request__heading repair-work__sub">{t("adminRepairRequests.schedule.title")}</h3>
          <ScheduleForm schedule={item.schedule} preferredDate={item.preferred_date} busy={busy} onSave={(body) => act("/schedule", { method: "PUT", body }, "schedule")} />

          <h3 className="car-request__heading repair-work__sub">{t("adminRepairRequests.send.title")}</h3>
          <p className="repair-work__lead">{t("adminRepairRequests.send.lead")}</p>
          <label className="field" htmlFor={`${fieldId}-msg`}>
            <span className="field__label">{t("adminRepairRequests.send.message")}</span>
            <textarea id={`${fieldId}-msg`} rows={2} value={message} maxLength={1000} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <div className="repair-actions">
            <button type="button" className="btn btn--primary btn--small" disabled={busy || !item.quotation} onClick={() => setConfirm("send")}>
              <Send size={15} aria-hidden="true" className="flip-rtl" />
              {t("adminRepairRequests.send.quote")}
            </button>
            <button type="button" className="btn btn--ghost btn--small repair-actions__danger" disabled={busy} onClick={() => setConfirm("cannot")}>
              {t("adminRepairRequests.send.cannot")}
            </button>
          </div>
          {!item.quotation && <p className="repair-work__hint">{t("adminRepairRequests.send.needsQuote")}</p>}
        </section>
      )}

      {status === "awaiting_customer" && (
        <section className="repair-section repair-work" aria-labelledby={`${fieldId}-awaiting`}>
          <h3 id={`${fieldId}-awaiting`} className="car-request__heading">
            {t("adminRepairRequests.sentResponse.title")}
          </h3>
          <p className="repair-work__lead">{t("adminRepairRequests.awaiting")}</p>
          {item.quotation && <QuoteView quotation={item.quotation} />}
          {item.schedule && <ScheduleView schedule={item.schedule} />}
          <div className="repair-actions">
            <button type="button" className="btn btn--ghost btn--small repair-actions__danger" disabled={busy} onClick={() => setConfirm("cancel")}>
              {t("adminRepairRequests.stages.cancel")}
            </button>
          </div>
        </section>
      )}

      {inStages && (
        <section className="repair-section repair-work" aria-labelledby={`${fieldId}-stages`}>
          <h3 id={`${fieldId}-stages`} className="car-request__heading">
            {t("adminRepairRequests.stages.title")}
          </h3>
          {item.quotation && <QuoteView quotation={item.quotation} />}
          {item.schedule && <ScheduleView schedule={item.schedule} />}
          <label className="field" htmlFor={`${fieldId}-snote`}>
            <span className="field__label">{t("adminRepairRequests.stages.noteLabel")}</span>
            <input id={`${fieldId}-snote`} type="text" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="repair-actions">
            <button type="button" className="btn btn--primary btn--small" disabled={busy} onClick={() => stage(NEXT_STAGE[status])}>
              {t(`adminRepairRequests.stages.${NEXT_STAGE[status]}`)}
            </button>
            <button type="button" className="btn btn--ghost btn--small repair-actions__danger" disabled={busy} onClick={() => setConfirm("cancel")}>
              {t("adminRepairRequests.stages.cancel")}
            </button>
          </div>
        </section>
      )}

      {terminal && (
        <section className="repair-section repair-work">
          <p className={`repair-done repair-done--${status}`}>
            {status === "completed" ? <CircleCheck size={18} aria-hidden="true" /> : <CircleX size={18} aria-hidden="true" />}
            {t(`adminRepairRequests.stages.done${status.charAt(0).toUpperCase()}${status.slice(1)}`)}
          </p>
          {item.reject_reason && (
            <p className="repair-notes" dir="auto">
              {item.reject_reason}
            </p>
          )}
          {item.quotation && <QuoteView quotation={item.quotation} />}
          {item.schedule && <ScheduleView schedule={item.schedule} />}
        </section>
      )}

      <Timeline events={item.events} />

      {confirm === "reject" && (
        <ConfirmDialog
          title={t("adminRepairRequests.review.rejectConfirm.title")}
          description={t("adminRepairRequests.review.rejectConfirm.description")}
          confirmLabel={t("adminRepairRequests.review.rejectConfirm.confirm")}
          cancelLabel={t("adminRepairRequests.dismiss")}
          onConfirm={() => {
            setConfirm(null);
            review("reject");
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === "send" && (
        <ConfirmDialog
          title={t("adminRepairRequests.send.confirm.title")}
          description={t("adminRepairRequests.send.confirm.description")}
          confirmLabel={t("adminRepairRequests.send.confirm.confirm")}
          cancelLabel={t("adminRepairRequests.dismiss")}
          tone="primary"
          onConfirm={() => {
            setConfirm(null);
            act("/send", { method: "POST", body: { canRepair: true, message } }, "sent");
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === "cannot" && (
        <ConfirmDialog
          title={t("adminRepairRequests.send.cannotConfirm.title")}
          description={t("adminRepairRequests.send.cannotConfirm.description")}
          confirmLabel={t("adminRepairRequests.send.cannotConfirm.confirm")}
          cancelLabel={t("adminRepairRequests.dismiss")}
          onConfirm={() => {
            setConfirm(null);
            act("/send", { method: "POST", body: { canRepair: false, message } }, "declined");
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === "cancel" && (
        <ConfirmDialog
          title={t("adminRepairRequests.stages.cancelConfirm.title")}
          description={t("adminRepairRequests.stages.cancelConfirm.description")}
          confirmLabel={t("adminRepairRequests.stages.cancelConfirm.confirm")}
          cancelLabel={t("adminRepairRequests.dismiss")}
          onConfirm={() => {
            setConfirm(null);
            stage("cancelled");
          }}
          onClose={() => setConfirm(null)}
        />
      )}

      {lightbox !== null && (
        <Lightbox
          images={images}
          index={lightbox}
          label={vehicle}
          onStep={(step) => setLightbox((current) => (current + step + images.length) % images.length)}
          onClose={() => setLightbox(null)}
        />
      )}
    </article>
  );
}
