export default {
  bar: {
    label: "Admin view",
    signedIn: "Signed in as admin: {name}",
    pending: { one: "{count} listing to review", other: "{count} listings to review" },
    dashboard: "Dashboard",
    maintenance: "Maintenance mode is on: visitors see the maintenance page",
  },
  panel: {
    title: "Moderation",
    featured: "Featured",
    public: "This listing is visible to everyone on the marketplace.",
    hidden: "This listing is not visible to the public. Only admins can open this page.",
    edit: "Edit in the dashboard",
    delete: "Delete listing",
  },
  confirm: {
    title: "Delete this listing?",
    text: "Are you sure you want to permanently delete this listing? It will be removed from the marketplace and will no longer be accessible to users.",
    details: "Its photos and its inspection requests are deleted too. This cannot be undone.",
    action: "Delete permanently",
  },
  deleted: "{name} was deleted from the marketplace.",
  deletedWithInspections: {
    one: "{name} was deleted, with {count} inspection request.",
    other: "{name} was deleted, with {count} inspection requests.",
  },
  sessionExpired: "Your admin session has ended. Log in again to delete this listing.",
};
