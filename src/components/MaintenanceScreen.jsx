import { useEffect } from "react";
import { Mail, Phone, Wrench } from "lucide-react";
import Logo from "./Logo";
import { LanguageMenu, ThemeToggle } from "./Preferences";
import { useI18n } from "../i18n/i18n-context";
import { useCategory } from "../lib/category-context";
import { useSite } from "../lib/site-context";
import { ownText, telHref } from "../lib/site-settings";
import "./MaintenanceScreen.css";

export default function MaintenanceScreen() {
  const { t, language } = useI18n();
  const category = useCategory();
  const { maintenance, site } = useSite();
  const message = ownText(maintenance.message, language) || t("nav.maintenance.text");
  const pageTitle = t("nav.maintenance.pageTitle", { brand: category.brand });
  const phoneLink = telHref(site.phone);

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <div className="maintenance">
      <header className="container maintenance__bar">
        <Logo to={category.home} brand={category.brand} label={t("nav.home", { brand: category.brand })} />
        <div className="maintenance__prefs">
          <LanguageMenu />
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="container maintenance__main">
        <div className="maintenance__card">
          <span className="maintenance__icon">
            <Wrench size={28} aria-hidden="true" />
          </span>
          <h1 className="display maintenance__title">{t("nav.maintenance.title")}</h1>
          <p className="maintenance__message">{message}</p>

          {(phoneLink || site.email) && (
            <div className="maintenance__help">
              <p>{t("nav.maintenance.help")}</p>
              <ul className="maintenance__contact">
                {phoneLink && (
                  <li>
                    <Phone size={16} aria-hidden="true" />
                    <a href={phoneLink} className="ltr">
                      {site.phone}
                    </a>
                  </li>
                )}
                {site.email && (
                  <li>
                    <Mail size={16} aria-hidden="true" />
                    <a href={`mailto:${site.email}`} className="ltr">
                      {site.email}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
