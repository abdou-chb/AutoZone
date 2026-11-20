import * as THREE from "three";
import { springTo } from "./motion";
import { optionOf } from "./options";

// The car's own lights. Each lamp has separate parts, each with one owner here:
// - the LED emitters glow (the DRL light line, the rear LED strips and the triangle grid), in the LED colour;
// - the reflector modules behind the headlamp lens pick up the light when the beam is on;
// - the light leaves the lamp: a beam pattern on the floor ahead (low beam with its cut-off line, high beam reaching
//   further), a red wash behind, and faint beam cones that mostly show when the studio is dimmed.
// The floor light is drawn on the floor itself rather than with scene lights: real lights would be evaluated by every
// material of the car on every frame (measured: GPU time per frame nearly doubled), for light that only shows on the
// floor anyway.
// Lens colour and smoke, housing finish and inner lens tone are materials (customise.js), not light.

// World positions after normaliseCar: nose towards +z, lamps at about ±0.62 m.
const HEADLAMPS = [-0.62, 0.62];
const HEADLAMP = { y: 0.66, z: 1.98 };
// Low beam dips onto the floor a few metres ahead; high beam aims further and higher.
const AIM = { x: 0.95, low: { y: 0, z: 5.6 }, high: { y: 0.28, z: 9.5 } };
const BEAM_LENGTH = 6.5;
const TAIL_RED = new THREE.Color("#ff1206");
const GRID_RED = new THREE.Color("#ff2414");

const beamVertex = /* glsl */ `
  uniform float length;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vAlong = position.y / length;
    vNormal = normalize(normalMatrix * normal);
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-view.xyz);
    gl_Position = projectionMatrix * view;
  }
`;

const beamFragment = /* glsl */ `
  uniform vec3 color;
  uniform float strength;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    // Brightest along the axis seen side-on, soft at the cone's edge, fading with distance from the lamp.
    float facing = pow(abs(dot(normalize(vNormal), normalize(vView))), 1.8);
    float fade = smoothstep(0.0, 0.06, vAlong) * pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.6);
    float alpha = strength * facing * fade;
    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

const poolVertex = /* glsl */ `
  varying vec2 vPool;

  void main() {
    vPool = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// x across the pool (0..1, lamp axis at 0.5), y away from the car (0..1).
const frontPoolFragment = /* glsl */ `
  uniform vec3 color;
  uniform float strength;
  uniform float reach;
  varying vec2 vPool;

  void main() {
    float along = vPool.y;
    float across = abs(vPool.x - 0.5) * 2.0 / mix(0.35, 1.0, along);
    float sides = exp(-across * across * 3.0);
    float start = smoothstep(0.0, 0.3, along);
    // Low beam ends at a cut-off a few metres out; high beam fades out further away.
    float end = 1.0 - smoothstep(mix(0.36, 0.62, reach), mix(0.6, 1.0, reach), along);
    float band = exp(-pow((along - mix(0.3, 0.45, reach)) * 3.0, 2.0));
    float light = strength * sides * start * end * (0.35 + 0.65 * band);
    gl_FragColor = vec4(color, light);
    #include <colorspace_fragment>
  }
`;

const rearPoolFragment = /* glsl */ `
  uniform vec3 color;
  uniform float strength;
  varying vec2 vPool;

  void main() {
    vec2 p = vec2((vPool.x - 0.5) * 2.0, vPool.y);
    float light = strength * smoothstep(0.0, 0.4, p.y) * exp(-p.x * p.x * 2.6 - p.y * p.y * 3.0);
    gl_FragColor = vec4(color, light);
    #include <colorspace_fragment>
  }
`;

function floorPool(fragmentShader, width, length, x, z, towards) {
  const geometry = new THREE.PlaneGeometry(width, length);
  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color() }, strength: { value: 0 }, reach: { value: 0 } },
    vertexShader: poolVertex,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);

  // Lying on the floor, its uv y running away from the car.
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = towards > 0 ? Math.PI : 0;
  mesh.position.set(x, 0.004, z + (towards * length) / 2);
  mesh.visible = false;
  mesh.renderOrder = 1;

  return mesh;
}

function beamCone(side) {
  const geometry = new THREE.ConeGeometry(1.1, BEAM_LENGTH, 28, 1, true);

  // Apex at the lamp, opening along +y; then turned towards the aim point.
  geometry.translate(0, -BEAM_LENGTH / 2, 0);
  geometry.rotateX(Math.PI);

  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color() }, strength: { value: 0 }, length: { value: BEAM_LENGTH } },
    vertexShader: beamVertex,
    fragmentShader: beamFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const from = new THREE.Vector3(side, HEADLAMP.y, HEADLAMP.z + 0.05);
  const to = new THREE.Vector3(side * AIM.x * 1.6, AIM.high.y, AIM.high.z);

  mesh.position.copy(from);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
  mesh.visible = false;
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;

  return mesh;
}

export function createLighting() {
  const group = new THREE.Group();
  // One pool per headlamp, from just ahead of the bumper; they overlap in the middle as real beams do.
  const pools = HEADLAMPS.map((x) => floorPool(frontPoolFragment, 3.6, 7.6, x * 1.25, 2.15, 1));
  const rearPool = floorPool(rearPoolFragment, 3.4, 3.2, 0, -2.15, -1);

  group.add(...pools, rearPool);

  const beams = HEADLAMPS.map(beamCone);

  group.add(...beams);
  group.name = "Car_Lighting";

  return {
    group,
    pools,
    rearPool,
    beams,
    led: new THREE.Color(),
    level: {
      drl: { value: 0, velocity: 0 },
      beam: { value: 0, velocity: 0 },
      tail: { value: 0, velocity: 0 },
      brake: { value: 0, velocity: 0 },
      dim: { value: 0, velocity: 0 },
    },
    dirty: true,
    dispose() {
      beams.forEach((beam) => {
        beam.geometry.dispose();
        beam.material.dispose();
      });
      [...pools, rearPool].forEach((pool) => {
        pool.geometry.dispose();
        pool.material.dispose();
      });
    },
  };
}

// The triangle grid glows in its own printed pattern: its colour map doubles as its emission map.
export function prepareLampMaterials(parts) {
  parts.tailGrid.forEach((material) => {
    if (material.map && material.emissiveMap !== material.map) {
      material.emissiveMap = material.map;
      material.needsUpdate = true;
    }
  });
}

const SPRINGS = { drl: 10, beam: 3.4, tail: 8, brake: 12, dim: 2.6 };

function settle(level, goals, dt) {
  let moving = false;

  Object.keys(level).forEach((key) => {
    const state = level[key];
    const goal = goals[key];

    if (state.value === goal && state.velocity === 0) {
      return;
    }

    springTo(state, goal, SPRINGS[key], dt);

    if (Math.abs(goal - state.value) < 1e-4 && Math.abs(state.velocity) < 1e-3) {
      state.value = goal;
      state.velocity = 0;
    } else {
      moving = true;
    }
  });

  return moving;
}

function glow(materials, color, intensity) {
  materials.forEach((material) => {
    material.emissive.copy(color);
    material.emissiveIntensity = intensity;
  });
}

// Moves every light towards the setup and applies it. `inspecting`: the lights section is on screen, so the studio
// dims around lamps that are on. Returns true while something is still changing.
export function updateLighting(lighting, parts, setup, inspecting, dt) {
  const front = optionOf("frontLights", setup.frontLights);
  const rear = optionOf("rearLights", setup.rearLights);
  const { level } = lighting;
  const lit = (front.drl || 0) + (rear.tail || 0) > 0;
  // The main beam waits for the DRL to light first, like a real lamp's start-up.
  const goals = {
    drl: front.drl || 0,
    beam: (front.beam || 0) * THREE.MathUtils.smoothstep(level.drl.value, 0.55, 0.95),
    tail: rear.tail || 0,
    brake: rear.brake || 0,
    dim: inspecting && lit ? (front.beam ? 1 : 0.75) : 0,
  };
  const moving = settle(level, goals, dt);

  if (!moving && !lighting.dirty) {
    return false;
  }

  lighting.dirty = false;
  lighting.led.set(optionOf("ledColor", setup.ledColor).glow);

  const { drl, beam, tail, brake, dim } = Object.fromEntries(Object.entries(level).map(([key, state]) => [key, Math.max(0, state.value)]));

  // Emission strengths are kept low enough that the LED colour survives tone mapping instead of burning to white.
  glow(parts.drl, lighting.led, drl * 2.1 + beam * 0.7);
  glow(parts.headInner, lighting.led, beam * 0.7 + drl * 0.1);
  glow(parts.tailLeds, TAIL_RED, tail * 0.95 + brake * 1.05);
  glow(parts.tailGrid, GRID_RED, tail * 0.55 + brake * 0.75);

  // Floor light: stronger when the studio is dimmed, as the eye would adapt; it never washes the floor out.
  const reach = THREE.MathUtils.clamp(beam - 1, 0, 0.75) / 0.75;

  lighting.pools.forEach((pool) => {
    pool.material.uniforms.color.value.copy(lighting.led);
    pool.material.uniforms.strength.value = Math.min(beam, 1) * (0.3 + 0.2 * dim) * (1 + 0.25 * reach);
    pool.material.uniforms.reach.value = reach;
    pool.visible = beam > 0.002;
  });
  lighting.rearPool.material.uniforms.color.value.copy(TAIL_RED);
  lighting.rearPool.material.uniforms.strength.value = (tail * 0.16 + brake * 0.2) * (0.7 + 0.5 * dim);
  lighting.rearPool.visible = tail + brake > 0.002;
  lighting.beams.forEach((cone) => {
    cone.material.uniforms.color.value.copy(lighting.led);
    cone.material.uniforms.strength.value = beam * (0.06 + 0.32 * dim);
    cone.visible = beam > 0.002;
  });

  return moving;
}

// Material groups that restore lamp materials call this, so the lights are applied again on the next frame.
export function refreshLighting(lighting) {
  lighting.dirty = true;
}

export function lightingDim(lighting) {
  return Math.max(0, lighting.level.dim.value);
}
