export const TABS = ["pending", "approved", "rejected", "all"];
export const STATUS_TONES = { pending: "wait", approved: "go", rejected: "stop" };

// "TZ-12" kept in one piece inside Arabic text.
export function referenceText(reference) {
  return `⁦${reference}⁩`;
}
