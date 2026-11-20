import { memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import ContactShadow from "./ContactShadow";
import * as THREE from "three";
import { brushedTexture, carbonTexture, classifyParts, GROUP_PARTS, normaliseCar, rigChassis } from "./car-parts";
import { cabinWaypoint, DEFAULT_ARC, doorRail, driverEye, FRAME, hotspotPoint, PIVOT, setFrame, view } from "./camera-stops";
import { APPLIED_GROUPS, applyGroups } from "./customise";
import { createDrive, createSwap, endTrip, steering, updateDrive, updateSwap } from "./drive";
import { clearDust, createDust, emitDust, setDustLook, updateDust } from "./dust";
import { createLighting, lightingDim, prepareLampMaterials, refreshLighting, updateLighting } from "./lighting";
import { frameTime, springTo, suspend } from "./motion";

import { REFERENCE_SIZE, vehicleById, VEHICLES } from "./vehicles";

// Each car's frame (its size along each axis against the Golf's), known once its model has loaded.
const frames = new Map();

function viewPose(view) {
  return {
    position: new THREE.Vector3().fromArray(view.position),
    target: new THREE.Vector3().fromArray(view.target),
    fov: view.fov,
    doors: view.doors || 0,
    bonnet: view.bonnet || 0,
  };
}

function blend(from, to, t, arc) {
  const eased = t * t * (3 - 2 * t);
  const a = viewPose(from);
  const b = viewPose(to);
  const position = a.position.lerp(b.position, eased);
  const away = new THREE.Vector3(position.x, 0, position.z).normalize();

  // Swing wide between two outside views instead of cutting across the bodywork.
  position.addScaledVector(away, Math.sin(Math.PI * eased) * arc);

  return {
    position,
    target: a.target.lerp(b.target, eased),
    fov: THREE.MathUtils.lerp(a.fov, b.fov, eased),
    doors: THREE.MathUtils.lerp(a.doors, b.doors, eased),
    bonnet: THREE.MathUtils.lerp(a.bonnet, b.bonnet, eased),
  };
}

function poseAt(progress, stops) {
  const last = stops.length - 1;
  const clamped = THREE.MathUtils.clamp(progress, 0, last);
  const index = Math.min(Math.floor(clamped), last - 1);
  const t = clamped - index;
  const from = stops[index];
  const to = stops[index + 1];

  // Between the seats and the cockpit the camera runs on the door rail (see camera-stops.js). Leaving the cockpit
  // for another view, it first runs back out along it.
  if (from.id === "seats" && to.id === "cockpit") {
    return onRail(blend(from, to, t, 0), t);
  }

  if (from.id === "cockpit" && to.id !== "seats") {
    const seats = view("seats");

    return t < 0.5 ? onRail(blend(from, seats, t * 2, 0), 1 - t * 2) : blend(seats, to, t * 2 - 1, DEFAULT_ARC);
  }

  return blend(from, to, t, Math.min(from.arc ?? DEFAULT_ARC, to.arc ?? DEFAULT_ARC));
}

// `t`: progress from the seats view to the cockpit; the rail position uses the same easing as every other blend.
function onRail(pose, t) {
  pose.rail = t * t * (3 - 2 * t);
  doorRail(pose.rail, pose.position);

  return pose;
}

// Nearest point of the door rail to `point`, as { u, distance }, by sampling then refining.
const railProbe = new THREE.Vector3();

function nearestOnRail(point) {
  let best = 0;
  let bestDistance = Infinity;

  for (let index = 0; index <= 40; index += 1) {
    const distance = doorRail(index / 40, railProbe).distanceToSquared(point);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = index / 40;
    }
  }

  for (let step = 1 / 80; step > 1e-4; step /= 2) {
    for (const u of [best - step, best + step]) {
      const distance = doorRail(THREE.MathUtils.clamp(u, 0, 1), railProbe).distanceToSquared(point);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = THREE.MathUtils.clamp(u, 0, 1);
      }
    }
  }

  return { u: best, distance: Math.sqrt(bestDistance) };
}

function railTarget(u, out) {
  const from = view("seats").target;
  const to = view("cockpit").target;

  return out.set(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u);
}

// The camera's position before the portrait step-back, to find it on the rail.
function toRailSpace(local, aspect, out) {
  if (aspect >= 1) {
    return out.copy(local);
  }

  // The step-back only moves points along their line to the target, so search the stepped-back rail instead.
  let best = null;
  let bestDistance = Infinity;
  const probe = new THREE.Vector3();
  const target = new THREE.Vector3();

  for (let index = 0; index <= 40; index += 1) {
    const u = index / 40;
    const distance = stepBack(doorRail(u, probe), railTarget(u, target), aspect).distanceToSquared(local);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = u;
    }
  }

  return bestDistance < 0.12 * 0.12 ? doorRail(best, out) : out.copy(local);
}

// Portrait screens are narrow, so views outside the car step back to keep the whole car in frame. The step-back
// fades in between 1.6 m and 2.4 m from the car's centre (every resting view is either inside 1.6 m or beyond 2.4 m),
// so a camera passing through the door does not jump when it crosses that distance.
function stepBack(position, target, aspect) {
  const amount = THREE.MathUtils.smoothstep(position.distanceTo(PIVOT), 1.6, 2.4);

  if (aspect < 1 && amount > 0) {
    position.sub(target).multiplyScalar(1 + (Math.min(2, 1 + (1 - aspect) * 1.7) - 1) * amount).add(target);
  }

  return position;
}

// Camera motion outside the car: critically damped springs on its place around the car (angle, height, distance),
// its aim and its lens. It leaves at rest, gathers speed and settles with no overshoot, and a new goal half-way
// keeps its speed instead of jerking. Following the scroll is quicker than moving to a chosen shot.
const FOLLOW = 7.5;
const SHOT = 4.4;
const sphereNow = new THREE.Spherical();
const sphereGoal = new THREE.Spherical();
const sphereLast = new THREE.Spherical();
const offsetNow = new THREE.Vector3();
const scratch = { value: 0, velocity: 0 };
const wrapAngle = (angle) => THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;

function spring(value, velocity, goal, omega, dt) {
  scratch.value = value;
  scratch.velocity = velocity;
  springTo(scratch, goal, omega, dt);

  return scratch;
}

// Around the car (not through it) while both points are outside; straight lines near and inside the cabin, where the
// door waypoints keep the camera clear of the bodywork.
function moveCamera(rig, local, goal, omega, dt, step) {
  offsetNow.copy(local).sub(PIVOT);

  if (offsetNow.length() < 1.6 || goal.distanceTo(PIVOT) < 1.6 || step === 1) {
    rig.orbit = null;
    local.lerp(goal, step);
    return;
  }

  sphereNow.setFromVector3(offsetNow);
  sphereGoal.setFromVector3(offsetNow.copy(goal).sub(PIVOT));

  // Joining the orbit (after the intro, the cabin or the 360° view): carry on at the speed the camera already had.
  if (!rig.orbit) {
    sphereLast.setFromVector3(offsetNow.copy(rig.last).sub(PIVOT));
    const lastDt = Math.max(rig.lastDt, 1e-3);

    rig.orbit = {
      theta: wrapAngle(sphereNow.theta - sphereLast.theta) / lastDt,
      phi: (sphereNow.phi - sphereLast.phi) / lastDt,
      radius: (sphereNow.radius - sphereLast.radius) / lastDt,
    };
  }

  const { orbit } = rig;
  let next = spring(sphereNow.theta, orbit.theta, sphereNow.theta + wrapAngle(sphereGoal.theta - sphereNow.theta), omega, dt);

  sphereNow.theta = next.value;
  orbit.theta = next.velocity;
  next = spring(sphereNow.phi, orbit.phi, sphereGoal.phi, omega, dt);
  sphereNow.phi = next.value;
  orbit.phi = next.velocity;
  next = spring(sphereNow.radius, orbit.radius, sphereGoal.radius, omega, dt);
  sphereNow.radius = next.value;
  orbit.radius = next.velocity;
  local.setFromSpherical(sphereNow).add(PIVOT);
}

// The opening shot: the camera finds the car low and almost head-on, then arcs round to the three-quarter view while
// it rises and draws closer, and comes to rest on it. It never blocks the page: a scroll or a click takes over at once.
const INTRO_TIME = 2.4;
// Once per visit: coming back from the request scene remounts the camera, and the car is already presented.
let introPlayed = false;
const smoother = (u) => u * u * u * (u * (u * 6 - 15) + 10);

function introPose(u) {
  const hero = view("hero");
  const e = smoother(THREE.MathUtils.clamp(u, 0, 1));
  const end = new THREE.Spherical().setFromVector3(new THREE.Vector3().fromArray(hero.position).sub(PIVOT));
  const start = end.clone();

  start.theta = end.theta - 0.62;
  start.radius = end.radius * 1.28;
  start.phi = Math.min(Math.PI / 2 - 0.01, end.phi + 0.07);

  const sphere = new THREE.Spherical(
    THREE.MathUtils.lerp(start.radius, end.radius, e),
    THREE.MathUtils.lerp(start.phi, end.phi, e),
    THREE.MathUtils.lerp(start.theta, end.theta, e),
  );
  const from = new THREE.Vector3(0, 0.55 * FRAME.y, 0.9 * FRAME.z);

  return {
    position: new THREE.Vector3().setFromSpherical(sphere).add(PIVOT),
    target: from.lerp(new THREE.Vector3().fromArray(hero.target), e),
    fov: THREE.MathUtils.lerp(21, hero.fov, e),
    doors: 0,
    bonnet: 0,
  };
}

// Camera views are measured from the car's resting place (the anchor). The anchor only moves while the car drives
// to its other side of the screen; the camera then follows it (see drive.js).
function toCar(world, anchor, out) {
  const dx = world.x - anchor.x;
  const dz = world.z - anchor.z;
  const cos = Math.cos(anchor.yaw);
  const sin = Math.sin(anchor.yaw);

  return out.set(dx * cos - dz * sin, world.y, dx * sin + dz * cos);
}

function fromCar(local, anchor, out) {
  const cos = Math.cos(anchor.yaw);
  const sin = Math.sin(anchor.yaw);

  return out.set(anchor.x + local.x * cos + local.z * sin, local.y, anchor.z - local.x * sin + local.z * cos);
}

// Horizontal framing on wide screens: the car is centred in the free space between the option panel and the section
// rail (measured by the page), so it is framed the same in both reading directions even though the car does not
// look symmetric from most views. Close up, when the whole car does not fit, the view's subject is centred instead.
const fallbackOffset = (dir) => (dir === "rtl" ? 0.12 : -0.12);
const corner = new THREE.Vector3();

function screenX(point, camera, width) {
  corner.copy(point).applyMatrix4(camera.matrixWorldInverse);

  if (corner.z > -0.05) {
    return null;
  }

  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect;

  return ((corner.x / -corner.z / half + 1) / 2) * width;
}

// Screen x (without view offset) of what the framing centres for the car at `pose`: the whole car when it fits in
// the free space, the view's subject (`target`, in the car's frame) when it does not.
function subjectX(camera, drive, pose, target, width, room, probe) {
  const { min, max } = drive.box;
  let left = Infinity;
  let right = -Infinity;
  let behind = false;

  for (let index = 0; index < 8; index += 1) {
    probe.set(index & 1 ? max.x : min.x, index & 2 ? max.y : min.y, index & 4 ? max.z : min.z);

    const x = screenX(fromCar(probe, pose, probe), camera, width);

    if (x === null) {
      behind = true;
      break;
    }

    left = Math.min(left, x);
    right = Math.max(right, x);
  }

  const subject = screenX(fromCar(target, pose, probe), camera, width) ?? width / 2;

  // Camera inside or against the car: part of it is behind the camera, so the outline has no meaning (and its
  // unset edges would make the offset NaN, which blanks the whole picture). Centre the view's subject.
  if (behind) {
    return subject;
  }

  const fit = 1 - THREE.MathUtils.smoothstep((right - left) / room, 0.95, 1.35);

  return THREE.MathUtils.lerp(subject, (left + right) / 2, fit);
}

// Where a shot puts the car on a phone, from the shot itself (not the moving camera, so the answer does not chase its
// own tail): the step-back that fits the whole car into the room, and the vertical view offset (a fraction of the
// screen height) that centres it there, or centres the view's subject for close-ups and views from inside the car.
const shotCorner = new THREE.Vector3();
const shotLook = new THREE.Vector3();

function placeShot(camera, pose, drive, size, room, whole) {
  const { width, height } = size;
  const { min, max } = drive.box;

  camera.fov = pose.fov;
  camera.aspect = width / Math.max(height, 1);
  camera.near = 0.02;
  camera.far = 80;
  camera.updateProjectionMatrix();
  fromCar(pose.position, drive.anchor, camera.position);
  camera.lookAt(fromCar(pose.target, drive.anchor, shotLook));
  camera.updateMatrixWorld();

  const roomHeight = Math.max(room.bottom - room.top, 40);
  const roomMiddle = (room.top + room.bottom) / 2;
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;

  for (let index = 0; index < 8; index += 1) {
    shotCorner.set(index & 1 ? max.x : min.x, index & 2 ? max.y : min.y, index & 4 ? max.z : min.z);
    fromCar(shotCorner, drive.anchor, shotCorner).applyMatrix4(camera.matrixWorldInverse);

    if (shotCorner.z > -0.05) {
      top = null;
      break;
    }

    shotCorner.applyMatrix4(camera.projectionMatrix);
    top = Math.min(top, ((1 - shotCorner.y) / 2) * height);
    bottom = Math.max(bottom, ((1 - shotCorner.y) / 2) * height);
    left = Math.min(left, ((shotCorner.x + 1) / 2) * width);
    right = Math.max(right, ((shotCorner.x + 1) / 2) * width);
  }

  // Part of the car behind the camera, or a close-up wider than the screen: centre the subject (the screen centre).
  if (top === null || !whole || right - left > width * 1.05) {
    return { fit: 1, y: (height / 2 - roomMiddle) / height };
  }

  const fit = THREE.MathUtils.clamp((bottom - top) / (roomHeight * 0.92), 1, 1.6);
  const middle = height / 2 + ((top + bottom) / 2 - height / 2) / fit;

  return { fit, y: (middle - roomMiddle) / height };
}

function CameraRig({ progressRef, focusView, free, reduceMotion, doorsRef, bonnetRef, driveRef, framingRef, sections }) {
  const aim = useRef(new THREE.Vector3().fromArray(view("hero").target));
  const rig = useRef({
    anchor: { x: 0, z: 0, yaw: 0 },
    offset: { x: null, y: 0, start: 0 },
    trip: null,
    rail: null,
    orbit: null,
    aimVelocity: new THREE.Vector3(),
    lens: { value: view("hero").fov, velocity: 0 },
    last: new THREE.Vector3(),
    start: new THREE.Vector3(),
    lastDt: 1 / 60,
    intro: { state: introPlayed ? "done" : "waiting", time: 0 },
    fit: 1,
    shot: new THREE.PerspectiveCamera(),
    local: new THREE.Vector3(),
    look: new THREE.Vector3(),
    probe: new THREE.Vector3(),
  });
  const invalidateScene = useThree((state) => state.invalidate);

  // New props reach the scene after the page's own redraw request, so ask for a frame here too.
  useEffect(() => {
    invalidateScene();
  }, [focusView, free, invalidateScene]);

  useFrame((state, delta) => {
    const { camera, invalidate, size, scene } = state;
    const drive = driveRef.current;
    const current = rig.current;
    const dt = frameTime(delta);
    const intro = current.intro;

    if (free || !drive) {
      camera.clearViewOffset();
      current.offset.x = 0;
      current.offset.y = 0;
      current.orbit = null;
      current.aimVelocity.set(0, 0, 0);
      current.lens.velocity = 0;
      Object.assign(current.anchor, drive?.anchor);
      aim.current.copy(PIVOT);
      doorsRef.current = 0;
      bonnetRef.current = 0;

      if (free && intro.state !== "done") {
        intro.state = "done";
      }

      return;
    }

    if (!drive.mounted && !drive.trip) {
      drive.dir = drive.want;
    }

    const local = toCar(camera.position, current.anchor, current.local);
    const start = current.start.copy(local);
    const stops = sections.map((section) => ({ ...view(section.view), id: section.view }));
    const aspect = size.width / Math.max(size.height, 1);

    // The opening shot starts once the car is on the floor, unless the page opened part-way down, on a chosen view,
    // or for a visitor who prefers less motion. It ends early as soon as the visitor scrolls or picks a view.
    if (intro.state === "waiting" && drive.box) {
      intro.state = reduceMotion || focusView || progressRef.current > 0.02 ? "done" : "playing";
      introPlayed = true;
    } else if (intro.state === "playing" && (focusView || progressRef.current > 0.02)) {
      intro.state = "done";
    }

    const playing = intro.state === "playing";

    if (playing) {
      // Clamped frame time: the frame that compiles the car's shaders does not skip the start of the shot.
      intro.time += dt;

      if (intro.time >= INTRO_TIME) {
        intro.state = "done";
      }
    }

    const pose = playing ? introPose(intro.time / INTRO_TIME) : focusView ? viewPose(view(focusView)) : poseAt(progressRef.current, stops);
    const reach = pose.position.distanceTo(PIVOT);

    // Portrait screens are narrow: step back so the whole car stays in frame; in the cabin the camera cannot step
    // back, so it widens instead.
    if (aspect < 1) {
      const inside = 1 - THREE.MathUtils.smoothstep(pose.position.distanceTo(PIVOT), 1.6, 2.4);

      stepBack(pose.position, pose.target, aspect);
      pose.fov = Math.min(pose.fov * (1 + (1 - aspect) * 0.6 * inside), 80);
    }

    // Phones: the car belongs in the room between the console at the top and the option sheet below. A shot of the
    // whole car steps back when that room is short (small phones, a tall sheet); close-ups keep their size.
    const wide = size.width > 860;
    const room = framingRef.current;
    const phoneRoom = !wide && room?.phone && drive.box ? room : null;
    const whole = reach > 6.5 && pose.rail === undefined;
    const shot = phoneRoom && placeShot(current.shot, pose, drive, size, phoneRoom, whole);
    const fitGoal = shot ? shot.fit : 1;

    current.fit = reduceMotion ? fitGoal : current.fit + (fitGoal - current.fit) * (1 - Math.exp(-dt * 5));

    if (current.fit !== 1) {
      pose.position.sub(pose.target).multiplyScalar(current.fit).add(pose.target);
    }

    // Enter and leave the cabin through the open driver door, never through the bodywork.
    // Waypoints are fixed points, so they come after the portrait step-back.
    const step = reduceMotion ? 1 : 1 - Math.exp(-dt * (focusView ? 3.2 : 4.5));
    const omega = focusView ? SHOT : FOLLOW;
    let lensGoal = pose.fov;

    current.lens.value = camera.fov;

    // On the door rail the camera's place along the rail follows the scroll on a critically damped spring, so it
    // glides through the door opening with no change of speed even when the wheel scrolls in steps. It joins the
    // rail only when it is already on it (normally at the seats view or in the cockpit); otherwise the waypoints
    // bring it to the door first.
    if (pose.rail === undefined) {
      current.rail = null;
    } else if (current.rail === null) {
      const near = nearestOnRail(toRailSpace(local, aspect, current.probe));

      current.rail = near.distance < 0.12 ? { value: near.u, velocity: 0 } : null;
    }

    if (playing) {
      // On the shot's path exactly; the springs take over from its speed when it ends or is cut short.
      local.copy(pose.position);
      current.orbit = null;
      current.aimVelocity.copy(pose.target).sub(aim.current).divideScalar(Math.max(dt, 1e-3));
      aim.current.copy(pose.target);
      current.lens.velocity = (pose.fov - current.lens.value) / Math.max(dt, 1e-3);
      current.lens.value = pose.fov;
    } else if (current.rail !== null) {
      current.orbit = null;
      springTo(current.rail, pose.rail, 7, reduceMotion ? 10 : dt);
      current.rail.value = THREE.MathUtils.clamp(current.rail.value, 0, 1);
      stepBack(doorRail(current.rail.value, local), railTarget(current.rail.value, current.probe), aspect);
      // Aim and lens follow the camera's own place on the rail, so position, view and focal length move as one.
      lensGoal = THREE.MathUtils.lerp(view("seats").fov, view("cockpit").fov, current.rail.value);

      if (aspect < 1) {
        lensGoal = Math.min(lensGoal * (1 + (1 - aspect) * 0.6 * (1 - THREE.MathUtils.smoothstep(doorRail(current.rail.value, current.look).distanceTo(PIVOT), 1.6, 2.4))), 80);
      }

      aim.current.copy(current.probe);
      current.aimVelocity.set(0, 0, 0);
      current.lens.value = lensGoal;
      current.lens.velocity = 0;
    } else {
      const waypoint = cabinWaypoint(local.toArray(), pose.position.toArray());

      if (waypoint) {
        pose.position.fromArray(waypoint);
        pose.doors = 1;
      }

      moveCamera(current, local, pose.position, omega, dt, step);
    }

    // Where the camera was at the start of this frame, to know its speed if it joins the orbit next frame.
    current.last.copy(start);
    current.lastDt = dt;

    if (!playing && current.rail === null) {
      if (reduceMotion) {
        aim.current.copy(pose.target);
        current.aimVelocity.set(0, 0, 0);
        current.lens.value = lensGoal;
        current.lens.velocity = 0;
      } else {
        for (const axis of ["x", "y", "z"]) {
          const next = spring(aim.current[axis], current.aimVelocity[axis], pose.target[axis], omega, dt);

          aim.current[axis] = next.value;
          current.aimVelocity[axis] = next.velocity;
        }

        const next = spring(current.lens.value, current.lens.velocity, lensGoal, omega, dt);

        current.lens.value = next.value;
        current.lens.velocity = next.velocity;
      }
    }

    fromCar(local, drive.anchor, camera.position);
    camera.lookAt(fromCar(aim.current, drive.anchor, current.look));
    Object.assign(current.anchor, drive.anchor);
    // Close to or inside the car the camera rides with it when it drives; far away it follows like a tracking shot.
    drive.near = 1 - THREE.MathUtils.smoothstep(local.distanceTo(PIVOT), 3.2, 6);
    doorsRef.current = pose.doors;
    bonnetRef.current = pose.bonnet;

    camera.fov = current.lens.value;
    camera.aspect = size.width / Math.max(size.height, 1);
    camera.updateMatrixWorld();

    // The floor fades into the background a fixed way behind the car, however far back the camera stands (the side
    // profile and portrait screens stand far back).
    if (scene.fog) {
      scene.fog.near = Math.max(14, local.distanceTo(PIVOT) + 4.5);
      scene.fog.far = scene.fog.near + 16;
    }

    // Keep the car clear of the option panel: beside it on wide screens, above the bottom sheet on phones.
    const framing = wide && room && !room.phone && drive.box;
    const offset = current.offset;
    const centre = framing ? (room.left + room.right) / 2 : 0;
    const restX = framing ? subjectX(camera, drive, drive.anchor, aim.current, size.width, room.right - room.left, current.probe) : 0;
    let goalX = framing ? (restX - centre) / size.width : wide ? fallbackOffset(drive.trip ? drive.trip.to : drive.dir) : 0;
    // Phones: in the room between the console and the sheet (measured by the page), else a fixed lift.
    const goalY = wide ? 0 : shot ? shot.y : 0.14;
    const ease = reduceMotion ? 1 : 1 - Math.exp(-dt * 8);

    if (drive.trip !== current.trip) {
      current.trip = drive.trip;
      // Where the car is on the screen when it sets off.
      offset.start = framing ? restX - (offset.x ?? goalX) * size.width : (offset.x ?? goalX);
    }

    if (drive.trip && framing) {
      // While it drives across, the car itself follows an eased path on the screen, from where it was to the middle of
      // its new free space, at its own pace; the camera's lag only changes the perspective.
      const carX = subjectX(camera, drive, drive.pose, aim.current, size.width, room.right - room.left, current.probe);
      const progress = THREE.MathUtils.clamp(drive.trip.progress.value, 0, 1);

      goalX = (carX - THREE.MathUtils.lerp(offset.start, centre, progress)) / size.width;
      offset.x = goalX;
    } else if (drive.trip) {
      offset.x = THREE.MathUtils.lerp(offset.start, goalX, drive.blend);
    } else {
      offset.x = offset.x === null ? goalX : offset.x + (goalX - offset.x) * ease;
    }

    offset.y += (goalY - offset.y) * ease;
    camera.setViewOffset(size.width, size.height, offset.x * size.width, offset.y * size.height, size.width, size.height);
    camera.updateProjectionMatrix();

    const framed = Math.abs(offset.x - goalX) < 1e-4 && Math.abs(offset.y - goalY) < 1e-4;
    const moving =
      playing ||
      local.distanceToSquared(pose.position) > 1e-6 ||
      aim.current.distanceToSquared(pose.target) > 1e-6 ||
      Math.abs(current.lens.value - lensGoal) > 1e-3 ||
      current.aimVelocity.lengthSq() > 1e-6 ||
      (current.orbit && Math.abs(current.orbit.theta) + Math.abs(current.orbit.phi) + Math.abs(current.orbit.radius) > 1e-4);

    if (moving || !framed) {
      invalidate();
    }
  });

  return null;
}

function FreeControls({ free }) {
  const controls = useRef(null);
  const get = useThree((state) => state.get);
  const inside = free === "inside";

  useEffect(() => {
    const { camera, invalidate } = get();
    const orbit = controls.current;

    if (!orbit) {
      return;
    }

    if (inside) {
      const eye = new THREE.Vector3().fromArray(driverEye());

      camera.position.copy(eye);
      orbit.target.copy(eye).add(new THREE.Vector3(0, -0.015, 0.05));
      camera.fov = 70;
    } else {
      orbit.target.copy(PIVOT);

      if (camera.position.distanceTo(PIVOT) < 3.2) {
        camera.position.set(5.2, 1.8, 5.6);
      }

      camera.fov = 34;
    }

    camera.updateProjectionMatrix();
    orbit.update();
    invalidate();
  }, [inside, get]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={inside ? -0.35 : 0.6}
      enableZoom={!inside}
      minDistance={inside ? 0.03 : 3.2}
      maxDistance={inside ? 0.08 : 11}
      minPolarAngle={inside ? 0.6 : 0.15}
      maxPolarAngle={inside ? 2.3 : Math.PI / 2 - 0.04}
    />
  );
}

function Hotspots({ spots, labels, onSelect }) {
  const refs = useRef({});
  const normal = useMemo(() => new THREE.Vector3(), []);
  const toCamera = useMemo(() => new THREE.Vector3(), []);

  // Only the points on the side facing the camera are shown and focusable.
  useFrame(({ camera }) => {
    spots.forEach((spot) => {
      const node = refs.current[spot.id];

      if (!node) return;

      const point = hotspotPoint(spot);

      normal.fromArray(point).sub(PIVOT).setY(0.25).normalize();
      toCamera.copy(camera.position).sub(new THREE.Vector3().fromArray(point)).normalize();

      const visible = normal.dot(toCamera) > 0.15;

      node.dataset.hidden = visible ? "false" : "true";
      node.tabIndex = visible ? 0 : -1;
    });
  });

  return spots.map((spot) => (
    <Html key={spot.id} position={hotspotPoint(spot)} center zIndexRange={[12, 11]}>
      <button
        type="button"
        ref={(node) => {
          refs.current[spot.id] = node;
        }}
        className="tz-hotspot"
        data-hidden="false"
        onClick={() => onSelect(spot)}
      >
        <span className="tz-hotspot__dot" aria-hidden="true" />
        <span className="tz-hotspot__label">{labels[spot.id]}</span>
      </button>
    </Html>
  ));
}

// Opens the driver door when the camera goes to the seats or the cockpit.
function useDoors(car, animations, clipName, doorsRef, reduceMotion) {
  const doors = useRef(null);

  useLayoutEffect(() => {
    const clip = clipName && animations.find((item) => item.name === clipName);

    if (!clip) {
      doors.current = null;
      return undefined;
    }

    const mixer = new THREE.AnimationMixer(car);
    const action = mixer.clipAction(clip);

    action.play();
    action.paused = true;
    doors.current = { mixer, action, duration: clip.duration, open: { value: 0, velocity: 0 } };

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(car);
    };
  }, [car, animations, clipName]);

  useFrame((state, delta) => {
    const current = doors.current;

    if (!current) {
      return;
    }

    const goal = doorsRef.current;
    const open = current.open;

    if (open.value === goal && open.velocity === 0) {
      return;
    }

    // About a second to swing open or shut, starting and stopping softly, on the model's own hinge animation.
    springTo(open, goal, 4.6, reduceMotion ? 10 : frameTime(delta));

    if (Math.abs(goal - open.value) < 1e-4 && Math.abs(open.velocity) < 1e-3) {
      open.value = goal;
      open.velocity = 0;
    } else {
      state.invalidate();
    }

    current.action.time = THREE.MathUtils.clamp(open.value, 0, 1) * current.duration * 0.999;
    current.mixer.update(0);
  });
}

// Raises the bonnet on its hinge for the engine views; it closes again everywhere else.
const BONNET_ANGLE = THREE.MathUtils.degToRad(58);

function useBonnet(node, bonnetRef, reduceMotion) {
  const hingeRef = useRef(null);
  const angle = useRef({ value: 0, velocity: 0 });

  useLayoutEffect(() => {
    hingeRef.current = node;
  }, [node]);

  useFrame((state, delta) => {
    const hinge = hingeRef.current;

    if (!hinge) {
      return;
    }

    const goal = bonnetRef.current * BONNET_ANGLE;
    const current = angle.current;

    if (current.value === goal && current.velocity === 0) {
      return;
    }

    springTo(current, goal, 3.6, reduceMotion ? 10 : frameTime(delta));

    if (Math.abs(goal - current.value) < 1e-4 && Math.abs(current.velocity) < 1e-3) {
      current.value = goal;
      current.velocity = 0;
    } else {
      state.invalidate();
    }

    hinge.rotation.x = current.value;
  });
}

// Drives the car across when the page changes reading direction (see drive.js): moves it along the path, spins
// each wheel and disc by the distance it really rolls, steers the front wheels (Ackermann), lets the body pitch and
// roll on its suspension, and kicks up dust at the tyres.
const PITCH_PER_ACCEL = 0.0045; // rad per m/s²: the nose rises when pulling away and dips when braking
const ROLL_PER_ACCEL = 0.008; // rad per m/s²: the body leans out of the turn

// stage: "present" (the car on the floor: the language drive moves it, the camera frames it), "waiting" (loaded,
// parked out of sight), "leaving" or "arriving" (its own swap path; onSwapDone once it is out or in place).
function useDrive({ chassis, driveRef, swapRef, stage, onSwapDone, groupRef, dust, reduceMotion, free, allWheelDrive }) {
  const motion = useRef(null);
  const reported = useRef(null);

  if (motion.current === null) {
    motion.current = {
      pitch: { value: 0, velocity: 0 },
      roll: { value: 0, velocity: 0 },
      hubs: [],
      hubsValid: false,
      pose: { x: 0, z: 0, yaw: 0 },
      turn: { left: 0, right: 0 },
      euler: new THREE.Euler(),
      pivot: new THREE.Vector3(),
      travel: { x: 0, z: 0 },
      at: { x: 0, z: 0 },
    };
  }

  useFrame((state, delta) => {
    const presented = stage === "present";
    const drive = presented ? driveRef.current : swapRef.current;
    const group = groupRef.current;
    const m = motion.current;

    if (!drive || !group) {
      return;
    }

    if (!chassis) {
      if (presented) drive.dir = drive.want;
      return;
    }

    const dt = frameTime(delta);
    const e = state.camera.matrixWorld.elements;
    let driving;

    if (presented) {
      driving = updateDrive(drive, dt, {
        canDrive: !reduceMotion && !free && state.size.width > 860,
        rear: chassis.rear,
        screenRight: { x: e[0], z: e[2] },
      });
    } else {
      driving = stage !== "waiting" && updateSwap(drive, reduceMotion ? 60 : dt);

      if (drive.done && reported.current !== stage) {
        reported.current = stage;
        onSwapDone(stage);
      }
    }

    const pose = drive.pose;

    group.position.set(pose.x, 0, pose.z);
    group.rotation.y = pose.yaw;

    // Wheels: steering from the path's curvature, spin from how far each hub really travelled since the last frame.
    const turn = drive.trip ? steering(pose.curvature, chassis.wheelbase, chassis.track, m.turn) : steering(0, 1, 1, m.turn);
    const cos = Math.cos(pose.yaw);
    const sin = Math.sin(pose.yaw);
    let rearSpin = 0;

    chassis.corners.forEach((corner, index) => {
      const angle = corner.front ? (corner.left ? turn.left : turn.right) : 0;
      const x = pose.x + corner.hub.x * cos + corner.hub.z * sin;
      const z = pose.z - corner.hub.x * sin + corner.hub.z * cos;
      const hub = m.hubs[index] || (m.hubs[index] = { x, z });

      if (corner.steer) {
        corner.steer.rotation.y = angle;
      }

      if (m.hubsValid && drive.trip) {
        const heading = pose.yaw + angle;

        m.travel.x = x - hub.x;
        m.travel.z = z - hub.z;

        const rolled = (m.travel.x * Math.sin(heading) + m.travel.z * Math.cos(heading)) / corner.radius;

        corner.spin.forEach((node) => {
          node.rotation.x -= rolled;
        });

        if (!corner.front) {
          rearSpin += rolled / 2;
        }

        // Dust: a little from every rolling tyre, more from the driven wheels while the car pulls away.
        const speed = Math.hypot(m.travel.x, m.travel.z) / dt;
        const pulling = Math.max(0, drive.accel.long * Math.sign(drive.trip.progress.velocity * drive.trip.sign));
        const driven = corner.front || allWheelDrive;
        const rate = speed * 3.5 + (driven ? pulling * 22 : 0);

        if (rate > 0.5) {
          m.at.x = x;
          m.at.z = z;
          m.travel.x /= dt;
          m.travel.z /= dt;
          emitDust(dust, m.at, m.travel, rate, dt);
        }
      }

      hub.x = x;
      hub.z = z;
    });

    chassis.rearDiscs.forEach((node) => {
      node.rotation.x -= rearSpin;
    });
    m.hubsValid = Boolean(drive.trip);

    // Body on its suspension: a slightly underdamped spring towards the lean the acceleration asks for.
    suspend(m.pitch, drive.accel.long * PITCH_PER_ACCEL, 9, 0.72, dt);
    suspend(m.roll, -drive.accel.lat * ROLL_PER_ACCEL, 9, 0.72, dt);

    const settling = Math.abs(m.pitch.value) + Math.abs(m.roll.value) > 1e-5 || Math.abs(m.pitch.velocity) + Math.abs(m.roll.velocity) > 1e-4;

    if (!settling && !driving) {
      m.pitch.value = 0;
      m.roll.value = 0;
      m.pitch.velocity = 0;
      m.roll.velocity = 0;
    }

    m.euler.set(m.pitch.value, 0, m.roll.value);
    chassis.body.quaternion.setFromEuler(m.euler);
    chassis.body.position.copy(chassis.pivot).sub(m.pivot.copy(chassis.pivot).applyQuaternion(chassis.body.quaternion));

    const dusty = updateDust(dust, dt, drive.shift, (state.size.height * state.viewport.dpr) / 2);

    if (driving || settling || dusty) {
      state.invalidate();
    }
  }, -1);
}

// The contact shadow is drawn once; it sits under the car and drives with it.
const Shadow = memo(function Shadow({ mode, ready }) {
  return <ContactShadow opacity={mode === "dark" ? 0.85 : 0.55} ready={ready} />;
});

// A short glow on the parts of the option group the user just opened.
function usePulse(parts, pulse, reduceMotion) {
  const active = useRef(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const keys = pulse && GROUP_PARTS[pulse.group];

    if (!keys || reduceMotion) {
      return undefined;
    }

    const materials = keys.flatMap((key) => parts[key] || []);

    active.current = { materials, start: performance.now(), base: materials.map((m) => ({ color: m.emissive.clone(), intensity: m.emissiveIntensity })) };
    invalidate();

    return () => {
      const current = active.current;

      current?.materials.forEach((material, index) => {
        material.emissive.copy(current.base[index].color);
        material.emissiveIntensity = current.base[index].intensity;
      });
      active.current = null;
    };
  }, [parts, pulse, reduceMotion, invalidate]);

  useFrame((state) => {
    const current = active.current;

    if (!current) {
      return;
    }

    const t = (performance.now() - current.start) / 1100;
    const glow = t >= 1 ? 0 : Math.sin(Math.PI * t) ** 2 * 0.45;

    current.materials.forEach((material, index) => {
      material.emissive.copy(current.base[index].color).addScalar(glow);
      material.emissiveIntensity = glow > 0 ? 1 : current.base[index].intensity;
    });

    if (t < 1) {
      state.invalidate();
    } else {
      active.current = null;
    }
  });
}

// The car's own lights (see lighting.js). They live in the drive group, so they travel with the car.
function useLighting({ lighting, parts, setup, inspecting, reduceMotion, dimRef }) {
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    prepareLampMaterials(parts);
  }, [parts]);

  useEffect(() => {
    invalidate();
  }, [inspecting, invalidate]);

  useEffect(() => () => lighting.dispose(), [lighting]);

  useFrame((state, delta) => {
    const moving = updateLighting(lighting, parts, setup, inspecting, reduceMotion ? 10 : frameTime(delta));
    const dim = lightingDim(lighting);

    // The studio applies the dim in its own frame callback, which runs first: one more frame shows the new value.
    if (moving || dim !== dimRef.current) {
      state.invalidate();
    }

    dimRef.current = dim;
  });
}

const CLOSED = { current: 0 };
const UNUSED = { current: 0 };

// One car of the showroom. Only the car on the floor ("present") follows the camera's doors, bonnet and dimming,
// shows the selection glow and answers the language drive; a car leaving or arriving drives its own swap path.
// One draw of the scene with both cars in view, so the waiting car's geometry is on the GPU and every shader either car
// needs is built before the swap: the glass pass draws the other car too, which a car without see-through glass never
// needed on its own. Drawn on the canvas itself, clipped to one pixel (a render target would build other shader
// variants), then the real frame is drawn again over it.
function warmUp(gl, world, camera, group) {
  if (!group) return;

  const box = new THREE.Box3();

  world.traverse((node) => node.name?.startsWith("car:") && box.expandByObject(node));

  const centre = box.getCenter(new THREE.Vector3());
  const reach = box.getSize(new THREE.Vector3()).length();
  const probe = camera.clone();
  const scissor = gl.getScissor(new THREE.Vector4());
  const scissorTest = gl.getScissorTest();
  const visible = group.visible;

  probe.clearViewOffset();
  probe.position.copy(centre).add(new THREE.Vector3(reach * 0.9, reach * 0.6, 0));
  probe.lookAt(centre);
  probe.fov = 60;
  probe.aspect = 1.6;
  probe.far = reach * 4;
  probe.updateProjectionMatrix();
  group.visible = true;
  gl.setScissorTest(true);
  gl.setScissor(0, 0, 1, 1);
  gl.render(world, probe);
  gl.setScissor(scissor);
  gl.setScissorTest(scissorTest);
  group.visible = visible;
  gl.render(world, camera);
}

function Car({ vehicle, stage, onLoaded, onSwapDone, setup, doorsRef, bonnetRef, reduceMotion, pulse, driveRef, free, mode, inspecting, dimRef }) {
  const { scene, animations } = useGLTF(vehicle.url, false, true);
  const getState = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);
  const presented = stage === "present";
  const { car, parts, chassis, frame } = useMemo(() => {
    const root = normaliseCar(scene.clone(true), vehicle.length);
    // Before classifyParts, so the ride height is read from the sprung groups in their new parent.
    const rig = rigChassis(root, vehicle.chassis);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());

    return {
      car: root,
      parts: classifyParts(root, vehicle.parts, vehicle.chassis),
      chassis: rig,
      frame: { x: size.x / REFERENCE_SIZE.x, y: size.y / REFERENCE_SIZE.y, z: size.z / REFERENCE_SIZE.z },
    };
  }, [scene, vehicle]);
  const groupRef = useRef(null);
  const swapRef = useRef(null);
  const dust = useMemo(() => createDust(), []);
  const lighting = useMemo(() => createLighting(), []);
  const textures = useMemo(() => ({ carbon: carbonTexture(), brushed: brushedTexture() }), []);
  const applied = useRef(null);

  // The lamps' floor light and beams were placed on the Golf; they follow each car's size.
  useLayoutEffect(() => {
    frames.set(vehicle.id, frame);
    lighting.group.scale.set(frame.x, frame.y, frame.z);
  }, [vehicle, frame, lighting]);

  // Only the groups that changed are re-applied, so a click stays cheap.
  useLayoutEffect(() => {
    const previous = applied.current?.parts === parts ? applied.current.setup : null;
    const groups = previous ? APPLIED_GROUPS.filter((group) => previous[group] !== setup[group]) : [...APPLIED_GROUPS];

    if (!previous || previous.finish !== setup.finish) {
      groups.push("finish");
    }

    applyGroups(parts, setup, textures, groups);
    applied.current = { parts, setup };
    // Some groups restore lamp materials; the lights are re-applied on the next frame.
    refreshLighting(lighting);
    invalidate();
  }, [parts, setup, textures, invalidate, lighting]);

  useEffect(() => {
    setDustLook(dust, mode);
  }, [dust, mode]);

  // A swap path for a car that is not on the floor: parked out of sight until it drives in, or driving out.
  useLayoutEffect(() => {
    if (stage === "waiting" || stage === "arriving") {
      if (!swapRef.current || swapRef.current.kind !== "arriving") swapRef.current = createSwap("arriving", chassis?.rear ?? 1.3, arrivalDelay(getState().size));
    } else if (stage === "leaving") {
      swapRef.current = createSwap("leaving", chassis?.rear ?? 1.3);
    } else {
      swapRef.current = null;
    }

    invalidate();
  }, [stage, chassis, invalidate, getState]);

  // Loaded and in the scene: its shaders compile and its textures upload while it waits out of sight (otherwise its
  // first visible frame stalls the drive), then the director can start the swap.
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const world = useThree((state) => state.scene);

  useEffect(() => {
    if (!onLoaded) {
      return undefined;
    }

    let live = true;

    car.traverse((node) => {
      [node.material].flat().forEach((material) => {
        Object.values(material || {}).forEach((value) => value?.isTexture && gl.initTexture(value));
      });
    });
    gl.compileAsync(car, camera, world)
      .catch(() => {})
      .then(() => {
        if (!live) return;
        warmUp(gl, world, camera, groupRef.current);
        onLoaded(vehicle.id);
      });

    return () => {
      live = false;
    };
  }, [onLoaded, vehicle, car, gl, camera, world]);

  // On the floor, the language drive and the framing know this car; until then a language change only reframes.
  useLayoutEffect(() => {
    const drive = driveRef.current;

    if (!presented || !drive) {
      return undefined;
    }

    drive.mounted = true;
    drive.box = new THREE.Box3().setFromObject(car);

    return () => {
      drive.mounted = false;
    };
  }, [driveRef, car, presented]);

  useEffect(
    () => () => {
      clearDust(dust);
      dust.dispose();
    },
    [dust],
  );

  // A car that leaves gives back what this copy made: its own materials and textures. The model itself stays cached,
  // so coming back to it is instant.
  useEffect(
    () => () => {
      const shared = new Set();

      scene.traverse((node) => [node.material].flat().forEach((material) => material && shared.add(material)));
      car.traverse((node) => [node.material].flat().forEach((material) => material && !shared.has(material) && material.dispose()));
      textures.carbon.dispose();
      textures.brushed.dispose();
    },
    [scene, car, textures],
  );

  useDoors(car, animations, vehicle.doors, presented ? doorsRef : CLOSED, reduceMotion);
  useBonnet(parts.hinge, presented ? bonnetRef : CLOSED, reduceMotion);
  usePulse(parts, presented ? pulse : null, reduceMotion);
  useDrive({ chassis, driveRef, swapRef, stage, onSwapDone, groupRef, dust, reduceMotion, free, allWheelDrive: vehicle.id === "golf" ? setup.powertrain === "r" : false });
  useLighting({ lighting, parts, setup, inspecting: presented && inspecting, reduceMotion, dimRef: presented ? dimRef : UNUSED });

  return (
    <>
      <group ref={groupRef} name={`car:${vehicle.id}`} visible={stage !== "waiting"}>
        <primitive object={car} />
        <primitive object={lighting.group} />
        <Shadow mode={mode} ready={stage !== "waiting"} />
      </group>
      <primitive object={dust.points} />
    </>
  );
}

// Memoised: drei redraws the environment map and the contact shadow whenever these elements re-render, which
// cost 60–90 ms right as the camera or a door started to move.
// The studio as lit for each theme, and how far it dims when the car's lights are being shown off: darker, never
// black, so the whole car stays readable.
const STUDIO = {
  light: { floor: "#f1f1ef", dimmed: "#8c8d8f", ambient: 0.35, environment: [1, 0.36] },
  dark: { floor: "#0b0b0c", dimmed: "#060607", ambient: 0.15, environment: [1, 0.42] },
};

const Studio = memo(function Studio({ mode, dimRef }) {
  const look = STUDIO[mode === "dark" ? "dark" : "light"];
  const floor = look.floor;
  const ambientRef = useRef(null);
  const floorRef = useRef(null);
  const shown = useRef(-1);
  const colors = useMemo(() => ({ base: new THREE.Color(look.floor), dimmed: new THREE.Color(look.dimmed), mix: new THREE.Color() }), [look]);

  // A new theme rebuilds the background and fog, so they take the current dim again.
  useEffect(() => {
    shown.current = -1;
  }, [mode]);

  useFrame(({ scene }) => {
    const dim = dimRef.current;

    if (dim === shown.current || !scene.background?.isColor) {
      return;
    }

    shown.current = dim;
    colors.mix.copy(colors.base).lerp(colors.dimmed, dim);
    scene.background.copy(colors.mix);
    scene.fog?.color.copy(colors.mix);
    floorRef.current?.color.copy(colors.mix);
    scene.environmentIntensity = THREE.MathUtils.lerp(look.environment[0], look.environment[1], dim);

    if (ambientRef.current) {
      ambientRef.current.intensity = look.ambient * (1 - 0.65 * dim);
    }
  });

  return (
    <>
      <color attach="background" args={[floor]} />
      <fog attach="fog" args={[floor, 14, 30]} />
      <ambientLight ref={ambientRef} intensity={look.ambient} />
      <Environment resolution={512} frames={1}>
        <Lightformer intensity={2.2} rotation-x={Math.PI / 2} position={[0, 6, -2]} scale={[12, 1.2, 1]} />
        <Lightformer intensity={2.2} rotation-x={Math.PI / 2} position={[0, 6, 1]} scale={[12, 1.2, 1]} />
        <Lightformer intensity={2.2} rotation-x={Math.PI / 2} position={[0, 6, 4]} scale={[12, 1.2, 1]} />
        <Lightformer intensity={1.4} rotation-y={Math.PI / 2} position={[-9, 2, 0]} scale={[16, 2, 1]} />
        <Lightformer intensity={1.4} rotation-y={-Math.PI / 2} position={[9, 2, 0]} scale={[16, 2, 1]} />
        {/* Horizon lines: a thin bright strip on each side at belt height, the sweep of light a studio draws along the
            doors and wings to show their curves. Baked into the environment once, so it costs nothing per frame. */}
        <Lightformer intensity={3.2} rotation-y={Math.PI / 2} position={[-8.5, 0.95, 0]} scale={[24, 0.28, 1]} />
        <Lightformer intensity={3.2} rotation-y={-Math.PI / 2} position={[8.5, 0.95, 0]} scale={[24, 0.28, 1]} />
        <Lightformer form="ring" intensity={6} scale={3} position={[8, 6, 8]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        <Lightformer intensity={0.6} position={[0, 1, -12]} scale={[20, 6, 1]} color={mode === "dark" ? "#9aa0a6" : "#ffffff"} />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]}>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial ref={floorRef} color={floor} roughness={0.92} metalness={0} />
      </mesh>
    </>
  );
});

function Ready({ onReady }) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return null;
}

// The arriving car waits this long after the leaving one sets off, so the spot is clear when it gets there. A narrow
// (portrait) view loses the leaving car sooner, so the next one comes sooner too.
const ARRIVAL_DELAY = 1.1;
const arrivalDelay = ({ width, height }) => ARRIVAL_DELAY * Math.min(1, Math.max(0.4, width / height / 1.5));

function TuningScene({ vehicleId, setups, onPresented, onSwapping, progressRef, invalidateRef, framingRef, sections, spots, focusView, free, mode, reduceMotion, onReady, hotspotLabels, onHotspot, pulse, dir, inspecting }) {
  const doorsRef = useRef(0);
  const bonnetRef = useRef(0);
  const dimRef = useRef(0);
  const driveRef = useRef(null);
  // present: the car on the floor. next: the car coming in. phase: idle, loading (next parked out of sight while its
  // model loads), swapping (present drives out, next drives in).
  const [floor, setFloor] = useState({ present: vehicleId, next: null, phase: "idle" });

  // The page's reading direction decides which side of the screen the car sits on; a change drives it across.
  useLayoutEffect(() => {
    if (!driveRef.current) {
      driveRef.current = createDrive(dir);
    }

    driveRef.current.want = dir;
    invalidateRef.current?.();
  }, [dir, invalidateRef]);

  // A new choice starts loading the next car; while one is only loading, the latest choice replaces it (or cancels it,
  // back to the car on the floor). During a swap the choice waits: when the swap ends, this picks up the latest one.
  if (floor.phase !== "swapping") {
    if (vehicleId === floor.present && floor.phase !== "idle") {
      setFloor({ ...floor, next: null, phase: "idle" });
    } else if (vehicleId !== floor.present && vehicleId !== floor.next) {
      setFloor({ ...floor, next: vehicleId, phase: "loading" });
    }
  }

  // The car on the floor sets the framing (its size) once it has arrived.
  useEffect(() => {
    setFrame(frames.get(floor.present) || { x: 1, y: 1, z: 1 });
    onPresented?.(floor.present);
    invalidateRef.current?.();
  }, [floor.present, onPresented, invalidateRef]);

  // The page follows the floor, not the last choice: a car can still be driving in after the visitor chose the car
  // that is leaving.
  const busy = floor.phase === "swapping";

  useEffect(() => {
    onSwapping?.(busy);
  }, [busy, onSwapping]);

  // Once the car on the floor has settled, the next car in the line loads in the background (the one the "next" arrow
  // brings), so most swaps start at once. Skipped when the visitor asked to save data.
  useEffect(() => {
    if (floor.phase !== "idle" || navigator.connection?.saveData) {
      return undefined;
    }

    const index = VEHICLES.findIndex((vehicle) => vehicle.id === floor.present);
    const upcoming = VEHICLES[(index + 1) % VEHICLES.length];
    const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 0));
    let handle = null;
    const timer = setTimeout(() => {
      handle = idle(() => useGLTF.preload(upcoming.url, false, true));
    }, 4000);

    return () => {
      clearTimeout(timer);
      if (handle !== null) (window.cancelIdleCallback || clearTimeout)(handle);
    };
  }, [floor.phase, floor.present]);

  const loaded = useCallback((id) => {
    setFloor((current) => {
      if (current.phase !== "loading" || current.next !== id) return current;

      // The language drive must not move a car that is about to leave: its trip ends where the page now is.
      if (driveRef.current) {
        endTrip(driveRef.current);
      }

      return { ...current, phase: "swapping" };
    });
    invalidateRef.current?.();
  }, [invalidateRef]);

  const swapDone = useCallback((stage) => {
    if (stage === "arriving") {
      setFloor((current) => (current.phase === "swapping" ? { present: current.next, next: null, phase: "idle" } : current));
    }
  }, []);

  const cars = [{ id: floor.present, stage: floor.phase === "swapping" ? "leaving" : "present" }];

  if (floor.next) {
    cars.push({ id: floor.next, stage: floor.phase === "swapping" ? "arriving" : "waiting" });
  }

  return (
    <Canvas
      className="tz-canvas"
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ position: view("hero").position, fov: view("hero").fov, near: 0.02, far: 80 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
      onCreated={({ invalidate }) => {
        invalidateRef.current = invalidate;
      }}
    >
      <Studio mode={mode} dimRef={dimRef} />
      {cars.map(({ id, stage }) => (
        // Each car loads on its own, so the one on the floor stays while the next one loads.
        <Suspense key={id} fallback={null}>
          <Car
            vehicle={vehicleById(id)}
            stage={stage}
            onLoaded={stage === "waiting" ? loaded : undefined}
            onSwapDone={swapDone}
            setup={setups[id].present}
            doorsRef={doorsRef}
            bonnetRef={bonnetRef}
            reduceMotion={reduceMotion}
            pulse={pulse}
            driveRef={driveRef}
            free={free}
            mode={mode}
            inspecting={inspecting}
            dimRef={dimRef}
          />
          {stage === "present" && <Ready onReady={onReady} />}
        </Suspense>
      ))}
      <CameraRig
        progressRef={progressRef}
        focusView={focusView}
        free={free}
        reduceMotion={reduceMotion}
        doorsRef={doorsRef}
        bonnetRef={bonnetRef}
        driveRef={driveRef}
        framingRef={framingRef}
        sections={sections}
      />
      {free && <FreeControls free={free} />}
      {free === "outside" && <Hotspots spots={spots} labels={hotspotLabels} onSelect={onHotspot} />}
    </Canvas>
  );
}

// Re-rendered only when its own props change, not on every scroll or panel update of the page.
export default memo(TuningScene);

useGLTF.preload(VEHICLES[0].url, false, true);
