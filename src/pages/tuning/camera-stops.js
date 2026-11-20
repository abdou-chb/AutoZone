import { Vector3 } from "three";

// World units are metres once the car is normalised, nose towards +z, driver (left-hand drive) on +x. Every value
// below was tuned on the Golf (4.3 m); other cars use them through the frame (see setFrame).
// doors / bonnet: how far the driver door or the bonnet is open (0-1). arc: how far the camera swings out when it
// travels to this view.
// inside: the camera is in the cabin; the rig enters and leaves through the open driver door.
export const VIEWS = {
  // Exterior. Camera at or a little above the belt line with a long lens, as a car photographer frames a car:
  // little perspective distortion, a strong stance. The side profile stands far enough back to fit the whole car beside
  // the option panel.
  hero: { position: [7.0, 1.36, 7.85], target: [0, 0.6, 0.15], fov: 27 },
  front: { position: [0, 0.98, 9.4], target: [0, 0.62, 0], fov: 24 },
  side: { position: [12.6, 1.0, 0.35], target: [0, 0.62, -0.1], fov: 25 },
  rear: { position: [0, 1.08, -9.4], target: [0, 0.68, 0], fov: 24 },
  details: { position: [4.4, 2.7, 5.4], target: [0, 0.7, 0.8], fov: 30 },
  // The other front three-quarter, low: the car as it leaves the workshop.
  summary: { position: [-7.0, 1.16, 7.85], target: [0, 0.58, 0.1], fov: 27 },
  performance: { position: [-6.4, 0.95, -6.9], target: [0, 0.55, -0.2], fov: 28 },
  // Exterior close-ups
  // Nearly square to the front wheel at hub height, a little ahead of it: the whole rim and the caliper behind it.
  wheel: { position: [3.55, 0.5, 2.45], target: [0.82, 0.38, 1.3], fov: 26 },
  headlights: { position: [1.7, 0.9, 5.8], target: [0.1, 0.62, 1.9], fov: 28 },
  taillights: { position: [-2.2, 1.15, -5.6], target: [0, 0.82, -1.9], fov: 28 },
  hood: { position: [2.1, 3.2, 6.1], target: [0, 0.75, 1.15], fov: 30 },
  mirror: { position: [2.6, 1.35, 2.4], target: [0.95, 1.0, 0.65], fov: 24 },
  grille: { position: [1.3, 0.75, 5.1], target: [0, 0.42, 2.0], fov: 26 },
  exhaust: { position: [-1.3, 0.6, -5.9], target: [0, 0.38, -2.0], fov: 28 },
  // Seats seen through the driver's window, for cars whose doors do not open.
  lookIn: { position: [2.35, 1.52, 0.05], target: [0.1, 0.7, -0.2], fov: 40 },
  // Lamp inspection. A low three-quarter view takes in both lamps and the floor they light; when the lights come on
  // the camera moves in on the driver-side lamp.
  frontLit: { position: [2.45, 0.86, 5.35], target: [0.1, 0.56, 2.05], fov: 30 },
  frontLitOn: { position: [1.6, 0.8, 4.2], target: [0.42, 0.63, 1.9], fov: 28 },
  rearLit: { position: [-2.5, 1.12, -5.4], target: [-0.05, 0.82, -1.9], fov: 30 },
  rearLitOn: { position: [-1.55, 1.06, -4.35], target: [-0.36, 0.9, -1.95], fov: 27 },
  // Engine bay, bonnet open (the bonnet hinges at the windscreen and rises over the front of the car)
  engineBay: { position: [0.55, 2.25, 4.1], target: [0, 0.64, 1.4], fov: 34, bonnet: 1 },
  engine: { position: [0.2, 1.55, 2.5], target: [0.04, 0.78, 1.45], fov: 34, bonnet: 1 },
  coolant: { position: [-0.95, 1.45, 2.55], target: [-0.42, 0.78, 1.62], fov: 32, bonnet: 1 },
  battery: { position: [1.05, 1.5, 2.45], target: [0.48, 0.76, 1.38], fov: 32, bonnet: 1 },
  // Through the open driver door
  seats: { position: [2.55, 1.45, 0.1], target: [0.25, 0.68, 0.05], fov: 38, doors: 1, arc: 0.6 },
  // Cabin
  cockpit: { position: [0, 1.17, -0.55], target: [0.1, 0.92, 0.7], fov: 58, doors: 1, arc: 0, inside: true },
  driver: { position: [0.36, 1.13, -0.12], target: [0.34, 0.98, 1.2], fov: 64, doors: 1, arc: 0, inside: true },
  passenger: { position: [-0.36, 1.13, -0.12], target: [-0.28, 0.95, 1.2], fov: 64, doors: 1, arc: 0, inside: true },
  rearSeats: { position: [0, 1.2, 0.4], target: [0, 0.74, -0.9], fov: 62, doors: 1, arc: 0, inside: true },
  steeringWheel: { position: [0.2, 1.1, -0.04], target: [0.35, 0.9, 0.38], fov: 42, doors: 1, arc: 0, inside: true },
  cluster: { position: [0.36, 1.08, 0.08], target: [0.35, 0.94, 0.62], fov: 34, doors: 1, arc: 0, inside: true },
  console: { position: [0.25, 1.25, -0.25], target: [0, 0.62, 0.25], fov: 48, doors: 1, arc: 0, inside: true },
  dashboard: { position: [0, 1.2, -0.3], target: [0.05, 0.95, 0.65], fov: 52, doors: 1, arc: 0, inside: true },
  doorPanel: { position: [0.3, 1.1, -0.1], target: [-0.72, 0.76, 0.12], fov: 56, doors: 1, arc: 0, inside: true },
};

export const DEFAULT_ARC = 1.4;

// Per-car framing. The car on the floor scales the Golf's views, pivot, cabin path and hotspots by its own size along
// each axis (width, height, length), so an SUV is not framed too tight nor a sports coupé from too far. The Golf's
// frame is 1, 1, 1: its views are used exactly as tuned. The cabin logic below works in "Golf space" (positions
// divided by the frame) and scales its answers back.
export const FRAME = { x: 1, y: 1, z: 1 };
export const PIVOT = new Vector3(0, 0.6, 0);

export function setFrame({ x, y, z }) {
  Object.assign(FRAME, { x, y, z });
  PIVOT.set(0, 0.6 * y, 0);
}

const scale = (p) => [p[0] * FRAME.x, p[1] * FRAME.y, p[2] * FRAME.z];
const unscale = (p) => [p[0] / FRAME.x, p[1] / FRAME.y, p[2] / FRAME.z];

export function view(id) {
  const base = VIEWS[id];

  return { ...base, position: scale(base.position), target: scale(base.target) };
}

// The camera enters and leaves the cabin through the open driver door: DOOR_PASSAGE is in the door opening,
// DOOR_APPROACH a step outside it, from where it can swing around the car without touching the bodywork.
export const DOOR_PASSAGE = [1.35, 1.2, 0.15];
export const DOOR_APPROACH = [2.7, 1.35, 0.15];

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const inCabin = (p) => Math.abs(p[0]) < 0.8 && p[1] < 1.42 && Math.abs(p[2]) < 1.05;
const besideDoor = (p) => p[0] > 0.8 && p[0] < 2.4 && Math.abs(p[2] - 0.15) < 1.0;

// Next point the camera should head for on its way from `camera` to `goal`, or null to go straight there.
export function cabinWaypoint(cameraPosition, goalPosition) {
  const waypoint = golfWaypoint(unscale(cameraPosition), unscale(goalPosition));

  return waypoint && scale(waypoint);
}

function golfWaypoint(camera, goal) {
  const near = (point) => distance(camera, point) < 0.3;

  if (inCabin(camera)) {
    return inCabin(goal) ? null : DOOR_PASSAGE;
  }

  if (inCabin(goal)) {
    // Through the door opening already: carry on to the seat.
    if (near(DOOR_PASSAGE) || (besideDoor(camera) && camera[0] < DOOR_PASSAGE[0])) return null;
    return besideDoor(camera) || near(DOOR_APPROACH) ? DOOR_PASSAGE : DOOR_APPROACH;
  }

  return besideDoor(camera) && !near(DOOR_APPROACH) ? DOOR_APPROACH : null;
}

// The camera's way between the seats view and the cockpit while the page scrolls: one smooth curve through the middle
// of the door opening (it passes DOOR_PASSAGE half-way), clear of the B-pillar and the roof rail.
const RAIL_START = VIEWS.seats.position;
const RAIL_END = VIEWS.cockpit.position;
const RAIL_BEND = DOOR_PASSAGE.map((value, index) => 2 * value - (RAIL_START[index] + RAIL_END[index]) / 2);

export function doorRail(u, out) {
  const a = (1 - u) * (1 - u);
  const b = 2 * u * (1 - u);
  const c = u * u;

  return out.set(
    (a * RAIL_START[0] + b * RAIL_BEND[0] + c * RAIL_END[0]) * FRAME.x,
    (a * RAIL_START[1] + b * RAIL_BEND[1] + c * RAIL_END[1]) * FRAME.y,
    (a * RAIL_START[2] + b * RAIL_BEND[2] + c * RAIL_END[2]) * FRAME.z,
  );
}

// Points on the car for the 360° view; each opens the matching section and option group. Scaled with hotspotPoint().
export const HOTSPOTS = [
  { id: "hood", section: "details", group: "hood", point: [0, 1.0, 1.55] },
  { id: "grille", section: "details", group: "grille", point: [0, 0.38, 2.12] },
  { id: "headlights", section: "lights", group: "headlights", point: [0.62, 0.72, 1.98] },
  { id: "wheel", section: "wheels", group: "rims", point: [0.9, 0.36, 1.32] },
  { id: "mirror", section: "details", group: "mirrors", point: [1.05, 1.05, 0.62] },
  { id: "window", section: "lights", group: "tint", point: [0.86, 1.18, -0.6] },
  { id: "seats", section: "interior", group: "seats", point: [0.36, 1.02, -0.1] },
  { id: "taillights", section: "lights", group: "taillights", point: [0.68, 0.92, -1.98] },
  { id: "exhaust", section: "details", group: "exhaust", point: [0.47, 0.3, -2.08] },
];

export function hotspotPoint(spot) {
  return scale(spot.point);
}

// Driver's eye for the inside 360° view.
export function driverEye() {
  return scale(VIEWS.driver.position);
}
