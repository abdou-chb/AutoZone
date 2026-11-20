import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useI18n } from "../i18n/i18n-context";
import { useSite } from "../lib/site-context";
import { localized } from "../lib/site-settings";
import "./AnnouncementBar.css";

const DISMISSED_KEY = "autozone:announcement";
const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert };

function readDismissed() {
  try {
    const value = JSON.parse(sessionStorage.getItem(DISMISSED_KEY));

    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveDismissed(list) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(list.slice(-10)));
  } catch {
    return;
  }
}

function AnnouncementLink({ href, children }) {
  if (href.startsWith("/")) {
    return (
      <Link to={href} className="announcement__link">
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className="announcement__link" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export default function AnnouncementBar() {
  const { t, language } = useI18n();
  const { announcement } = useSite();
  const [dismissed, setDismissed] = useState(readDismissed);
  const text = localized(announcement.text, language);
  const id = [announcement.text.en, announcement.text.fr, announcement.text.ar, announcement.link].join("|");

  if (!announcement.enabled || !text || dismissed.includes(id)) {
    return null;
  }

  const tone = ICONS[announcement.tone] ? announcement.tone : "info";
  const Icon = ICONS[tone];

  function dismiss() {
    const next = [...dismissed, id];

    saveDismissed(next);
    setDismissed(next);
  }

  return (
    <section className={`announcement announcement--${tone}`} aria-label={t("nav.announcement.label")}>
      <div className="container announcement__inner">
        <Icon size={18} className="announcement__icon" aria-hidden="true" />
        <p className="announcement__text">
          {text}
          {announcement.link && (
            <>
              {" "}
              <AnnouncementLink href={announcement.link}>
                {t("nav.announcement.more")}
                <ArrowRight size={15} className="flip-rtl" aria-hidden="true" />
              </AnnouncementLink>
            </>
          )}
        </p>
        <button
          type="button"
          className="announcement__close"
          onClick={dismiss}
          aria-label={t("nav.announcement.dismiss")}
          title={t("nav.announcement.dismiss")}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
