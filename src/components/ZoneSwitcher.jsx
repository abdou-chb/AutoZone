import { Link, useLocation } from "react-router-dom";
import { useCategory } from "../lib/category-context";
import { useVisibleCategories } from "../lib/site-context";
import { useI18n } from "../i18n/i18n-context";
import useZoneLinks from "../lib/zone-switch";
import { TUNING_ZONE, useTuningAvailable } from "../lib/tuning-zone";

export default function ZoneSwitcher() {
  const active = useCategory();
  const { t } = useI18n();
  const zones = useVisibleCategories();
  const zoneLink = useZoneLinks();
  const inTuning = useLocation().pathname.startsWith(TUNING_ZONE.home);
  const tuningReady = useTuningAvailable();
  const TuningIcon = TUNING_ZONE.icon;


  return (
    <nav className="zones" aria-label={t("nav.marketplaces")}>
      <div className="container">
        <ul className="zones__list">
          {zones.map((category) => {
            const Icon = category.icon;
            const isActive = !inTuning && category.key === active.key;

            return (
              <li key={category.key}>
                <Link
                  to={category.home}
                  className={`zones__link${isActive ? " is-active" : ""}`}
                  style={{ "--zone": category.theme.accent }}
                  aria-current={isActive ? "true" : undefined}
                  {...zoneLink(category.key)}
                >
                  <Icon size={17} strokeWidth={2} aria-hidden="true" />
                  <span>{category.brand}</span>
                </Link>
              </li>
            );
          })}
          {(tuningReady || inTuning) && (
          <li className="zones__tuning">
            <Link
              to={TUNING_ZONE.home}
              className={`zones__link zones__link--tuning${inTuning ? " is-active" : ""}`}
              style={{ "--zone": TUNING_ZONE.accent }}
              aria-current={inTuning ? "true" : undefined}
            >
              <TuningIcon size={17} strokeWidth={2} aria-hidden="true" />
              <span>{TUNING_ZONE.brand}</span>
            </Link>
          </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
