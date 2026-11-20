import { Camera, MapPin, Tag } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";
import { ATTRIBUTE_ICONS, attributeLabel, listingSpecs } from "../../lib/attributes";
import { formatMillions, formatPrice, wilayaName } from "../../lib/format";

function Placeholder({ children }) {
  return <span className="sell-preview__empty">{children}</span>;
}

export default function ListingPreview({ category, listing, nameLabel }) {
  const { t } = useI18n();
  const specs = listingSpecs(listing, category, category.cardSpecs);
  const isElectric = listing.attributes.electric === true || listing.attributes.fuel === "Electric";

  return (
    <section className="sell-preview" aria-labelledby="sell-preview-title">
      <h2 id="sell-preview-title" className="sell-aside__title">
        {t("sell.preview.title")}
      </h2>
      <div className="sell-preview__card">
        <div className="sell-preview__media">
          {listing.image ? (
            <img src={listing.image} alt="" />
          ) : (
            <span className="sell-preview__no-photo">
              <Camera size={24} aria-hidden="true" />
              {t("sell.preview.coverPhoto")}
            </span>
          )}
          <span className="sell-preview__badges">
            {listing.condition === "New" && <span className="badge badge--signal">{t("common.card.new")}</span>}
            {isElectric && <span className="badge badge--go">{t("common.card.electric")}</span>}
          </span>
        </div>

        <div className="sell-preview__body">
          <p className="sell-preview__title">
            {listing.name.trim() || <Placeholder>{nameLabel}</Placeholder>}{" "}
            {listing.year && <span className="sell-preview__year">{listing.year}</span>}
          </p>

          <p className="sell-preview__location">
            <MapPin size={14} aria-hidden="true" />
            {listing.location ? wilayaName(listing.location) : <Placeholder>{t("sell.preview.wilaya")}</Placeholder>}
          </p>

          <p className="sell-preview__price">
            {listing.price ? (
              <>
                <span className="display numeric">{formatPrice(listing.price)}</span>
                <span className="sell-preview__millions">{formatMillions(listing.price)}</span>
              </>
            ) : (
              <span className="display sell-preview__empty">{t("sell.preview.price")}</span>
            )}
          </p>

          <ul className="sell-preview__specs">
            {category.cardSpecs.map((key) => {
              const spec = specs.find((item) => item.key === key);
              const attribute = category.attributes.find((item) => item.key === key);
              const Icon = ATTRIBUTE_ICONS[key] || Tag;

              return (
                <li key={key}>
                  <Icon size={15} aria-hidden="true" />
                  {spec ? (
                    <>
                      <span className="visually-hidden">{spec.label}: </span>
                      {spec.short}
                    </>
                  ) : (
                    <Placeholder>{attributeLabel(attribute, category.key)}</Placeholder>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
