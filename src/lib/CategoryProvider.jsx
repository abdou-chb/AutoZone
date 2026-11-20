import { useLayoutEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { CategoryContext } from "./category-context";
import { CATEGORIES, categoryFromPath, DEFAULT_CATEGORY, getCategory, isCategoryKey } from "./categories";
import { useSite } from "./site-context";
import { isZoneVisible } from "./site-settings";

function faviconFor({ accent, ink }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="5.5" y="5.5" width="21" height="21" rx="3.5" transform="rotate(45 16 16)" fill="${accent}" stroke="#18212b" stroke-width="2.5"/><rect x="14.6" y="9" width="2.8" height="5" rx="1" fill="${ink}"/><rect x="14.6" y="18" width="2.8" height="5" rx="1" fill="${ink}"/></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function CategoryProvider({ children }) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const [lastKey, setLastKey] = useState(DEFAULT_CATEGORY);

  const settings = useSite();

  const queryKey = searchParams.get("category");
  const wanted = categoryFromPath(pathname) || (isCategoryKey(queryKey) ? queryKey : lastKey);
  const key = [wanted, lastKey, ...CATEGORIES.map((item) => item.key)].find((item) => isZoneVisible(settings, item)) || wanted;

  if (key !== lastKey) {
    setLastKey(key);
  }

  const category = getCategory(key);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const { accent, hover, ink } = category.theme;

    root.dataset.category = category.key;
    root.style.setProperty("--signal", accent);
    root.style.setProperty("--signal-hover", hover);
    root.style.setProperty("--signal-ink", ink);

    const icon = document.querySelector('link[rel="icon"]');

    if (icon) {
      icon.href = faviconFor(category.theme);
    }
  }, [category]);

  return <CategoryContext.Provider value={category}>{children}</CategoryContext.Provider>;
}
