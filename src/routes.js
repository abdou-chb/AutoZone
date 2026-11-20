import { createElement, lazy, useState } from "react";
import { CATEGORIES } from "./lib/categories";

function lazyRoute(load) {
  let loaded = null;
  const preload = () =>
    load().then((module) => {
      loaded = module;

      return module;
    });
  const Lazy = lazy(preload);

  function Route(props) {
    const [Component] = useState(() => loaded?.default ?? Lazy);

    return createElement(Component, props);
  }

  Route.preload = preload;

  return Route;
}

export const Home = lazyRoute(() => import("./pages/Home"));
export const ListingDetails = lazyRoute(() => import("./pages/ListingDetails"));
export const RequestInspection = lazyRoute(() => import("./pages/RequestInspection"));
export const SellListing = lazyRoute(() => import("./pages/SellListing"));
export const TrackInspection = lazyRoute(() => import("./pages/TrackInspection"));
export const Saved = lazyRoute(() => import("./pages/Saved"));
export const Contact = lazyRoute(() => import("./pages/Contact"));
export const TuningZone = lazyRoute(() => import("./pages/tuning/TuningZone"));

const PAGES = {
  "/sell": SellListing,
  "/track": TrackInspection,
  "/saved": Saved,
  "/contact": Contact,
  "/cars": Home,
  "/tuning": TuningZone,
};

function routeFor(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (PAGES[path]) {
    return PAGES[path];
  }

  for (const category of CATEGORIES) {
    if (path === category.home) return Home;
    if (path.startsWith(`${category.base}/`)) {
      return path.endsWith("/inspection") ? RequestInspection : ListingDetails;
    }
  }

  return null;
}

export function preloadRoute(pathname) {
  const route = routeFor(pathname);

  return route ? route.preload().catch(() => undefined) : Promise.resolve();
}
