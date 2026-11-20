import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Inbox, MailOpen, Search } from "lucide-react";
import EmptyState from "../../../components/EmptyState";
import Pagination from "../../../components/Pagination";
import { useI18n } from "../../../i18n/i18n-context";
import { isCategoryKey } from "../../../lib/categories";
import { formatRelativeDay } from "../../../lib/format";
import useMediaQuery from "../../../lib/useMediaQuery";
import usePagedParams from "../../../lib/usePagedParams";
import { useAdmin } from "../admin-context";
import { LoadError } from "../PanelStates";
import { useAdminData } from "../useAdminSession";
import ZoneTag from "../ZoneTag";
import MessageReader from "./MessageReader";
import { firstLine, languageName, STATUS_TONES, TABS, tabCount } from "./message-utils";
import "./inbox.css";

const PAGE_SIZE = 20;

function MessageRow({ item, active, fresh, href }) {
  const { t } = useI18n();
  const unread = item.status === "new";
  const classes = ["inbox-item", unread ? "is-unread" : "", active ? "is-active" : "", fresh ? "is-fresh" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <li>
      <Link className={classes} to={href} aria-current={active ? "page" : undefined}>
        <span className="inbox-item__dot" aria-hidden="true" />
        <span className="inbox-item__top">
          <bdi className="inbox-item__name">{item.name}</bdi>
          <span className="inbox-item__date">{formatRelativeDay(item.created_at)}</span>
        </span>
        <span className="inbox-item__subject">
          {unread && <span className="visually-hidden">{t("adminMessages.unread")}, </span>}
          {fresh && <span className="badge badge--signal inbox-item__new">{t("adminMessages.justArrived")}</span>}
          {t(`adminMessages.subjects.${item.subject}`)}
        </span>
        <bdi className="inbox-item__preview" lang={item.language}>
          {firstLine(item.body)}
        </bdi>
        <span className="inbox-item__tags">
          {isCategoryKey(item.category) && <ZoneTag category={item.category} />}
          <span className="badge inbox-lang">
            <span aria-hidden="true">{item.language.toUpperCase()}</span>
            <span className="visually-hidden">{t("adminMessages.writtenIn", { language: languageName(item.language) })}</span>
          </span>
          {["replied", "archived"].includes(item.status) && (
            <span className={`badge badge--${STATUS_TONES[item.status]}`}>{t(`adminMessages.status.${item.status}`)}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="inbox-list" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <li key={index} className="inbox-item inbox-item--skeleton">
          <span className="skeleton admin-skeleton-line admin-skeleton-line--title" />
          <span className="skeleton admin-skeleton-line" />
        </li>
      ))}
    </ul>
  );
}

export default function MessagesPage() {
  const { t } = useI18n();
  const { id: rawId } = useParams();
  const { request, summary } = useAdmin();
  const paging = usePagedParams("admin-messages");
  const { searchParams, page, search, updateParams, clampPage } = paging;
  const phone = useMediaQuery("(max-width: 960px)");
  const id = /^\d+$/.test(rawId || "") ? Number(rawId) : null;
  const statusParam = searchParams.get("status");
  const tab = TABS.includes(statusParam) ? statusParam : "inbox";
  const q = (searchParams.get("q") || "").trim();
  const [draft, setDraft] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  const [tracked, setTracked] = useState({ lastId: null, fresh: [] });
  const firstLastId = useRef(summary?.lastId);

  if (q !== lastQ) {
    setLastQ(q);
    setDraft(q);
  }

  const lastId = summary?.lastId;

  if (lastId !== undefined && lastId !== tracked.lastId) {
    const fresh =
      tracked.lastId === null
        ? []
        : (summary.latest || []).filter((item) => item.type === "message" && item.id > tracked.lastId).map((item) => item.ref_id);

    setTracked({ lastId, fresh: fresh.length ? fresh : tracked.fresh });
  }

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });

  if (tab !== "inbox") params.set("status", tab);
  if (q) params.set("q", q);

  const list = useAdminData(request, `/api/admin/messages?${params}`);
  const { reload } = list;
  const items = list.data?.items || [];
  const pages = list.data?.pages || 1;
  const counts = list.data?.counts;
  const listHref = `/admin/messages${search ? `?${search}` : ""}`;
  const rowHref = (itemId) => `/admin/messages/${itemId}${search ? `?${search}` : ""}`;

  useEffect(() => {
    if (lastId === undefined || lastId === firstLastId.current) {
      return;
    }

    const known = firstLastId.current !== undefined;

    firstLastId.current = lastId;

    if (known) {
      reload();
    }
  }, [lastId, reload]);

  useEffect(() => {
    if (list.data?.pages) {
      clampPage(list.data.pages);
    }
  }, [list.data, clampPage]);

  useEffect(() => {
    if (draft.trim() === q) {
      return undefined;
    }

    const timer = window.setTimeout(() => updateParams({ q: draft.trim() }), 350);

    return () => window.clearTimeout(timer);
  }, [draft, q, updateParams]);

  const freshShown = items.filter((item) => tracked.fresh.includes(item.id) && item.status === "new");
  let announcement = "";

  if (list.loading) {
    announcement = t("adminMessages.loading");
  } else if (freshShown.length) {
    announcement = t("adminMessages.arrived", { count: freshShown.length });
  } else if (typeof list.data?.total === "number") {
    announcement = t("adminMessages.announce", { count: list.data.total });
  }

  return (
    <div className="inbox-page">
      <div className="console-head">
        <div>
          <h1>{t("adminMessages.title")}</h1>
          <p>{t("adminMessages.lead")}</p>
        </div>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      <div className={`inbox console-card${id ? " has-open" : ""}`}>
        <section className="inbox__list" aria-label={t("adminMessages.listLabel")}>
          <nav className="inbox-tabs" aria-label={t("adminMessages.tabsLabel")}>
            {TABS.map((item) => {
              const next = new URLSearchParams(searchParams);

              next.delete("page");
              if (item === "inbox") next.delete("status");
              else next.set("status", item);

              const count = counts ? tabCount(item, counts) : null;

              return (
                <Link
                  key={item}
                  className="inbox-tab"
                  to={`/admin/messages${next.size ? `?${next}` : ""}`}
                  aria-current={tab === item ? "page" : undefined}
                  replace
                >
                  {t(`adminMessages.tabs.${item}`)}
                  {count !== null && (
                    <span className={`inbox-tab__count numeric${item === "new" && count ? " is-hot" : ""}`}>{count}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          <form className="inbox-search" role="search" onSubmit={(event) => {
            event.preventDefault();
            updateParams({ q: draft.trim() });
          }}>
            <label className="visually-hidden" htmlFor="inbox-search">
              {t("adminMessages.search")}
            </label>
            <Search size={18} aria-hidden="true" className="inbox-search__icon" />
            <input
              id="inbox-search"
              className="input"
              type="search"
              placeholder={t("adminMessages.searchPlaceholder")}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </form>

          {list.loading && !list.data && <SkeletonList />}
          {list.error && <LoadError message={list.error} onRetry={reload} retrying={list.refreshing} />}
          {!list.loading && !list.error && items.length === 0 && (
            <EmptyState icon={Inbox} title={t(q ? "adminMessages.empty.search" : `adminMessages.empty.${tab}`)}>
              {q ? t("adminMessages.empty.searchText", { query: q }) : t("adminMessages.empty.text")}
            </EmptyState>
          )}
          {items.length > 0 && (
            <ul className="inbox-list">
              {items.map((item) => (
                <MessageRow
                  key={item.id}
                  item={item}
                  active={item.id === id}
                  fresh={tracked.fresh.includes(item.id) && item.status === "new"}
                  href={rowHref(item.id)}
                />
              ))}
            </ul>
          )}

          <Pagination
            page={Math.min(page, pages)}
            pages={pages}
            hrefFor={paging.hrefFor}
            onChange={paging.setPage}
            label={t("adminMessages.pages")}
          />
        </section>

        <section className="inbox__reader" aria-label={t("adminMessages.readerLabel")}>
          {id ? (
            <MessageReader
              key={id}
              id={id}
              listItem={items.find((item) => item.id === id)}
              backHref={listHref}
              focusOnLoad={phone}
              onChanged={reload}
            />
          ) : (
            <div className="inbox-reader__placeholder">
              <MailOpen size={32} aria-hidden="true" />
              <p>{t("adminMessages.choose")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
