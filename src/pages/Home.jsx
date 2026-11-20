import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigationType } from "react-router-dom";
import { Search, SearchX, ShieldCheck, SlidersHorizontal, UserRoundCheck, X } from "lucide-react";
import EmptyState from "../components/EmptyState";
import ListingCard, { ListingCardSkeleton } from "../components/ListingCard";
import Pagination from "../components/Pagination";
import Magnet from "../components/bits/Magnet/Magnet";
import SplitText from "../components/bits/SplitText/SplitText";
import { loadResource, toListingPage, toShelves } from "../lib/api";
import { getCategory } from "../lib/categories";
import { formatMillions, wilayaName } from "../lib/format";
import { getListingEntry, updateListingEntry } from "../lib/listing-store";
import { jumpTo, scrollToSection } from "../lib/scroll";
import usePagedParams from "../lib/usePagedParams";
import useStaggerIn from "../lib/motion/useStaggerIn";
import useResource from "../lib/useResource";
import { useSite } from "../lib/site-context";
import { isZoneVisible, zoneSettings } from "../lib/site-settings";
import { attributeLabel, optionLabel } from "../lib/attributes";
import { useI18n } from "../i18n/i18n-context";
import {
  BrandList,
  FeaturedShelf,
  FitGuide,
  PicksShelf,
  PopularSearches,
  RangeGuide,
  UseGuide,
} from "./home/Landing";
import { chipLabel, filterKeys, listingSearch, PAGE_SIZE, rangeParams, sortsFor } from "./home/listing-filters";
import { asIs, heroSource, heroSources, shelvesPath, withZoneSettings } from "./home/zone-data";
import NotFound from "./NotFound";
import "./Home.css";

const FACT_ICONS = [ShieldCheck, UserRoundCheck];

function HeroBackdrop({ image, focus, maxWidth = 2000 }) {
  const [layers, setLayers] = useState([{ id: 0, image, focus, maxWidth, ready: false }]);
  const newest = layers[layers.length - 1];

  if (newest.image !== image) {
    setLayers([...layers.slice(-1), { id: newest.id + 1, image, focus, maxWidth, ready: false }]);
  }

  function show(id) {
    setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ready: true } : layer)));
  }

  function dropOlder(id) {
    setLayers((current) => current.filter((layer) => layer.id >= id));
  }

  return (
    <div className="hero__backdrop" aria-hidden="true">
      {layers.map((layer) => (
        <img
          key={layer.id}
          className={`hero__photo${layer.ready ? " is-ready" : ""}`}
          src={heroSource(layer.image, layer.maxWidth)}
          srcSet={heroSources(layer.image, layer.maxWidth)}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          style={{ objectPosition: layer.focus }}
          onLoad={() => show(layer.id)}
          onTransitionEnd={() => layer.ready && dropOlder(layer.id)}
        />
      ))}
    </div>
  );
}

function HeroSearch({ category, overview, filters, onSearch }) {
  const { t, language } = useI18n();
  const zone = category.key;
  const [query, setQuery] = useState(filters.q || "");
  const [wilaya, setWilaya] = useState(filters.wilaya || "");
  const [max, setMax] = useState(filters.max || "");

  const names = overview?.models || [];
  const wilayas = (overview?.wilayas || [])
    .map((name) => ({ name, label: wilayaName(name) }))
    .sort((a, b) => a.label.localeCompare(b.label, language));

  function handleSubmit(event) {
    event.preventDefault();
    onSearch({ q: query.trim(), wilaya, max });
  }

  return (
    <form className="hero-search" onSubmit={handleSubmit} role="search">
      <div className="field hero-search__query">
        <label className="field__label" htmlFor="hero-query">
          {t("home.search.query", { zone })}
        </label>
        <input
          id="hero-query"
          className="input"
          type="search"
          list="hero-models"
          placeholder={t(`zones.${zone}.hero.placeholder`)}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
        <datalist id="hero-models">
          {names.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="hero-wilaya">
          {t("home.search.wilaya")}
        </label>
        <select id="hero-wilaya" className="select" value={wilaya} onChange={(event) => setWilaya(event.target.value)}>
          <option value="">{t("home.search.allWilayas")}</option>
          {wilayas.map(({ name, label }) => (
            <option key={name} value={name}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="hero-budget">
          {t("home.search.budget")}
        </label>
        <select id="hero-budget" className="select" value={max} onChange={(event) => setMax(event.target.value)}>
          <option value="">{t("home.search.anyBudget")}</option>
          {category.budgets.map((value) => (
            <option key={value} value={value}>
              {t("home.search.upTo", { amount: formatMillions(value) })}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn btn--primary btn--large hero-search__submit">
        <Search size={20} aria-hidden="true" />
        {t("home.search.submit", { zone })}
      </button>
    </form>
  );
}

export default function Home({ categoryKey }) {
  const settings = useSite();

  if (!isZoneVisible(settings, categoryKey)) {
    return <NotFound />;
  }

  return <ZoneHome categoryKey={categoryKey} settings={settings} />;
}

function ZoneHome({ categoryKey, settings }) {
  const { t, language } = useI18n();
  const category = useMemo(
    () => withZoneSettings(getCategory(categoryKey), zoneSettings(settings, categoryKey), language),
    [categoryKey, settings, language]
  );
  const { sections } = category;
  const zone = category.key;
  const [zoneSeen, setZoneSeen] = useState({ zone, switched: false });

  if (zoneSeen.zone !== zone) {
    setZoneSeen({ zone, switched: true });
  }
  const scope = `home:${category.key}`;
  const keys = filterKeys(category);
  const { searchParams, page, search, hrefFor, setPage, updateParams, clampPage } = usePagedParams(scope);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { hash } = useLocation();
  const navigationType = useNavigationType();
  const restore = useRef(navigationType === "POP" ? getListingEntry(scope) : null);
  const searchRef = useRef(search);
  const gridRef = useRef(null);

  const filters = Object.fromEntries(keys.map((key) => [key, searchParams.get(key) || ""]));
  const sorts = sortsFor(category);
  const sort = sorts.some((option) => option.value === searchParams.get("sort")) ? searchParams.get("sort") : "newest";
  const activeCount = keys.filter((key) => filters[key]).length;
  const filterAttributes = category.attributes.filter(
    (attribute) => attribute.filter && (!category.moreFilters.length || category.moreFilters.includes(attribute.key))
  );

  const pagePath = (target) =>
    `/api/cars?${listingSearch(category, {
      ...filters,
      sort: sort === "newest" ? "" : sort,
      page: String(target),
      pageSize: String(PAGE_SIZE),
    })}`;

  const grid = useResource(pagePath(page), toListingPage, category.key);
  const overview = useResource(`/api/cars/overview?category=${category.key}`, asIs, category.key).data;
  const shelves = useResource(shelvesPath(category), toShelves, category.key);
  const results = grid.data;
  const firstLoad = grid.loading && !grid.stale;
  useStaggerIn(gridRef, results && !grid.stale ? `${category.key}?${search}` : "");
  const nextPath = results && !grid.stale && page < results.pages ? pagePath(page + 1) : "";

  const browseKey = category.browse.attribute;
  const browseAttribute = category.attributes.find((attribute) => attribute.key === browseKey);
  const browseItems = category.browse.values
    .map((value) => ({ value, count: overview?.facets[browseKey]?.[value] || 0 }))
    .filter((item) => item.count > 0);

  const quickKeys = [...new Set(category.quickFilters.flatMap((quick) => Object.keys(quick.params)))];
  const quickFilters = [
    { id: "all", label: t(`zones.${zone}.all`), params: {} },
    ...category.quickFilters.map((quick) => ({ ...quick, label: quick.label ?? t(`zones.${zone}.quick.${quick.id}`) })),
  ];
  const activeQuick = quickFilters.find(
    ({ params }) =>
      quickKeys.every((key) => (params[key] || "") === filters[key]) &&
      keys.every((key) => quickKeys.includes(key) || !filters[key])
  );
  const chips = keys
    .filter((key) => filters[key])
    .map((key) => ({ key, label: chipLabel(key, filters[key], category) }));

  const steps = [
    { id: "find", title: t("home.how.find.title", { zone }), text: t("home.how.find.text", { zone }) },
    { id: "request", title: t("home.how.request.title"), text: t("home.how.request.text") },
    { id: "inspect", title: t("home.how.inspect.title", { zone }), text: t(`zones.${zone}.inspection`) },
    { id: "decide", title: t("home.how.decide.title"), text: t("home.how.decide.text", { zone }) },
  ];
  const facts = t(`zones.${zone}.hero.facts`);
  const pageTitle = t("home.documentTitle", { brand: category.brand, title: t(`zones.${zone}.pageTitle`) });

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  useEffect(() => {
    const latest = searchRef;

    return () => updateListingEntry(scope, { scrollY: window.scrollY, scrollSearch: latest.current });
  }, [scope]);

  useEffect(() => {
    const saved = restore.current;

    if (!saved || !results || grid.stale || shelves.loading) {
      return;
    }

    restore.current = null;

    if (!hash && saved.scrollSearch === search && saved.scrollY > 0) {
      jumpTo(saved.scrollY);
    }
  }, [results, grid.stale, shelves.loading, search, hash]);

  useEffect(() => {
    if (!firstLoad && hash) {
      scrollToSection(hash.slice(1));
    }
  }, [firstLoad, hash]);

  useEffect(() => {
    if (results && !grid.stale && results.page < page) {
      clampPage(results.page);
    }
  }, [results, grid.stale, page, clampPage]);

  useEffect(() => {
    if (nextPath) {
      loadResource(nextPath, toListingPage).catch(() => undefined);
    }
  }, [nextPath]);

  function updateFilters(changes, { scroll = false } = {}) {
    updateParams(changes);

    if (scroll) {
      scrollToSection("listings");
    }
  }

  function applyFilters(params) {
    updateFilters(
      { ...Object.fromEntries([...keys, "sort"].map((key) => [key, ""])), ...params },
      { scroll: true }
    );
  }

  function applyQuickFilter(params) {
    updateFilters({ ...Object.fromEntries(quickKeys.map((key) => [key, ""])), ...params });
  }

  function clearAll() {
    updateFilters(Object.fromEntries(keys.map((key) => [key, ""])));
  }

  function changePage(target) {
    setPage(target);
    scrollToSection("listings");
  }

  function renderResults() {
    if (grid.error && !results) {
      return (
        <div className="notice notice--stop listings__error">
          <span>{grid.error}</span>
          <button
            type="button"
            className="btn btn--outline btn--small"
            onClick={activeCount ? clearAll : grid.retry}
          >
            {t(activeCount ? "common.actions.clearFilters" : "common.actions.tryAgain")}
          </button>
        </div>
      );
    }

    if (firstLoad) {
      return (
        <div className="car-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <ListingCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (!results.total) {
      return (
        <EmptyState
          icon={activeCount ? SearchX : category.icon}
          title={t(activeCount ? "home.listings.noMatch" : "home.listings.none", { zone })}
          action={
            activeCount ? (
              <button type="button" className="btn btn--dark" onClick={clearAll}>
                {t("common.actions.clearFilters")}
              </button>
            ) : (
              <Link to={`/sell?category=${category.key}`} className="btn btn--primary">
                {t(`zones.${zone}.sell`)}
              </Link>
            )
          }
        >
          {activeCount
            ? t("home.listings.noMatchText")
            : t("home.listings.noneText", { zone, brand: category.brand })}
        </EmptyState>
      );
    }

    const from = (results.page - 1) * results.pageSize + 1;
    const to = from + results.listings.length - 1;

    return (
      <>
        {grid.error && (
          <div className="notice notice--stop listings__error">
            <span>{grid.error}</span>
            <button type="button" className="btn btn--outline btn--small" onClick={grid.retry}>
              {t("common.actions.tryAgain")}
            </button>
          </div>
        )}
        <div ref={gridRef} className={`car-grid${grid.stale ? " is-stale" : ""}`} aria-busy={grid.stale}>
          {results.listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
        <div className="listings__footer">
          <Pagination
            page={results.page}
            pages={results.pages}
            hrefFor={hrefFor}
            onChange={changePage}
            busy={grid.stale}
            label={t("home.listings.pages", { zone })}
          />
          {results.pages > 1 && (
            <p className="listings__range numeric">
              {t("home.listings.range", { from, to, total: results.total })}
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <section className="hero">
        <HeroBackdrop image={category.hero.image} focus={category.hero.focus} maxWidth={category.hero.maxWidth} />
        <div className="container hero__inner">
          <div className="hero__copy" key={category.key}>
            <SplitText
              tag="h1"
              text={category.heroTitle || t(`zones.${zone}.hero.title`)}
              className="display hero__title"
              splitType="words"
              mask
              effect="rise"
              trigger="load"
              delay={70}
              duration={0.9}
              textAlign="start"
            />
            <p className="hero__lead">{category.heroLead || t(`zones.${zone}.hero.lead`)}</p>
          </div>

          <div className="hero__search">
            <HeroSearch
              key={`${category.key}?${language}?${["q", "wilaya", "max"].map((key) => filters[key]).join("|")}`}
              category={category}
              overview={overview}
              filters={filters}
              onSearch={(values) => updateFilters(values, { scroll: true })}
            />
          </div>

          <ul className="hero__facts">
            {facts.map((fact, index) => {
              const Icon = FACT_ICONS[index] || ShieldCheck;

              return (
                <li key={index}>
                  <Icon size={20} aria-hidden="true" />
                  {fact}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <div key={zone} className={`zone-content${zoneSeen.switched ? " is-switching" : ""}`}>
      {sections.browse && browseItems.length > 1 && (
        <section className="browse container" aria-labelledby="browse-title">
          <h2 id="browse-title" className="browse__title">
            {t(`zones.${zone}.browseTitle`)}
          </h2>
          <ul className="browse__list">
            {browseItems.map(({ value, count }) => {
              const isActive = filters[browseKey] === value;

              return (
                <li key={value}>
                  <button
                    type="button"
                    className={`browse__tile${isActive ? " is-active" : ""}`}
                    aria-pressed={isActive}
                    onClick={() => updateFilters({ [browseKey]: isActive ? "" : value }, { scroll: true })}
                  >
                    <span className="browse__name">{optionLabel(browseAttribute, value)}</span>
                    <span className="browse__count numeric">{t("home.listingCount", { count })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sections.featured && (
        <FeaturedShelf
          category={category}
          result={shelves.data?.[0]}
          loading={shelves.loading}
          onSelect={applyFilters}
        />
      )}
      {sections.picks && (
        <PicksShelf
          key={category.key}
          category={category}
          results={shelves.data?.slice(1)}
          loading={shelves.loading}
          onSelect={applyFilters}
        />
      )}
      {sections.brands && (
        <BrandList category={category} brands={overview?.brands} active={filters.brand} onSelect={applyFilters} />
      )}
      {sections.guides && category.landing.uses && (
        <UseGuide category={category} overview={overview} onSelect={applyFilters} />
      )}
      {sections.guides &&
        category.landing.ranges?.map((range) => (
          <RangeGuide
            key={range.attribute}
            category={category}
            range={range}
            counts={overview?.ranges[range.attribute]}
            paramsFor={(index) => rangeParams(category, range.attribute, index)}
            onSelect={applyFilters}
          />
        ))}
      {sections.guides && category.landing.fit && (
        <FitGuide category={category} overview={overview} onSelect={applyFilters} />
      )}
      {sections.searches && category.landing.searches && (
        <PopularSearches category={category} onSelect={applyFilters} />
      )}

      <section className="listings container" id="listings" aria-labelledby="listings-title">
        <div className="listings__head">
          <div>
            <h2 id="listings-title" className="listings__title">
              {t(`zones.${zone}.forSale`)}
            </h2>
            <p className="listings__count" role="status" aria-atomic="true">
              {firstLoad || !results
                ? t("home.listings.loading", { zone })
                : results.pages > 1
                  ? t("home.listings.foundPage", {
                      found: t("home.listings.found", { zone, count: results.total }),
                      page: results.page,
                      pages: results.pages,
                    })
                  : t("home.listings.found", { zone, count: results.total })}
            </p>
          </div>

          <div className="listings__sort">
            <label htmlFor="sort" className="listings__sort-label">
              {t("home.listings.sortBy")}
            </label>
            <select
              id="sort"
              className="select"
              value={sort}
              onChange={(event) => updateFilters({ sort: event.target.value === "newest" ? "" : event.target.value })}
            >
              {sorts.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`home.listings.sorts.${option.value}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="listings__toolbar">
          <div className="quick-filters" role="group" aria-label={t("home.listings.quickFilters")}>
            {quickFilters.map((quick) => (
              <button
                key={quick.id}
                type="button"
                className={`quick-filter${activeQuick === quick ? " is-active" : ""}`}
                aria-pressed={activeQuick === quick}
                onClick={() => applyQuickFilter(quick.params)}
              >
                {quick.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn--outline btn--small listings__more"
            aria-expanded={filtersOpen}
            aria-controls="more-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            {t("home.listings.moreFilters")}
          </button>
        </div>

        <div id="more-filters" className={`more-filters${filtersOpen ? " is-open" : ""}`}>
          <div className="field">
            <label className="field__label" htmlFor="filter-condition">
              {t("home.listings.condition")}
            </label>
            <select
              id="filter-condition"
              className="select"
              value={filters.condition}
              onChange={(event) => updateFilters({ condition: event.target.value })}
            >
              <option value="">{t("home.listings.newAndUsed")}</option>
              <option value="New">{t("common.condition.New")}</option>
              <option value="Used">{t("common.condition.Used")}</option>
            </select>
          </div>

          {filterAttributes.map((attribute) => {
            const value = filters[attribute.key];
            const custom = attribute.type === "select" && value && !attribute.options.includes(value);

            return (
              <div className="field" key={attribute.key}>
                <label className="field__label" htmlFor={`filter-${attribute.key}`}>
                  {attributeLabel(attribute, zone)}
                </label>
                <select
                  id={`filter-${attribute.key}`}
                  className="select"
                  value={value}
                  onChange={(event) => updateFilters({ [attribute.key]: event.target.value })}
                >
                  <option value="">{t("home.listings.any")}</option>
                  {custom && <option value={value}>{chipLabel(attribute.key, value, category)}</option>}
                  {attribute.type === "boolean" ? (
                    <>
                      <option value="true">{t("attributes.yes")}</option>
                      <option value="false">{t("attributes.no")}</option>
                    </>
                  ) : (
                    attribute.options.map((option) => (
                      <option key={option} value={option}>
                        {optionLabel(attribute, option)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            );
          })}

          <div className="field">
            <label className="field__label" htmlFor="filter-max">
              {t("home.listings.maxPrice")}
            </label>
            <select
              id="filter-max"
              className="select"
              value={filters.max}
              onChange={(event) => updateFilters({ max: event.target.value })}
            >
              <option value="">{t("home.search.anyBudget")}</option>
              {category.budgets.map((value) => (
                <option key={value} value={value}>
                  {t("home.search.upTo", { amount: formatMillions(value) })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="active-filters">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="active-filter"
                onClick={() => updateFilters({ [chip.key]: "" })}
              >
                {chip.label}
                <X size={14} aria-hidden="true" />
                <span className="visually-hidden">{t("home.listings.removeFilter")}</span>
              </button>
            ))}
            {activeCount > 1 && (
              <button type="button" className="btn btn--ghost btn--small" onClick={clearAll}>
                {t("common.actions.clearAll")}
              </button>
            )}
          </div>
        )}

        {renderResults()}
      </section>

      {sections.how && (
        <section className="how" id="how-it-works" aria-labelledby="how-title">
          <div className="container">
            <h2 id="how-title" className="how__title display">
              {t("home.how.title")}
            </h2>
            <ol className="how__steps">
              {steps.map((step, index) => (
                <li key={step.id} className="how__step">
                  <span className="how__marker display" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
            <Link to="/track" className="text-link">
              {t("home.how.track")}
            </Link>
          </div>
        </section>
      )}

      {sections.sell && (
        <section className="container home-sell" aria-labelledby="home-sell-title">
          <div className="home-sell__inner">
            <div>
              <h2 id="home-sell-title" className="display home-sell__title">
                {t("home.sell.title", { zone })}
              </h2>
              <p>{t("home.sell.text", { zone, brand: category.brand })}</p>
            </div>
            <Magnet padding={60} magnetStrength={4}>
              <Link to={`/sell?category=${category.key}`} className="btn btn--primary btn--large">
                {t(`zones.${zone}.sell`)}
              </Link>
            </Magnet>
          </div>
        </section>
      )}
      </div>
    </>
  );
}
