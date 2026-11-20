import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useI18n } from "../../i18n/i18n-context";
import { useToast } from "../../lib/toast-context";
import { AdminContext } from "./admin-context";
import AdminShell from "./AdminShell";
import OverviewPage from "./OverviewPage";
import useNotifications, { notificationText } from "./useNotifications";
import { readToken, useAdminSession } from "./useAdminSession";
import ListingsPage from "./listings/ListingsPage";
import ListingEditPage from "./listings/ListingEditPage";
import BrandsPage from "./brands/BrandsPage";
import InspectionsPage from "./inspections/InspectionsPage";
import MessagesPage from "./messages/MessagesPage";
import CarRequestsPage from "./car-requests/CarRequestsPage";
import RepairRequestsPage from "./repair-requests/RepairRequestsPage";
import ZonesPage from "./settings/ZonesPage";
import SettingsPage from "./settings/SettingsPage";
import TeamPage from "./settings/TeamPage";
import ActivityPage from "./settings/ActivityPage";
import AccountPage from "./settings/AccountPage";
import "../../components/layout.css";
import "./admin.css";
import "./admin-shell.css";

function Console() {
  const { t } = useI18n();
  const showToast = useToast();
  const { request, logout } = useAdminSession();
  const [me, setMe] = useState(null);

  const onNew = useCallback(
    (items) => items.slice(0, 2).forEach((item) => showToast(notificationText(item), { tone: "success", duration: 6000 })),
    [showToast]
  );
  const { summary, refresh, markRead } = useNotifications(request, onNew);

  useEffect(() => {
    const controller = new AbortController();

    request("/api/admin/me", { signal: controller.signal })
      .then((data) => setMe(data.admin))
      .catch(() => undefined);

    return () => controller.abort();
  }, [request]);

  useEffect(() => {
    const unread = summary?.unread || 0;
    const base = t("adminShell.documentTitle");

    document.title = unread ? `(${unread}) ${base}` : base;
  }, [summary, t]);

  const value = useMemo(
    () => ({
      request,
      logout,
      me,
      setMe,
      isOwner: me?.role === "owner",
      summary,
      refreshSummary: refresh,
      markRead,
    }),
    [request, logout, me, summary, refresh, markRead]
  );

  return (
    <AdminContext.Provider value={value}>
      <AdminShell>
        <Routes>
          <Route index element={<OverviewPage />} />
          <Route path="listings" element={<ListingsPage />} />
          <Route path="listings/:id" element={<ListingEditPage />} />
          <Route path="inspections" element={<InspectionsPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="messages/:id" element={<MessagesPage />} />
          <Route path="car-requests" element={<CarRequestsPage />} />
          <Route path="car-requests/:id" element={<CarRequestsPage />} />
          <Route path="repair-requests" element={<RepairRequestsPage />} />
          <Route path="repair-requests/:id" element={<RepairRequestsPage />} />
          <Route path="brands" element={<BrandsPage />} />
          <Route path="zones" element={<ZonesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminShell>
    </AdminContext.Provider>
  );
}

export default function AdminApp() {
  if (!readToken()) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Console />;
}
