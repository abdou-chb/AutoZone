import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CircleAlert,
  CircleCheck,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareOff,
  Phone,
  X,
} from "lucide-react";
import Field from "../components/Field";
import { useI18n } from "../i18n/i18n-context";
import { apiRequest, fetchListing } from "../lib/api";
import { getCategory, listingPath } from "../lib/categories";
import { useCategory } from "../lib/category-context";
import { formatNumber } from "../lib/format";
import { useSite, useVisibleCategories } from "../lib/site-context";
import { localized, SOCIAL_NETWORKS, telHref, whatsappHref } from "../lib/site-settings";
import "./Contact.css";

const SUBJECTS = ["general", "buying", "selling", "inspection", "partnership", "other"];
const FIELD_ORDER = ["name", "email", "phone", "subject", "message"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 80;
const EMAIL_MAX = 120;
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;
const REACH_ERROR_ID = "contact-reach-error";

function cleanPhone(phone) {
  return phone.trim().replace(/[\s.-]/g, "");
}

function validate(values, t) {
  const errors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const phone = cleanPhone(values.phone);
  const message = values.message.trim();

  if (name.length < 2) {
    errors.name = t("contact.errors.name");
  } else if (name.length > NAME_MAX) {
    errors.name = t("contact.errors.nameLong", { max: NAME_MAX });
  }

  if (!email && !phone) {
    errors.reach = t("contact.errors.reach");
  }

  if (email && (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX)) {
    errors.email = t("contact.errors.email");
  }

  if (phone && !/^\+?\d{9,15}$/.test(phone)) {
    errors.phone = t("contact.errors.phone");
  }

  if (!SUBJECTS.includes(values.subject)) {
    errors.subject = t("contact.errors.subject");
  }

  if (message.length < MESSAGE_MIN) {
    errors.message = t("contact.errors.messageShort", { min: MESSAGE_MIN });
  } else if (message.length > MESSAGE_MAX) {
    errors.message = t("contact.errors.messageLong", { max: formatNumber(MESSAGE_MAX) });
  }

  return errors;
}

function withReachError(props, hasError) {
  if (!hasError) {
    return props;
  }

  return {
    ...props,
    "aria-invalid": true,
    "aria-describedby": [props["aria-describedby"], REACH_ERROR_ID].filter(Boolean).join(" "),
  };
}

function ContactDetails() {
  const { t, language } = useI18n();
  const { site } = useSite();
  const phoneLink = telHref(site.phone);
  const whatsappLink = whatsappHref(site.whatsapp);
  const address = localized(site.address, language);
  const hours = localized(site.hours, language) || t("nav.footer.hours");
  const social = SOCIAL_NETWORKS.filter((network) => site.social?.[network.key]);

  return (
    <section className="panel contact-details" aria-labelledby="contact-details-title">
      <h2 id="contact-details-title" className="contact-details__title">
        {t("contact.details.title")}
      </h2>
      <ul className="contact-details__list">
        {phoneLink && (
          <li>
            <span className="contact-details__icon">
              <Phone size={18} aria-hidden="true" />
            </span>
            <span className="contact-details__body">
              <span className="contact-details__label">{t("contact.details.phone")}</span>
              <a href={phoneLink} className="contact-details__value ltr">
                {site.phone}
              </a>
            </span>
          </li>
        )}
        {whatsappLink && (
          <li>
            <span className="contact-details__icon">
              <MessageCircle size={18} aria-hidden="true" />
            </span>
            <span className="contact-details__body">
              <span className="contact-details__label">{t("contact.details.whatsapp")}</span>
              <a
                href={whatsappLink}
                className="contact-details__value"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("contact.details.whatsappLink")}
              </a>
            </span>
          </li>
        )}
        {site.email && (
          <li>
            <span className="contact-details__icon">
              <Mail size={18} aria-hidden="true" />
            </span>
            <span className="contact-details__body">
              <span className="contact-details__label">{t("contact.details.email")}</span>
              <a href={`mailto:${site.email}`} className="contact-details__value ltr">
                {site.email}
              </a>
            </span>
          </li>
        )}
        {address && (
          <li>
            <span className="contact-details__icon">
              <MapPin size={18} aria-hidden="true" />
            </span>
            <span className="contact-details__body">
              <span className="contact-details__label">{t("contact.details.address")}</span>
              <span className="contact-details__text">{address}</span>
            </span>
          </li>
        )}
        <li>
          <span className="contact-details__icon">
            <Clock size={18} aria-hidden="true" />
          </span>
          <span className="contact-details__body">
            <span className="contact-details__label">{t("contact.details.hours")}</span>
            <span className="contact-details__text">{hours}</span>
          </span>
        </li>
      </ul>

      {social.length > 0 && (
        <div className="contact-social">
          <h3 className="contact-social__title">{t("contact.details.social")}</h3>
          <ul className="contact-social__list">
            {social.map((network) => (
              <li key={network.key}>
                <a
                  href={site.social[network.key]}
                  className="contact-social__link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {network.label}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ListingNote({ listing, onRemove }) {
  const { t } = useI18n();

  return (
    <div className="contact-listing">
      {listing.image ? (
        <img className="contact-listing__photo" src={listing.image} alt="" />
      ) : (
        <span className="contact-listing__photo" aria-hidden="true" />
      )}
      <p className="contact-listing__text">
        <span className="contact-listing__label">{t("contact.listing.about")}</span>
        <Link to={listingPath(listing)} className="contact-listing__name" dir="auto">
          {listing.name} <span className="numeric">{listing.year}</span>
        </Link>
      </p>
      <button
        type="button"
        className="contact-listing__remove"
        onClick={onRemove}
        aria-label={t("contact.listing.remove", { name: listing.name })}
        title={t("contact.listing.remove", { name: listing.name })}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function Contact() {
  const { t, language } = useI18n();
  const category = useCategory();
  const zones = useVisibleCategories();
  const settings = useSite();
  const [searchParams, setSearchParams] = useSearchParams();
  const listingParam = searchParams.get("listing") || "";
  const listingId = /^[1-9]\d{0,9}$/.test(listingParam) ? listingParam : "";
  const [values, setValues] = useState(() => ({
    name: "",
    email: "",
    phone: "",
    subject: listingId ? "buying" : "",
    category: "",
    message: "",
    website: "",
  }));
  const [listingState, setListingState] = useState({ id: "", listing: null });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState("");
  const [sent, setSent] = useState(false);
  const formRef = useRef(null);
  const controllerRef = useRef(null);

  const listing = listingId && listingState.id === listingId ? listingState.listing : null;
  const errors = validate(values, t);
  const errorFor = (name) => (submitted || touched[name] ? errors[name] : undefined);
  const reachError = submitted ? errors.reach : undefined;
  const messageLength = values.message.trim().length;
  const pageTitle = t("contact.documentTitle", { brand: category.brand });

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  useEffect(() => {
    if (!listingId) {
      return undefined;
    }

    const controller = new AbortController();

    fetchListing(listingId, controller.signal).then(
      (result) => {
        setListingState({ id: listingId, listing: result });
        setValues((current) => (current.category ? current : { ...current, category: result.category }));
      },
      (error) => {
        if (error.name !== "AbortError") {
          setListingState({ id: listingId, listing: null });
        }
      }
    );

    return () => controller.abort();
  }, [listingId]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleBlur = (event) => {
    const { name, value } = event.target;

    if (name && name !== "website" && typeof value === "string" && value.trim()) {
      setTouched((current) => (current[name] ? current : { ...current, [name]: true }));
    }
  };

  const removeListing = () => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("listing");

        return next;
      },
      { replace: true, preventScrollReset: true }
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setServerError("");

    const firstInvalid = FIELD_ORDER.find((name) => errors[name] || (name === "email" && errors.reach));

    if (firstInvalid) {
      formRef.current?.querySelector(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setSending(true);

    try {
      await apiRequest("/api/messages", {
        method: "POST",
        body: {
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          subject: values.subject,
          category: values.category,
          listingId: listing ? listing.id : undefined,
          message: values.message.trim(),
          language,
          website: values.website,
        },
        signal: controller.signal,
      });

      setSent(true);
    } catch (error) {
      if (error.name !== "AbortError") {
        const known = { 429: "contact.errors.tooMany", 403: "contact.closed.text" }[error.status];

        setServerError(known ? t(known) : error.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setSending(false);
      }
    }
  };

  const startOver = () => {
    setValues({ name: "", email: "", phone: "", subject: "", category: "", message: "", website: "" });
    setTouched({});
    setSubmitted(false);
    setServerError("");
    setSent(false);
    removeListing();
  };

  function renderForm() {
    if (!settings.contact.enabled) {
      return (
        <section className="panel contact-closed" aria-labelledby="contact-closed-title">
          <span className="contact-closed__icon">
            <MessageSquareOff size={26} aria-hidden="true" />
          </span>
          <h2 id="contact-closed-title">{t("contact.closed.title")}</h2>
          <p>{t("contact.closed.text")}</p>
        </section>
      );
    }

    if (sent) {
      return (
        <section className="panel contact-success" aria-labelledby="contact-success-title">
          <span className="contact-success__icon">
            <CircleCheck size={28} aria-hidden="true" />
          </span>
          <h2 id="contact-success-title" tabIndex={-1} ref={(node) => node?.focus()}>
            {t("contact.success.title")}
          </h2>
          <p>{t("contact.success.text")}</p>
          <div className="contact-success__actions">
            <Link to={category.home} className="btn btn--primary">
              {t("contact.success.back", { zone: category.key })}
            </Link>
            <button type="button" className="btn btn--outline" onClick={startOver}>
              {t("contact.success.another")}
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="panel contact-form-panel" aria-labelledby="contact-form-title">
        <h2 id="contact-form-title" className="contact-form-panel__title">
          {t("contact.form.title")}
        </h2>
        <form ref={formRef} className="contact-form" onSubmit={handleSubmit} onBlur={handleBlur} noValidate>
          {listing && <ListingNote listing={listing} onRemove={removeListing} />}

          <Field id="contact-name" label={t("contact.form.name")} error={errorFor("name")}>
            {(props) => (
              <input
                {...props}
                name="name"
                className="input"
                autoComplete="name"
                maxLength={NAME_MAX}
                value={values.name}
                onChange={handleChange}
              />
            )}
          </Field>

          <fieldset className="contact-form__reach" aria-describedby="contact-reach-hint">
            <legend className="field__label">{t("contact.form.reach")}</legend>
            <p id="contact-reach-hint" className="field__hint">
              {t("contact.form.reachHint")}
            </p>
            <div className="contact-form__row">
              <Field id="contact-email" label={t("contact.form.email")} error={errorFor("email")}>
                {(props) => (
                  <input
                    {...withReachError(props, Boolean(reachError))}
                    name="email"
                    type="email"
                    inputMode="email"
                    dir="ltr"
                    className="input"
                    autoComplete="email"
                    maxLength={EMAIL_MAX}
                    value={values.email}
                    onChange={handleChange}
                  />
                )}
              </Field>
              <Field id="contact-phone" label={t("contact.form.phone")} error={errorFor("phone")}>
                {(props) => (
                  <input
                    {...withReachError(props, Boolean(reachError))}
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    className="input"
                    autoComplete="tel"
                    placeholder={t("contact.form.phonePlaceholder")}
                    maxLength={20}
                    value={values.phone}
                    onChange={handleChange}
                  />
                )}
              </Field>
            </div>
            {reachError && (
              <p id={REACH_ERROR_ID} className="field__error">
                {reachError}
              </p>
            )}
          </fieldset>

          <div className="contact-form__row">
            <Field id="contact-subject" label={t("contact.form.subject")} error={errorFor("subject")}>
              {(props) => (
                <select {...props} name="subject" className="select" value={values.subject} onChange={handleChange}>
                  <option value="" disabled>
                    {t("contact.form.chooseSubject")}
                  </option>
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {t(`contact.subjects.${subject}`)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field id="contact-category" label={t("contact.form.zone")} optional>
              {(props) => (
                <select {...props} name="category" className="select" value={values.category} onChange={handleChange}>
                  <option value="">{t("contact.form.anyZone")}</option>
                  {zones.map((zone) => (
                    <option key={zone.key} value={zone.key}>
                      {zone.brand}
                    </option>
                  ))}
                  {values.category && !zones.some((zone) => zone.key === values.category) && (
                    <option value={values.category}>{getCategory(values.category).brand}</option>
                  )}
                </select>
              )}
            </Field>
          </div>

          <Field
            id="contact-message"
            label={t("contact.form.message")}
            error={errorFor("message")}
            hint={t("contact.form.messageHint", {
              min: MESSAGE_MIN,
              count: formatNumber(messageLength),
              max: formatNumber(MESSAGE_MAX),
            })}
          >
            {(props) => (
              <textarea
                {...props}
                name="message"
                className="textarea"
                rows={6}
                maxLength={MESSAGE_MAX}
                value={values.message}
                onChange={handleChange}
              />
            )}
          </Field>

          <div className="visually-hidden" aria-hidden="true">
            <label htmlFor="contact-website">{t("contact.form.website")}</label>
            <input
              id="contact-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={handleChange}
            />
          </div>

          {serverError && (
            <div className="notice notice--stop" role="alert">
              <CircleAlert size={18} aria-hidden="true" />
              <p>{serverError}</p>
            </div>
          )}

          <div className="contact-form__submit">
            <button type="submit" className="btn btn--primary btn--large" disabled={sending}>
              {sending && <span className="spinner" aria-hidden="true" />}
              {sending ? t("contact.form.sending") : t("contact.form.submit")}
            </button>
            <p className="field__hint">{t("contact.form.privacy")}</p>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="container page">
      <header className="page-heading">
        <h1>{t("contact.title")}</h1>
        <p>{t("contact.lead")}</p>
      </header>

      <div className="contact-layout">
        <div className="contact-layout__main">{renderForm()}</div>
        <aside className="contact-layout__aside">
          <ContactDetails />
        </aside>
      </div>
    </div>
  );
}
