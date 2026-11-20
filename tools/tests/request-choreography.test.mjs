// The request scene's script, checked every 20 ms from start to finish:
// - each side car's whole footprint stays on its own side, clear of the chosen car;
// - the side cars move smoothly (no jump in place or heading from one step to the next);
// - the chosen car is always in front of the camera and on screen, at every screen shape;
// - the camera never jumps and is still at the end.
//   node --test tools/tests/request-choreography.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { createCameraPath, END, SIDE_CLEARANCE, sidePose } from "../../src/pages/tuning/request/choreography.js";

const STEP = 0.02;
const HALF = { width: 1.0, length: 2.5 }; // the largest side car (RS 6 Avant, 4.995 m), with its mirrors
const HERO_HALF_WIDTH = 1.05;

function footprint(pose) {
  const cos = Math.cos(pose.yaw);
  const sin = Math.sin(pose.yaw);

  return [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ].map(([sx, sz]) => {
    const x = sx * HALF.width;
    const z = sz * HALF.length;

    return { x: pose.x + x * cos + z * sin, z: pose.z - x * sin + z * cos };
  });
}

test("side cars stay on their own side, clear of the chosen car", () => {
  for (const side of ["audi", "mercedes"]) {
    let nearest = Infinity;

    for (let t = 0; t <= END + 2; t += STEP) {
      const corners = footprint(sidePose(t, side));
      const inner = side === "audi" ? Math.max(...corners.map((c) => c.x)) : Math.min(...corners.map((c) => c.x));

      nearest = Math.min(nearest, Math.abs(inner));
      assert.ok(side === "audi" ? inner < 0 : inner > 0, `${side} crosses the middle at ${t.toFixed(2)} s`);
    }

    assert.ok(nearest >= SIDE_CLEARANCE, `${side} comes within ${nearest.toFixed(2)} m of the middle`);
    assert.ok(nearest - HERO_HALF_WIDTH > 0.6, `${side} leaves only ${(nearest - HERO_HALF_WIDTH).toFixed(2)} m beside the chosen car`);
  }
});

test("side cars move smoothly and end parked, mirrored", () => {
  for (const side of ["audi", "mercedes"]) {
    let last = sidePose(0, side);

    for (let t = STEP; t <= END + 1; t += STEP) {
      const pose = sidePose(t, side);

      assert.ok(Math.hypot(pose.x - last.x, pose.z - last.z) < 0.25, `${side} jumps at ${t.toFixed(2)} s`);
      assert.ok(Math.abs(pose.yaw - last.yaw) < 0.08, `${side} turns abruptly at ${t.toFixed(2)} s`);
      last = pose;
    }

    assert.equal(sidePose(END + 1, side).moving, false);
  }

  const audi = sidePose(END + 1, "audi");
  const mercedes = sidePose(END + 1, "mercedes");

  assert.ok(Math.abs(audi.x + mercedes.x) < 1e-6 && Math.abs(audi.z - mercedes.z) < 1e-6 && Math.abs(audi.yaw + mercedes.yaw) < 1e-6);
  // Noses turned in towards the middle, so their beams cross ahead of the chosen car.
  assert.ok(audi.yaw > 0.2 && mercedes.yaw < -0.2);
});

test("the camera always sees the chosen car, never jumps, and holds still at the end", () => {
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1920, 1080],
    [390, 844],
    [360, 740],
    [820, 1180],
  ]) {
    const aspect = width / height;
    const path = createCameraPath(aspect);
    const camera = new THREE.PerspectiveCamera(30, aspect, 0.05, 120);
    const shot = { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30 };
    const hero = new THREE.Vector3(0, 0.7, 0);
    let previous = null;

    for (let t = 0; t <= END + 1; t += STEP) {
      path.sample(t, shot);
      camera.position.copy(shot.position);
      camera.lookAt(shot.target);
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      const projected = hero.clone().project(camera);

      assert.ok(projected.z < 1 && Math.abs(projected.x) < 0.9 && Math.abs(projected.y) < 0.9, `${width}x${height}: chosen car off screen at ${t.toFixed(2)} s`);

      if (previous) {
        assert.ok(previous.distanceTo(shot.position) < 0.35, `${width}x${height}: camera jumps at ${t.toFixed(2)} s`);
      }

      previous = shot.position.clone();
    }

    const end = path.sample(END, { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 0 }).position.clone();
    const later = path.sample(END + 5, { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 0 }).position;

    assert.ok(end.distanceTo(later) < 1e-9, "the camera keeps moving after the final shot");
  }
});
