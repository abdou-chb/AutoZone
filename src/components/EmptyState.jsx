export default function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-state__icon">
          <Icon size={26} strokeWidth={1.75} />
        </span>
      )}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
