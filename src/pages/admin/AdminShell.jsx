import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  CarFront,
  Wrench,
  ExternalLink,
  FileCheck2,
  History,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Tags,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Logo from "../../components/Logo";
import { LanguageMenu, ThemeToggle } from "../../components/Preferences";
import { useI18n } from "../../i18n/i18n-context";
import { formatRelativeDay } from "../../lib/format";
import { useAdmin } from "./admin-context";
import { notificationText } from "./useNotifications";

const NOTIFICATION_LINKS = {
  message: (id) => `/admin/messages/${id}`,
  listing: (id) => `/admin/listings/${id}`,
  inspection: (id) => `/admin/inspections?request=${id}`,
  tuning: (id) => `/admin/car-requests/${id}`,
  repair: (id) => `/admin/repair-requests/${id}`,
};

const NOTIFICATION_ICONS = { message: Mail, listing: CarFront, inspection: CalendarDays, tuning: FileCheck2, repair: Wrench };

function useCloseOnOutside(open, setOpen, ref) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function close(event) {
      if (event.type === "keydown" ? event.key === "Escape" : !ref.current?.contains(event.target)) {
        setOpen(false);

        if (event.type === "keydown") {
          ref.current?.querySelector("button")?.focus();
        }
      }
    }

    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);

    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, setOpen, ref]);
}

function NotificationBell() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { summary, markRead } = useAdmin();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(() => ("Notification" in window ? Notification.permission : "denied"));
  const rootRef = useRef(null);
  const unread = summary?.unread || 0;

  useCloseOnOutside(open, setOpen, rootRef);

  function openItem(item) {
    setOpen(false);

    if (!item.read_at) {
      markRead([item.id]);
    }

    navigate(NOTIFICATION_LINKS[item.type]?.(item.ref_id) || "/admin");
  }

  async function enableAlerts() {
    setPermission(await Notification.requestPermission());
  }

  return (
    <div className="admin-bell" ref={rootRef}>
      <button
        type="button"
        className="admin-icon-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread ? t("adminShell.notifications.labelUnread", { count: unread }) : t("adminShell.notifications.label")}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && <span className="admin-bell__count numeric">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="admin-popover admin-bell__panel" role="dialog" aria-label={t("adminShell.notifications.label")}>
          <div className="admin-bell__head">
            <strong>{t("adminShell.notifications.label")}</strong>
            {unread > 0 && (
              <button type="button" className="admin-link-btn" onClick={() => markRead()}>
                {t("adminShell.notifications.markAll")}
              </button>
            )}
          </div>

          {summary?.latest?.length ? (
            <ul className="admin-bell__list">
              {summary.latest.map((item) => {
                const Icon = NOTIFICATION_ICONS[item.type] || Bell;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`admin-bell__item${item.read_at ? "" : " is-unread"}`}
                      onClick={() => openItem(item)}
                    >
                      <span className={`admin-bell__icon admin-bell__icon--${item.type}`}>
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="admin-bell__text">
                        <span>{notificationText(item)}</span>
                        <span className="admin-bell__time">{formatRelativeDay(item.created_at)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="admin-bell__empty">{t("adminShell.notifications.empty")}</p>
          )}

          {permission === "default" && (
            <button type="button" className="btn btn--outline btn--small admin-bell__alerts" onClick={enableAlerts}>
              {t("adminShell.notifications.enableAlerts")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { t } = useI18n();
  const { me, logout } = useAdmin();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useCloseOnOutside(open, setOpen, rootRef);

  const initials = (me?.name || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="admin-user" ref={rootRef}>
      <button
        type="button"
        className="admin-user__button"
        aria-expanded={open}
        aria-label={t("adminShell.user.menu")}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="admin-user__avatar">{initials}</span>
        <span className="admin-user__name">{me?.name}</span>
      </button>

      {open && (
        <div className="admin-popover admin-user__panel">
          <div className="admin-user__who">
            <strong>{me?.name}</strong>
            <span className="ltr">{me?.email}</span>
            <span className="badge">{me ? t(`adminShell.roles.${me.role}`) : ""}</span>
          </div>
          <Link className="admin-user__item" to="/admin/account" onClick={() => setOpen(false)}>
            <UserRound size={17} aria-hidden="true" />
            {t("adminShell.nav.account")}
          </Link>
          <button type="button" className="admin-user__item" onClick={logout}>
            <LogOut size={17} aria-hidden="true" className="flip-rtl" />
            {t("adminShell.user.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminShell({ children }) {
  const { t } = useI18n();
  const { summary, isOwner, me } = useAdmin();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(location.pathname);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const wasOpen = useRef(false);
  const counts = summary?.counts || {};

  if (openedAt !== location.pathname) {
    setOpenedAt(location.pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (menuOpen) {
      wasOpen.current = true;
      closeButtonRef.current?.focus();

      const onKey = (event) => event.key === "Escape" && setMenuOpen(false);

      document.addEventListener("keydown", onKey);

      return () => document.removeEventListener("keydown", onKey);
    }

    if (wasOpen.current) {
      wasOpen.current = false;

      if (!document.activeElement || document.activeElement === document.body || document.activeElement.closest(".console__side")) {
        menuButtonRef.current?.focus();
      }
    }

    return undefined;
  }, [menuOpen]);

  const groups = [
    {
      key: "work",
      items: [
        { to: "/admin", end: true, icon: LayoutDashboard, label: "overview" },
        { to: "/admin/listings", icon: CarFront, label: "listings", count: counts.listings },
        { to: "/admin/inspections", icon: CalendarDays, label: "inspections", count: counts.inspections },
        { to: "/admin/messages", icon: Mail, label: "messages", count: counts.messages },
        { to: "/admin/car-requests", icon: FileCheck2, label: "carRequests", count: counts.carRequests },
        { to: "/admin/repair-requests", icon: Wrench, label: "repairRequests", count: counts.repairRequests },
      ],
    },
    {
      key: "catalogue",
      items: [
        { to: "/admin/brands", icon: Tags, label: "brands" },
        { to: "/admin/zones", icon: SlidersHorizontal, label: "zones" },
      ],
    },
    {
      key: "system",
      items: [
        { to: "/admin/settings", icon: Settings, label: "settings", owner: true },
        { to: "/admin/team", icon: Users, label: "team", owner: true },
        { to: "/admin/activity", icon: History, label: "activity" },
      ],
    },
  ];

  return (
    <div className={`console${menuOpen ? " is-menu-open" : ""}`}>
      <aside className="console__side" aria-label={t("adminShell.nav.label")}>
        <div className="console__brand">
          <Logo to="/admin" brand="AutoZone" tone="light" suffix={t("admin.brandSuffix")} />
          <button
            type="button"
            ref={closeButtonRef}
            className="admin-icon-btn console__close"
            aria-label={t("adminShell.nav.close")}
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="console__nav">
          {groups.map((group) => (
            <div key={group.key} className="console__group">
              <p className="console__group-title">{t(`adminShell.nav.groups.${group.key}`)}</p>
              <ul>
                {group.items
                  .filter((item) => !item.owner || isOwner)
                  .map((item) => {
                    const Icon = item.icon;

                    return (
                      <li key={item.to}>
                        <NavLink to={item.to} end={item.end} className="console__link">
                          <Icon size={19} aria-hidden="true" />
                          <span>{t(`adminShell.nav.${item.label}`)}</span>
                          {item.count > 0 && (
                            <span
                              className="console__count numeric"
                              aria-label={t("adminShell.nav.pending", { count: item.count })}
                            >
                              {item.count}
                            </span>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>

        <a className="console__site" href="/" target="_blank" rel="noreferrer">
          <ExternalLink size={17} aria-hidden="true" />
          {t("adminShell.viewSite")}
          <span className="visually-hidden">{t("adminShell.newTab")}</span>
        </a>
      </aside>

      <button
        type="button"
        className="console__scrim"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setMenuOpen(false)}
      />

      <div className="console__body" inert={menuOpen}>
        <header className="console__top">
          <button
            type="button"
            ref={menuButtonRef}
            className="admin-icon-btn console__menu"
            aria-label={t("adminShell.nav.open")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="console__tools">
            <LanguageMenu />
            <ThemeToggle />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main className="console__main" id="admin-main">
          {me?.mustChangePassword && location.pathname !== "/admin/account" && (
            <div className="notice notice--wait console__security" role="status">
              <ShieldAlert size={20} aria-hidden="true" />
              <p>{t("adminShell.security.mustChange")}</p>
              <Link to="/admin/account" className="btn btn--dark btn--small">
                {t("adminShell.security.changeNow")}
              </Link>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
