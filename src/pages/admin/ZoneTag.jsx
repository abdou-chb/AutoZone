import { getCategory } from "../../lib/categories";

export default function ZoneTag({ category }) {
  const { brand, icon: Icon, theme } = getCategory(category);

  return (
    <span className="admin-zone-tag">
      <Icon size={16} color={theme.accent} aria-hidden="true" />
      {brand}
    </span>
  );
}
