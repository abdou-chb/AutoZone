import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CircleAlert, ExternalLink, ImagePlus, Save, Star, Trash2, Undo2 } from "lucide-react";
import Field from "../../../components/Field";
import StatusBadge from "../../../components/StatusBadge";
import { useI18n } from "../../../i18n/i18n-context";
import { imageUrl } from "../../../lib/api";
import { attributeLabel, optionLabel } from "../../../lib/attributes";
import { CATEGORIES, getCategory, listingPath } from "../../../lib/categories";
import { formatDate, formatMillions, formatNumber, formatPrice, wilayaName } from "../../../lib/format";
import { useToast } from "../../../lib/toast-context";
import { WILAYAS } from "../../sell/wilayas";
import { isolate, requestNumber } from "../admin-config";
import { useAdmin } from "../admin-context";
import ConfirmDialog from "../ConfirmDialog";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import ZoneTag from "../ZoneTag";
import { isQuietError, LISTING_STATUSES, listHref } from "./listing-helpers";
import "./listings.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONDITIONS = ["Used", "New"];
const LAST_YEAR = new Date().getFullYear() + 1;
const YEARS = Array.from({ length: LAST_YEAR - 1949 }, (_, index) => LAST_YEAR - index);
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function attributeValue(car, attribute) {
  const value = attribute.column ? car[attribute.column] : car.specs?.[attribute.key];

  if (value === undefined || value === null) {
    return "";
  }

  if (attribute.type === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function toForm(car) {
  const category = getCategory(car.category);

  return {
    status: car.status,
    featured: Boolean(car.featured),
    category: category.key,
    name: car.name || "",
    year: String(car.year || ""),
    price: car.price ? String(car.price) : "",
    condition: car.condition || "Used",
    location: car.location || "",
    description: car.description || "",
    issues: car.issues || "",
    attributes: Object.fromEntries(category.attributes.map((attribute) => [attribute.key, attributeValue(car, attribute)])),
    seller: {
      firstName: car.seller_first_name || "",
      lastName: car.seller_last_name || "",
      email: car.seller_email || "",
      phone: car.seller_phone || "",
    },
  };
}

function digits(value) {
  const clean = String(value).replace(/[\s.,]/g, "");

  return /^\d+$/.test(clean) ? Number(clean) : null;
}

function toPayload(form) {
  const category = getCategory(form.category);
  const attributes = {};

  category.attributes.forEach((attribute) => {
    const raw = form.attributes[attribute.key] ?? "";

    if (raw === "") return;
    if (attribute.type === "number") attributes[attribute.key] = digits(raw);
    else if (attribute.type === "boolean") attributes[attribute.key] = raw === "true";
    else attributes[attribute.key] = raw;
  });

  return {
    status: form.status,
    featured: form.status === "approved" && form.featured,
    category: form.category,
    name: form.name.trim(),
    year: Number(form.year),
    price: digits(form.price),
    condition: form.condition,
    location: form.location,
    description: form.description,
    issues: form.issues,
    attributes,
    seller: {
      firstName: form.seller.firstName.trim(),
      lastName: form.seller.lastName.trim(),
      email: form.seller.email.trim(),
      phone: form.seller.phone.trim(),
    },
  };
}

function validate(form, t) {
  const errors = {};
  const category = getCategory(form.category);
  const name = form.name.trim();
  const price = digits(form.price);

  if (name.length < 2 || name.length > 120) errors.name = t("adminListings.editor.errors.name");
  if (!form.year) errors.year = t("adminListings.editor.errors.year");
  if (!price) errors.price = t("adminListings.editor.errors.price");
  if (!form.location) errors.location = t("adminListings.editor.errors.location");

  category.attributes.forEach((attribute) => {
    const raw = form.attributes[attribute.key] ?? "";
    const label = attributeLabel(attribute, category.key);

    if (raw === "") {
      if (attribute.required) errors[`attr-${attribute.key}`] = t("adminListings.editor.errors.required", { label });
      return;
    }

    if (attribute.type === "number") {
      const value = digits(raw);

      if (value === null || value < attribute.min || value > attribute.max) {
        errors[`attr-${attribute.key}`] = t("adminListings.editor.errors.range", {
          label,
          min: formatNumber(attribute.min),
          max: formatNumber(attribute.max),
        });
      }
    }
  });

  if (form.seller.email.trim() && !EMAIL_PATTERN.test(form.seller.email.trim())) {
    errors.email = t("adminListings.editor.errors.email");
  }

  return errors;
}

function AttributeField({ attribute, zone, value, error, onChange }) {
  const { t } = useI18n();
  const id = `edit-attr-${attribute.key}`;
  const label = attributeLabel(attribute, zone);

  if (attribute.type === "number") {
    return (
      <Field
        id={id}
        label={attribute.unit ? t("adminListings.editor.withUnit", { label, unit: t(`sell.units.${attribute.unit}`) }) : label}
        optional={!attribute.required}
        hint={t("adminListings.editor.rangeHint", { min: formatNumber(attribute.min), max: formatNumber(attribute.max) })}
        error={error}
      >
        {(props) => (
          <input
            {...props}
            className="input numeric"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={(event) => onChange(attribute.key, event.target.value)}
          />
        )}
      </Field>
    );
  }

  const options = attribute.type === "boolean" ? ["true", "false"] : attribute.options;
  const labelFor = (option) =>
    attribute.type === "boolean" ? t(option === "true" ? "attributes.yes" : "attributes.no") : optionLabel(attribute, option);

  return (
    <Field id={id} label={label} optional={!attribute.required} error={error}>
      {(props) => (
        <select {...props} className="select" value={value} onChange={(event) => onChange(attribute.key, event.target.value)}>
          <option value="">{t("adminListings.editor.choose")}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {labelFor(option)}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

function PhotoManager({ car, maxPhotos, onCar }) {
  const { t, locale } = useI18n();
  const { request } = useAdmin();
  const showToast = useToast();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [busy, setBusy] = useState("");
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [message, setMessage] = useState("");
  const focusRef = useRef(null);
  const images = car.images || [];
  const room = Math.max(0, maxPhotos - images.length);

  useEffect(() => {
    const target = focusRef.current;

    if (target === null) {
      return;
    }

    focusRef.current = null;

    const items = listRef.current?.querySelectorAll(".edit-photo") || [];
    const element =
      target === "cover"
        ? listRef.current?.querySelector(".edit-photo__cover")
        : items[Math.min(target, items.length - 1)]?.querySelector("button:not(:disabled), [tabindex]");

    (element || inputRef.current)?.focus();
  }, [car.images]);

  async function run(key, path, options, success) {
    setBusy(key);

    try {
      const data = await request(path, options);

      onCar(data.car);
      setMessage(success);
      showToast(success, { tone: "success" });

    } catch (error) {
      focusRef.current = null;

      if (!isQuietError(error)) {
        showToast(error.message, { tone: "error" });
      }
    } finally {
      setBusy("");
    }
  }

  async function setCover(image, index) {
    focusRef.current = "cover";
    await run(
      `cover-${image.id}`,
      `/api/admin/cars/${car.id}/images/${image.id}/main`,
      { method: "PATCH" },
      t("adminListings.photos.coverDone", { index: index + 1 })
    );
  }

  async function remove(image) {
    setConfirm(null);

    focusRef.current = images.findIndex((item) => item.id === image.id);
    await run(
      `delete-${image.id}`,
      `/api/admin/cars/${car.id}/images/${image.id}`,
      { method: "DELETE" },
      t("adminListings.photos.deleted")
    );
  }

  function upload(fileList) {
    const accepted = [];
    const refused = [];
    const size = (bytes) =>
      new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024));

    Array.from(fileList).forEach((file) => {
      if (!PHOTO_TYPES.includes(file.type)) {
        refused.push(t("adminListings.photos.reasons.type", { name: file.name }));
      } else if (file.size > MAX_PHOTO_BYTES) {
        refused.push(t("adminListings.photos.reasons.size", { name: file.name, size: size(file.size) }));
      } else if (accepted.length >= room) {
        refused.push(t("adminListings.photos.reasons.full", { name: file.name, max: maxPhotos }));
      } else {
        accepted.push(file);
      }
    });

    setRejected(refused);

    if (!accepted.length) {
      return;
    }

    const body = new FormData();
    accepted.forEach((file) => body.append("images", file));
    run("upload", `/api/admin/cars/${car.id}/images`, { method: "POST", body }, t("adminListings.photos.uploaded", { count: accepted.length }));
  }

  return (
    <>
      <p className="visually-hidden" role="status">
        {message}
      </p>

      {images.length ? (
        <ul className="edit-photos" ref={listRef}>
          {images.map((image, index) => {
            const cover = image.is_main === 1;
            const number = { index: index + 1, count: images.length };

            return (
              <li key={image.id} className={`edit-photo${cover ? " is-cover" : ""}`}>
                <div className="edit-photo__media">
                  <img src={imageUrl(image.image_path)} alt={t("adminListings.photos.alt", number)} loading="lazy" />
                  {cover && (
                    <span className="badge edit-photo__badge">
                      <Star size={12} aria-hidden="true" />
                      {t("adminListings.photos.cover")}
                    </span>
                  )}
                </div>
                <div className="edit-photo__actions">
                  {cover ? (
                    <span className="edit-photo__cover" tabIndex={-1}>
                      {t("adminListings.photos.isCover")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setCover(image, index)}
                      disabled={Boolean(busy)}
                      aria-label={t("adminListings.photos.setCoverLabel", number)}
                    >
                      {busy === `cover-${image.id}` && <span className="spinner" aria-hidden="true" />}
                      {t("adminListings.photos.setCover")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-icon-btn lst-action lst-action--stop"
                    onClick={() => setConfirm({ image, index })}
                    disabled={Boolean(busy) || images.length <= 1}
                    aria-label={t("adminListings.photos.deleteLabel", number)}
                    title={images.length <= 1 ? t("adminListings.photos.lastPhoto") : t("adminListings.photos.delete")}
                  >
                    {busy === `delete-${image.id}` ? (
                      <span className="spinner" aria-hidden="true" />
                    ) : (
                      <Trash2 size={18} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="edit-muted">{t("adminListings.photos.none")}</p>
      )}

      {images.length === 1 && <p className="field__hint">{t("adminListings.photos.lastPhoto")}</p>}

      <div
        className={`edit-drop${dragging ? " is-dragging" : ""}${room ? "" : " is-full"}`}
        onDragOver={(event) => {
          if (!room) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (room) upload(event.dataTransfer.files);
        }}
      >
        <ImagePlus size={26} aria-hidden="true" />
        {room ? (
          <>
            <p className="edit-drop__title">{t("adminListings.photos.drop")}</p>
            <p className="edit-drop__hint">{t("adminListings.photos.room", { count: room, max: maxPhotos })}</p>
            <input
              ref={inputRef}
              id="edit-photo-input"
              type="file"
              accept={PHOTO_TYPES.join(",")}
              multiple
              className="visually-hidden"
              onChange={(event) => {
                upload(event.target.files);
                event.target.value = "";
              }}
            />
            <label htmlFor="edit-photo-input" className={`btn btn--outline${busy === "upload" ? " is-busy" : ""}`}>
              {busy === "upload" ? <span className="spinner" aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}
              {t(busy === "upload" ? "adminListings.photos.uploading" : "adminListings.photos.choose")}
            </label>
          </>
        ) : (
          <p className="edit-drop__title">{t("adminListings.photos.full", { max: maxPhotos })}</p>
        )}
      </div>

      {rejected.length > 0 && (
        <ul className="edit-rejected" role="alert">
          {rejected.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}

      {confirm && (
        <ConfirmDialog
          title={t("adminListings.photos.confirm.title")}
          description={t("adminListings.photos.confirm.description", { index: confirm.index + 1 })}
          confirmLabel={t("adminListings.photos.confirm.confirm")}
          cancelLabel={t("common.actions.cancel")}
          onConfirm={() => remove(confirm.image)}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function Editor({ initial, maxPhotos }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const showToast = useToast();
  const { request, refreshSummary } = useAdmin();
  const [car, setCar] = useState(initial.car);
  const [baseline, setBaseline] = useState(() => toForm(initial.car));
  const [form, setForm] = useState(baseline);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const [leaveTo, setLeaveTo] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const serverErrorRef = useRef(null);
  const backHref = listHref();

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const errors = submitted ? validate(form, t) : {};
  const category = getCategory(form.category);
  const price = digits(form.price);
  const title = `${car.name} ${car.year}`;
  const inspections = initial.inspections || [];
  const wilayas = WILAYAS.some((wilaya) => wilaya.name === form.location) || !form.location
    ? WILAYAS
    : [{ name: form.location, code: "" }, ...WILAYAS];

  useEffect(() => {
    if (serverError) {
      serverErrorRef.current?.focus();
    }
  }, [serverError]);

  useEffect(() => {
    if (!dirty) {
      return undefined;
    }

    function onBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    function onClick(event) {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;

      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === "_blank"
      ) {
        return;
      }

      const url = new URL(link.href, window.location.href);

      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setLeaveTo(`${url.pathname}${url.search}${url.hash}`);
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  function update(changes) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function updateAttribute(key, value) {
    setForm((current) => ({ ...current, attributes: { ...current.attributes, [key]: value } }));
  }

  function updateSeller(key, value) {
    setForm((current) => ({ ...current, seller: { ...current.seller, [key]: value } }));
  }

  function changeCategory(key) {
    const next = getCategory(key);

    update({ category: next.key, attributes: Object.fromEntries(next.attributes.map((attribute) => [attribute.key, ""])) });
  }

  function changeStatus(status) {
    update(status === "approved" ? { status } : { status, featured: false });
  }

  async function save(event) {
    event.preventDefault();
    setSubmitted(true);
    setServerError("");

    const found = Object.keys(validate(form, t));

    if (found.length) {
      const first = found[0] === "email" ? "edit-email" : `edit-${found[0]}`;

      document.getElementById(first)?.focus();
      return;
    }

    setSaving(true);

    try {
      const data = await request(`/api/admin/cars/${car.id}`, { method: "PUT", body: toPayload(form) });
      const next = toForm(data.car);

      setCar(data.car);
      setBaseline(next);
      setForm(next);
      setSubmitted(false);
      showToast(t("adminListings.editor.saved"), { tone: "success" });
      refreshSummary?.();
    } catch (error) {
      if (!isQuietError(error)) {
        setServerError(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setForm(baseline);
    setSubmitted(false);
    setServerError("");
  }

  async function removeListing() {
    setConfirmDelete(false);
    setDeleting(true);

    try {
      await request(`/api/admin/cars/${car.id}`, { method: "DELETE" });
      showToast(t("adminListings.toasts.delete", { name: isolate(title) }), { tone: "success" });
      refreshSummary?.();
      navigate(backHref, { replace: true });
    } catch (error) {
      if (!isQuietError(error)) {
        showToast(error.message, { tone: "error" });
      }

      setDeleting(false);
    }
  }

  function onPhotosChanged(next) {
    setCar((current) => ({ ...current, images: next.images, mainImage: next.mainImage }));
  }

  const millions = price ? formatMillions(price) : "";
  const priceHint = price
    ? millions
      ? t("adminListings.editor.priceMillions", { price: formatPrice(price), millions })
      : t("adminListings.editor.priceAmount", { price: formatPrice(price) })
    : t("adminListings.editor.priceHint");

  return (
    <form className="edit-page" onSubmit={save} noValidate>
      <Link to={backHref} className="edit-back">
        <ArrowLeft size={18} aria-hidden="true" className="flip-rtl" />
        {t("adminListings.editor.back")}
      </Link>

      <div className="edit-head">
        <div>
          <h1>
            <bdi>{car.name}</bdi> <span className="numeric">{car.year}</span>
          </h1>
          <div className="edit-head__meta">
            <ZoneTag category={car.category} />
            <StatusBadge kind="listing" status={car.status} />
            {car.featured ? (
              <span className="badge badge--signal">
                <Star size={12} aria-hidden="true" />
                {t("adminListings.list.featured")}
              </span>
            ) : null}
            <span>
              {t("adminListings.editor.meta", {
                number: requestNumber(car.id),
                date: formatDate(car.created_at),
              })}
            </span>
          </div>
        </div>
        <div className="edit-head__actions">
          {car.status === "approved" && (
            <a className="btn btn--outline" href={listingPath(car)} target="_blank" rel="noreferrer">
              <ExternalLink size={18} aria-hidden="true" className="flip-rtl" />
              {t("admin.listings.actions.view")}
              <span className="visually-hidden"> {t("admin.newTab")}</span>
            </a>
          )}
        </div>
      </div>

      {serverError && (
        <div className="notice notice--stop edit-notice" role="alert" tabIndex={-1} ref={serverErrorRef}>
          <CircleAlert size={18} aria-hidden="true" />
          <p>{t("adminListings.editor.serverError", { message: serverError })}</p>
        </div>
      )}

      {submitted && Object.keys(errors).length > 0 && (
        <div className="notice notice--stop edit-notice" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <p>{t("adminListings.editor.fixErrors", { count: Object.keys(errors).length })}</p>
        </div>
      )}

      <div className="edit-layout">
        <div className="edit-column">
          <section className="console-card edit-section edit-section--vehicle" aria-labelledby="edit-vehicle">
            <div className="console-card__head">
              <h2 id="edit-vehicle">{t("adminListings.editor.sections.vehicle")}</h2>
            </div>
            <div className="console-card__body">
              <div className="edit-grid">
                <Field id="edit-category" label={t("adminListings.editor.fields.zone")} hint={t("adminListings.editor.zoneHint")}>
                  {(props) => (
                    <select {...props} className="select" value={form.category} onChange={(event) => changeCategory(event.target.value)}>
                      {CATEGORIES.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.brand}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field id="edit-name" label={t("adminListings.editor.fields.name")} error={errors.name}>
                  {(props) => (
                    <input
                      {...props}
                      className="input"
                      dir="auto"
                      autoComplete="off"
                      value={form.name}
                      maxLength={120}
                      onChange={(event) => update({ name: event.target.value })}
                    />
                  )}
                </Field>
                <Field id="edit-year" label={t("adminListings.editor.fields.year")} error={errors.year}>
                  {(props) => (
                    <select {...props} className="select numeric" value={form.year} onChange={(event) => update({ year: event.target.value })}>
                      <option value="">{t("adminListings.editor.choose")}</option>
                      {YEARS.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field id="edit-price" label={t("adminListings.editor.fields.price")} hint={priceHint} error={errors.price}>
                  {(props) => (
                    <input
                      {...props}
                      className="input numeric"
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.price}
                      onChange={(event) => update({ price: event.target.value })}
                    />
                  )}
                </Field>
                <fieldset className="edit-radios">
                  <legend className="field__label">{t("adminListings.editor.fields.condition")}</legend>
                  {CONDITIONS.map((condition) => (
                    <label key={condition} className="edit-radio">
                      <input
                        type="radio"
                        name="condition"
                        value={condition}
                        checked={form.condition === condition}
                        onChange={() => update({ condition })}
                      />
                      <span>{t(`common.condition.${condition}`)}</span>
                    </label>
                  ))}
                </fieldset>
                <Field id="edit-location" label={t("adminListings.editor.fields.wilaya")} error={errors.location}>
                  {(props) => (
                    <select {...props} className="select" value={form.location} onChange={(event) => update({ location: event.target.value })}>
                      <option value="">{t("adminListings.editor.choose")}</option>
                      {wilayas.map((wilaya) => (
                        <option key={wilaya.name} value={wilaya.name}>
                          {wilaya.code ? `${wilaya.code} ` : ""}
                          {wilayaName(wilaya.name)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>

                <h3 className="edit-subtitle">{t("adminListings.editor.specsTitle", { zone: category.brand })}</h3>
                {category.attributes.map((attribute) => (
                  <AttributeField
                    key={`${category.key}-${attribute.key}`}
                    attribute={attribute}
                    zone={category.key}
                    value={form.attributes[attribute.key] ?? ""}
                    error={errors[`attr-${attribute.key}`]}
                    onChange={updateAttribute}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="console-card edit-section edit-section--photos" aria-labelledby="edit-photos">
            <div className="console-card__head">
              <h2 id="edit-photos">{t("adminListings.editor.sections.photos")}</h2>
              <p>{t("adminListings.photos.instant")}</p>
            </div>
            <div className="console-card__body">
              <PhotoManager car={car} maxPhotos={maxPhotos} onCar={onPhotosChanged} />
            </div>
          </section>

          <section className="console-card edit-section edit-section--text" aria-labelledby="edit-text">
            <div className="console-card__head">
              <h2 id="edit-text">{t("adminListings.editor.sections.text")}</h2>
            </div>
            <div className="console-card__body">
              <Field
                id="edit-description"
                label={t("adminListings.editor.fields.description")}
                optional
                hint={t("adminListings.editor.characters", { count: formatNumber(form.description.length), max: formatNumber(4000) })}
              >
                {(props) => (
                  <textarea
                    {...props}
                    className="textarea"
                    dir="auto"
                    rows={6}
                    maxLength={4000}
                    value={form.description}
                    onChange={(event) => update({ description: event.target.value })}
                  />
                )}
              </Field>
              <Field id="edit-issues" label={t("adminListings.editor.fields.issues")} optional hint={t("adminListings.editor.issuesHint")}>
                {(props) => (
                  <textarea
                    {...props}
                    className="textarea"
                    dir="auto"
                    rows={4}
                    maxLength={2000}
                    value={form.issues}
                    onChange={(event) => update({ issues: event.target.value })}
                  />
                )}
              </Field>
            </div>
          </section>

          <section className="console-card edit-section edit-section--seller" aria-labelledby="edit-seller">
            <div className="console-card__head">
              <h2 id="edit-seller">{t("adminListings.editor.sections.seller")}</h2>
            </div>
            <div className="console-card__body">
              <div className="edit-grid">
                <Field id="edit-first-name" label={t("adminListings.editor.fields.firstName")} optional>
                  {(props) => (
                    <input
                      {...props}
                      className="input"
                      dir="auto"
                      autoComplete="off"
                      value={form.seller.firstName}
                      onChange={(event) => updateSeller("firstName", event.target.value)}
                    />
                  )}
                </Field>
                <Field id="edit-last-name" label={t("adminListings.editor.fields.lastName")} optional>
                  {(props) => (
                    <input
                      {...props}
                      className="input"
                      dir="auto"
                      autoComplete="off"
                      value={form.seller.lastName}
                      onChange={(event) => updateSeller("lastName", event.target.value)}
                    />
                  )}
                </Field>
                <Field id="edit-email" label={t("adminListings.editor.fields.email")} optional error={errors.email}>
                  {(props) => (
                    <input
                      {...props}
                      type="email"
                      className="input ltr"
                      dir="ltr"
                      autoComplete="off"
                      value={form.seller.email}
                      onChange={(event) => updateSeller("email", event.target.value)}
                    />
                  )}
                </Field>
                <Field id="edit-phone" label={t("adminListings.editor.fields.phone")} optional>
                  {(props) => (
                    <input
                      {...props}
                      type="tel"
                      className="input ltr numeric"
                      dir="ltr"
                      autoComplete="off"
                      value={form.seller.phone}
                      onChange={(event) => updateSeller("phone", event.target.value)}
                    />
                  )}
                </Field>
              </div>
            </div>
          </section>
        </div>

        <div className="edit-column">
          <section className="console-card edit-section edit-section--status" aria-labelledby="edit-status-title">
            <div className="console-card__head">
              <h2 id="edit-status-title">{t("adminListings.editor.sections.status")}</h2>
            </div>
            <div className="console-card__body">
              <Field id="edit-status" label={t("adminListings.editor.fields.status")} hint={t(`adminListings.editor.statusHints.${form.status}`)}>
                {(props) => (
                  <select {...props} className="select" value={form.status} onChange={(event) => changeStatus(event.target.value)}>
                    {LISTING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {t(`common.status.listing.${status}`)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <label className="edit-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={form.featured}
                  disabled={form.status !== "approved"}
                  aria-describedby="edit-featured-hint"
                  onChange={(event) => update({ featured: event.target.checked })}
                />
                <span className="edit-switch__text">
                  {t("adminListings.editor.fields.featured")}
                  <span id="edit-featured-hint" className="edit-switch__hint">
                    {t(form.status === "approved" ? "adminListings.editor.featuredHint" : "adminListings.editor.featuredLiveOnly")}
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="console-card edit-section edit-section--inspections" aria-labelledby="edit-inspections">
            <div className="console-card__head">
              <h2 id="edit-inspections">{t("adminListings.editor.sections.inspections")}</h2>
            </div>
            <div className="console-card__body">
              {inspections.length ? (
                <ul className="edit-inspections">
                  {inspections.map((item) => (
                    <li key={item.id}>
                      <Link className="edit-inspection" to={`/admin/inspections?request=${item.id}`}>
                        <span className="edit-inspection__text">
                          <strong>
                            {t("admin.inspections.title", { number: requestNumber(item.id) })} · <bdi>{item.buyer_full_name}</bdi>
                          </strong>
                          <span>
                            {item.appointment_date
                              ? t("adminListings.editor.appointment", {
                                  date: formatDate(item.appointment_date, { day: "numeric", month: "short", year: "numeric" }),
                                  time: item.appointment_time || "",
                                })
                              : t("adminListings.editor.noAppointment")}
                          </span>
                        </span>
                        <StatusBadge status={item.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="edit-muted">{t("adminListings.editor.noInspections")}</p>
              )}
            </div>
          </section>

          <section className="console-card edit-section edit-section--danger edit-danger" aria-labelledby="edit-danger">
            <div className="console-card__head">
              <h2 id="edit-danger">{t("adminListings.editor.sections.danger")}</h2>
            </div>
            <div className="console-card__body">
              <p className="edit-muted">{t("adminListings.editor.deleteText")}</p>
              <button type="button" className="btn btn--danger" onClick={() => setConfirmDelete(true)} disabled={deleting}>
                {deleting ? <span className="spinner" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}
                {t("adminListings.editor.delete")}
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="edit-savebar">
        <p className={`edit-savebar__status${dirty ? " is-dirty" : ""}`} role="status">
          {dirty && <span className="edit-savebar__dot" aria-hidden="true" />}
          {t(dirty ? "adminListings.editor.unsaved" : "adminListings.editor.allSaved")}
        </p>
        <button type="button" className="btn btn--outline" onClick={discard} disabled={!dirty || saving}>
          <Undo2 size={18} aria-hidden="true" className="flip-rtl" />
          {t("adminListings.editor.discard")}
        </button>
        <button type="submit" className="btn btn--primary" disabled={!dirty || saving}>
          {saving ? <span className="spinner" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
          {t(saving ? "adminListings.editor.saving" : "adminListings.editor.save")}
        </button>
      </div>

      {leaveTo && (
        <ConfirmDialog
          title={t("adminListings.editor.leave.title")}
          description={t("adminListings.editor.leave.description")}
          confirmLabel={t("adminListings.editor.leave.confirm")}
          cancelLabel={t("adminListings.editor.leave.cancel")}
          onConfirm={() => {
            setForm(baseline);
            setLeaveTo(null);
            window.setTimeout(() => navigate(leaveTo), 0);
          }}
          onClose={() => setLeaveTo(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t("adminListings.confirmDelete.title")}
          description={t("adminListings.confirmDelete.description", { name: isolate(car.name), year: car.year })}
          confirmLabel={t("adminListings.confirmDelete.confirm")}
          cancelLabel={t("common.actions.cancel")}
          onConfirm={removeListing}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </form>
  );
}

export default function ListingEditPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const { request } = useAdmin();
  const listing = useAdminData(request, `/api/admin/cars/${encodeURIComponent(id)}`);
  const settings = useAdminData(request, "/api/admin/settings");
  const maxPhotos = settings.data?.settings?.listings?.maxPhotos || 9;

  if (listing.data) {
    return <Editor key={listing.data.car.id} initial={listing.data} maxPhotos={maxPhotos} />;
  }

  return (
    <div className="edit-page">
      <Link to={listHref()} className="edit-back">
        <ArrowLeft size={18} aria-hidden="true" className="flip-rtl" />
        {t("adminListings.editor.back")}
      </Link>
      {listing.error ? (
        <LoadError message={listing.error} onRetry={listing.reload} retrying={listing.refreshing} />
      ) : (
        <div className="edit-skeleton" aria-busy="true">
          <p className="visually-hidden" role="status">
            {t("adminListings.editor.loading")}
          </p>
          <div className="skeleton lst-skeleton-line lst-skeleton-line--title" />
          <div className="skeleton edit-skeleton__block" />
          <div className="skeleton edit-skeleton__block" />
        </div>
      )}
    </div>
  );
}
