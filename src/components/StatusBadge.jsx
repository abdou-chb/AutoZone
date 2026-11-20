import { useI18n } from "../i18n/i18n-context";
import { INSPECTION_STATUS, LISTING_STATUS } from "../lib/status";

export default function StatusBadge({ status, kind = "inspection" }) {
  const { t } = useI18n();
  const map = kind === "listing" ? LISTING_STATUS : INSPECTION_STATUS;
  const tone = map[status]?.tone || "";

  return <span className={`badge badge--${tone}`}>{t(`common.status.${kind}.${status}`)}</span>;
}
