export default {
  bar: {
    label: "Vue administrateur",
    signedIn: "Connecté en tant qu'administrateur : {name}",
    pending: { one: "{count} annonce à valider", other: "{count} annonces à valider" },
    dashboard: "Tableau de bord",
    maintenance: "Mode maintenance activé : les visiteurs voient la page de maintenance",
  },
  panel: {
    title: "Modération",
    featured: "Mise en avant",
    public: "Cette annonce est visible par tous sur la plateforme.",
    hidden: "Cette annonce n'est pas visible du public. Seuls les administrateurs peuvent ouvrir cette page.",
    edit: "Modifier dans le tableau de bord",
    delete: "Supprimer l'annonce",
  },
  confirm: {
    title: "Supprimer cette annonce ?",
    text: "Voulez-vous vraiment supprimer définitivement cette annonce ? Elle sera retirée de la plateforme et ne sera plus accessible aux utilisateurs.",
    details: "Ses photos et ses demandes d'inspection sont aussi supprimées. Cette action est irréversible.",
    action: "Supprimer définitivement",
  },
  deleted: "{name} a été supprimée de la plateforme.",
  deletedWithInspections: {
    one: "{name} a été supprimée, avec {count} demande d'inspection.",
    other: "{name} a été supprimée, avec {count} demandes d'inspection.",
  },
  sessionExpired: "Votre session administrateur a expiré. Reconnectez-vous pour supprimer cette annonce.",
};
