import { Link, useParams, useSearchParams } from "react-router-dom";
import { Inbox, Wrench } from "lucide-react";
import EmptyState from "../../../components/EmptyState";
import { useI18n } from "../../../i18n/i18n-context";
import { formatRelativeDay } from "../../../lib/format";
import useMediaQuery from "../../../lib/useMediaQuery";
import { useAdmin } from "../admin-context";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import RepairRequestReader from "./RepairRequestReader";
import { referenceText, STATUS_TONES, TABS } from "./repair-request-utils";
import "../messages/inbox.css";
import "../car-requests/car-requests.css";
import "./repair-requests.css";

function RequestRow({ item, active, href }) {
  const { t } = useI18n();
  const problems = t("adminRepairRequests.problemCount", { count: item.problem_count });

  return (
    <li>
      <Link className={`inbox-item${item.status === "submitted" ? " is-unread" : ""}${active ? " is-active" : ""}`} to={href} aria-current={active ? "page" : undefined}>
        <span className="inbox-item__dot" aria-hidden="true" />
        <span className="inbox-item__top">
          <bdi className="inbox-item__name">{item.full_name}</bdi>
          <span className="inbox-item__date">{formatRelativeDay(item.created_at)}</span>
        </span>
        <span className="inbox-item__subject">
          <bdi>
            {item.vehicle_make} {item.vehicle_model}
          </bdi>{" "}
          <span className="car-request__ref numeric">{referenceText(item.reference)}</span>
        </span>
        <span className="inbox-item__preview">{problems}</span>
        <span className="inbox-item__tags">
          <span className={`badge badge--${STATUS_TONES[item.status] || ""}`}>{t(`adminRepairRequests.status.${item.status}`)}</span>
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

// Repair requests sent from the 3D Zone: the list on one side, the request being read on the other (read only).
export default function RepairRequestsPage() {
  const { t } = useI18n();
  const { id: rawId } = useParams();
  const [searchParams] = useSearchParams();
  const { request } = useAdmin();
  const phone = useMediaQuery("(max-width: 960px)");
  const id = /^\d+$/.test(rawId || "") ? Number(rawId) : null;
  const statusParam = searchParams.get("status");
  const tab = TABS.includes(statusParam) ? statusParam : "submitted";
  const list = useAdminData(request, `/api/admin/repair-requests${tab === "all" ? "" : `?status=${tab}`}`);
  const items = list.data?.requests || [];
  const counts = list.data?.counts;
  const search = searchParams.toString();
  const listHref = `/admin/repair-requests${search ? `?${search}` : ""}`;
  const rowHref = (itemId) => `/admin/repair-requests/${itemId}${search ? `?${search}` : ""}`;
  const total = counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : null;

  return (
    <div className="inbox-page">
      <div className="console-head">
        <div>
          <h1>{t("adminRepairRequests.title")}</h1>
          <p>{t("adminRepairRequests.lead")}</p>
        </div>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {list.loading ? t("adminRepairRequests.loading") : t("adminRepairRequests.announce", { count: items.length })}
      </p>

      <div className={`inbox console-card${id ? " has-open" : ""}`}>
        <section className="inbox__list" aria-label={t("adminRepairRequests.listLabel")}>
          <nav className="inbox-tabs" aria-label={t("adminRepairRequests.tabsLabel")}>
            {TABS.map((item) => {
              const count = !counts ? null : item === "all" ? total : counts[item] || 0;

              return (
                <Link
                  key={item}
                  className="inbox-tab"
                  to={`/admin/repair-requests${item === "submitted" ? "" : `?status=${item}`}`}
                  aria-current={tab === item ? "page" : undefined}
                  replace
                >
                  {t(`adminRepairRequests.tabs.${item}`)}
                  {count !== null && <span className={`inbox-tab__count numeric${item === "submitted" && count ? " is-hot" : ""}`}>{count}</span>}
                </Link>
              );
            })}
          </nav>

          {list.loading && !list.data && <SkeletonList />}
          {list.error && <LoadError message={list.error} onRetry={list.reload} retrying={list.refreshing} />}
          {!list.loading && !list.error && items.length === 0 && (
            <EmptyState icon={Inbox} title={t(`adminRepairRequests.empty.${tab}`)}>
              {t("adminRepairRequests.empty.text")}
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

        <section className="inbox__reader" aria-label={t("adminRepairRequests.readerLabel")}>
          {id ? (
            <RepairRequestReader key={id} id={id} backHref={listHref} focusOnLoad={phone} onChanged={list.reload} />
          ) : (
            <div className="inbox-reader__placeholder">
              <Wrench size={32} aria-hidden="true" />
              <p>{t("adminRepairRequests.choose")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
