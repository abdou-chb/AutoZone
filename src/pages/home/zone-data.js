import { imageUrl, loadResource, toListingPage, toShelves } from "../../lib/api";
import { getCategory } from "../../lib/categories";
import { localized, ownText, zoneSettings } from "../../lib/site-settings";
import { listingSearch, PAGE_SIZE } from "./listing-filters";

const HERO_WIDTHS = [800, 1400, 2000];
const SIZED_URL = /([?&]w=)\d+/;
const warmed = new Set();

export function asIs(data) {
  return data;
}

export function heroSource(url, width) {
  return url.replace(SIZED_URL, `$1${width}`);
}

export function heroSources(url, maxWidth) {
  if (!SIZED_URL.test(url)) {
    return undefined;
  }

  return HERO_WIDTHS.filter((width) => width <= maxWidth)
    .concat(HERO_WIDTHS.includes(maxWidth) ? [] : [maxWidth])
    .map((width) => `${heroSource(url, width)} ${width}w`)
    .join(", ");
}

export function withZoneSettings(category, zone, language) {
  return {
    ...category,
    hero: zone.hero.image ? { image: imageUrl(zone.hero.image), focus: "center" } : category.hero,
    heroTitle: ownText(zone.hero.title, language),
    heroLead: ownText(zone.hero.lead, language),
    budgets: zone.budgets.length ? zone.budgets : category.budgets,
    quickFilters: zone.quickFilters.length
      ? zone.quickFilters.map((quick, index) => ({
          id: `custom-${index}-${quick.id}`,
          params: quick.params || {},
          label: localized(quick.label, language) || quick.id,
        }))
      : category.quickFilters,
    moreFilters: zone.filters,
    sections: zone.sections,
  };
}

export function shelvesPath(category) {
  if (!category.sections.featured && !category.sections.picks) {
    return "";
  }

  const queries = [{ featured: "true" }, ...category.landing.picks.tabs.map((tab) => tab.params)];

  return `/api/cars/batch?${new URLSearchParams(
    queries.map((params) => ["query", listingSearch(category, { ...params, pageSize: "4" })])
  )}`;
}

export function prefetchZone(zoneKey, settings, language) {
  const category = withZoneSettings(getCategory(zoneKey), zoneSettings(settings, zoneKey), language);
  const shelves = shelvesPath(category);
  const ignore = () => undefined;

  loadResource(`/api/cars?${listingSearch(category, { page: "1", pageSize: String(PAGE_SIZE) })}`, toListingPage).catch(ignore);
  loadResource(`/api/cars/overview?category=${category.key}`, asIs).catch(ignore);

  if (shelves) {
    loadResource(shelves, toShelves).catch(ignore);
  }

  const image = category.hero.image;

  if (image && !warmed.has(image)) {
    warmed.add(image);

    const preload = new Image();

    preload.decoding = "async";
    preload.sizes = "100vw";

    const sources = heroSources(image, category.hero.maxWidth || 2000);

    if (sources) {
      preload.srcset = sources;
    }

    preload.src = heroSource(image, category.hero.maxWidth || 2000);
  }
}
