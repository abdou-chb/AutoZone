export const LISTING_STATUS = {
  pending: { tone: "wait" },
  approved: { tone: "go" },
  rejected: { tone: "stop" },
  sold: { tone: "dark" },
};

export const INSPECTION_STATUS = {
  pending: { tone: "wait" },
  scheduled: { tone: "info" },
  confirmed: { tone: "go" },
  completed: { tone: "dark" },
  cancelled: { tone: "stop" },
};

export const INSPECTION_STEPS = ["pending", "scheduled", "confirmed", "completed"];
