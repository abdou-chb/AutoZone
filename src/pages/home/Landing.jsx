import { useId, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import AnimatedContent from "../../components/bits/AnimatedContent/AnimatedContent";
import GlareHover from "../../components/bits/GlareHover";
import BrandMark from "../../components/BrandMark";
import ListingCard, { ListingCardSkeleton } from "../../components/ListingCard";
import { hasTranslation } from "../../i18n/core";
import { useI18n } from "../../i18n/i18n-context";
import { useSite } from "../../lib/site-context";
import { countFor } from "./listing-filters";
import "./Landing.css";

function SectionHead({ id, title, text, action }) {
  return (
    <div className="landing-head">
      <div>
        <h2 id={id} className="landing-head__title">
          {title}
        </h2>
        {text && <p className="landing-head__text">{text}</p>}
      </div>
      {action}
    </div>
  );
}

function SeeAll({ total, category, onClick }) {
  const { t } = useI18n();

  return (
    <button type="button" className="landing-more" onClick={onClick}>
      {t("landing.seeAll", { zone: category.key, count: total })}
      <ArrowRight size={16} aria-hidden="true" className="flip-rtl" />
    </button>
  );
}

function ShelfGrid({ result, loading, glare = false }) {
  if (loading && !result) {
    return (
      <div className="shelf-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <ListingCardSkeleton key={item} />
        ))}
      </div>
    );
  }

  return (
    <AnimatedContent className="shelf-grid" distance={36} duration={0.7} stagger={0.08} threshold={0.15}>
      {result.listings.map((listing) =>
        glare ? (
          <GlareHover
            key={listing.id}
            className="shelf-glare"
            borderRadius="var(--radius-lg)"
            glareOpacity={0.35}
            glareSize={40}
            rimGlint={false}
          >
            <ListingCard listing={listing} />
          </GlareHover>
        ) : (
          <ListingCard key={listing.id} listing={listing} />
        )
      )}
    </AnimatedContent>
  );
}

export function FeaturedShelf({ category, result, loading, onSelect }) {
  const { t } = useI18n();

  if (!loading && !result?.total) {
    return null;
  }

  return (
    <section className="featured-band" aria-labelledby="featured-title">
      <div className="container">
        <SectionHead
          id="featured-title"
          title={t("landing.featured", { zone: category.key })}
          text={t(`zones.${category.key}.landing.featured`)}
          action={
            result?.total > 4 && (
              <SeeAll total={result.total} category={category} onClick={() => onSelect({ featured: "true" })} />
            )
          }
        />
        <ShelfGrid result={result} loading={loading} glare />
      </div>
    </section>
  );
}

export function PicksShelf({ category, results, loading, onSelect }) {
  const { t, dir } = useI18n();
  const { tabs } = category.landing.picks;
  const title = t(`zones.${category.key}.landing.picksTitle`);
  const tabKey = (tab, field) => `zones.${category.key}.landing.tabs.${tab.id}.${field}`;
  const [chosen, setChosen] = useState(0);
  const tabRefs = useRef([]);
  const baseId = useId();

  const visible = tabs
    .map((tab, index) => ({ ...tab, index, result: results?.[index] }))
    .filter((tab) => loading || tab.result?.total > 0);

  if (!visible.length) {
    return null;
  }

  const current = visible.find((tab) => tab.index === chosen) || visible[0];

  function handleKeyDown(event) {
    const position = visible.indexOf(current);
    const forward = (position + 1) % visible.length;
    const backward = (position - 1 + visible.length) % visible.length;
    const keys = {
      ArrowRight: dir === "rtl" ? backward : forward,
      ArrowLeft: dir === "rtl" ? forward : backward,
      Home: 0,
      End: visible.length - 1,
    };

    if (!(event.key in keys)) {
      return;
    }

    event.preventDefault();

    const next = visible[keys[event.key]];
    setChosen(next.index);
    tabRefs.current[next.index]?.focus();
  }

  return (
    <section className="landing container" aria-labelledby={`${baseId}-title`}>
      <SectionHead
        id={`${baseId}-title`}
        title={title}
        action={
          current.result?.total > 4 && (
            <SeeAll total={current.result.total} category={category} onClick={() => onSelect(current.params)} />
          )
        }
      />

      <div className="picks-tabs" role="tablist" aria-label={title} onKeyDown={handleKeyDown}>
        {visible.map((tab) => {
          const selected = tab === current;
          const text = hasTranslation(tabKey(tab, "text")) ? t(tabKey(tab, "text")) : "";

          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.index}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`picks-tab${selected ? " is-selected" : ""}`}
              onClick={() => setChosen(tab.index)}
            >
              {t(tabKey(tab, "label"))}
              {text && <span className="picks-tab__text">{text}</span>}
            </button>
          );
        })}
      </div>

      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${current.index}`}>
        <ShelfGrid key={current.index} result={current.result} loading={loading} />
      </div>
    </section>
  );
}

export function BrandList({ category, brands, active, onSelect }) {
  const { t } = useI18n();
  const settings = useSite();
  const logos = Object.fromEntries((settings.brands[category.key] || []).map((brand) => [brand.name, brand.logo]));

  if (!brands || brands.length < 2) {
    return null;
  }

  return (
    <section className="landing container" aria-labelledby="brands-title">
      <SectionHead id="brands-title" title={t(`zones.${category.key}.landing.brandsTitle`)} />
      <AnimatedContent as="ul" className="brand-list" distance={24} duration={0.6} stagger={0.04}>
        {brands.slice(0, 12).map((brand) => {
          const isActive = active === brand.name;

          return (
            <li key={brand.name}>
              <button
                type="button"
                className={`brand-tile${isActive ? " is-active" : ""}`}
                aria-pressed={isActive}
                onClick={() => onSelect({ brand: isActive ? "" : brand.name })}
              >
                <BrandMark name={brand.name} logo={brand.logo || logos[brand.name]} size={48} />
                <span className="brand-tile__text">
                  <span className="brand-tile__name" title={brand.name}>
                    {brand.name}
                  </span>
                  <span className="brand-tile__count numeric">{t("home.listingCount", { count: brand.count })}</span>
                </span>
              </button>
            </li>
          );
        })}
      </AnimatedContent>
    </section>
  );
}

export function RangeGuide({ category, range, counts, paramsFor, onSelect }) {
  const { t } = useI18n();

  if (!counts || counts.every((count) => count === 0)) {
    return null;
  }

  const id = `range-${range.attribute}`;
  const largest = Math.max(...counts);
  const base = `zones.${category.key}.landing.ranges.${range.attribute}`;
  const text = hasTranslation(`${base}.text`) ? t(`${base}.text`) : "";
  const items = t(`${base}.items`);

  return (
    <section className="landing container" aria-labelledby={id}>
      <SectionHead id={id} title={t(`${base}.title`)} text={text} />
      <ul className="range-list">
        {items.map((item, index) => {
          const count = counts[index] || 0;

          return (
            <li key={index}>
              <button
                type="button"
                className="range-tile"
                disabled={count === 0}
                onClick={() => onSelect(paramsFor(index))}
              >
                <span className="range-tile__label">{item.label}</span>
                {item.meta && <span className="range-tile__meta">{item.meta}</span>}
                <span className="range-tile__text">{item.text}</span>
                <span className="range-tile__count numeric">
                  {count
                    ? t(`zones.${category.key}.count`, { count })
                    : t("landing.none", { zone: category.key })}
                </span>
                <span className="range-tile__gauge" aria-hidden="true">
                  <span style={{ "--share": count / largest }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function UseGuide({ category, overview, onSelect }) {
  const { t } = useI18n();
  const { uses } = category.landing;
  const base = `zones.${category.key}.landing.uses`;

  return (
    <section className="landing container" aria-labelledby="uses-title">
      <SectionHead id="uses-title" title={t(`${base}.title`)} />
      <ul className="range-list range-list--wide">
        {uses.items.map((item) => {
          const count = countFor(item.params, overview);

          return (
            <li key={item.id}>
              <button
                type="button"
                className="range-tile"
                disabled={count === 0}
                onClick={() => onSelect(item.params)}
              >
                <span className="range-tile__label">{t(`${base}.items.${item.id}.title`)}</span>
                <span className="range-tile__text">{t(`${base}.items.${item.id}.text`)}</span>
                {count !== null && (
                  <span className="range-tile__count numeric">
                    {count
                      ? t(`zones.${category.key}.count`, { count })
                      : t("landing.none", { zone: category.key })}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function FitGuide({ category, overview, onSelect }) {
  const { t } = useI18n();
  const { fit } = category.landing;
  const sizes = overview?.facets.frameSize || {};
  const base = `zones.${category.key}.landing.fit`;

  return (
    <section className="landing container" aria-labelledby="fit-title">
      <div className="fit">
        <SectionHead id="fit-title" title={t(`${base}.title`)} text={t(`${base}.text`)} />
        <table className="fit-table">
          <thead>
            <tr>
              <th scope="col">{t("landing.fit.height")}</th>
              <th scope="col">{t("attributes.frameSize.label")}</th>
              <th scope="col">
                <span className="visually-hidden">{t(`zones.${category.key}.forSale`)}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {fit.rows.map((row) => {
              const count = sizes[row.size] || 0;

              return (
                <tr key={row.size}>
                  <td className="numeric">{t(`${base}.heights.${row.size}`)}</td>
                  <td>
                    <strong>{row.size}</strong>
                  </td>
                  <td className="fit-table__action">
                    {count > 0 ? (
                      <button type="button" className="text-link" onClick={() => onSelect({ frameSize: row.size })}>
                        {t("landing.fit.show", { count })}
                      </button>
                    ) : (
                      <span className="fit-table__none">{t("landing.fit.none")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PopularSearches({ category, onSelect }) {
  const { t } = useI18n();

  return (
    <section className="landing container" aria-labelledby="searches-title">
      <SectionHead id="searches-title" title={t("landing.searches")} />
      <ul className="search-links">
        {category.landing.searches.map((item) => (
          <li key={item.id}>
            <button type="button" className="search-link" onClick={() => onSelect(item.params)}>
              {t(`zones.${category.key}.landing.searches.${item.id}`)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
