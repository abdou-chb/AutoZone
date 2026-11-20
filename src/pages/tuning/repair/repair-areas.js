// What a repair request is made of, shared by the 3D scene and the form so they always agree.
// This is a reporting and problem-location tool, not a diagnosis: the areas only say WHERE on the car the customer
// points, never WHAT is wrong.

// The repair categories, in the order the grid shows them. `area` is the clickable place on the 3D car this category
// points to (a key of AREAS), or null when the part is not on the model (under the car, or a whole-vehicle concern):
// those categories still work, with a note instead of a pin. Icons are chosen in the component.
export const CATEGORIES = [
  { id: "engine", area: "engine" },
  { id: "transmission", area: null },
  { id: "brakes", area: "front-wheel" },
  { id: "suspension", area: "front-wheel" },
  { id: "electrical", area: "cabin" },
  { id: "ac", area: "cabin" },
  { id: "bodywork", area: "body" },
  { id: "tires", area: "front-wheel" },
  { id: "interior", area: "cabin" },
  { id: "other", area: null },
];

export const CATEGORY_IDS = CATEGORIES.map((category) => category.id);
export const categoryArea = (id) => CATEGORIES.find((category) => category.id === id)?.area ?? null;

// The clickable places on the car. `point` is in "Golf space" (metres, scaled to each car by the scene, like the
// configurator's hotspots); `view` is the camera stop to frame it; `categories` are the repair categories that point
// here, so clicking the car can start a report. A model without a real bonnet or cabin falls back to an outside view
// (viewFor), and the pin sits at the scaled point regardless, so every car shows something.
export const AREAS = {
  engine: { point: [0, 0.98, 1.5], view: "engineBay", categories: ["engine"] },
  "front-wheel": { point: [0.86, 0.42, 1.32], view: "wheel", categories: ["brakes", "tires", "suspension"] },
  body: { point: [0.96, 0.86, 0.1], view: "side", categories: ["bodywork"] },
  cabin: { point: [0.28, 1.02, 0.05], view: "seats", categories: ["electrical", "ac", "interior"] },
};

export const AREA_IDS = Object.keys(AREAS);

// How urgent the customer feels the problem is, mildest first.
export const SEVERITY = ["low", "medium", "high", "urgent"];

// Roughly when it started; "" means not said. `startedNote` beside it lets them be exact in their own words.
export const STARTED = ["today", "days", "weeks", "months", "long"];

// How the customer would like the garage to reach them.
export const CONTACT = ["phone", "whatsapp", "email"];

export const MAX_PROBLEMS = 10;
export const MAX_IMAGES = 6;
export const DESCRIPTION_MAX = 1000;

// A blank problem for one reported issue.
export function emptyProblem(category) {
  return { category, area: categoryArea(category) || "", description: "", symptoms: "", started: "", startedNote: "", severity: "medium", notes: "" };
}

// A problem is ready to send once it says what is wrong.
export function problemReady(problem) {
  return problem.description.trim().length > 0;
}
