import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { CircleAlert, Heart, Info, RotateCw } from "lucide-react";
import ListingCard, { ListingCardSkeleton } from "../components/ListingCard";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import { toListingPage } from "../lib/api";
import { useCategory } from "../lib/category-context";
import useStaggerIn from "../lib/motion/useStaggerIn";
import { useSavedCars } from "../lib/saved-context";
import { scrollToTop } from "../lib/scroll";
import { useToast } from "../lib/toast-context";
import usePagedParams from "../lib/usePagedParams";
import useResource from "../lib/useResource";
import { useI18n } from "../i18n/i18n-context";
import "./Saved.css";

const PAGE_SIZE = 12;

function asIs(data) {
  return data;
}

export default function Saved() {
  const { savedIds, removeSaved } = useSavedCars();
  const category = useCategory();
  const { t } = useI18n();
  const showToast = useToast();
  const { page, hrefFor, setPage, clampPage } = usePagedParams("saved");
  const gridRef = useRef(null);

  const checkedIds = savedIds.slice(0, 100);
  const available = useResource(
    checkedIds.length ? `/api/cars/available?ids=${checkedIds.join(",")}` : null,
    asIs,
    "saved"
  );
  const availableIds = available.data ? new Set(available.data.ids) : null;
  const forSale = availableIds ? checkedIds.filter((id) => availableIds.has(id)) : [];
  const pages = Math.max(1, Math.ceil(forSale.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageIds = forSale.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const details = useResource(
    pageIds.length ? `/api/cars?ids=${pageIds.join(",")}&pageSize=${PAGE_SIZE}` : null,
    toListingPage,
    "saved"
  );
  const byId = new Map((details.data?.listings || []).map((listing) => [listing.id, listing]));
  const savedListings = pageIds.map((id) => byId.get(id)).filter(Boolean);

  const loading = available.loading || (pageIds.length > 0 && details.loading && !details.stale);
  const error = available.error || details.error;
  const retry = available.error ? available.retry : details.retry;
  const deletedIds = available.data?.deleted || [];
  const goneIds = availableIds
    ? savedIds.filter((id) => !availableIds.has(id) && checkedIds.includes(id) && !deletedIds.includes(id))
    : [];

  useStaggerIn(gridRef, details.data && !details.stale ? pageIds.join(",") : "");

  const checked = Boolean(available.data);
  const deletedKey = deletedIds.join(",");

  useEffect(() => {
    if (deletedKey) {
      deletedKey.split(",").map(Number).forEach(removeSaved);
    }
  }, [deletedKey, removeSaved]);

  useEffect(() => {
    if (checked) {
      clampPage(pages);
    }
  }, [checked, pages, clampPage]);

  useEffect(() => {
    document.title = t("saved.pageTitle", { brand: category.brand });
  }, [category.brand, t]);

  const browseLink = (
    <Link to={category.home} className="btn btn--primary">
      {t(`zones.${category.key}.browse`)}
    </Link>
  );

  function changePage(target) {
    setPage(target);
    scrollToTop();
  }

  function removeGone() {
    goneIds.forEach(removeSaved);
    showToast(t("saved.gone.removed", { count: goneIds.length }));
  }

  function renderContent() {
    if (!savedIds.length) {
      return (
        <EmptyState icon={Heart} title={t("saved.empty.title")} action={browseLink}>
          {t("saved.empty.text")}
        </EmptyState>
      );
    }

    if (loading) {
      return (
        <div className="car-grid" aria-hidden="true">
          {savedIds.slice(0, 6).map((id) => (
            <ListingCardSkeleton key={id} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="notice notice--stop saved-page__error" role="alert">
          <CircleAlert size={20} aria-hidden="true" />
          <div className="saved-page__notice-body">
            <p>
              <strong>{t("saved.loadError")}</strong> {error}
            </p>
            <button type="button" className="btn btn--outline" onClick={retry}>
              <RotateCw size={18} aria-hidden="true" />
              {t("common.actions.retry")}
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        {goneIds.length > 0 && (
          <div className="notice saved-page__gone">
            <Info size={20} aria-hidden="true" />
            <div className="saved-page__notice-body saved-page__notice-body--row">
              <p>{t("saved.gone.text", { count: goneIds.length })}</p>
              <button type="button" className="btn btn--outline" onClick={removeGone}>
                {t("saved.gone.remove", { count: goneIds.length })}
              </button>
            </div>
          </div>
        )}

        {forSale.length > 0 ? (
          <>
            <div ref={gridRef} className={`car-grid${details.stale ? " is-stale" : ""}`} aria-busy={details.stale}>
              {savedListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} showZone />
              ))}
            </div>
            <Pagination
              page={current}
              pages={pages}
              hrefFor={hrefFor}
              onChange={changePage}
              busy={details.stale}
              label={t("saved.pagination")}
            />
          </>
        ) : (
          <EmptyState icon={Heart} title={t("saved.noneForSale.title")} action={browseLink}>
            {t("saved.noneForSale.text")}
          </EmptyState>
        )}
      </>
    );
  }

  return (
    <div className="container page saved-page">
      <header className="page-heading">
        <h1>{t("saved.title")}</h1>
        <p>{t("saved.lead")}</p>
      </header>

      <p className="visually-hidden" role="status">
        {loading && savedIds.length > 0 ? t("saved.loading") : ""}
        {!loading && !error && forSale.length > 0 ? t("saved.count", { count: forSale.length }) : ""}
      </p>

      <div className="saved-page__content">{renderContent()}</div>
    </div>
  );
}
