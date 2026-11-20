import { Link } from "react-router-dom";
import { useI18n } from "../i18n/i18n-context";

export default function Logo({ to, brand, tone = "dark", suffix, label }) {
  const { t } = useI18n();

  return (
    <Link to={to} className={`logo logo--${tone}`} aria-label={label || t("nav.home", { brand })}>
      <svg className="logo__mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="5.5" y="5.5" width="21" height="21" rx="3.5" transform="rotate(45 16 16)" />
        <rect className="logo__lane" x="14.6" y="9" width="2.8" height="5" rx="1" />
        <rect className="logo__lane" x="14.6" y="18" width="2.8" height="5" rx="1" />
      </svg>
      <span className="logo__word">{brand}</span>
      {suffix && <span className="logo__suffix">{suffix}</span>}
    </Link>
  );
}
