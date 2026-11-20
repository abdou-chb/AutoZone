import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Heart,
  ImageOff,
  MapPin,
  Maximize2,
  MessageCircle,
  RotateCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import ListingCard from "../components/ListingCard";
import { fetchListing, toListing, toShelves } from "../lib/api";
import { adminRequest, adminToken } from "../lib/admin-presence";
import { listingSpecs } from "../lib/attributes";
import { getCategory, listingPath } from "../lib/categories";
import { formatDate, formatMillions, formatPrice, formatRelativeDay, wilayaName } from "../lib/format";
import { useI18n } from "../i18n/i18n-context";
import { useSavedCars } from "../lib/saved-context";
import { useToast } from "../lib/toast-context";
import useResource from "../lib/useResource";
import { listingsLink } from "../lib/listing-store";
import { useSite } from "../lib/site-context";
import { isZoneVisible } from "../lib/site-settings";
import AdminListingPanel from "./details/AdminListingPanel";
import NotFound from "./NotFound";
import "./ListingDetails.css";

const Lightbox = lazy(() => import("./Lightbox"));

const isValidId = (id) => /^\d+$/.test(id) && Number(id) > 0;

export default function ListingDetails({ categoryKey }) {
  const { id } = useParams();
  const settings = useSite();

  if (!isZoneVisible(settings, categoryKey)) {
    return <NotFound />;
  }

  return <ListingDetailsView key={`${categoryKey}:${id}`} id={id} category={getCategory(categoryKey)} />;
}

function ListingDetailsView({ id, category }) {
  const validId = isValidId(id);
  const [state, setState] = useState({ status: validId ? "loading" : "missing", listing: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const { status, listing, error } = state;
  const { t } = useI18n();
  const zone = category.key;

  useEffect(() => {
    if (!validId) {
      return undefined;
    }

    const controller = new AbortController();

    const loadAsAdmin = (reason) =>
      reason.status === 404 && adminToken()
        ? adminRequest(`/api/admin/cars/${id}`, { signal: controller.signal }).then(
            (data) => toListing(data.car),
            () => Promise.reject(reason)
          )
        : Promise.reject(reason);

    fetchListing(id, controller.signal)
      .catch(loadAsAdmin)
      .then((result) => setState({ status: "ready", listing: result, error: "" }))
      .catch((reason) => {
        if (reason.name === "AbortError") {
          return;
        }

        if (reason.status === 404 || reason.status === 400) {
          setState({ status: "missing", listing: null, error: "" });
        } else {
          setState({ status: "error", listing: null, error: reason.message });
        }
      });

    return () => controller.abort();
  }, [id, validId, attempt]);

  useEffect(() => {
    if (listing) {
      document.title = t("details.pageTitle.listing", {
        name: listing.name,
        year: listing.year,
        brand: getCategory(listing.category).brand,
      });
    } else {
      document.title = t(`details.pageTitle.${status === "missing" ? "missing" : "details"}`, {
        zone,
        brand: category.brand,
      });
    }
  }, [status, listing, zone, category.brand, t]);

  function retry() {
    setState({ status: "loading", listing: null, error: "" });
    setAttempt((value) => value + 1);
  }

  if (status === "missing") {
    return <MissingListing category={category} />;
  }

  if (status === "error") {
    return (
      <div className="container page">
        <div className="notice notice--stop details-error" role="alert">
          <CircleAlert size={20} aria-hidden="true" />
          <div className="details-error__body">
            <h1 className="details-error__title">{t("details.loadError", { zone })}</h1>
            <p>{error}</p>
            <button type="button" className="btn btn--outline" onClick={retry}>
              <RotateCw size={18} aria-hidden="true" />
              {t("common.actions.retry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return <DetailsSkeleton category={category} />;
  }

  if (listing.category !== category.key) {
    return <Navigate replace to={listingPath(listing)} />;
  }

  return <ListingView listing={listing} category={category} />;
}

function ListingView({ listing, category }) {
  const { t } = useI18n();
  const settings = useSite();
  const label = `${listing.name} ${listing.year}`;
  const inspectionPath = settings.inspections.enabled ? `${listingPath(listing)}/inspection` : "";
  const contactPath = settings.contact.enabled ? `/contact?listing=${listing.id}` : "";

  return (
    <div className="container page details-page">
      <nav aria-label={t("details.breadcrumb")}>
        <ol className="breadcrumb details-breadcrumb">
          <li>
            <Link to={listingsLink(`home:${category.key}`, category.home)}>{t(`zones.${category.key}.forSale`)}</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{listing.name}</li>
        </ol>
      </nav>

      <AdminListingPanel listing={listing} category={category} />

      <div className="details-layout">
        <div className="details-gallery-area">
          <Gallery images={listing.images} label={label} />
        </div>

        <aside className="details-aside" aria-label={t("details.aside")}>
          <BuyPanel listing={listing} category={category} inspectionPath={inspectionPath} contactPath={contactPath} />
        </aside>

        <div className="details-info">
          <KeyDetails listing={listing} category={category} />
          <section className="details-section" aria-labelledby="details-description">
            <h2 id="details-description">{t("details.description.title")}</h2>
            {listing.description ? (
              <p className="details-description">{listing.description}</p>
            ) : (
              <p className="details-muted">{t("details.description.empty")}</p>
            )}
          </section>
          <KnownIssues issues={listing.issues} />
        </div>
      </div>

      <MoreListings listing={listing} category={category} />

      <div className="details-buybar">
        <p className="details-buybar__price">
          <span className="display numeric">{formatPrice(listing.price)}</span>
          <span className="details-buybar__millions">{formatMillions(listing.price)}</span>
        </p>
        {inspectionPath ? (
          <Link to={inspectionPath} className="btn btn--primary details-buybar__action">
            {t("details.actions.inspect")}
          </Link>
        ) : (
          contactPath && (
            <Link to={contactPath} className="btn btn--primary details-buybar__action">
              {t("details.actions.contactShort")}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

function Gallery({ images, label }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const count = images.length;

  if (!count) {
    return (
      <div className="details-nophoto">
        <ImageOff size={32} strokeWidth={1.5} aria-hidden="true" />
        <p>{t("details.gallery.noPhotos")}</p>
      </div>
    );
  }

  const step = (delta) => setIndex((current) => (current + delta + count) % count);

  return (
    <div className="details-gallery">
      <div className="details-stage">
        <button type="button" className="details-stage__open" onClick={() => setOpen(true)}>
          <img
            src={images[index]}
            alt={t("details.gallery.photo", { label, index: index + 1, count })}
            fetchPriority={index === 0 ? "high" : undefined}
          />
          <span className="details-stage__hint">
            <Maximize2 size={16} aria-hidden="true" />
            <span className="visually-hidden">{t("details.gallery.open")}</span>
          </span>
        </button>

        {count > 1 && (
          <>
            <button type="button" className="details-stage__nav details-stage__nav--prev" onClick={() => step(-1)}>
              <ChevronLeft size={22} className="flip-rtl" aria-hidden="true" />
              <span className="visually-hidden">{t("details.gallery.previous")}</span>
            </button>
            <button type="button" className="details-stage__nav details-stage__nav--next" onClick={() => step(1)}>
              <ChevronRight size={22} className="flip-rtl" aria-hidden="true" />
              <span className="visually-hidden">{t("details.gallery.next")}</span>
            </button>
            <span className="details-stage__count numeric" aria-hidden="true">
              {t("details.gallery.counter", { index: index + 1, count })}
            </span>
          </>
        )}
        <span className="visually-hidden" aria-live="polite">
          {count > 1 ? t("details.gallery.photo", { label, index: index + 1, count }) : ""}
        </span>
      </div>

      {count > 1 && (
        <ul className="details-thumbs" aria-label={t("details.gallery.all")}>
          {images.map((image, imageIndex) => (
            <li key={`${imageIndex}-${image}`}>
              <button
                type="button"
                className="details-thumb"
                aria-pressed={imageIndex === index}
                onClick={() => setIndex(imageIndex)}
              >
                <img src={image} alt="" loading="lazy" decoding="async" />
                <span className="visually-hidden">{t("details.gallery.show", { index: imageIndex + 1 })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Suspense fallback={null}>
          <Lightbox images={images} index={index} label={label} onStep={step} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

function BuyPanel({ listing, category, inspectionPath, contactPath }) {
  const { isSaved, toggleSaved } = useSavedCars();
  const { t } = useI18n();
  const showToast = useToast();
  const saved = isSaved(listing.id);
  const zone = category.key;

  function handleSave() {
    toggleSaved(listing.id);
    showToast(t(saved ? "common.card.removed" : "common.card.saved"));
  }

  return (
    <div className="panel details-panel">
      <div className="details-panel__head">
        <h1 className="details-title">
          {listing.name} <span className="details-title__year">{listing.year}</span>
        </h1>
        <p className="details-location">
          <MapPin size={16} aria-hidden="true" />
          {wilayaName(listing.location)}
        </p>
      </div>

      <div className="details-price">
        <p className="display numeric details-price__value">{formatPrice(listing.price)}</p>
        <p className="details-price__millions">{formatMillions(listing.price)}</p>
        <p className="details-price__note">{t("details.price.note")}</p>
      </div>

      <div className="details-actions">
        {inspectionPath ? (
          <Link to={inspectionPath} className="btn btn--primary btn--large btn--block">
            {t("details.actions.inspect")}
          </Link>
        ) : (
          <p className="notice details-paused" role="note">
            <CircleAlert size={18} aria-hidden="true" />
            <span>{t("details.paused", { zone })}</span>
          </p>
        )}
        <button
          type="button"
          className={`btn btn--outline btn--block details-save${saved ? " is-saved" : ""}`}
          aria-pressed={saved}
          onClick={handleSave}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
          {saved ? t("details.actions.saved") : t("details.actions.save", { zone })}
        </button>
        {contactPath && (
          <Link to={contactPath} className="text-link details-contact">
            <MessageCircle size={18} aria-hidden="true" />
            {t("details.actions.contact", { zone })}
          </Link>
        )}
      </div>

      <div className="details-trust">
        <p className="details-trust__reviewed">
          <ShieldCheck size={20} aria-hidden="true" />
          {t("details.trust.reviewed")}
        </p>
        {inspectionPath && (
          <>
            <h2 className="details-trust__title">{t("details.trust.title")}</h2>
            <ol className="details-steps">
              <li>{t("details.trust.call")}</li>
              <li>
                {t("details.trust.see", { zone })} {t(`zones.${zone}.inspection`)}
              </li>
              <li>{t("details.trust.decide")}</li>
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

function KeyDetails({ listing, category }) {
  const { t } = useI18n();
  const specs = [
    { key: "year", icon: CalendarDays, label: t("details.specs.year"), value: listing.year },
    ...listingSpecs(listing, category),
    {
      key: "condition",
      icon: BadgeCheck,
      label: t("details.specs.condition"),
      value: t(`common.condition.${listing.condition}`),
    },
    { key: "wilaya", icon: MapPin, label: t("details.specs.wilaya"), value: wilayaName(listing.location) },
    {
      key: "listed",
      icon: Clock,
      label: t("details.specs.listed"),
      value: (
        <time dateTime={listing.createdAt} title={formatDate(listing.createdAt)}>
          {formatRelativeDay(listing.createdAt)}
        </time>
      ),
    },
  ];

  return (
    <section className="details-section" aria-labelledby="details-key">
      <h2 id="details-key">{t("details.specs.title")}</h2>
      <dl className="details-specs">
        {specs.map(({ key, icon: Icon, label, value }) => (
          <div key={key} className="details-spec">
            <dt>
              <Icon size={16} aria-hidden="true" />
              {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function KnownIssues({ issues }) {
  const { t } = useI18n();

  return (
    <section className="details-section" aria-labelledby="details-issues">
      <h2 id="details-issues">{t("details.issues.title")}</h2>
      {issues.length ? (
        <ul className="details-issues">
          {issues.map((issue, issueIndex) => (
            <li key={`${issueIndex}-${issue}`}>
              <TriangleAlert size={18} aria-hidden="true" />
              {issue}
            </li>
          ))}
        </ul>
      ) : (
        <p className="details-no-issues">
          <CircleCheck size={18} aria-hidden="true" />
          {t("details.issues.none")}
        </p>
      )}
    </section>
  );
}

function MoreListings({ listing, category }) {
  const { t } = useI18n();
  const base = `category=${category.key}&pageSize=4`;
  const path = `/api/cars/batch?${new URLSearchParams([
    ["query", `${base}&min=${listing.price}&sort=price-asc`],
    ["query", `${base}&max=${listing.price}&sort=price-desc`],
  ])}`;
  const { data } = useResource(path, toShelves);
  const others = [...new Map((data || []).flatMap((shelf) => shelf.listings).map((other) => [other.id, other])).values()]
    .filter((other) => other.id !== listing.id)
    .sort((a, b) => Math.abs(a.price - listing.price) - Math.abs(b.price - listing.price))
    .slice(0, 3);

  if (!others.length) {
    return null;
  }

  return (
    <section className="details-more" aria-labelledby="details-more-title">
      <div className="details-more__head">
        <h2 id="details-more-title">{t("details.more.title", { zone: category.key })}</h2>
        <Link to={category.home} className="text-link">
          {t("details.more.seeAll", { zone: category.key })}
        </Link>
      </div>
      <div className="car-grid">
        {others.map((other) => (
          <ListingCard key={other.id} listing={other} />
        ))}
      </div>
    </section>
  );
}

function MissingListing({ category }) {
  const { t } = useI18n();
  const Icon = category.icon;
  const zone = category.key;

  return (
    <div className="container page">
      <div className="empty-state details-missing">
        <span className="empty-state__icon">
          <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h1>{t("details.missing.title", { zone })}</h1>
        <p>{t("details.missing.text", { zone })}</p>
        <div className="empty-state__action">
          <Link to={category.home} className="btn btn--primary">
            {t(`zones.${zone}.browse`)}
          </Link>
        </div>
      </div>
    </div>
  );
}

function DetailsSkeleton({ category }) {
  const { t } = useI18n();

  return (
    <div className="container page details-page">
      <p className="visually-hidden" role="status">
        {t("details.loading", { zone: category.key })}
      </p>
      <div aria-hidden="true">
        <div className="skeleton details-skeleton__crumb" />
        <div className="details-layout">
          <div className="details-gallery-area">
            <div className="skeleton details-skeleton__stage" />
            <div className="details-thumbs">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="skeleton details-skeleton__thumb" />
              ))}
            </div>
          </div>
          <div className="details-aside">
            <div className="panel details-panel">
              <div className="skeleton" style={{ height: 30, width: "75%" }} />
              <div className="skeleton" style={{ height: 16, width: "40%" }} />
              <div className="skeleton" style={{ height: 44, width: "65%", marginBlockStart: 12 }} />
              <div className="skeleton" style={{ height: 52, marginBlockStart: 12 }} />
              <div className="skeleton" style={{ height: 44 }} />
            </div>
          </div>
          <div className="details-info">
            <div className="skeleton" style={{ height: 24, width: 160 }} />
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
