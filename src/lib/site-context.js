import { createContext, useContext } from "react";
import { CATEGORIES } from "./categories";
import { DEFAULT_SETTINGS, isZoneVisible } from "./site-settings";

export const SiteContext = createContext(DEFAULT_SETTINGS);

export function useSite() {
  return useContext(SiteContext);
}

export function useVisibleCategories() {
  const settings = useSite();

  return CATEGORIES.filter((category) => isZoneVisible(settings, category.key));
}
