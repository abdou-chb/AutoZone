import { Link, useParams, useSearchParams } from "react-router-dom";
import { CarFront, Inbox } from "lucide-react";
import EmptyState from "../../../components/EmptyState";
import { useI18n } from "../../../i18n/i18n-context";
import { formatPrice, formatRelativeDay } from "../../../lib/format";
import useMediaQuery from "../../../lib/useMediaQuery";
import { useAdmin } from "../admin-context";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import CarRequestReader from "./CarRequestReader";
import { referenceText, STATUS_TONES, TABS } from "./car-request-utils";
import "../messages/inbox.css";
import "./car-requests.css";

function RequestRow({ item, active, href }) {
  const { t } = useI18n();

  return (
    <li>
      <Link className={`inbox-item${item.status === "pending" ? " is-unread" : ""}${active ? " is-active" : ""}`} to={href} aria-current={active ? "page" : undefined}>
        <span className="inbox-item__dot" aria-hidden="true" />
        <span className="inbox-item__top">
          <bdi className="inbox-item__name">{item.full_name}</bdi>
          <span className="inbox-item__date">{formatRelativeDay(item.created_at)}</span>
        </span>
        <span className="inbox-item__subject">
          {item.vehicle_name} <span className="car-request__ref numeric">{referenceText(item.reference)}</span>
        </span>
        <span className="inbox-item__preview numeric">{formatPrice(item.total)}</span>
        <span className="inbox-item__tags">
          <span className={`badge badge--${STATUS_TONES[item.status]}`}>{t(`adminCarRequests.status.${item.status}`)}</span>
          <bdi className="badge">{item.wilaya}</bdi>
        </span>
      </Link>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="inbox-list" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="inbox-item inbox-item--skeleton">
          <span className="skeleton admin-skeleton-line admin-skeleton-line--title" />
          <span className="skeleton admin-skeleton-line" />
        </li>
      ))}
    </ul>
  );
}

// Car requests sent from the Tuning Zone: the list on one side, the request under review on the other.
export default function CarRequestsPage() {
  const { t } = useI18n();
  const { id: rawId } = useParams();
  const [searchParams] = useSearchParams();
  const { request } = useAdmin();
  const phone = useMediaQuery("(max-width: 960px)");
  const id = /^\d+$/.test(rawId || "") ? Number(rawId) : null;
  const statusParam = searchParams.get("status");
  const tab = TABS.includes(statusParam) ? statusParam : "pending";
  const list = useAdminData(request, `/api/admin/tuning-requests${tab === "all" ? "" : `?status=${tab}`}`);
  const items = list.data?.requests || [];
  const counts = list.data?.counts;
  const search = searchParams.toString();
  const listHref = `/admin/car-requests${search ? `?${search}` : ""}`;
  const rowHref = (itemId) => `/admin/car-requests/${itemId}${search ? `?${search}` : ""}`;
  const total = counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : null;

  return (
    <div className="inbox-page">
      <div className="console-head">
        <div>
          <h1>{t("adminCarRequests.title")}</h1>
          <p>{t("adminCarRequests.lead")}</p>
        </div>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {list.loading ? t("adminCarRequests.loading") : t("adminCarRequests.announce", { count: items.length })}
      </p>

      <div className={`inbox console-card${id ? " has-open" : ""}`}>
        <section className="inbox__list" aria-label={t("adminCarRequests.listLabel")}>
          <nav className="inbox-tabs" aria-label={t("adminCarRequests.tabsLabel")}>
            {TABS.map((item) => {
              const count = !counts ? null : item === "all" ? total : counts[item] || 0;

              return (
                <Link
                  key={item}
                  className="inbox-tab"
                  to={`/admin/car-requests${item === "pending" ? "" : `?status=${item}`}`}
                  aria-current={tab === item ? "page" : undefined}
                  replace
                >
                  {t(`adminCarRequests.tabs.${item}`)}
                  {count !== null && <span className={`inbox-tab__count numeric${item === "pending" && count ? " is-hot" : ""}`}>{count}</span>}
                </Link>
              );
            })}
          </nav>

          {list.loading && !list.data && <SkeletonList />}
          {list.error && <LoadError message={list.error} onRetry={list.reload} retrying={list.refreshing} />}
          {!list.loading && !list.error && items.length === 0 && (
            <EmptyState icon={Inbox} title={t(`adminCarRequests.empty.${tab}`)}>
              {t("adminCarRequests.empty.text")}
            </EmptyState>
          )}
          {items.length > 0 && (
            <ul className="inbox-list">
              {items.map((item) => (
                <RequestRow key={item.id} item={item} active={item.id === id} href={rowHref(item.id)} />
              ))}
            </ul>
          )}
        </section>

        <section className="inbox__reader" aria-label={t("adminCarRequests.readerLabel")}>
          {id ? (
            <CarRequestReader key={id} id={id} backHref={listHref} focusOnLoad={phone} onChanged={list.reload} />
          ) : (
            <div className="inbox-reader__placeholder">
              <CarFront size={32} aria-hidden="true" />
              <p>{t("adminCarRequests.choose")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
