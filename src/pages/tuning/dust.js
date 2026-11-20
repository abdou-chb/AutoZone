import * as THREE from "three";

// Light dust kicked up at the tyres' contact patches while the car drives. One preallocated buffer of soft
// points, drawn in a single call; particles live in the world, so they stay behind as the car moves on.
const COUNT = 220;
const LIFE = [1.3, 2.2];

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float alpha;
  uniform float halfHeight;
  varying float vAlpha;

  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = size * projectionMatrix[1][1] * halfHeight / max(-view.z, 0.05);
    vAlpha = alpha;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 color;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float soft = pow(clamp(1.0 - d, 0.0, 1.0), 1.6);
    if (soft * vAlpha < 0.002) discard;
    gl_FragColor = vec4(color, soft * vAlpha);
    #include <colorspace_fragment>
  }
`;

export function createDust() {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const alpha = new Float32Array(COUNT);

  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("size", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));

  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color() }, halfHeight: { value: 400 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);

  points.frustumCulled = false;
  points.visible = false;
  points.renderOrder = 2;

  return {
    points,
    velocity: new Float32Array(COUNT * 3),
    age: new Float32Array(COUNT).fill(1),
    life: new Float32Array(COUNT).fill(1),
    grow: new Float32Array(COUNT),
    next: 0,
    carry: 0,
    alive: 0,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

export function setDustLook(dust, mode) {
  dust.points.material.uniforms.color.value.set(mode === "dark" ? "#77736d" : "#b9b1a4");
  dust.peak = mode === "dark" ? 0.16 : 0.24;
}

// Emits about `rate` particles per second at `at` (a contact patch), thrown back against `travel` (wheel velocity).
export function emitDust(dust, at, travel, rate, dt) {
  dust.carry += rate * dt;

  while (dust.carry >= 1) {
    dust.carry -= 1;

    const index = dust.next;
    const p = index * 3;
    const position = dust.points.geometry.attributes.position.array;

    dust.next = (dust.next + 1) % COUNT;
    position[p] = at.x + (Math.random() - 0.5) * 0.18;
    position[p + 1] = 0.03 + Math.random() * 0.05;
    position[p + 2] = at.z + (Math.random() - 0.5) * 0.18;
    dust.velocity[p] = -travel.x * (0.18 + Math.random() * 0.14) + (Math.random() - 0.5) * 0.35;
    dust.velocity[p + 1] = 0.12 + Math.random() * 0.22;
    dust.velocity[p + 2] = -travel.z * (0.18 + Math.random() * 0.14) + (Math.random() - 0.5) * 0.35;
    dust.age[index] = 0;
    dust.life[index] = LIFE[0] + Math.random() * (LIFE[1] - LIFE[0]);
    dust.grow[index] = 0.5 + Math.random() * 0.35;
  }
}

// Moves, grows and fades every live particle. `shift` moves them with the world when car and camera go back to the origin.
export function updateDust(dust, dt, shift, halfHeight) {
  const { attributes } = dust.points.geometry;
  const position = attributes.position.array;
  const size = attributes.size.array;
  const alpha = attributes.alpha.array;
  const drag = Math.exp(-dt * 1.8);
  let alive = 0;

  for (let index = 0; index < COUNT; index += 1) {
    const p = index * 3;

    if (dust.age[index] >= dust.life[index]) {
      alpha[index] = 0;
      size[index] = 0;
      continue;
    }

    dust.age[index] += dt;

    const t = Math.min(dust.age[index] / dust.life[index], 1);

    if (shift) {
      position[p] -= shift.x;
      position[p + 2] -= shift.z;
    }

    dust.velocity[p] *= drag;
    dust.velocity[p + 1] = dust.velocity[p + 1] * drag - 0.02 * dt;
    dust.velocity[p + 2] *= drag;
    position[p] += dust.velocity[p] * dt;
    position[p + 1] = Math.max(0.02, position[p + 1] + dust.velocity[p + 1] * dt);
    position[p + 2] += dust.velocity[p + 2] * dt;
    // Quick rise, long fade; the puff spreads as it thins.
    alpha[index] = dust.peak * Math.min(t / 0.12, 1) * (1 - t) ** 1.6;
    size[index] = 0.1 + dust.grow[index] * Math.sqrt(t);
    alive += 1;
  }

  dust.alive = alive;
  dust.points.visible = alive > 0;
  dust.points.material.uniforms.halfHeight.value = halfHeight;
  attributes.position.needsUpdate = true;
  attributes.size.needsUpdate = true;
  attributes.alpha.needsUpdate = true;

  return alive > 0;
}

export function clearDust(dust) {
  dust.age.fill(1);
  dust.life.fill(1);
  dust.carry = 0;
}
