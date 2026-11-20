import * as THREE from "three";

// The request scene's script, in seconds from the moment the three cars are on screen. Pure functions of time, so
// the scene can be shown at any moment (reduced motion jumps to the end) and the timing can be tested on its own.
//
// World: metres, the chosen car at the origin facing +z (towards the camera's final place). The Audi works on the
// left (x < 0), the Mercedes on the right (x > 0); neither ever comes nearer the middle than SIDE_CLEARANCE.

export const END = 8.6;
// From SLIDE_FROM the picture slides so the cars end up clear of where the form will be; the form comes in at FORM_AT,
// while the side cars are still parking and the camera makes its last approach, so it never covers the chosen car.
export const SLIDE_FROM = 4.6;
export const SLIDE_TO = 7.6;
export const FORM_AT = 6.2;
export const SIDE_CLEARANCE = 1.75;

const smoother = (u) => {
  const x = THREE.MathUtils.clamp(u, 0, 1);

  // Clamped again: rounding can return 1.0000000000000002, and a curve sampled past its end gives NaN.
  return Math.min(1, x * x * x * (x * (x * 6 - 15) + 10));
};

// A cubic Bézier in the floor plane, sampled once by arc length so a car moves along it at the pace we choose.
function path(points) {
  const curve = new THREE.CubicBezierCurve(...points.map(([x, z]) => new THREE.Vector2(x, z)));

  curve.arcLengthDivisions = 200;
  curve.updateArcLengths();

  return curve;
}

// One side car's moves (the Audi's; the Mercedes mirrors them a moment later). yaw: nose turned towards +x.
// 1. Drives in out of the dark behind, curving towards its place, and stops a little ahead of it.
// 2. Pauses, then reverses into its final place while its nose swings in towards the middle: the turn shows its flank
//    to the camera and leaves its headlights crossing the chosen car's beams in the fog ahead.
const ARRIVE = { from: 1.6, to: 5.0, curve: path([[-5.4, -12], [-5.4, -7], [-3.75, -1.6], [-3.3, 2.2]]), reverse: false };
const PARK = { from: 5.45, to: 7.6, curve: path([[-3.3, 2.2], [-3.41, 1.31], [-3.38, 0.34], [-3.7, -0.5]]), reverse: true };
const SIDE_MOVES = [ARRIVE, PARK];
export const SIDE_DELAY = { audi: 0, mercedes: 0.32 };

const tangent = new THREE.Vector2();
const point = new THREE.Vector2();

// Where a side car is at time t: x, z, yaw, the signed distance it has covered (for the wheels) and its path curvature
// (for the steering), mirrored for the right-hand car.
export function sidePose(t, side, out = {}) {
  const mirror = side === "mercedes" ? -1 : 1;
  const local = t - SIDE_DELAY[side];
  let travelled = 0;
  let move = SIDE_MOVES[0];
  let u = 0;

  for (const candidate of SIDE_MOVES) {
    const length = candidate.curve.getLength();

    if (local >= candidate.to) {
      travelled += candidate.reverse ? -length : length;
      move = candidate;
      u = 1;
      continue;
    }

    move = candidate;
    u = local <= candidate.from ? 0 : smoother((local - candidate.from) / (candidate.to - candidate.from));
    travelled += (candidate.reverse ? -length : length) * u;
    break;
  }

  move.curve.getPointAt(u, point);
  move.curve.getTangentAt(u, tangent);

  const heading = move.reverse ? tangent.clone().negate() : tangent;
  const ahead = Math.min(u + 0.01, 1);
  const next = move.curve.getTangentAt(ahead, new THREE.Vector2());
  const turn = Math.atan2(tangent.x * next.y - tangent.y * next.x, tangent.dot(next));
  const step = move.curve.getLength() * (ahead - u) || 1;

  out.x = mirror * point.x;
  out.z = point.y;
  out.yaw = mirror * Math.atan2(heading.x, heading.y);
  out.travelled = travelled;
  // Positive curvature turns the nose towards +x; reversing turns the wheels the other way for the same path.
  out.curvature = (mirror * -turn) / step * (move.reverse ? -1 : 1);
  out.moving = local > move.from && local < move.to;

  return out;
}

// Lamp cues for each car, as levels: drl (light signature), beam (0 off, 1 low, 1.75 high). The chosen car lights first,
// in the dark; the side cars light as they come out of it; at the end the chosen car flashes its main beam twice.
const CUES = {
  hero: [
    [0, { drl: 0, beam: 0 }],
    [0.55, { drl: 1, beam: 0 }],
    [1.35, { drl: 1, beam: 1 }],
    [6.7, { drl: 1, beam: 1.75 }],
    [6.85, { drl: 1, beam: 1 }],
    [7.05, { drl: 1, beam: 1.75 }],
    [7.3, { drl: 1, beam: 1 }],
  ],
  audi: [
    [0, { drl: 0, beam: 0 }],
    [2.0, { drl: 1, beam: 0 }],
    [2.45, { drl: 1, beam: 1 }],
  ],
  mercedes: [
    [0, { drl: 0, beam: 0 }],
    [2.32, { drl: 1, beam: 0 }],
    [2.77, { drl: 1, beam: 1 }],
  ],
};

export function lampCue(car, t) {
  let state = CUES[car][0][1];

  for (const [at, cue] of CUES[car]) {
    if (t >= at) state = cue;
  }

  return state;
}

// The fog's density over the scene: a thin layer in the dark, thickening as the side cars roll in.
export function fogLevel(t) {
  return 0.35 + 0.65 * smoother((t - 1.4) / 3.5);
}

// Camera: one continuous move through these shots, at a pace set by their times (monotone, so it never runs back).
// 0 Close on the chosen car's headlamp in the dark while it lights. 1 It eases back. 2 It swings out and rises,
// revealing the cars rolling in behind. 3 A low tracking shot on the Audi's side as it parks with its beams crossing.
// 4 The final composition (from finalShot), still.
const SHOTS = [
  { t: 0, position: [1.95, 0.6, 4.7], target: [0.55, 0.64, 1.9], fov: 30 },
  { t: 1.5, position: [2.7, 0.72, 5.9], target: [0.35, 0.64, 1.6], fov: 32 },
  { t: 3.6, position: [6.8, 1.7, 8.6], target: [-1.2, 0.72, -2.2], fov: 36 },
  { t: 6.0, position: [-3.4, 1.15, 10.6], target: [-1.0, 0.72, 0], fov: 34 },
];

// The still shot the scene settles on, fitted to the screen's shape: wide screens hold all three cars, narrow ones the
// chosen car with the side cars' inner halves and their beams.
export function finalShot(aspect) {
  const fov = aspect < 1 ? 40 : 30;
  const span = THREE.MathUtils.lerp(6.4, 11.8, THREE.MathUtils.smoothstep(aspect, 0.5, 1.45));
  const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect);
  const distance = Math.max(span / 2 / Math.tan(half), 8.5);

  return { t: END, position: [0, 0.75 + distance * 0.11, distance], target: [0, 0.78, 0], fov };
}

// Monotone cubic (Fritsch–Carlson) from time to shot index: the camera's pace changes smoothly from shot to shot and
// stops at the end with no jolt.
function monotone(xs, ys) {
  const n = xs.length;
  const slopes = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = [0, ...slopes.slice(1).map((s, i) => (s * slopes[i] <= 0 ? 0 : (2 * s * slopes[i]) / (s + slopes[i]))), 0];

  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];

    let i = 0;

    while (x > xs[i + 1]) i += 1;

    const h = xs[i + 1] - xs[i];
    const s = (x - xs[i]) / h;

    return (
      (2 * s ** 3 - 3 * s ** 2 + 1) * ys[i] + (s ** 3 - 2 * s ** 2 + s) * h * m[i] + (-2 * s ** 3 + 3 * s ** 2) * ys[i + 1] + (s ** 3 - s ** 2) * h * m[i + 1]
    );
  };
}

export function createCameraPath(aspect) {
  const shots = [...SHOTS, finalShot(aspect)];
  const positions = new THREE.CatmullRomCurve3(shots.map((shot) => new THREE.Vector3(...shot.position)), false, "centripetal");
  const targets = new THREE.CatmullRomCurve3(shots.map((shot) => new THREE.Vector3(...shot.target)), false, "centripetal");
  const index = monotone(shots.map((shot) => shot.t), shots.map((_, i) => i));
  const last = shots.length - 1;

  return {
    final: shots[last],
    sample(t, out) {
      const i = THREE.MathUtils.clamp(index(t), 0, last);
      const u = i / last;
      const low = Math.min(Math.floor(i), last - 1);

      positions.getPoint(u, out.position);
      targets.getPoint(u, out.target);
      out.fov = THREE.MathUtils.lerp(shots[low].fov, shots[low + 1].fov, smoother(i - low));

      return out;
    },
  };
}
