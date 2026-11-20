import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import ScrollManager from "./components/ScrollManager";
import SiteLayout from "./components/SiteLayout";
import { CATEGORIES } from "./lib/categories";
import I18nProvider from "./i18n/I18nProvider";
import CategoryProvider from "./lib/CategoryProvider";
import SavedCarsProvider from "./lib/SavedCarsProvider";
import SiteSettingsProvider from "./lib/SiteSettingsProvider";
import ToastProvider from "./lib/ToastProvider";
import NotFound from "./pages/NotFound";
import {
  Contact,
  Home,
  ListingDetails,
  RequestInspection,
  Saved,
  SellListing,
  TrackInspection,
  TuningZone,
} from "./routes";

const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminApp = lazy(() => import("./pages/admin/AdminApp"));

function CarsRedirect() {
  const { search, hash } = useLocation();

  return <Navigate to={{ pathname: "/", search, hash }} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <SiteSettingsProvider>
          <CategoryProvider>
            <SavedCarsProvider>
              <ToastProvider>
                <ScrollManager />
                <Suspense fallback={null}>
                  <Routes>
                    <Route element={<SiteLayout />}>
                      {CATEGORIES.map((category) => (
                        <Route key={category.key}>
                          <Route path={category.home} element={<Home categoryKey={category.key} />} />
                          <Route
                            path={`${category.base}/:id`}
                            element={<ListingDetails categoryKey={category.key} />}
                          />
                          <Route
                            path={`${category.base}/:id/inspection`}
                            element={<RequestInspection categoryKey={category.key} />}
                          />
                        </Route>
                      ))}
                      <Route path="cars" element={<CarsRedirect />} />
                      <Route path="sell" element={<SellListing />} />
                      <Route path="track" element={<TrackInspection />} />
                      <Route path="saved" element={<Saved />} />
                      <Route path="contact" element={<Contact />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                    <Route path="tuning" element={<TuningZone />} />
                    <Route path="admin/login" element={<AdminLogin />} />
                    <Route path="admin/*" element={<AdminApp />} />
                  </Routes>
                </Suspense>
              </ToastProvider>
            </SavedCarsProvider>
          </CategoryProvider>
        </SiteSettingsProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
