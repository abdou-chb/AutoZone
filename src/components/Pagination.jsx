import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageItems } from "../lib/page-items";
import useMediaQuery from "../lib/useMediaQuery";
import { useI18n } from "../i18n/i18n-context";
import "./Pagination.css";

function isPlainClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export default function Pagination({ page, pages, hrefFor, onChange, label, busy = false }) {
  const compact = useMediaQuery("(max-width: 560px)");
  const { t } = useI18n();

  if (pages <= 1) {
    return null;
  }

  function pageLink(target, content, props = {}) {
    return (
      <Link
        to={hrefFor(target)}
        preventScrollReset
        onClick={(event) => {
          if (isPlainClick(event)) {
            event.preventDefault();
            onChange(target);
          }
        }}
        {...props}
      >
        {content}
      </Link>
    );
  }

  function step(target, text, ariaLabel, Icon, modifier) {
    const content = (
      <>
        {modifier === "next" && <span className="pagination__step-text">{text}</span>}
        <Icon size={18} aria-hidden="true" className="flip-rtl" />
        {modifier === "previous" && <span className="pagination__step-text">{text}</span>}
      </>
    );

    if (target < 1 || target > pages) {
      return (
        <span className={`pagination__step pagination__step--${modifier} is-disabled`} aria-disabled="true">
          {content}
        </span>
      );
    }

    return pageLink(target, content, {
      className: `pagination__step pagination__step--${modifier}`,
      "aria-label": ariaLabel,
    });
  }

  return (
    <nav className={`pagination${busy ? " is-busy" : ""}`} aria-label={label || t("common.pagination.label")}>
      <ul className="pagination__list">
        <li>
          {step(page - 1, t("common.pagination.previous"), t("common.pagination.previousPage"), ChevronLeft, "previous")}
        </li>
        {pageItems(page, pages, compact ? 0 : 1).map((item) =>
          typeof item === "number" ? (
            <li key={item}>
              {pageLink(item, item, {
                className: `pagination__page numeric${item === page ? " is-current" : ""}`,
                "aria-label": t("common.pagination.page", { page: item }),
                "aria-current": item === page ? "page" : undefined,
              })}
            </li>
          ) : (
            <li key={item} className="pagination__gap" aria-hidden="true">
              …
            </li>
          )
        )}
        <li>{step(page + 1, t("common.pagination.next"), t("common.pagination.nextPage"), ChevronRight, "next")}</li>
      </ul>
    </nav>
  );
}
