import { Link } from "react-router-dom";
import { Clock, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import Logo from "./Logo";
import { useCategory } from "../lib/category-context";
import { useSite, useVisibleCategories } from "../lib/site-context";
import { localized, SOCIAL_NETWORKS, telHref, whatsappHref } from "../lib/site-settings";
import { useI18n } from "../i18n/i18n-context";
import useZoneLinks from "../lib/zone-switch";
import { TUNING_ZONE, useTuningAvailable } from "../lib/tuning-zone";

export default function Footer() {
  const zoneLink = useZoneLinks();
  const tuningReady = useTuningAvailable();
  const category = useCategory();
  const zones = useVisibleCategories();
  const { site } = useSite();
  const { t, language } = useI18n();
  const phoneLink = telHref(site.phone);
  const whatsappLink = whatsappHref(site.whatsapp);
  const hours = localized(site.hours, language) || t("nav.footer.hours");
  const address = localized(site.address, language);
  const social = SOCIAL_NETWORKS.filter((network) => site.social?.[network.key]);

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__about">
          <Logo
            to={category.home}
            brand={category.brand}
            tone="light"
            label={t("nav.home", { brand: category.brand })}
          />
          <p>{t("nav.footer.about")}</p>
          {social.length > 0 && (
            <ul className="site-footer__social" aria-label={t("nav.footer.social")}>
              {social.map((network) => (
                <li key={network.key}>
                  <a href={site.social[network.key]} target="_blank" rel="noopener noreferrer">
                    {network.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {zones.length > 1 && (
          <div>
            <h2 className="site-footer__title">{t("nav.marketplaces")}</h2>
            <ul className="site-footer__links">
              {zones.map((zone) => {
                const Icon = zone.icon;

                return (
                  <li key={zone.key}>
                    <Link
                      to={zone.home}
                      className="site-footer__zone"
                      style={{ "--zone": zone.theme.accent }}
                      {...zoneLink(zone.key)}
                    >
                      <Icon size={16} aria-hidden="true" />
                      {zone.brand}
                    </Link>
                  </li>
                );
              })}
            {tuningReady && (
            <li>
              <Link to={TUNING_ZONE.home} className="site-footer__zone" style={{ "--zone": "var(--on-night)" }}>
                <TUNING_ZONE.icon size={16} aria-hidden="true" />
                {TUNING_ZONE.brand}
              </Link>
            </li>
            )}
            </ul>
          </div>
        )}

        <div>
          <h2 className="site-footer__title">{t("nav.footer.buyAndSell")}</h2>
          <ul className="site-footer__links">
            <li>
              <Link to={`/sell?category=${category.key}`}>{t("nav.footer.sell")}</Link>
            </li>
            <li>
              <Link to="/track">{t("nav.footer.track")}</Link>
            </li>
            <li>
              <Link to="/saved">{t("nav.footer.saved")}</Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="site-footer__title">{t("nav.footer.contact")}</h2>
          <ul className="site-footer__contact">
            {phoneLink && (
              <li>
                <Phone size={16} aria-hidden="true" />
                <a href={phoneLink} className="ltr">
                  {site.phone}
                </a>
              </li>
            )}
            {whatsappLink && (
              <li>
                <MessageCircle size={16} aria-hidden="true" />
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  {t("nav.footer.whatsapp")}
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
            {address && (
              <li>
                <MapPin size={16} aria-hidden="true" />
                <span>{address}</span>
              </li>
            )}
            <li>
              <Clock size={16} aria-hidden="true" />
              <span>{hours}</span>
            </li>
            <li>
              <Send size={16} aria-hidden="true" className="flip-rtl" />
              <Link to="/contact">{t("nav.footer.message")}</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} AutoZone</span>
        <Link to="/admin">{t("nav.footer.team")}</Link>
      </div>
    </footer>
  );
}
