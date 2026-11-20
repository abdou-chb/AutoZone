import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useCategory } from "../lib/category-context";
import { useI18n } from "../i18n/i18n-context";
import "./NotFound.css";

export default function NotFound() {
  const category = useCategory();
  const { t } = useI18n();

  useEffect(() => {
    document.title = t("details.notFound.pageTitle", { brand: category.brand });
  }, [category.brand, t]);

  return (
    <div className="container page notfound-page">
      <div className="notfound">
        <svg className="notfound__sign" viewBox="0 0 120 120" aria-hidden="true">
          <rect
            className="notfound__sign-plate"
            x="22"
            y="22"
            width="76"
            height="76"
            rx="10"
            transform="rotate(45 60 60)"
          />
          <rect className="notfound__sign-mark" x="54" y="50" width="12" height="38" rx="2" />
          <rect className="notfound__sign-mark" x="36" y="38" width="48" height="12" rx="2" />
        </svg>
        <h1>{t("details.notFound.title")}</h1>
        <p>{t("details.notFound.text", { zone: category.key })}</p>
        <div className="notfound__actions">
          <Link to={category.home} className="btn btn--primary">
            {t(`zones.${category.key}.browse`)}
          </Link>
          <Link to="/track" className="btn btn--outline">
            {t("details.notFound.track")}
          </Link>
        </div>
      </div>
    </div>
  );
}
