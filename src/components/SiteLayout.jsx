import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import AdminBar from "./AdminBar";
import Footer from "./Footer";
import Header from "./Header";
import ZoneDock from "./ZoneDock";
import MaintenanceScreen from "./MaintenanceScreen";
import SmoothScroll from "../lib/motion/SmoothScroll";
import { useI18n } from "../i18n/i18n-context";
import { useAdminPresence } from "../lib/admin-presence";
import { useSite } from "../lib/site-context";
import "./layout.css";

function skipToContent(event) {
  event.preventDefault();
  document.getElementById("main")?.focus();
}

function PageLoading({ label }) {
  return (
    <div className="container page page-loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export default function SiteLayout() {
  const { t } = useI18n();
  const { maintenance } = useSite();
  const admin = useAdminPresence();

  if (maintenance.enabled && !admin) {
    return <MaintenanceScreen />;
  }

  return (
    <SmoothScroll>
      <a href="#main" className="skip-link" onClick={skipToContent}>
        {t("nav.skip")}
      </a>
      <AdminBar maintenance={maintenance.enabled} />
      <Header />
      <main id="main" className="site-main" tabIndex={-1}>
        <Suspense fallback={<PageLoading label={t("common.loading")} />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <ZoneDock />
    </SmoothScroll>
  );
}
