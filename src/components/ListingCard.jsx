import { Link } from "react-router-dom";
import { Heart, MapPin } from "lucide-react";
import { listingSpecs } from "../lib/attributes";
import { getCategory, listingPath } from "../lib/categories";
import { formatMillions, formatPrice, wilayaName } from "../lib/format";
import { useI18n } from "../i18n/i18n-context";
import { useSavedCars } from "../lib/saved-context";
import "./ListingCard.css";

export default function ListingCard({ listing, showZone = false }) {
  const { isSaved, toggleSaved } = useSavedCars();
  const { t } = useI18n();
  const saved = isSaved(listing.id);
  const category = getCategory(listing.category);
  const specs = listingSpecs(listing, category, category.cardSpecs);
  const isElectric = listing.attributes.electric === true || listing.attributes.fuel === "Electric";
  const ZoneIcon = category.icon;

  return (
    <article className="car-card">
      <Link to={listingPath(listing)} className="car-card__link">
        <div className="car-card__media">
          {listing.image ? (
            <img src={listing.image} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="car-card__no-photo">{t("common.card.noPhoto")}</span>
          )}
          <span className="car-card__badges">
            {listing.condition === "New" && <span className="badge badge--signal">{t("common.card.new")}</span>}
            {isElectric && <span className="badge badge--go">{t("common.card.electric")}</span>}
          </span>
        </div>

        <div className="car-card__body">
          {showZone && (
            <span className="car-card__zone" style={{ "--zone": category.theme.accent }}>
              <ZoneIcon size={14} aria-hidden="true" />
              {category.brand}
            </span>
          )}

          <h3 className="car-card__title">
            {listing.name} <span className="car-card__year">{listing.year}</span>
          </h3>

          <p className="car-card__location">
            <MapPin size={14} aria-hidden="true" />
            {wilayaName(listing.location)}
          </p>

          <p className="car-card__price">
            <span className="display numeric">{formatPrice(listing.price)}</span>
            <span className="car-card__millions">{formatMillions(listing.price)}</span>
          </p>

          {specs.length > 0 && (
            <ul className="car-card__specs">
              {specs.map((spec) => {
                const Icon = spec.icon;

                return (
                  <li key={spec.key}>
                    <Icon size={15} aria-hidden="true" />
                    <span className="visually-hidden">{spec.label}: </span>
                    {spec.short}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Link>

      <button
        type="button"
        className={`car-card__save${saved ? " is-saved" : ""}`}
        onClick={() => toggleSaved(listing.id)}
        aria-pressed={saved}
        aria-label={t(saved ? "common.card.unsave" : "common.card.save", { name: listing.name })}
      >
        <Heart size={18} fill={saved ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="car-card car-card--skeleton" aria-hidden="true">
      <div className="car-card__media skeleton" />
      <div className="car-card__body">
        <div className="skeleton" style={{ height: 20, width: "70%" }} />
        <div className="skeleton" style={{ height: 14, width: "35%" }} />
        <div className="skeleton" style={{ height: 28, width: "55%", marginTop: 8 }} />
        <div className="skeleton" style={{ height: 14, width: "90%", marginTop: 8 }} />
      </div>
    </div>
  );
}
