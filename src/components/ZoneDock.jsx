import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUp, LayoutGrid, X } from "lucide-react";
import { useI18n } from "../i18n/i18n-context";
import { useCategory } from "../lib/category-context";
import { scrollToTop } from "../lib/scroll";
import { useVisibleCategories } from "../lib/site-context";
import useZoneLinks, { usePrefetchZones } from "../lib/zone-switch";
import { TUNING_ZONE, useTuningAvailable } from "../lib/tuning-zone";
import "./ZoneDock.css";

function useShownAfterZoneStrip() {
  const [shown, setShown] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const strip = document.querySelector(".zones");

    if (strip && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting), { threshold: 0 });

      observer.observe(strip);

      return () => observer.disconnect();
    }

    const onScroll = () => setShown(window.scrollY > 240);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return shown;
}

export default function ZoneDock() {
  const { t } = useI18n();
  const active = useCategory();
  const zones = useVisibleCategories();
  const shown = useShownAfterZoneStrip();
  const zoneLink = useZoneLinks();
  const prefetchZones = usePrefetchZones();
  const tuningReady = useTuningAvailable();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const toggleRef = useRef(null);
  const firstItemRef = useRef(null);
  const panelId = useId();
  const expanded = open && shown;

  useEffect(() => {
    if (!expanded) {
      return undefined;
    }

    firstItemRef.current?.focus();
    prefetchZones(zones.filter((zone) => zone.key !== active.key).map((zone) => zone.key));

    function close(event) {
      if (event.type === "keydown") {
        if (event.key === "Escape") {
          setOpen(false);
          toggleRef.current?.focus();
        }

        return;
      }

      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);

    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [expanded, prefetchZones, zones, active.key]);

  function backToTop() {
    setOpen(false);
    scrollToTop();
    document.getElementById("main")?.focus({ preventScroll: true });
  }

  const items = zones.length > 1 ? zones : [];

  return (
    <div
      ref={rootRef}
      className={`zone-dock${shown ? " is-shown" : ""}${expanded ? " is-open" : ""}`}
      inert={!shown}
      style={{ "--dock-accent": active.theme.accent }}
    >
      <nav id={panelId} className="zone-dock__panel" aria-label={t("nav.dock.label")} inert={!expanded}>
        <ul className="zone-dock__list">
          {items.map((zone, index) => {
            const Icon = zone.icon;
            const isActive = zone.key === active.key;

            return (
              <li key={zone.key} style={{ "--i": items.length - index }}>
                <Link
                  ref={index === 0 ? firstItemRef : undefined}
                  to={zone.home}
                  className={`zone-dock__item${isActive ? " is-active" : ""}`}
                  style={{ "--zone": zone.theme.accent }}
                  aria-current={isActive ? "true" : undefined}
                  {...zoneLink(zone.key, () => setOpen(false))}
                >
                  <span className="zone-dock__icon">
                    <Icon size={18} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="zone-dock__label">{zone.brand}</span>
                  {isActive && <span className="visually-hidden">{t("nav.dock.current")}</span>}
                </Link>
              </li>
            );
          })}
          {tuningReady && (
          <li style={{ "--i": 0 }}>
            <Link
              to={TUNING_ZONE.home}
              className="zone-dock__item zone-dock__item--tuning"
              onClick={() => setOpen(false)}
            >
              <span className="zone-dock__icon">
                <TUNING_ZONE.icon size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="zone-dock__label">{TUNING_ZONE.brand}</span>
            </Link>
          </li>
          )}
          <li style={{ "--i": 0 }}>
            <button
              ref={items.length ? undefined : firstItemRef}
              type="button"
              className="zone-dock__item zone-dock__item--top"
              onClick={backToTop}
            >
              <span className="zone-dock__icon">
                <ArrowUp size={18} strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="zone-dock__label">{t("nav.dock.top")}</span>
            </button>
          </li>
        </ul>
      </nav>

      <button
        ref={toggleRef}
        type="button"
        className="zone-dock__toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={t(expanded ? "nav.dock.close" : "nav.dock.open")}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="zone-dock__glyph zone-dock__glyph--open" aria-hidden="true">
          <LayoutGrid size={22} strokeWidth={2} />
        </span>
        <span className="zone-dock__glyph zone-dock__glyph--close" aria-hidden="true">
          <X size={22} strokeWidth={2.25} />
        </span>
      </button>
    </div>
  );
}
