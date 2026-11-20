import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BadgeCheck,
  Ban,
  Check,
  ExternalLink,
  ImageOff,
  Inbox,
  Pencil,
  Search,
  SearchX,
  Star,
  StarOff,
  Store,
  Trash2,
  X,
} from "lucide-react";
import EmptyState from "../../../components/EmptyState";
import Pagination from "../../../components/Pagination";
import StatusBadge from "../../../components/StatusBadge";
import { useI18n } from "../../../i18n/i18n-context";
import { imageUrl } from "../../../lib/api";
import { CATEGORIES, getCategory, isCategoryKey, listingPath } from "../../../lib/categories";
import { formatDate, formatNumber, formatPrice, wilayaName } from "../../../lib/format";
import { useToast } from "../../../lib/toast-context";
import usePagedParams from "../../../lib/usePagedParams";
import { isolate } from "../admin-config";
import { useAdmin } from "../admin-context";
import ConfirmDialog from "../ConfirmDialog";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import ZoneTag from "../ZoneTag";
import { isQuietError, LISTING_STATUSES, rememberListSearch, sellerName } from "./listing-helpers";
import "./listings.css";

const PAGE_SIZE = 20;
const SORTS = ["newest", "price-asc", "price-desc", "year"];
const EMPTY_ICONS = { pending: Inbox, approved: Store, sold: BadgeCheck, rejected: Ban };
const BULK_ACTIONS = {
  pending: ["approve", "reject", "delete"],
  approved: ["feature", "unfeature", "sold", "delete"],
  sold: ["delete"],
  rejected: ["delete"],
};
const CONFIRM_TONE = { reject: "danger", sold: "dark", delete: "danger" };
const BULK_ICONS = { approve: Check, reject: X, feature: Star, unfeature: StarOff, sold: BadgeCheck, delete: Trash2 };
const NO_SELECTION = new Set();

function SkeletonTable() {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <tr key={index} className="lst-row lst-row--skeleton">
          <td className="lst-cell lst-cell--check" />
          <td className="lst-cell lst-cell--photo">
            <div className="skeleton lst-thumb" />
          </td>
          <td className="lst-cell lst-cell--vehicle">
            <div className="skeleton lst-skeleton-line lst-skeleton-line--title" />
            <div className="skeleton lst-skeleton-line" />
          </td>
          <td className="lst-cell lst-cell--price">
            <div className="skeleton lst-skeleton-line" />
          </td>
          <td className="lst-cell lst-cell--status">
            <div className="skeleton lst-skeleton-line lst-skeleton-line--short" />
          </td>
          <td className="lst-cell lst-cell--seller">
            <div className="skeleton lst-skeleton-line" />
          </td>
          <td className="lst-cell lst-cell--actions" />
        </tr>
      ))}
    </tbody>
  );
}

function IconAction({ label, icon: Icon, onClick, busy, disabled, tone = "", flip = false }) {
  return (
    <button
      type="button"
      className={`admin-icon-btn lst-action${tone ? ` lst-action--${tone}` : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : <Icon size={18} aria-hidden="true" className={flip ? "flip-rtl" : undefined} />}
    </button>
  );
}

function ListingRow({ car, selected, onSelect, busyAction, onAction }) {
  const { t } = useI18n();
  const busy = Boolean(busyAction);
  const name = `${car.name} ${car.year}`;
  const seller = sellerName(car);
  const live = car.status === "approved";

  return (
    <tr id={`lst-row-${car.id}`} tabIndex={-1} className={`lst-row${selected ? " is-selected" : ""}`} aria-busy={busy || undefined}>
      <td className="lst-cell lst-cell--check">
        <input
          type="checkbox"
          className="lst-check"
          checked={selected}
          onChange={(event) => onSelect(car.id, event.target.checked)}
          aria-label={t("adminListings.list.select", { name: isolate(name) })}
        />
      </td>
      <td className="lst-cell lst-cell--photo">
        {car.mainImage ? (
          <img className="lst-thumb" src={imageUrl(car.mainImage)} alt="" loading="lazy" />
        ) : (
          <span className="lst-thumb lst-thumb--empty">
            <ImageOff size={18} aria-hidden="true" />
            <span className="visually-hidden">{t("common.card.noPhoto")}</span>
          </span>
        )}
      </td>
      <td className="lst-cell lst-cell--vehicle">
        <Link className="lst-name" to={`/admin/listings/${car.id}`}>
          <bdi>{car.name}</bdi> <span className="lst-year numeric">{car.year}</span>
        </Link>
        <span className="lst-sub">
          <ZoneTag category={car.category} />
          {car.location && <span className="lst-dot">{wilayaName(car.location)}</span>}
        </span>
      </td>
      <td className="lst-cell lst-cell--price">
        <span className="lst-price numeric">{formatPrice(car.price)}</span>
      </td>
      <td className="lst-cell lst-cell--status">
        <StatusBadge kind="listing" status={car.status} />
        {live && (
          <button
            type="button"
            className={`lst-star${car.featured ? " is-on" : ""}`}
            aria-pressed={Boolean(car.featured)}
            aria-label={t("adminListings.list.featuredToggle", { name: isolate(name) })}
            title={t(car.featured ? "adminListings.list.featured" : "adminListings.list.notFeatured")}
            onClick={() => onAction(car, car.featured ? "unfeature" : "feature")}
            disabled={busy}
          >
            {busyAction === "feature" || busyAction === "unfeature" ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <Star size={18} aria-hidden="true" />
            )}
            <span className="lst-star__text">{t(car.featured ? "adminListings.list.featured" : "adminListings.list.feature")}</span>
          </button>
        )}
      </td>
      <td className="lst-cell lst-cell--seller">
        <span className="lst-seller">{seller ? <bdi>{seller}</bdi> : t("admin.listings.unnamedSeller")}</span>
        <span className="lst-date">{t("adminListings.list.added", { date: formatDate(car.created_at, { day: "numeric", month: "short", year: "numeric" }) })}</span>
      </td>
      <td className="lst-cell lst-cell--actions">
        <div className="lst-actions">
          {car.status === "pending" && (
            <>
              <IconAction
                label={t("adminListings.actions.approve", { name: isolate(name) })}
                icon={Check}
                tone="go"
                busy={busyAction === "approve"}
                disabled={busy}
                onClick={() => onAction(car, "approve")}
              />
              <IconAction
                label={t("adminListings.actions.reject", { name: isolate(name) })}
                icon={X}
                tone="stop"
                busy={busyAction === "reject"}
                disabled={busy}
                onClick={() => onAction(car, "reject")}
              />
            </>
          )}
          {live && (
            <>
              <IconAction
                label={t("adminListings.actions.sold", { name: isolate(name) })}
                icon={BadgeCheck}
                busy={busyAction === "sold"}
                disabled={busy}
                onClick={() => onAction(car, "sold")}
              />
              <a
                className="admin-icon-btn lst-action"
                href={listingPath(car)}
                target="_blank"
                rel="noreferrer"
                aria-label={`${t("adminListings.actions.view", { name: isolate(name) })} ${t("admin.newTab")}`}
                title={t("admin.listings.actions.view")}
              >
                <ExternalLink size={18} aria-hidden="true" className="flip-rtl" />
              </a>
            </>
          )}
          <Link
            className="admin-icon-btn lst-action"
            to={`/admin/listings/${car.id}`}
            aria-label={t("adminListings.actions.edit", { name: isolate(name) })}
            title={t("adminListings.actions.editShort")}
          >
            <Pencil size={18} aria-hidden="true" />
          </Link>
          <IconAction
            label={t("adminListings.actions.delete", { name: isolate(name) })}
            icon={Trash2}
            tone="stop"
            busy={busyAction === "delete"}
            disabled={busy}
            onClick={() => onAction(car, "delete")}
          />
        </div>
      </td>
    </tr>
  );
}

export default function ListingsPage() {
  const { t } = useI18n();
  const showToast = useToast();
  const location = useLocation();
  const { request, refreshSummary } = useAdmin();
  const { searchParams, page, hrefFor, setPage, updateParams, clampPage } = usePagedParams("admin-listings");
  const headingRef = useRef(null);
  const selectAllRef = useRef(null);
  const focusAfterRef = useRef(null);
  const searchId = useId();

  const rawStatus = searchParams.get("status");
  const status = LISTING_STATUSES.includes(rawStatus) ? rawStatus : "pending";
  const zone = isCategoryKey(searchParams.get("zone")) ? searchParams.get("zone") : "";
  const brand = zone ? searchParams.get("brand") || "" : "";
  const q = (searchParams.get("q") || "").trim();
  const sort = SORTS.includes(searchParams.get("sort")) ? searchParams.get("sort") : "newest";
  const filtered = Boolean(q || brand);

  const query = new URLSearchParams({ status, sort, page: String(page), pageSize: String(PAGE_SIZE) });
  if (zone) query.set("category", zone);
  if (q) query.set("q", q);
  if (brand) query.set("brand", brand);
  const path = `/api/admin/cars?${query}`;

  const listings = useAdminData(request, path);
  const overview = useAdminData(request, "/api/admin/overview");
  const brands = useAdminData(request, zone ? `/api/admin/brands?category=${zone}` : null);

  const [lastData, setLastData] = useState(null);
  const [draft, setDraft] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  const [selection, setSelection] = useState({ key: path, ids: NO_SELECTION });
  const [busy, setBusy] = useState({});
  const [bulkBusy, setBulkBusy] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [actionMessage, setActionMessage] = useState("");

  if (listings.data && listings.data !== lastData) {
    setLastData(listings.data);
  }

  if (q !== syncedQ) {
    setSyncedQ(q);

    if (q !== draft.trim()) {
      setDraft(q);
    }
  }

  const data = listings.data || (listings.error ? null : lastData);
  const stale = !listings.data && Boolean(data);
  const rows = data?.cars || [];
  const selectedIds = selection.key === path ? rows.filter((car) => selection.ids.has(car.id)).map((car) => car.id) : [];
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const counts = (zone ? overview.data?.listings.byZone[zone] : overview.data?.listings.byStatus) || {};

  useEffect(() => {
    rememberListSearch(location.search);
  }, [location.search]);

  useEffect(() => {
    if (listings.data && listings.data.page < page) {
      clampPage(listings.data.pages);
    }
  }, [listings.data, page, clampPage]);

  useEffect(() => {
    if (draft.trim() === q) {
      return undefined;
    }

    const timer = window.setTimeout(() => updateParams({ q: draft.trim() }), 350);

    return () => window.clearTimeout(timer);
  }, [draft, q, updateParams]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.length > 0 && !allSelected;
    }
  });

  useEffect(() => {
    if (!listings.data || !focusAfterRef.current) {
      return;
    }

    const target = document.getElementById(`lst-row-${focusAfterRef.current}`) || headingRef.current;

    focusAfterRef.current = null;
    target?.focus();
  }, [listings.data]);

  function setSelected(ids) {
    setSelection({ key: path, ids: new Set(ids) });
  }

  function toggleOne(id, checked) {
    const next = new Set(selectedIds);

    if (checked) next.add(id);
    else next.delete(id);

    setSelected(next);
  }

  function changed() {
    listings.reload();
    overview.reload();
    refreshSummary?.();
  }

  function neighbourOf(id) {
    const index = rows.findIndex((car) => car.id === id);

    return rows[index + 1]?.id ?? rows[index - 1]?.id ?? "head";
  }

  async function runSingle(car, action) {
    setBusy((current) => ({ ...current, [car.id]: action }));

    try {
      if (action === "delete") {
        await request(`/api/admin/cars/${car.id}`, { method: "DELETE" });
      } else {
        await request(`/api/admin/cars/${car.id}/${action}`, { method: "PATCH" });
      }

      const message = t(`adminListings.toasts.${action}`, { name: isolate(`${car.name} ${car.year}`) });

      if (action !== "feature" && action !== "unfeature") {
        focusAfterRef.current = neighbourOf(car.id);
      }

      setActionMessage(message);
      showToast(message, { tone: "success" });
      changed();
    } catch (error) {
      if (!isQuietError(error)) {
        showToast(error.message, { tone: "error" });
      }
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[car.id];

        return next;
      });
    }
  }

  async function runBulk(action) {
    const ids = selectedIds;

    setBulkBusy(action);

    try {
      const result = await request("/api/admin/cars/bulk", { method: "POST", body: { ids, action } });
      const skipped = ids.length - result.changed;
      const message = [
        t(`adminListings.bulk.done.${action}`, { count: result.changed }),
        skipped > 0 ? t("adminListings.bulk.skipped", { count: skipped }) : "",
      ]
        .filter(Boolean)
        .join(" ");

      setActionMessage(message);
      showToast(message, { tone: result.changed ? "success" : "error" });
      setSelected([]);

      if (action !== "feature" && action !== "unfeature") {
        focusAfterRef.current = "head";
      }

      changed();
    } catch (error) {
      if (!isQuietError(error)) {
        showToast(error.message, { tone: "error" });
      }
    } finally {
      setBulkBusy("");
    }
  }

  function handleSingle(car, action) {
    if (CONFIRM_TONE[action]) {
      setConfirm({ car, action });
    } else {
      runSingle(car, action);
    }
  }

  function handleBulk(action) {
    if (CONFIRM_TONE[action]) {
      setConfirm({ bulk: true, action, count: selectedIds.length });
    } else {
      runBulk(action);
    }
  }

  function handleConfirm() {
    const current = confirm;

    setConfirm(null);

    if (current.bulk) {
      runBulk(current.action);
    } else {
      runSingle(current.car, current.action);
    }
  }

  function clearFilters() {
    setDraft("");
    updateParams({ q: "", brand: "", zone: "", sort: "" });
  }

  let confirmProps = null;

  if (confirm?.bulk) {
    confirmProps = {
      title: t(`adminListings.bulk.confirm.${confirm.action}.title`, { count: confirm.count }),
      description: t(`adminListings.bulk.confirm.${confirm.action}.description`, { count: confirm.count }),
      confirmLabel: t(`adminListings.bulk.confirm.${confirm.action}.confirm`, { count: confirm.count }),
    };
  } else if (confirm) {
    const vars = { name: isolate(confirm.car.name), year: confirm.car.year };

    confirmProps =
      confirm.action === "delete"
        ? {
            title: t("adminListings.confirmDelete.title"),
            description: t("adminListings.confirmDelete.description", vars),
            confirmLabel: t("adminListings.confirmDelete.confirm"),
          }
        : {
            title: t(`admin.listings.confirm.${confirm.action}.title`),
            description: t(`admin.listings.confirm.${confirm.action}.description`, vars),
            confirmLabel: t(`admin.listings.confirm.${confirm.action}.confirm`),
          };
  }

  const zoneBrand = zone ? getCategory(zone).brand : "";
  let announcement = "";

  if (listings.loading) {
    announcement = t("admin.listings.loading");
  } else if (!listings.error && data) {
    const summary = t(`admin.listings.announce.${status}`, { count: data.total });

    announcement = zoneBrand ? t("admin.listings.inZone", { text: summary, zone: zoneBrand }) : summary;
  }

  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  const hasFilters = Boolean(q || zone || brand || sort !== "newest");

  return (
    <div className="lst-page">
      <div className="console-head">
        <div>
          <h1>{t("adminListings.title")}</h1>
          <p>{t("adminListings.lead")}</p>
        </div>
      </div>

      <div className="lst-tabs" role="group" aria-label={t("adminListings.filters.status")}>
        {LISTING_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            className="lst-tab"
            aria-pressed={value === status}
            onClick={() => updateParams({ status: value })}
          >
            {t(`admin.filters.listing.${value}`)}
            <span className="lst-tab__count numeric">{overview.data ? formatNumber(counts[value] || 0) : "–"}</span>
          </button>
        ))}
      </div>

      <div className="lst-filters">
        <form
          className="lst-filter lst-filter--search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ q: draft.trim() });
          }}
        >
          <label className="field__label" htmlFor={searchId}>
            {t("adminListings.filters.search")}
          </label>
          <div className="lst-search">
            <Search size={18} aria-hidden="true" className="lst-search__icon" />
            <input
              id={searchId}
              type="search"
              className="input lst-search__input"
              value={draft}
              placeholder={t("adminListings.filters.searchPlaceholder")}
              onChange={(event) => setDraft(event.target.value)}
              autoComplete="off"
              dir="auto"
            />
          </div>
        </form>

        <div className="lst-filter">
          <label className="field__label" htmlFor="lst-zone">
            {t("adminListings.filters.zone")}
          </label>
          <select
            id="lst-zone"
            className="select"
            value={zone}
            onChange={(event) => updateParams({ zone: event.target.value, brand: "" })}
          >
            <option value="">{t("adminListings.filters.allZones")}</option>
            {CATEGORIES.map((category) => (
              <option key={category.key} value={category.key}>
                {category.brand}
              </option>
            ))}
          </select>
        </div>

        <div className="lst-filter">
          <label className="field__label" htmlFor="lst-brand">
            {t("adminListings.filters.brand")}
          </label>
          <select
            id="lst-brand"
            className="select"
            value={brand}
            disabled={!zone || !brands.data}
            aria-describedby={zone ? undefined : "lst-brand-hint"}
            onChange={(event) => updateParams({ brand: event.target.value })}
          >
            <option value="">{zone ? t("adminListings.filters.allBrands") : t("adminListings.filters.chooseZone")}</option>
            {(brands.data?.brands || []).map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          {!zone && (
            <span id="lst-brand-hint" className="visually-hidden">
              {t("adminListings.filters.chooseZone")}
            </span>
          )}
        </div>

        <div className="lst-filter">
          <label className="field__label" htmlFor="lst-sort">
            {t("adminListings.filters.sort")}
          </label>
          <select
            id="lst-sort"
            className="select"
            value={sort}
            onChange={(event) => updateParams({ sort: event.target.value === "newest" ? "" : event.target.value })}
          >
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {t(`adminListings.sorts.${value}`)}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button type="button" className="btn btn--ghost lst-clear" onClick={clearFilters}>
            <X size={18} aria-hidden="true" />
            {t("common.actions.clearFilters")}
          </button>
        )}
      </div>

      <p className="visually-hidden" role="status">
        {announcement}
      </p>
      <p className="visually-hidden" role="status">
        {actionMessage}
      </p>

      <section className="console-card lst-card" aria-labelledby="lst-results">
        <div className={`lst-bar${selectedIds.length ? " is-selecting" : ""}`}>
          <label className="lst-select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="lst-check"
              checked={allSelected}
              disabled={!rows.length || stale}
              onChange={(event) => setSelected(event.target.checked ? rows.map((car) => car.id) : [])}
            />
            <span>{t("adminListings.list.selectAll")}</span>
          </label>

          <h2 id="lst-results" ref={headingRef} tabIndex={-1} className="lst-bar__title">
            {selectedIds.length
              ? t("adminListings.bulk.selected", { count: selectedIds.length })
              : data && data.total
                ? t("adminListings.list.range", { from: formatNumber(from), to: formatNumber(to), total: formatNumber(data.total) })
                : t("adminListings.list.title")}
          </h2>

          {selectedIds.length > 0 && (
            <div className="lst-bulk" role="group" aria-label={t("adminListings.bulk.label")}>
              {BULK_ACTIONS[status].map((action) => {
                const Icon = BULK_ICONS[action];

                return (
                  <button
                    key={action}
                    type="button"
                    className={`btn btn--small ${action === "delete" || action === "reject" ? "btn--danger" : action === "approve" ? "btn--success" : "btn--outline"}`}
                    onClick={() => handleBulk(action)}
                    disabled={Boolean(bulkBusy)}
                  >
                    {bulkBusy === action ? <span className="spinner" aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                    {t(`adminListings.bulk.actions.${action}`)}
                  </button>
                );
              })}
              <button type="button" className="btn btn--small btn--ghost" onClick={() => setSelected([])} disabled={Boolean(bulkBusy)}>
                {t("adminListings.bulk.clear")}
              </button>
            </div>
          )}
        </div>

        {listings.error && !data && (
          <div className="lst-state">
            <LoadError message={listings.error} onRetry={listings.reload} retrying={listings.refreshing} />
          </div>
        )}

        {!listings.error && !data && (
          <table className="lst-table">
            <SkeletonTable />
          </table>
        )}

        {data && rows.length === 0 && (
          <div className="lst-state">
            {filtered ? (
              <EmptyState
                icon={SearchX}
                title={t("adminListings.empty.filtered.title")}
                action={
                  <button type="button" className="btn btn--outline" onClick={clearFilters}>
                    {t("common.actions.clearFilters")}
                  </button>
                }
              >
                {t("adminListings.empty.filtered.text")}
              </EmptyState>
            ) : (
              <EmptyState
                icon={EMPTY_ICONS[status]}
                title={
                  zoneBrand
                    ? t(`admin.listings.empty.${status}.titleInZone`, { zone: zoneBrand })
                    : t(`admin.listings.empty.${status}.title`)
                }
              >
                {t(`admin.listings.empty.${status}.text`)}
              </EmptyState>
            )}
          </div>
        )}

        {data && rows.length > 0 && (
          <table className={`lst-table${stale ? " is-stale" : ""}`} aria-busy={stale || undefined}>
            <thead>
              <tr>
                <th scope="col" className="lst-cell--check">
                  <span className="visually-hidden">{t("adminListings.columns.select")}</span>
                </th>
                <th scope="col" className="lst-cell--photo">
                  <span className="visually-hidden">{t("adminListings.columns.photo")}</span>
                </th>
                <th scope="col">{t("adminListings.columns.vehicle")}</th>
                <th scope="col" className="lst-cell--price">{t("adminListings.columns.price")}</th>
                <th scope="col">{t("adminListings.columns.status")}</th>
                <th scope="col">{t("adminListings.columns.seller")}</th>
                <th scope="col" className="lst-cell--actions">
                  <span className="visually-hidden">{t("adminListings.columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((car) => (
                <ListingRow
                  key={car.id}
                  car={car}
                  selected={selectedIds.includes(car.id)}
                  onSelect={toggleOne}
                  busyAction={busy[car.id]}
                  onAction={handleSingle}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {data && (
        <Pagination
          page={data.page}
          pages={data.pages}
          hrefFor={hrefFor}
          onChange={setPage}
          label={t("admin.listings.pages")}
          busy={stale}
        />
      )}

      {confirm && (
        <ConfirmDialog
          {...confirmProps}
          cancelLabel={t("common.actions.cancel")}
          tone={CONFIRM_TONE[confirm.action]}
          onConfirm={handleConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
