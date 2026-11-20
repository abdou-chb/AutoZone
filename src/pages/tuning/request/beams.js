import * as THREE from "three";

// Headlamp light made visible: a shaft per lamp (an open cone from the lens, shaded like light crossing drifting fog:
// bright on its axis seen side-on, broken up by slowly moving 3D noise, fading with distance and into the floor),
// and a flare on the lens itself, strongest when the lamp looks at the camera, with the horizontal streak of an
// anamorphic lens. Both are additive and bright enough for the bloom pass to pick up.

const SHAFT_LENGTH = 10;
const SHAFT_RADIUS = 1.9;

const shaftVertex = /* glsl */ `
  uniform float uLength;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;

  void main() {
    vAlong = position.z / uLength;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const shaftFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uTime;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;

    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    float facing = pow(abs(dot(normalize(vNormal), normalize(vView))), 2.2);
    float fade = smoothstep(0.0, 0.05, vAlong) * pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.7);
    vec3 drift = vec3(uTime * 0.22, uTime * 0.05, -uTime * 0.12);
    float fog = 0.45 + 0.85 * noise(vWorld * 0.9 + drift) * noise(vWorld * 0.35 - drift * 0.5);
    float ground = smoothstep(-0.02, 0.35, vWorld.y);
    float alpha = uPower * facing * fade * fog * ground;

    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;

const flareVertex = /* glsl */ `
  uniform float uSize;
  varying vec2 vUv;

  void main() {
    vUv = uv - 0.5;
    vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    // Wider than tall: room for the streak.
    center.xy += position.xy * vec2(uSize * 2.4, uSize);
    gl_Position = projectionMatrix * center;
  }
`;

const flareFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv * vec2(2.4, 1.0);
    float core = exp(-dot(p, p) * 60.0);
    float halo = exp(-dot(p, p) * 9.0) * 0.35;
    float streak = exp(-abs(vUv.y) * 90.0) * exp(-abs(vUv.x) * 3.2) * 0.55;
    float light = (core * 2.6 + halo + streak) * uPower;

    gl_FragColor = vec4(uColor * light, light);
  }
`;

function shaftGeometry() {
  const geometry = new THREE.ConeGeometry(SHAFT_RADIUS, SHAFT_LENGTH, 32, 1, true);

  // Apex at the lamp, opening along +z.
  geometry.translate(0, -SHAFT_LENGTH / 2, 0);
  geometry.rotateX(-Math.PI / 2);

  return geometry;
}

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };

export function createBeams() {
  const geometry = shaftGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  const group = new THREE.Group();

  const lamps = [0, 1].map(() => {
    const shaft = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: shaftVertex,
        fragmentShader: shaftFragment,
        uniforms: { uColor: { value: new THREE.Color() }, uPower: { value: 0 }, uTime: { value: 0 }, uLength: { value: SHAFT_LENGTH } },
        ...additive,
      }),
    );
    const flare = new THREE.Mesh(
      quad,
      new THREE.ShaderMaterial({
        vertexShader: flareVertex,
        fragmentShader: flareFragment,
        uniforms: { uColor: { value: new THREE.Color() }, uPower: { value: 0 }, uSize: { value: 0.6 } },
        ...additive,
        depthTest: true,
      }),
    );

    shaft.frustumCulled = false;
    flare.frustumCulled = false;
    shaft.renderOrder = 3;
    flare.renderOrder = 4;
    group.add(shaft, flare);

    return { shaft, flare };
  });

  return { group, lamps, geometry, quad };
}

const look = new THREE.Vector3();
const toCamera = new THREE.Vector3();

// lamp: { position, direction, color, power } in world space; `beam` (0–1.75) drives the shaft, `glow` the flare.
export function updateBeams(beams, lamps, time, camera) {
  beams.lamps.forEach(({ shaft, flare }, index) => {
    const lamp = lamps[index];

    if (!lamp || lamp.power <= 0.001) {
      shaft.visible = false;
      flare.visible = false;
      return;
    }

    shaft.visible = lamp.beam > 0.002;
    shaft.position.copy(lamp.position);
    shaft.lookAt(look.copy(lamp.position).add(lamp.direction));
    shaft.material.uniforms.uColor.value.copy(lamp.color);
    shaft.material.uniforms.uPower.value = lamp.beam * 0.32 * lamp.fog;
    shaft.material.uniforms.uTime.value = time;

    toCamera.copy(camera.position).sub(lamp.position).normalize();

    const facing = Math.max(0, toCamera.dot(lamp.direction));

    flare.visible = true;
    flare.position.copy(lamp.position);
    flare.material.uniforms.uColor.value.copy(lamp.color);
    flare.material.uniforms.uPower.value = (lamp.glow * 0.3 + lamp.beam * 0.7) * (0.15 + 0.85 * facing ** 2.5);
  });
}

export function disposeBeams(beams) {
  beams.geometry.dispose();
  beams.quad.dispose();
  beams.lamps.forEach(({ shaft, flare }) => {
    shaft.material.dispose();
    flare.material.dispose();
  });
}
