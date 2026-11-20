import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronRight, CircleAlert, CircleCheck, CirclePause, Copy, MapPin, RotateCw } from "lucide-react";
import EmptyState from "../components/EmptyState";
import { apiRequest, fetchListing } from "../lib/api";
import { getCategory, listingPath } from "../lib/categories";
import { formatMillions, formatNumber, formatPrice, todayISO, wilayaName } from "../lib/format";
import { useI18n } from "../i18n/i18n-context";
import { useToast } from "../lib/toast-context";
import { useSite } from "../lib/site-context";
import { isZoneVisible } from "../lib/site-settings";
import Field from "../components/Field";
import NotFound from "./NotFound";
import "./RequestInspection.css";

const MESSAGE_MAX = 1000;
const FIELD_ORDER = ["fullName", "phone", "preferredDate", "message"];
const EMPTY_FORM = { fullName: "", phone: "", preferredDate: "", message: "" };

function isValidPhone(phone) {
  return /^\+?\d{9,15}$/.test(phone.replace(/[\s.()-]/g, ""));
}

function validate(values, t, zone) {
  const errors = {};

  if (!values.fullName.trim()) errors.fullName = t("inspection.errors.fullName");

  if (!values.phone.trim()) {
    errors.phone = t("inspection.errors.phone");
  } else if (!isValidPhone(values.phone)) {
    errors.phone = t("inspection.errors.phoneFormat");
  }

  if (!values.preferredDate) {
    errors.preferredDate = t("inspection.errors.date", { zone });
  } else if (values.preferredDate < todayISO()) {
    errors.preferredDate = t("inspection.errors.datePast");
  }

  if (values.message.length > MESSAGE_MAX) {
    errors.message = t("inspection.errors.messageLength", { max: formatNumber(MESSAGE_MAX) });
  }

  return errors;
}

function Breadcrumb({ listing, category }) {
  const { t } = useI18n();

  return (
    <nav aria-label={t("inspection.breadcrumb")}>
      <ol className="breadcrumb inspect-crumbs">
        <li>
          <Link to={category.home}>{t(`zones.${category.key}.forSale`)}</Link>
        </li>
        <li>
          <ChevronRight size={14} className="flip-rtl" aria-hidden="true" />
          <Link to={listingPath(listing)}>{listing.name}</Link>
        </li>
        <li>
          <ChevronRight size={14} className="flip-rtl" aria-hidden="true" />
          <span aria-current="page">{t("inspection.crumb")}</span>
        </li>
      </ol>
    </nav>
  );
}

function ListingSummary({ listing, category }) {
  const { t } = useI18n();

  return (
    <section className="panel inspect-car" aria-label={t("inspection.summary", { zone: category.key })}>
      <div className="inspect-car__media">
        {listing.image ? (
          <img src={listing.image} alt="" />
        ) : (
          <span className="inspect-car__no-photo">{t("common.card.noPhoto")}</span>
        )}
      </div>
      <div className="inspect-car__body">
        <p className="inspect-car__title">
          {listing.name} <span className="inspect-car__year">{listing.year}</span>
        </p>
        <p className="inspect-car__location">
          <MapPin size={14} aria-hidden="true" />
          {wilayaName(listing.location)}
        </p>
        <p className="inspect-car__price">
          <span className="display numeric">{formatPrice(listing.price)}</span>
          <span className="inspect-car__millions">{formatMillions(listing.price)}</span>
        </p>
      </div>
    </section>
  );
}

function HowItWorks({ category }) {
  const { t } = useI18n();
  const zone = category.key;

  return (
    <section className="inspect-how" aria-labelledby="inspect-how-title">
      <h2 id="inspect-how-title">{t("inspection.how.title")}</h2>
      <ol className="inspect-how__list">
        <li>
          <span className="inspect-how__number display" aria-hidden="true">1</span>
          <div>
            <strong>{t("inspection.how.call.title")}</strong>
            <p>{t("inspection.how.call.text")}</p>
          </div>
        </li>
        <li>
          <span className="inspect-how__number display" aria-hidden="true">2</span>
          <div>
            <strong>{t("inspection.how.see.title", { zone })}</strong>
            <p>
              {t("inspection.how.see.place")} {t(`zones.${zone}.inspection`)} {t("inspection.how.see.answers")}
            </p>
          </div>
        </li>
        <li>
          <span className="inspect-how__number display" aria-hidden="true">3</span>
          <div>
            <strong>{t("inspection.how.decide.title")}</strong>
            <p>{t("inspection.how.decide.text")}</p>
          </div>
        </li>
      </ol>
    </section>
  );
}

function LoadingState({ category }) {
  const { t } = useI18n();

  return (
    <div className="container page" aria-busy="true">
      <p className="visually-hidden" role="status">
        {t("inspection.loading", { zone: category.key })}
      </p>
      <div className="skeleton inspect-skeleton-line" />
      <div className="skeleton inspect-skeleton-title" />
      <div className="inspect-layout">
        <div className="inspect-layout__summary skeleton inspect-skeleton" />
        <div className="inspect-layout__form skeleton inspect-skeleton inspect-skeleton--tall" />
      </div>
    </div>
  );
}

function PausedPanel({ listing, category, contact }) {
  const { t } = useI18n();
  const zone = category.key;

  return (
    <section className="panel inspect-success inspect-paused" aria-labelledby="inspect-paused-title">
      <span className="inspect-success__icon inspect-paused__icon">
        <CirclePause size={28} aria-hidden="true" />
      </span>
      <h2 id="inspect-paused-title">{t("inspection.paused.title")}</h2>
      <p>{t("inspection.paused.text", { zone })}</p>
      <div className="inspect-success__actions">
        <Link to={listingPath(listing)} className="btn btn--primary">
          {t("inspection.success.back", { zone })}
        </Link>
        {contact && (
          <Link to={`/contact?listing=${listing.id}`} className="btn btn--outline">
            {t("inspection.paused.contact")}
          </Link>
        )}
      </div>
    </section>
  );
}

export default function RequestInspection({ categoryKey }) {
  const settings = useSite();

  if (!isZoneVisible(settings, categoryKey)) {
    return <NotFound />;
  }

  return (
    <InspectionRequest
      categoryKey={categoryKey}
      paused={!settings.inspections.enabled}
      contact={settings.contact.enabled}
    />
  );
}

function InspectionRequest({ categoryKey, paused, contact }) {
  const { id } = useParams();
  const category = getCategory(categoryKey);
  const zone = category.key;
  const { t } = useI18n();
  const showToast = useToast();
  const validId = /^[1-9]\d*$/.test(id || "");
  const [attempt, setAttempt] = useState(0);
  const loadKey = `${categoryKey}:${id}:${attempt}`;
  const [load, setLoad] = useState({ key: null, listing: null, notFound: false, error: "" });
  const [values, setValues] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState("");
  const [requestId, setRequestId] = useState(null);
  const formRef = useRef(null);
  const controllerRef = useRef(null);

  const errors = validate(values, t, zone);
  const errorFor = (name) => (submitted || touched[name] ? errors[name] : undefined);

  const pageTitle = t("inspection.pageTitle", { brand: category.brand });

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  useEffect(() => {
    if (!validId) {
      return undefined;
    }

    const controller = new AbortController();

    fetchListing(id, controller.signal)
      .then((listing) => setLoad({ key: loadKey, listing, notFound: false, error: "" }))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setLoad({
            key: loadKey,
            listing: null,
            notFound: error.status === 404 || error.status === 400,
            error: error.message,
          });
        }
      });

    return () => controller.abort();
  }, [id, validId, loadKey]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleBlur = (event) => {
    const { name, value } = event.target;

    if (name && value.trim()) {
      setTouched((current) => (current[name] ? current : { ...current, [name]: true }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setServerError("");

    const firstInvalid = FIELD_ORDER.find((name) => errors[name]);

    if (firstInvalid) {
      formRef.current?.querySelector(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setSending(true);

    try {
      const data = await apiRequest("/api/inspection-requests", {
        method: "POST",
        body: {
          carId: Number(id),
          fullName: values.fullName.trim(),
          phone: values.phone.trim(),
          preferredDate: values.preferredDate,
          message: values.message.trim(),
        },
        signal: controller.signal,
      });

      setRequestId(data.requestId);
    } catch (error) {
      if (error.name !== "AbortError") {
        setServerError(error.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setSending(false);
      }
    }
  };

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(String(requestId));
      showToast(t("inspection.success.copied"));
    } catch {
      showToast(t("inspection.success.copyFailed"), { tone: "error" });
    }
  };

  if (validId && load.key !== loadKey) {
    return <LoadingState category={category} />;
  }

  if (!validId || load.notFound) {
    return (
      <div className="container page">
        <EmptyState
          icon={category.icon}
          title={t("details.missing.title", { zone })}
          action={
            <Link to={category.home} className="btn btn--primary">
              {t(`zones.${zone}.browse`)}
            </Link>
          }
        >
          {t("details.missing.text", { zone })}
        </EmptyState>
      </div>
    );
  }

  if (load.error) {
    return (
      <div className="container page">
        <div className="notice notice--stop inspect-load-error" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <h1 className="details-error__title">{t("details.loadError", { zone })}</h1>
            <p>{load.error}</p>
            <button
              type="button"
              className="btn btn--outline inspect-load-error__retry"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <RotateCw size={16} aria-hidden="true" />
              {t("common.actions.tryAgain")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { listing } = load;

  if (listing.category !== category.key) {
    return <Navigate replace to={`${listingPath(listing)}/inspection`} />;
  }

  return (
    <div className="container page">
      <Breadcrumb listing={listing} category={category} />

      <header className="page-heading">
        <h1>{t("inspection.title")}</h1>
        <p>{t("inspection.lead", { zone })}</p>
      </header>

      <div className="inspect-layout">
        <div className="inspect-layout__summary">
          <ListingSummary listing={listing} category={category} />
        </div>

        <div className="inspect-layout__form">
          {requestId !== null ? (
            <section className="panel inspect-success" aria-labelledby="inspect-success-title">
              <span className="inspect-success__icon">
                <CircleCheck size={28} aria-hidden="true" />
              </span>
              <h2 id="inspect-success-title" tabIndex={-1} ref={(node) => node?.focus()}>
                {t("inspection.success.title")}
              </h2>
              <div className="inspect-success__number">
                <p>
                  <span className="inspect-success__label">{t("inspection.success.numberLabel")}</span>
                  <span className="display numeric ltr">#{requestId}</span>
                </p>
                <button type="button" className="btn btn--outline" onClick={copyNumber}>
                  <Copy size={16} aria-hidden="true" />
                  {t("inspection.success.copy")}
                </button>
              </div>
              <p>{t("inspection.success.keep")}</p>
              <p className="inspect-success__muted">{t("inspection.success.call", { zone })}</p>
              <div className="inspect-success__actions">
                <Link to={`/track?id=${requestId}`} className="btn btn--primary">
                  {t("inspection.success.track")}
                </Link>
                <Link to={listingPath(listing)} className="btn btn--outline">
                  {t("inspection.success.back", { zone })}
                </Link>
              </div>
            </section>
          ) : paused ? (
            <PausedPanel listing={listing} category={category} contact={contact} />
          ) : (
            <section className="panel inspect-form-panel" aria-labelledby="inspect-form-title">
              <h2 id="inspect-form-title">{t("inspection.form.title")}</h2>
              <form ref={formRef} className="inspect-form" onSubmit={handleSubmit} onBlur={handleBlur} noValidate>
                <Field id="inspect-fullName" label={t("inspection.form.fullName")} error={errorFor("fullName")}>
                  {(props) => (
                    <input
                      {...props}
                      name="fullName"
                      className="input"
                      autoComplete="name"
                      value={values.fullName}
                      onChange={handleChange}
                    />
                  )}
                </Field>
                <div className="inspect-form__row">
                  <Field
                    id="inspect-phone"
                    label={t("inspection.form.phone")}
                    error={errorFor("phone")}
                    hint={t("inspection.form.phoneHint")}
                  >
                    {(props) => (
                      <input
                        {...props}
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        className="input"
                        dir="ltr"
                        autoComplete="tel"
                        placeholder={t("inspection.form.phonePlaceholder")}
                        value={values.phone}
                        onChange={handleChange}
                      />
                    )}
                  </Field>
                  <Field
                    id="inspect-preferredDate"
                    label={t("inspection.form.date")}
                    error={errorFor("preferredDate")}
                    hint={t("inspection.form.dateHint")}
                  >
                    {(props) => (
                      <input
                        {...props}
                        name="preferredDate"
                        type="date"
                        className="input"
                        min={todayISO()}
                        value={values.preferredDate}
                        onChange={handleChange}
                      />
                    )}
                  </Field>
                </div>
                <Field
                  id="inspect-message"
                  label={t("inspection.form.message")}
                  optional
                  error={errorFor("message")}
                  hint={t("inspection.form.messageHint", {
                    count: formatNumber(values.message.length),
                    max: formatNumber(MESSAGE_MAX),
                  })}
                >
                  {(props) => (
                    <textarea
                      {...props}
                      name="message"
                      className="textarea"
                      rows={4}
                      maxLength={MESSAGE_MAX}
                      value={values.message}
                      onChange={handleChange}
                    />
                  )}
                </Field>

                {serverError && (
                  <div className="notice notice--stop" role="alert">
                    <CircleAlert size={18} aria-hidden="true" />
                    <p>{serverError}</p>
                  </div>
                )}

                <button type="submit" className="btn btn--primary btn--large btn--block" disabled={sending}>
                  {sending && <span className="spinner" aria-hidden="true" />}
                  {sending ? t("inspection.form.sending") : t("inspection.form.submit")}
                </button>
              </form>
            </section>
          )}
        </div>

        {!paused && (
          <div className="inspect-layout__how">
            <HowItWorks category={category} />
          </div>
        )}
      </div>
    </div>
  );
}
