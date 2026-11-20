import * as THREE from "three";

// Showroom fog: soft puffs drawn as camera-facing quads, each shaded in its fragment shader with the light it scatters
// from every headlamp beam it sits in (a cone test per lamp, stronger when looking up the beam: forward scattering),
// so the beams show where the fog is and the fog glows where the beams are. Puffs live in one pool: a low layer that
// drifts across the floor, trails rolling off the side cars' rear wheels as they move, and swells where they stop.
// Sorted back to front each frame (a few hundred quads), so the layering stays right.

export const LAMPS = 6;

const vertexShader = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec4 aData; // size, opacity, seed, spin
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vUv = uv;
    // Thin out puffs right in front of the lens: a camera passing through the fog must not see a white screen.
    float depth = -(viewMatrix * vec4(aCenter, 1.0)).z;
    vAlpha = aData.y * smoothstep(1.2, 5.5, depth);
    vSeed = aData.z;

    float c = cos(aData.w);
    float s = sin(aData.w);
    vec2 corner = (uv - 0.5) * aData.x;
    corner = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y);

    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    // Flattened: fog lies along the floor rather than standing in round balls.
    vWorld = aCenter + right * corner.x + up * corner.y * 0.55;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uBase;
  uniform vec3 uLampPos[${LAMPS}];
  uniform vec3 uLampDir[${LAMPS}];
  uniform vec3 uLampColor[${LAMPS}];
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vAlpha;
  varying float vSeed;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.55;

    for (int i = 0; i < 3; i++) {
      sum += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }

    return sum;
  }

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float n = fbm(vUv * 2.4 + vSeed * 13.7 + vec2(uTime * 0.05, -uTime * 0.035));
    float density = smoothstep(1.0, 0.1, r + (n - 0.5) * 0.55) * (0.35 + 0.9 * n) * vAlpha;

    // Soft where a puff meets the floor.
    density *= smoothstep(-0.05, 0.3, vWorld.y);

    if (density < 0.002) discard;

    vec3 toCamera = normalize(cameraPosition - vWorld);
    vec3 light = uBase;

    for (int i = 0; i < ${LAMPS}; i++) {
      vec3 d = vWorld - uLampPos[i];
      float along = dot(d, uLampDir[i]);
      float near = 1.0 / (1.0 + dot(d, d) * 3.0);

      // A glow around the lamp itself, then the beam's cone.
      light += uLampColor[i] * near * 0.25;

      if (along > 0.0) {
        float radial = length(d - uLampDir[i] * along);
        float spread = 0.1 + along * 0.28;
        float cone = 1.0 - smoothstep(spread * 0.3, spread, radial);
        float fade = 1.0 / (1.0 + along * along * 0.035);
        float forward = pow(max(dot(toCamera, uLampDir[i]), 0.0), 6.0);

        light += uLampColor[i] * cone * fade * (0.2 + 0.7 * forward);
      }
    }

    gl_FragColor = vec4(light * density, density);
  }
`;

const rand = (min, max) => min + Math.random() * (max - min);

export function createSmoke(count) {
  const plane = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();

  geometry.index = plane.index;
  geometry.setAttribute("position", plane.getAttribute("position"));
  geometry.setAttribute("uv", plane.getAttribute("uv"));

  const centers = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  const data = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);

  centers.setUsage(THREE.DynamicDrawUsage);
  data.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aCenter", centers);
  geometry.setAttribute("aData", data);
  geometry.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new THREE.Color("#12161c") },
      uLampPos: { value: Array.from({ length: LAMPS }, () => new THREE.Vector3(0, -50, 0)) },
      uLampDir: { value: Array.from({ length: LAMPS }, () => new THREE.Vector3(0, 0, 1)) },
      uLampColor: { value: Array.from({ length: LAMPS }, () => new THREE.Color(0, 0, 0)) },
    },
    transparent: true,
    depthWrite: false,
    // Premultiplied "over": fog both hides what is behind it a little and lights up where the beams cross it.
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });

  const mesh = new THREE.Mesh(geometry, material);

  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  const puffs = Array.from({ length: count }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, size: 1, grow: 1, opacity: 0, seed: 0, spin: 0, spinRate: 0, ambient: false }));

  return { mesh, material, puffs, layer: 0, next: 0, order: [], depth: new Float32Array(count) };
}

// The floor layer takes the first puffs of the pool; trails take turns through the rest (the oldest goes first).
function spawnTrail(smoke) {
  const start = smoke.layer;
  const span = smoke.puffs.length - start;
  const puff = smoke.puffs[start + (smoke.next % span)];

  smoke.next = (smoke.next + 1) % span;

  return puff;
}

// The low layer over the floor: long-lived puffs placed anywhere in the showroom's middle, kept at a steady number.
export function seedLayer(smoke, count, extent = { x: 10, zMin: -9, zMax: 9 }) {
  smoke.layer = Math.min(count, smoke.puffs.length - 1);

  for (let index = 0; index < smoke.layer; index += 1) {
    const puff = smoke.puffs[index];

    Object.assign(puff, {
      alive: true,
      ambient: true,
      extent,
      x: rand(-extent.x, extent.x),
      y: rand(0.05, 0.45),
      z: rand(extent.zMin, extent.zMax),
      vx: rand(-0.06, 0.06),
      vy: 0,
      vz: rand(-0.04, 0.04),
      age: rand(0, 14),
      life: rand(12, 18),
      size: rand(3.2, 5.6),
      grow: 0,
      opacity: rand(0.09, 0.18),
      seed: Math.random(),
      spin: rand(0, Math.PI * 2),
      spinRate: rand(-0.04, 0.04),
    });
  }
}

// Fog thrown off behind a moving wheel, or swelling around a car that stops (`burst`).
export function emit(smoke, at, push, { size = 0.9, grow = 0.75, life = 6, opacity = 0.22 } = {}) {
  const puff = spawnTrail(smoke);

  Object.assign(puff, {
    alive: true,
    ambient: false,
    x: at.x + rand(-0.15, 0.15),
    y: rand(0.08, 0.3),
    z: at.z + rand(-0.15, 0.15),
    vx: push.x + rand(-0.12, 0.12),
    vy: rand(0.02, 0.07),
    vz: push.z + rand(-0.12, 0.12),
    age: 0,
    life: life * rand(0.8, 1.2),
    size: size * rand(0.8, 1.25),
    grow: grow * rand(0.8, 1.2),
    opacity: opacity * rand(0.75, 1.15),
    seed: Math.random(),
    spin: rand(0, Math.PI * 2),
    spinRate: rand(-0.25, 0.25),
  });
}

const view = new THREE.Vector3();

// Moves every puff, writes the visible ones back to front, and returns how many are drawn.
export function updateSmoke(smoke, dt, time, camera, density) {
  const { puffs, order, depth } = smoke;
  const centers = smoke.mesh.geometry.getAttribute("aCenter");
  const data = smoke.mesh.geometry.getAttribute("aData");

  smoke.material.uniforms.uTime.value = time;
  order.length = 0;

  puffs.forEach((puff, index) => {
    if (!puff.alive) return;

    puff.age += dt;

    if (puff.age >= puff.life) {
      if (!puff.ambient) {
        puff.alive = false;
        return;
      }

      // The floor layer never runs out: a puff that fades is reborn elsewhere.
      puff.age = 0;
      puff.x = rand(-puff.extent.x, puff.extent.x);
      puff.z = rand(puff.extent.zMin, puff.extent.zMax);
    }

    // Slow down, rise a little, and curl in a gentle swirl so the fog never looks frozen.
    const drag = Math.exp(-dt * (puff.ambient ? 0.1 : 0.9));

    puff.vx = puff.vx * drag + Math.sin(time * 0.21 + puff.seed * 9 + puff.z * 0.3) * 0.012 * dt * 10;
    puff.vz = puff.vz * drag + Math.cos(time * 0.17 + puff.seed * 7 + puff.x * 0.3) * 0.012 * dt * 10;
    puff.vy = puff.vy * drag;
    puff.x += puff.vx * dt;
    puff.y = Math.min(puff.y + puff.vy * dt, 1.4);
    puff.z += puff.vz * dt;
    puff.spin += puff.spinRate * dt;

    const u = puff.age / puff.life;
    const fade = Math.min(1, u / 0.18) * Math.min(1, (1 - u) / 0.35);

    puff.shown = puff.opacity * fade * (puff.ambient ? density : 1);
    puff.drawSize = puff.size * (1 + puff.grow * Math.sqrt(u) * 3);

    view.set(puff.x, puff.y, puff.z).applyMatrix4(camera.matrixWorldInverse);
    depth[index] = view.z;

    if (puff.shown > 0.003 && view.z < 0.5) {
      order.push(index);
    }
  });

  order.sort((a, b) => depth[a] - depth[b]);
  order.forEach((index, slot) => {
    const puff = puffs[index];

    centers.setXYZ(slot, puff.x, puff.y, puff.z);
    data.setXYZW(slot, puff.drawSize, puff.shown, puff.seed, puff.spin);
  });

  centers.needsUpdate = true;
  data.needsUpdate = true;
  smoke.mesh.geometry.instanceCount = order.length;

  return order.length;
}

export function setSmokeLamps(smoke, lamps) {
  const { uLampPos, uLampDir, uLampColor } = smoke.material.uniforms;

  for (let index = 0; index < LAMPS; index += 1) {
    const lamp = lamps[index];

    if (lamp) {
      uLampPos.value[index].copy(lamp.position);
      uLampDir.value[index].copy(lamp.direction);
      uLampColor.value[index].copy(lamp.color).multiplyScalar(lamp.power);
    } else {
      uLampColor.value[index].setRGB(0, 0, 0);
    }
  }
}

export function disposeSmoke(smoke) {
  smoke.mesh.geometry.dispose();
  smoke.material.dispose();
}
