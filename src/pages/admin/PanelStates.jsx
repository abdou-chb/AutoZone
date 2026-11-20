import { CircleAlert, RotateCw } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";

export function SkeletonRows({ count = 3 }) {
  return (
    <ul className="admin-list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="admin-card admin-card--skeleton">
          <div className="skeleton admin-card__media" />
          <div className="admin-card__body">
            <div className="skeleton admin-skeleton-line admin-skeleton-line--title" />
            <div className="skeleton admin-skeleton-line" />
            <div className="skeleton admin-skeleton-line admin-skeleton-line--short" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LoadError({ message, onRetry, retrying }) {
  const { t } = useI18n();

  return (
    <div className="notice notice--stop admin-error" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <p className="admin-error__text">{message}</p>
      <button type="button" className="btn btn--outline" onClick={onRetry} disabled={retrying}>
        {retrying ? <span className="spinner" aria-hidden="true" /> : <RotateCw size={16} aria-hidden="true" />}
        {t("common.actions.retry")}
      </button>
    </div>
  );
}
