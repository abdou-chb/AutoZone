import { CircleCheck } from "lucide-react";
import { useI18n } from "../../i18n/i18n-context";
import { useVisibleCategories } from "../../lib/site-context";

export default function CategoryPicker({ labelledBy, value, onChange }) {
  const { t } = useI18n();
  const zones = useVisibleCategories();

  return (
    <div className="sell-categories" role="radiogroup" aria-labelledby={labelledBy}>
      {zones.map((category) => {
        const Icon = category.icon;

        return (
          <label key={category.key} className="sell-category" style={{ "--sell-tile": category.theme.accent }}>
            <input
              type="radio"
              name="category"
              value={category.key}
              className="sell-category__input"
              checked={value === category.key}
              onChange={() => onChange(category.key)}
            />
            <span className="sell-category__icon">
              <Icon size={26} aria-hidden="true" />
            </span>
            <span className="sell-category__brand display">{category.brand}</span>
            <span className="sell-category__line">{t(`sell.categories.${category.key}`)}</span>
            <CircleCheck className="sell-category__check" size={20} aria-hidden="true" />
          </label>
        );
      })}
    </div>
  );
}
