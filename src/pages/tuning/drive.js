import { planMove, sampleMove, springTo } from "./motion";

// When the page changes reading direction the panel and the car swap sides. The car does not jump: it drives a
// short lane change (forward from left-to-right to right-to-left, reversing back the other way) while the camera
// follows it like a tracking shot and the framing moves to the other side. The studio floor and background are
// plain, so once the car has stopped, car and camera are moved back together to the origin without any visible change.

// Rear-axle path in metres: `FORWARD` along the car, `LATERAL` sideways, with zero steering at both ends.
export const FORWARD = 4.2;
export const LATERAL = 0.6;
const TRIP_TIME = 2.6;
// How fast the camera catches up with the car when it is far enough not to touch it.
const FOLLOW = 6;

const smoother = (u) => u * u * u * (u * (u * 6 - 15) + 10);
const smootherSlope = (u) => 30 * u * u * (u - 1) * (u - 1);
const smootherBend = (u) => 60 * u * (u - 1) * (2 * u - 1);

// Lateral offset of the rear axle and its first two derivatives along the path; straight before 0 and after 1.
function lane(u, lateral, out) {
  const t = Math.min(Math.max(u, 0), 1);

  out.offset = lateral * smoother(t);
  out.slope = u > 0 && u < 1 ? lateral * smootherSlope(t) : 0;
  out.bend = u > 0 && u < 1 ? lateral * smootherBend(t) : 0;

  return out;
}

const laneSample = { offset: 0, slope: 0, bend: 0 };

// Pose of the car (origin, heading) at progress `u` of a trip. The rear axle follows the path, as a real car does.
// sign: 1 forward, -1 reverse. side: 1 towards the car's left (+x), -1 towards its right. A trip may set its own
// forward and lateral lengths and a start offset (the showroom swap); otherwise it is the language drive's lane change.
export function tripPose(trip, u, out) {
  const forward = trip.forward ?? FORWARD;
  const { offset, slope, bend } = lane(u, trip.lateral ?? LATERAL, laneSample);
  const dx = trip.side * slope;
  const yaw = Math.atan2(trip.sign * dx, forward);
  const rearX = trip.side * offset + (trip.startX ?? 0);
  const rearZ = -trip.rear + trip.sign * forward * u + (trip.startZ ?? 0);

  out.x = rearX + Math.sin(yaw) * trip.rear;
  out.z = rearZ + Math.cos(yaw) * trip.rear;
  out.yaw = yaw;
  // Path curvature per metre of forward travel (positive turns left), same sign going forward or reversing.
  out.curvature = (trip.side * bend * forward) / (forward * forward + dx * dx) ** 1.5;
  // Rear-axle velocity and acceleration per unit of progress, for the body's pitch and roll.
  out.dx = dx;
  out.dz = trip.sign * forward;
  out.ddx = trip.side * bend;

  return out;
}

// Steering angles of the left and right front wheels (Ackermann: the inner wheel turns more).
export function steering(curvature, wheelbase, track, out) {
  if (Math.abs(curvature) < 1e-6) {
    out.left = 0;
    out.right = 0;

    return out;
  }

  const radius = 1 / curvature;

  out.left = Math.atan(wheelbase / (radius - track / 2));
  out.right = Math.atan(wheelbase / (radius + track / 2));

  return out;
}

export function createDrive(dir) {
  return {
    dir, // framing the camera uses when no trip is running
    want: dir, // reading direction of the page now
    trip: null,
    blend: 0, // framing progress from trip.from to trip.to
    pose: { x: 0, z: 0, yaw: 0, curvature: 0, dx: 0, dz: 0, ddx: 0 },
    anchor: { x: 0, z: 0, yaw: 0 }, // where the camera's views are measured from
    accel: { long: 0, lat: 0 }, // car-frame acceleration in m/s², for the suspension
    shift: null, // set for one frame when car and camera move back to the origin
    near: 0, // 0 when the camera is far from the car, 1 when it is close or inside (it then rides with the car)
  };
}

const sample = { value: 0, velocity: 0, acceleration: 0 };
const anchorPose = { x: 0, z: 0, yaw: 0, curvature: 0, dx: 0, dz: 0, ddx: 0 };

function replan(trip, target) {
  const distance = Math.abs(target - trip.progress.value);
  // Turning back half-way needs time to brake first.
  const { velocity, acceleration } = trip.progress;
  const towards = Math.sign(target - trip.progress.value);
  const backing = (Math.sign(velocity) === -towards ? 1.6 * Math.abs(velocity) : 0) + (Math.sign(acceleration) === -towards ? 0.6 * Math.abs(acceleration) : 0);

  trip.target = target;
  trip.time = 0;
  trip.plan = planMove(trip.progress.value, trip.progress.velocity, trip.progress.acceleration, target, Math.max(0.9, TRIP_TIME * Math.sqrt(distance)) + backing);
}

function finish(drive, trip, reached) {
  drive.dir = reached ? trip.to : trip.from;

  if (reached) {
    tripPose(trip, 1, anchorPose);
    drive.shift = { x: anchorPose.x, z: anchorPose.z };
  }

  drive.trip = null;
  drive.blend = 0;
  Object.assign(drive.pose, { x: 0, z: 0, yaw: 0, curvature: 0, dx: 0, dz: 0, ddx: 0 });
  Object.assign(drive.anchor, { x: 0, z: 0, yaw: 0 });
  drive.accel.long = 0;
  drive.accel.lat = 0;
}

// The showroom swap. The car on the floor pulls away, drives out ahead of the camera and leaves at speed; the next
// one comes in from 22 m behind, where the studio fog hides it, and slows to a stop on the presentation spot. Both
// follow a gentle lane change, so they steer, and give the same pose, acceleration and progress as a language trip,
// so wheels, suspension and dust behave the same.
const SWAPS = {
  leaving: { forward: 16, lateral: -2.6, time: 3.4, endSpeed: 1.9 },
  arriving: { forward: 22, lateral: 1.6, time: 4.4, startSpeed: 1.7 },
};

export function createSwap(kind, rear, delay = 0) {
  const swap = SWAPS[kind];
  const trip = {
    sign: 1,
    side: Math.sign(swap.lateral),
    lateral: Math.abs(swap.lateral),
    forward: swap.forward,
    rear,
    // The arriving car's path ends on the presentation spot: it starts one path length back and one shift aside.
    startX: kind === "arriving" ? -swap.lateral : 0,
    startZ: kind === "arriving" ? -swap.forward : 0,
    progress: { value: 0, velocity: (swap.startSpeed || 0) / swap.time, acceleration: 0 },
    plan: planMove(0, (swap.startSpeed || 0) / swap.time, 0, 1, swap.time, (swap.endSpeed || 0) / swap.time),
    time: -delay,
  };
  const out = { kind, trip, pose: { x: 0, z: 0, yaw: 0, curvature: 0, dx: 0, dz: 0, ddx: 0 }, accel: { long: 0, lat: 0 }, shift: null, done: false };

  tripPose(trip, 0, out.pose);

  return out;
}

export function updateSwap(swap, dt) {
  const { trip } = swap;

  trip.time += dt;

  // Holding at the start (the arriving car waits for the leaving one to clear the spot).
  if (trip.time < 0) {
    swap.accel.long = 0;
    swap.accel.lat = 0;
    return true;
  }

  Object.assign(trip.progress, sampleMove(trip.plan, trip.time, sample));

  const pose = tripPose(trip, trip.progress.value, swap.pose);
  const { velocity: v, acceleration: a } = trip.progress;
  const ax = pose.ddx * v * v + pose.dx * a;
  const az = pose.dz * a;
  const sin = Math.sin(pose.yaw);
  const cos = Math.cos(pose.yaw);

  swap.accel.long = ax * sin + az * cos;
  swap.accel.lat = ax * cos - az * sin;
  swap.done = trip.time >= trip.plan.T;

  return !swap.done;
}

// Ends a language trip at once where the page's direction now puts it (the car is about to leave the floor).
export function endTrip(drive) {
  if (drive.trip) {
    finish(drive, drive.trip, drive.want === drive.trip.to);
  }
}

// Advances the drive by one frame. `screenRight` is the camera's right direction in the world (x, z), used to
// pick the side of the lane change that carries the car towards its new place on the screen.
export function updateDrive(drive, dt, { canDrive, rear, screenRight }) {
  drive.shift = null;

  if (!drive.trip) {
    if (drive.want === drive.dir) {
      return false;
    }

    if (!canDrive) {
      drive.dir = drive.want;
      return false;
    }

    // Left-to-right to right-to-left: the car moves to the left of the screen, and back.
    const sign = drive.want === "rtl" ? 1 : -1;
    const towards = -sign; // screen direction the car moves to: -1 left, 1 right
    const side = Math.sign(towards * screenRight.x) || 1;

    drive.trip = {
      from: drive.dir,
      to: drive.want,
      sign,
      side,
      rear,
      target: 1,
      time: 0,
      plan: null,
      progress: { value: 0, velocity: 0, acceleration: 0 },
      follow: { value: 0, velocity: 0 },
    };
    replan(drive.trip, 1);
  }

  const trip = drive.trip;

  if (!canDrive) {
    finish(drive, trip, drive.want === trip.to);
    return true;
  }

  const target = drive.want === trip.to ? 1 : 0;

  if (target !== trip.target) {
    replan(trip, target);
  }

  trip.time += dt;
  Object.assign(trip.progress, sampleMove(trip.plan, trip.time, sample));
  springTo(trip.follow, trip.progress.value, FOLLOW, dt);

  const u = trip.progress.value;
  const pose = tripPose(trip, u, drive.pose);
  // Close or inside the car the camera rides with it, so it can never touch the bodywork.
  const anchorProgress = trip.follow.value + (u - trip.follow.value) * drive.near;

  tripPose(trip, anchorProgress, anchorPose);
  drive.anchor.x = anchorPose.x;
  drive.anchor.z = anchorPose.z;
  drive.anchor.yaw = anchorPose.yaw;
  drive.blend = Math.min(Math.max(anchorProgress, 0), 1);

  // Rear-axle acceleration in the world, then in the car's frame.
  const { velocity: v, acceleration: a } = trip.progress;
  const ax = pose.ddx * v * v + pose.dx * a;
  const az = pose.dz * a;
  const sin = Math.sin(pose.yaw);
  const cos = Math.cos(pose.yaw);

  drive.accel.long = ax * sin + az * cos;
  drive.accel.lat = ax * cos - az * sin;

  const settled = trip.time >= trip.plan.T && Math.abs(trip.follow.value - trip.target) < 1e-3 && Math.abs(trip.follow.velocity) < 1e-2;

  if (settled) {
    finish(drive, trip, trip.target === 1);
  }

  return true;
}
