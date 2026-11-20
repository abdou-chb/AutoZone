import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useI18n } from "../i18n/i18n-context";
import { apiRequest } from "../lib/api";
import { attributeLabel, optionLabel } from "../lib/attributes";
import { getCategory, isCategoryKey } from "../lib/categories";
import { useCategory } from "../lib/category-context";
import { useSite } from "../lib/site-context";
import { isZoneVisible } from "../lib/site-settings";
import { formatMillions, formatNumber, formatPrice, wilayaName } from "../lib/format";
import { jumpTo } from "../lib/scroll";
import Field from "../components/Field";
import CategoryPicker from "./sell/CategoryPicker";
import ListingPreview from "./sell/ListingPreview";
import PhotoUploader from "./sell/PhotoUploader";
import Segmented from "./sell/Segmented";
import { WILAYAS } from "./sell/wilayas";
import "./SellListing.css";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR + 1 - 1950 + 1 }, (_, index) => CURRENT_YEAR + 1 - index);
const DESCRIPTION_MAX = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BOOLEAN_OPTIONS = ["Yes", "No"];
const CONDITIONS = ["New", "Used"];

const EXAMPLES = {
  cars: { name: "Renault Clio 4", price: "2950000", mileage: "87000", seats: "5" },
  bicycles: { name: "Rockrider ST 540", price: "85000", gears: "9" },
  motorcycles: { name: "Yamaha TMAX 560", price: "1850000", engineCc: "560", mileage: "12000" },
  trucks: { name: "Toyota Hilux", price: "5400000", payload: "1000", gvw: "3200", power: "150", mileage: "240000" },
};

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  name: "",
  year: "",
  price: "",
  condition: "Used",
  location: "",
  description: "",
  issues: "",
};

function toWholeNumber(text) {
  const digits = text.replace(/\s/g, "");

  return /^\d+$/.test(digits) ? Number(digits) : null;
}

function isValidPhone(phone) {
  return /^\+?\d{9,15}$/.test(phone.replace(/[\s.()-]/g, ""));
}

function usesSegmented(attribute) {
  return attribute.type === "boolean" || (attribute.type === "select" && attribute.options.length <= 3);
}

function parseAttribute(attribute, raw) {
  if (attribute.type === "number") {
    return toWholeNumber(raw);
  }

  if (attribute.type === "boolean") {
    return raw ? raw === "Yes" : null;
  }

  return raw || null;
}

function attributeError(attribute, raw, zone, t, locale) {
  const label = attributeLabel(attribute, zone);
  const vars = { label, lower: label.toLocaleLowerCase(locale), zone };
  const unit = attribute.unit ? t(`sell.units.${attribute.unit}`) : "";

  if (!raw.trim()) {
    if (!attribute.required) return undefined;
    if (attribute.type === "boolean") return t("sell.errors.booleanRequired", vars);
    if (attribute.type === "select") return t("sell.errors.selectRequired", vars);
    if (attribute.key === "mileage") return t("sell.errors.mileageRequired", vars);

    return unit ? t("sell.errors.numberRequiredUnit", { ...vars, unit }) : t("sell.errors.numberRequired", vars);
  }

  if (attribute.type === "number") {
    const value = toWholeNumber(raw);

    if (value === null) return t("sell.errors.numbersOnly", { example: EXAMPLES[zone][attribute.key] });
    if (value < attribute.min || value > attribute.max) {
      const range = { ...vars, unit, min: formatNumber(attribute.min), max: formatNumber(attribute.max) };

      return t(unit ? "sell.errors.rangeUnit" : "sell.errors.range", range);
    }

    return undefined;
  }

  const options = attribute.type === "boolean" ? BOOLEAN_OPTIONS : attribute.options;

  return options.includes(raw) ? undefined : t("sell.errors.invalidOption", vars);
}

function validate(values, attributes, photos, category, t, locale, maxPhotos) {
  const errors = {};
  const zone = category.key;
  const examples = EXAMPLES[zone];

  if (!values.firstName.trim()) errors.firstName = t("sell.errors.firstName");
  if (!values.lastName.trim()) errors.lastName = t("sell.errors.lastName");

  if (!values.email.trim()) {
    errors.email = t("sell.errors.emailRequired");
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = t("sell.errors.emailInvalid");
  }

  if (!values.phone.trim()) {
    errors.phone = t("sell.errors.phoneRequired");
  } else if (!isValidPhone(values.phone)) {
    errors.phone = t("sell.errors.phoneInvalid");
  }

  if (!values.name.trim()) errors.name = t("sell.errors.name", { zone, example: examples.name });
  if (!values.year) errors.year = t("sell.errors.year", { zone });
  if (!values.location) errors.location = t("sell.errors.location", { zone });

  if (!values.price.trim()) {
    errors.price = t("sell.errors.priceRequired");
  } else if (!toWholeNumber(values.price)) {
    errors.price = t("sell.errors.priceInvalid", { example: examples.price });
  }

  if (!values.condition) errors.condition = t("sell.errors.condition");

  category.attributes.forEach((attribute) => {
    const error = attributeError(attribute, attributes[attribute.key] ?? "", zone, t, locale);

    if (error) errors[attribute.key] = error;
  });

  if (!values.description.trim()) errors.description = t("sell.errors.description", { zone });
  if (!photos.length) errors.photos = t("sell.errors.photos", { zone });
  else if (photos.length > maxPhotos) errors.photos = t("sell.errors.photosMax", { max: maxPhotos });

  return errors;
}

function fieldOrder(category) {
  return [
    "firstName",
    "lastName",
    "email",
    "phone",
    "name",
    "year",
    "location",
    "price",
    "condition",
    ...category.attributes.map((attribute) => attribute.key),
    "description",
    "photos",
  ];
}

function withOptional(label, t) {
  return (
    <>
      {label}
      <span className="field__optional"> {t("sell.optional")}</span>
    </>
  );
}

function FormSection({ number, title, intro, children }) {
  const { t } = useI18n();
  const headingId = `sell-step-${number}`;

  return (
    <section className="panel sell-section" aria-labelledby={headingId}>
      <div className="sell-section__head">
        <span className="sell-section__number display" aria-hidden="true">
          {number}
        </span>
        <div>
          <h2 id={headingId}>
            <span className="visually-hidden">{t("sell.step", { number })}</span>
            {title}
          </h2>
          {intro && <p>{intro}</p>}
        </div>
      </div>
      <div className="sell-section__body">{children}</div>
    </section>
  );
}

function NextSteps({ category, review, inspections }) {
  const { t } = useI18n();
  const zone = category.key;
  const steps = [
    review && { id: "review", title: t("sell.next.review.title"), text: t("sell.next.review.text") },
    {
      id: "live",
      title: t(review ? "sell.next.live.title" : "sell.next.liveNow.title", { brand: category.brand }),
      text: t("sell.next.live.text"),
    },
    inspections && {
      id: "inspection",
      title: t("sell.next.inspection.title"),
      text: t("sell.next.inspection.text", { zone }),
    },
  ].filter(Boolean);

  return (
    <section className="sell-next" aria-labelledby="sell-next-title">
      <h2 id="sell-next-title" className="sell-aside__title">
        {t("sell.next.title")}
      </h2>
      <ol className="sell-next__list">
        {steps.map((step, index) => (
          <li key={step.id}>
            <span className="sell-next__number display" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AttributeField({ attribute, zone, placeholder, value, error, onChange }) {
  const { t } = useI18n();
  const id = `sell-${attribute.key}`;
  const optional = !attribute.required;
  const label = attributeLabel(attribute, zone);
  const fieldLabel = (text) => (optional ? withOptional(text, t) : text);

  if (usesSegmented(attribute)) {
    return (
      <Segmented
        name={attribute.key}
        legend={label}
        options={attribute.type === "boolean" ? BOOLEAN_OPTIONS : attribute.options}
        labelFor={(option) =>
          attribute.type === "boolean" ? t(option === "Yes" ? "attributes.yes" : "attributes.no") : optionLabel(attribute, option)
        }
        value={value}
        onChange={onChange}
        error={error}
        optional={optional}
      />
    );
  }

  if (attribute.type === "select") {
    return (
      <Field id={id} label={fieldLabel(label)} error={error}>
        {(props) => (
          <select
            {...props}
            name={attribute.key}
            className="select"
            value={value}
            onChange={(event) => onChange(attribute.key, event.target.value)}
          >
            <option value="">{t("sell.fields.choose")}</option>
            {attribute.options.map((option) => (
              <option key={option} value={option}>
                {optionLabel(attribute, option)}
              </option>
            ))}
          </select>
        )}
      </Field>
    );
  }

  return (
    <Field
      id={id}
      label={fieldLabel(attribute.unit ? t("sell.fields.withUnit", { label, unit: t(`sell.units.${attribute.unit}`) }) : label)}
      error={error}
    >
      {(props) => (
        <input
          {...props}
          name={attribute.key}
          inputMode="numeric"
          className="input numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(attribute.key, event.target.value)}
        />
      )}
    </Field>
  );
}

export default function SellListing() {
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = useCategory();
  const settings = useSite();
  const { maxPhotos, requireApproval } = settings.listings;
  const queryKey = searchParams.get("category");
  const category = getCategory(
    isCategoryKey(queryKey) && isZoneVisible(settings, queryKey) ? queryKey : activeCategory.key
  );
  const zone = category.key;
  const examples = EXAMPLES[zone];
  const nameLabel = t("sell.fields.name", { zone });

  const [values, setValues] = useState(EMPTY_FORM);
  const [attributeState, setAttributeState] = useState({ category: category.key, values: {} });
  const [photos, setPhotos] = useState([]);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState("");
  const [listingId, setListingId] = useState(null);
  const [listingLive, setListingLive] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef(null);
  const photosRef = useRef(photos);
  const controllerRef = useRef(null);

  const attributes = attributeState.category === category.key ? attributeState.values : {};
  const parsedAttributes = Object.fromEntries(
    category.attributes
      .map((attribute) => [attribute.key, parseAttribute(attribute, attributes[attribute.key] ?? "")])
      .filter(([, value]) => value !== null)
  );

  const hasUnsavedInput =
    listingId === null &&
    (photos.length > 0 ||
      Object.values(attributes).some(Boolean) ||
      Object.keys(EMPTY_FORM).some((key) => values[key] !== EMPTY_FORM[key]));

  const errors = validate(values, attributes, photos, category, t, locale, maxPhotos);
  const errorCount = Object.keys(errors).length;
  const price = toWholeNumber(values.price);
  const errorFor = (name) => (submitted || touched[name] ? errors[name] : undefined);

  useEffect(() => {
    if (!hasUnsavedInput) return undefined;

    const warnBeforeLeaving = (event) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);

    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedInput]);

  const pageTitle = t("sell.documentTitle", { title: t("sell.title", { zone }), brand: category.brand });

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    },
    []
  );

  const setField = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const setAttribute = (name, value) => {
    setAttributeState((current) => ({
      category: category.key,
      values: { ...(current.category === category.key ? current.values : {}), [name]: value },
    }));
  };

  const chooseCategory = (key) => {
    const previousKeys = new Set(category.attributes.map((attribute) => attribute.key));

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("category", key);

        return next;
      },
      { replace: true }
    );
    setAttributeState({ category: key, values: {} });
    setTouched((current) => Object.fromEntries(Object.entries(current).filter(([name]) => !previousKeys.has(name))));
  };

  const handleChange = (event) => {
    setField(event.target.name, event.target.value);
  };

  const handleBlur = (event) => {
    const { name, value } = event.target;

    if (name && typeof value === "string" && value.trim()) {
      setTouched((current) => (current[name] ? current : { ...current, [name]: true }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    setServerError("");

    const firstInvalid = fieldOrder(category).find((name) => errors[name]);

    if (firstInvalid) {
      formRef.current?.querySelector(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const body = new FormData();

    body.append(
      "seller",
      JSON.stringify({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
      })
    );
    body.append(
      "car",
      JSON.stringify({
        category: category.key,
        name: values.name.trim(),
        year: Number(values.year),
        price,
        condition: values.condition,
        location: values.location,
        description: values.description.trim(),
        issues: values.issues
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .join("\n"),
        ...parsedAttributes,
      })
    );
    body.append("mainImage", photos[0].file);
    photos.slice(1).forEach((photo) => body.append("additionalImages", photo.file));

    const controller = new AbortController();
    controllerRef.current = controller;
    setSending(true);

    try {
      const data = await apiRequest("/api/cars", { method: "POST", body, signal: controller.signal });

      setListingLive(data.status === "approved");
      setListingId(data.id);
      jumpTo(0);
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

  const startOver = () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setValues(EMPTY_FORM);
    setAttributeState({ category: category.key, values: {} });
    setPhotos([]);
    setTouched({});
    setSubmitted(false);
    setServerError("");
    setListingId(null);
    setListingLive(false);
    setFormKey((key) => key + 1);
    jumpTo(0);
  };

  if (listingId !== null) {
    return (
      <div className="container page">
        <section className="panel sell-success" aria-labelledby="sell-success-title">
          <span className="sell-success__icon">
            <CircleCheck size={32} aria-hidden="true" />
          </span>
          <h1 id="sell-success-title" tabIndex={-1} ref={(node) => node?.focus()}>
            {t(listingLive ? "sell.success.liveTitle" : "sell.success.title")}
          </h1>
          <p className="sell-success__ref">
            {t("sell.success.reference")} <span className="display numeric ltr">#{listingId}</span>
          </p>
          <p>{t(listingLive ? "sell.success.liveText" : "sell.success.text", { zone, brand: category.brand })}</p>
          <div className="sell-success__actions">
            {listingLive ? (
              <Link to={`${category.base}/${listingId}`} className="btn btn--primary">
                {t("sell.success.see")}
              </Link>
            ) : (
              <Link to={category.home} className="btn btn--primary">
                {t("sell.success.back", { zone })}
              </Link>
            )}
            <button type="button" className="btn btn--outline" onClick={startOver}>
              {t("sell.success.another", { zone })}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container page">
      <header className="page-heading">
        <h1>{t("sell.title", { zone })}</h1>
        <p>{t(requireApproval ? "sell.intro" : "sell.introLive", { zone })}</p>
      </header>

      <div className="sell-layout">
        <form ref={formRef} className="sell-form" onSubmit={handleSubmit} onBlur={handleBlur} noValidate>
          <FormSection number={1} title={t("sell.steps.category.title")} intro={t("sell.steps.category.intro")}>
            <CategoryPicker labelledBy="sell-step-1" value={category.key} onChange={chooseCategory} />
          </FormSection>

          <FormSection number={2} title={t("sell.steps.contact.title")} intro={t("sell.steps.contact.intro")}>
            <div className="sell-grid">
              <Field id="sell-firstName" label={t("sell.fields.firstName")} error={errorFor("firstName")}>
                {(props) => (
                  <input
                    {...props}
                    name="firstName"
                    className="input"
                    autoComplete="given-name"
                    value={values.firstName}
                    onChange={handleChange}
                  />
                )}
              </Field>
              <Field id="sell-lastName" label={t("sell.fields.lastName")} error={errorFor("lastName")}>
                {(props) => (
                  <input
                    {...props}
                    name="lastName"
                    className="input"
                    autoComplete="family-name"
                    value={values.lastName}
                    onChange={handleChange}
                  />
                )}
              </Field>
              <Field id="sell-email" label={t("sell.fields.email")} error={errorFor("email")}>
                {(props) => (
                  <input
                    {...props}
                    name="email"
                    type="email"
                    dir="ltr"
                    className="input"
                    autoComplete="email"
                    spellCheck={false}
                    value={values.email}
                    onChange={handleChange}
                  />
                )}
              </Field>
              <Field id="sell-phone" label={t("sell.fields.phone")} error={errorFor("phone")}>
                {(props) => (
                  <input
                    {...props}
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    className="input"
                    autoComplete="tel"
                    placeholder={t("sell.fields.phonePlaceholder")}
                    value={values.phone}
                    onChange={handleChange}
                  />
                )}
              </Field>
            </div>
          </FormSection>

          <FormSection
            number={3}
            title={t("sell.steps.vehicle.title", { zone })}
            intro={t("sell.steps.vehicle.intro")}
          >
            <div className="sell-grid">
              <Field id="sell-name" label={nameLabel} className="sell-grid__wide" error={errorFor("name")}>
                {(props) => (
                  <input
                    {...props}
                    name="name"
                    className="input"
                    autoComplete="off"
                    dir="auto"
                    placeholder={examples.name}
                    value={values.name}
                    onChange={handleChange}
                  />
                )}
              </Field>
              <Field id="sell-year" label={t("sell.fields.year")} error={errorFor("year")}>
                {(props) => (
                  <select {...props} name="year" className="select" value={values.year} onChange={handleChange}>
                    <option value="">{t("sell.fields.chooseYear")}</option>
                    {YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field
                id="sell-location"
                label={t("sell.fields.wilaya")}
                error={errorFor("location")}
                hint={t("sell.fields.wilayaHint", { zone })}
              >
                {(props) => (
                  <select {...props} name="location" className="select" value={values.location} onChange={handleChange}>
                    <option value="">{t("sell.fields.chooseWilaya")}</option>
                    {WILAYAS.map((wilaya) => (
                      <option key={wilaya.code} value={wilaya.name}>
                        {wilaya.code} {wilayaName(wilaya.name)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field
                id="sell-price"
                label={t("sell.fields.price")}
                className="sell-grid__wide"
                error={errorFor("price")}
                hint={
                  price
                    ? formatMillions(price)
                      ? t("sell.fields.priceAmountMillions", { price: formatPrice(price), millions: formatMillions(price) })
                      : t("sell.fields.priceAmount", { price: formatPrice(price) })
                    : t("sell.fields.priceExample", { example: examples.price })
                }
              >
                {(props) => (
                  <input
                    {...props}
                    name="price"
                    inputMode="numeric"
                    className="input numeric"
                    autoComplete="off"
                    placeholder={examples.price}
                    value={values.price}
                    onChange={handleChange}
                  />
                )}
              </Field>
              <Segmented
                name="condition"
                legend={t("sell.fields.condition")}
                options={CONDITIONS}
                labelFor={(condition) => t(`common.condition.${condition}`)}
                value={values.condition}
                onChange={setField}
                error={errorFor("condition")}
              />
              {category.attributes.map((attribute) => (
                <AttributeField
                  key={`${category.key}-${attribute.key}`}
                  attribute={attribute}
                  zone={zone}
                  placeholder={examples[attribute.key]}
                  value={attributes[attribute.key] ?? ""}
                  error={errorFor(attribute.key)}
                  onChange={setAttribute}
                />
              ))}
              <Field
                id="sell-description"
                label={t("sell.fields.description")}
                className="sell-grid__wide"
                error={errorFor("description")}
                hint={t("sell.fields.descriptionHint", {
                  count: formatNumber(values.description.length),
                  max: formatNumber(DESCRIPTION_MAX),
                })}
              >
                {(props) => (
                  <textarea
                    {...props}
                    name="description"
                    className="textarea"
                    rows={5}
                    maxLength={DESCRIPTION_MAX}
                    value={values.description}
                    onChange={handleChange}
                  />
                )}
              </Field>
              <Field
                id="sell-issues"
                label={withOptional(t("sell.fields.issues"), t)}
                className="sell-grid__wide"
                hint={t("sell.fields.issuesHint")}
              >
                {(props) => (
                  <textarea
                    {...props}
                    name="issues"
                    className="textarea"
                    rows={3}
                    placeholder={t("sell.fields.issuesPlaceholder", { zone })}
                    value={values.issues}
                    onChange={handleChange}
                  />
                )}
              </Field>
            </div>
          </FormSection>

          <FormSection number={4} title={t("sell.steps.photos.title")} intro={t("sell.steps.photos.intro", { zone })}>
            <PhotoUploader
              key={formKey}
              id="sell-photos"
              photos={photos}
              onChange={setPhotos}
              error={errorFor("photos")}
              max={maxPhotos}
            />
          </FormSection>

          <div className="sell-submit">
            {serverError && (
              <div className="notice notice--stop" role="alert">
                <CircleAlert size={18} aria-hidden="true" />
                <p>{serverError}</p>
              </div>
            )}
            {submitted && errorCount > 0 && !serverError && (
              <p className="field__error sell-submit__summary" role="alert">
                {t("sell.errors.summary", { count: errorCount })}
              </p>
            )}
            <button type="submit" className="btn btn--primary btn--large" disabled={sending}>
              {sending && <span className="spinner" aria-hidden="true" />}
              {sending ? t("sell.submit.sending") : t("sell.submit.idle")}
            </button>
            <p className="field__hint">{t(requireApproval ? "sell.submit.note" : "sell.submit.noteLive")}</p>
          </div>
        </form>

        <aside className="sell-aside">
          <div className="sell-aside__preview">
            <ListingPreview
              category={category}
              nameLabel={nameLabel}
              listing={{
                category: category.key,
                name: values.name,
                year: values.year,
                price,
                location: values.location,
                condition: values.condition,
                attributes: parsedAttributes,
                image: photos[0]?.url,
              }}
            />
          </div>
          <NextSteps category={category} review={requireApproval} inspections={settings.inspections.enabled} />
        </aside>
      </div>
    </div>
  );
}
