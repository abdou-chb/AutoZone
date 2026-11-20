export const TABS = ["submitted", "under_review", "awaiting_customer", "accepted", "completed", "all"];

// Badge tone per status (badge--go green, --info blue, --wait amber, --signal, --stop red, --dark).
export const STATUS_TONES = {
  submitted: "wait",
  under_review: "info",
  info_required: "wait",
  awaiting_customer: "signal",
  accepted: "go",
  declined: "stop",
  scheduled: "info",
  received: "info",
  in_progress: "signal",
  completed: "go",
  rejected: "stop",
  cancelled: "dark",
};

export const SEVERITY_TONES = { low: "go", medium: "wait", high: "wait", urgent: "stop" };
export const CATEGORIES = ["engine", "transmission", "brakes", "suspension", "electrical", "ac", "bodywork", "tires", "interior", "other"];
export const KINDS = ["diagnostic", "parts", "labor", "service"];

// "RP-12" kept in one piece inside Arabic text.
export function referenceText(reference) {
  return `⁦${reference}⁩`;
}

export const categoryKey = (category) => `adminRepairRequests.categories.${CATEGORIES.includes(category) ? category : "other"}`;
export const severityKey = (severity) => `adminRepairRequests.severity.${SEVERITY_TONES[severity] ? severity : "medium"}`;
export const startedKey = (started) => (started ? `adminRepairRequests.started.${started}` : null);
export const contactKey = (contact) => `adminRepairRequests.contact.${["phone", "whatsapp", "email"].includes(contact) ? contact : "phone"}`;
export const statusKey = (status) => `adminRepairRequests.status.${STATUS_TONES[status] ? status : "submitted"}`;
export const kindKey = (kind) => `adminRepairRequests.kinds.${KINDS.includes(kind) ? kind : "service"}`;
