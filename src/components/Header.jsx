import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart, Menu, X } from "lucide-react";
import AnnouncementBar from "./AnnouncementBar";
import Logo from "./Logo";
import { LanguageMenu, ThemeToggle } from "./Preferences";
import { useI18n } from "../i18n/i18n-context";
import ZoneSwitcher from "./ZoneSwitcher";
import { useCategory } from "../lib/category-context";
import { useSavedCars } from "../lib/saved-context";
import { useSite } from "../lib/site-context";
import { zoneSettings } from "../lib/site-settings";
import { scrollToSection, scrollToTop } from "../lib/scroll";

function navLinks(category, showHow, t) {
  const { home } = category;
  const sectionLink = home === "/" ? "/#how-it-works" : `${home}#how-it-works`;

  return [
    {
      to: home,
      label: t(`zones.${category.key}.buy`),
      section: null,
      isActive: ({ pathname, hash }) => pathname === home && !hash,
    },
    showHow && {
      to: sectionLink,
      label: t("nav.howItWorks"),
      section: "how-it-works",
      isActive: ({ pathname, hash }) => pathname === home && hash === "#how-it-works",
    },
    {
      to: "/track",
      label: t("nav.track"),
      isActive: ({ pathname }) => pathname === "/track",
    },
    {
      to: "/contact",
      label: t("nav.contact"),
      isActive: ({ pathname }) => pathname === "/contact",
    },
  ].filter(Boolean);
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { savedIds } = useSavedCars();
  const category = useCategory();
  const location = useLocation();
  const { t } = useI18n();
  const settings = useSite();
  const links = navLinks(category, zoneSettings(settings, category.key).sections.how, t);
  const sellLabel = t(`zones.${category.key}.sell`);
  const sellLink = `/sell?category=${category.key}`;
  const headerRef = useRef(null);
  const toggleRef = useRef(null);
  const [menuPath, setMenuPath] = useState(location.pathname);

  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return undefined;

    function close(event) {
      if (event.type === "keydown") {
        if (event.key === "Escape") {
          setMenuOpen(false);
          toggleRef.current?.focus();
        }
      } else if (!headerRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    headerRef.current?.querySelector(".site-nav a")?.focus();

    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  function handleNavClick(link) {
    closeMenu();

    if (location.pathname !== category.home || link.section === undefined) {
      return;
    }

    if (link.section) {
      scrollToSection(link.section);
    } else {
      scrollToTop();
    }
  }

  return (
    <>
      <AnnouncementBar />
      <ZoneSwitcher />
      <header className="site-header" ref={headerRef}>
        <div className="container site-header__inner">
          <Logo to={category.home} brand={category.brand} label={t("nav.home", { brand: category.brand })} />

          <nav id="site-nav" className={`site-nav${menuOpen ? " is-open" : ""}`} aria-label={t("nav.main")}>
            <ul className="site-nav__list">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    onClick={() => handleNavClick(link)}
                    className={`site-nav__link${link.isActive(location) ? " is-active" : ""}`}
                    aria-current={link.isActive(location) ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to={sellLink} className="btn btn--primary site-nav__sell-mobile" onClick={closeMenu}>
              {sellLabel}
            </Link>
          </nav>

          <div className="site-header__actions">
            <div className="site-header__prefs">
              <LanguageMenu />
              <ThemeToggle />
            </div>
            <Link
              to="/saved"
              className="saved-link"
              onClick={closeMenu}
              aria-label={savedIds.length ? t("nav.savedCount", { count: savedIds.length }) : t("nav.saved")}
              aria-current={location.pathname === "/saved" ? "page" : undefined}
            >
              <Heart size={20} aria-hidden="true" />
              <span className="saved-link__label">{t("nav.saved")}</span>
              {savedIds.length > 0 && (
                <span className="saved-link__count numeric" aria-hidden="true">
                  {savedIds.length}
                </span>
              )}
            </Link>
            {location.pathname !== "/sell" && (
              <Link to={sellLink} className="btn btn--primary site-header__sell">
                {sellLabel}
              </Link>
            )}
            <button
              ref={toggleRef}
              type="button"
              className="icon-btn site-header__menu"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="site-nav"
              aria-label={t(menuOpen ? "nav.closeMenu" : "nav.openMenu")}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
