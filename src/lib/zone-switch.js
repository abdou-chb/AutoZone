import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "../i18n/i18n-context";
import { prefetchZone } from "../pages/home/zone-data";
import { getCategory } from "./categories";
import { glideToTop, prepareZoneSwitch } from "./scroll";
import { useSite } from "./site-context";

function isPlainClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function usePrefetchZones() {
  const settings = useSite();
  const { language } = useI18n();

  return useCallback((zoneKeys) => zoneKeys.forEach((key) => prefetchZone(key, settings, language)), [settings, language]);
}

export default function useZoneLinks() {
  const settings = useSite();
  const { language } = useI18n();
  const { pathname } = useLocation();

  return useCallback(
    (zoneKey, onAfterClick) => {
      const warm = () => prefetchZone(zoneKey, settings, language);

      return {
        onPointerEnter: warm,
        onFocus: warm,
        onTouchStart: warm,
        onClick: (event) => {
          onAfterClick?.();

          if (!isPlainClick(event)) {
            return;
          }

          if (pathname === getCategory(zoneKey).home) {
            glideToTop();
          } else {
            prepareZoneSwitch();
          }
        },
      };
    },
    [settings, language, pathname]
  );
}
