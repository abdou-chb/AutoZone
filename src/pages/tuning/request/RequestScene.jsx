import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshReflectorMaterial, PerformanceMonitor, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import ContactShadow from "../ContactShadow";
import { brushedTexture, carbonTexture, classifyParts, normaliseCar, rigChassis } from "../car-parts";
import { APPLIED_GROUPS, applyGroups } from "../customise";
import { steering } from "../drive";
import { createLighting, prepareLampMaterials, refreshLighting, updateLighting } from "../lighting";
import { frameTime, suspend } from "../motion";
import { factoryFor } from "../options";
import { REFERENCE_SIZE, vehicleById } from "../vehicles";
import { createBeams, disposeBeams, updateBeams } from "./beams";
import { createCameraPath, END, fogLevel, FORM_AT, lampCue, sidePose, SLIDE_FROM, SLIDE_TO } from "./choreography";
import { createSmoke, disposeSmoke, emit, seedLayer, setSmokeLamps, updateSmoke } from "./smoke";

// The request scene: the chosen car in the middle, lights blazing; the Audi (RS 6) on the left and the Mercedes
// (C 63) on the right drive in out of the dark, park in a V and cross their beams in the fog. See choreography.js
// for the script and docs/audit/tuning-zone.md ("Request scene") for the choices.

const SIDE_CARS = { audi: "rs6", mercedes: "c63" };
const LAMP_SLOTS = { hero: 0, audi: 2, mercedes: 4 };
const PITCH_PER_ACCEL = 0.005;

// The lamps' world places, filled by the cars each frame and read by the fog and the beams.
function createWorld() {
  return {
    lamps: Array.from({ length: 6 }, () => ({ position: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, 1), color: new THREE.Color(), power: 0, beam: 0, glow: 0, fog: 1 })),
    fog: 0,
  };
}

// The headlamps of a car's own model: the centres of its lamp parts on each side, at the front of the lens. Falls back
// to the Golf's lamp places, scaled, when a model's lamp parts are shared between both sides.
function lampAnchors(root, parts, frame) {
  const materials = new Set([...(parts.drl || []), ...(parts.headlights || []), ...(parts.headInner || [])]);
  const sides = { left: new THREE.Box3(), right: new THREE.Box3() };
  const box = new THREE.Box3();
  const centre = new THREE.Vector3();

  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (!node.isMesh || ![node.material].flat().some((material) => materials.has(material))) return;

    box.setFromObject(node);
    box.getCenter(centre);

    if (centre.z > 0.8 * frame.z) {
      sides[centre.x < 0 ? "left" : "right"].union(box);
    }
  });

  return ["left", "right"].map((side) => {
    const found = sides[side];
    const size = found.getSize(new THREE.Vector3());

    if (found.isEmpty() || size.x > 1.1 || size.x < 0.05) {
      return new THREE.Vector3((side === "left" ? -0.62 : 0.62) * frame.x, 0.66 * frame.y, 1.98 * frame.z);
    }

    found.getCenter(centre);

    return new THREE.Vector3(centre.x, centre.y, found.max.z - 0.04);
  });
}

const LAMP_OPTION = (cue) => (cue.beam > 1.2 ? "high" : cue.beam > 0 ? "low" : cue.drl > 0 ? "drl" : "off");

// After the request is sent the chosen car flashes its main beam twice, the side cars once.
function celebration(role, since) {
  if (since < 0 || since > 1.2) return null;

  if (role === "hero") {
    return { drl: 1, beam: since < 0.16 || (since > 0.34 && since < 0.5) ? 1.75 : 1 };
  }

  return { drl: 1, beam: since > 0.36 && since < 0.6 ? 1.75 : 1 };
}

function ShowCar({ role, vehicle, setup, directorRef, worldRef, onReady }) {
  const { scene } = useGLTF(vehicle.url, false, true);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const stage = useThree((state) => state.scene);
  const groupRef = useRef(null);
  const built = useMemo(() => {
    const root = normaliseCar(scene.clone(true), vehicle.length);
    const chassis = rigChassis(root, vehicle.chassis);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    const frame = { x: size.x / REFERENCE_SIZE.x, y: size.y / REFERENCE_SIZE.y, z: size.z / REFERENCE_SIZE.z };
    const parts = classifyParts(root, vehicle.parts, vehicle.chassis);

    return { root, chassis, parts, frame, anchors: lampAnchors(root, parts, frame) };
  }, [scene, vehicle]);
  const textures = useMemo(() => ({ carbon: carbonTexture(), brushed: brushedTexture() }), []);
  const lighting = useMemo(() => createLighting(), []);
  const motion = useRef({ travelled: null, speed: 0, accel: 0, moving: false, pitch: { value: 0, velocity: 0 }, turn: { left: 0, right: 0 }, euler: new THREE.Euler(), pivot: new THREE.Vector3() });

  useLayoutEffect(() => {
    lighting.group.scale.set(built.frame.x, built.frame.y, built.frame.z);
    prepareLampMaterials(built.parts);
    applyGroups(built.parts, setup, textures, [...APPLIED_GROUPS, "finish"]);
    refreshLighting(lighting);
  }, [built, setup, textures, lighting]);

  // Ready once its textures are on the GPU and its shaders compiled, so the first moving frames do not stall.
  useEffect(() => {
    let live = true;

    built.root.traverse((node) => {
      [node.material].flat().forEach((material) => Object.values(material || {}).forEach((value) => value?.isTexture && gl.initTexture(value)));
    });
    gl.compileAsync(built.root, camera, stage)
      .catch(() => {})
      .then(() => live && onReady(role));

    return () => {
      live = false;
    };
  }, [built, gl, camera, stage, onReady, role]);

  useEffect(
    () => () => {
      const shared = new Set();

      scene.traverse((node) => [node.material].flat().forEach((material) => material && shared.add(material)));
      built.root.traverse((node) => [node.material].flat().forEach((material) => material && !shared.has(material) && material.dispose()));
      textures.carbon.dispose();
      textures.brushed.dispose();
      lighting.dispose?.();
    },
    [scene, built, textures, lighting],
  );

  const pose = useMemo(() => ({ x: 0, z: 0, yaw: 0, travelled: 0, curvature: 0, moving: false }), []);
  const hub = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);

  // In its starting place before the first frame, so each car's contact shadow is drawn with no other car above it.
  useLayoutEffect(() => {
    const group = groupRef.current;

    if (role === "hero" || !group) return;

    sidePose(0, role, pose);
    group.position.set(pose.x, 0, pose.z);
    group.rotation.y = pose.yaw;
  }, [role, pose]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const clock = directorRef.current;

    if (!group || !clock.started) return;

    const dt = frameTime(delta);
    const t = clock.time;
    const { chassis, parts, anchors } = built;
    const m = motion.current;

    if (role === "hero") {
      Object.assign(pose, { x: 0, z: 0, yaw: 0, travelled: 0, curvature: 0, moving: false });
    } else {
      sidePose(t, role, pose);
    }

    group.position.set(pose.x, 0, pose.z);
    group.rotation.y = pose.yaw;

    // Wheels roll by the distance covered, the front ones steer with the path; the body pitches as it brakes.
    const step = m.travelled === null ? 0 : pose.travelled - m.travelled;
    const speed = step / Math.max(dt, 1e-3);

    m.accel = dt > 0 ? (speed - m.speed) / Math.max(dt, 1e-3) : 0;
    m.speed = speed;
    m.travelled = pose.travelled;

    if (chassis) {
      steering(pose.moving ? pose.curvature : 0, chassis.wheelbase, chassis.track, m.turn);
      chassis.corners.forEach((corner) => {
        if (corner.steer) corner.steer.rotation.y = corner.left ? m.turn.left : m.turn.right;
        corner.spin.forEach((node) => {
          node.rotation.x -= step / corner.radius;
        });
      });
      chassis.rearDiscs.forEach((node) => {
        node.rotation.x -= step / chassis.corners[2].radius;
      });
      suspend(m.pitch, THREE.MathUtils.clamp(m.accel, -6, 6) * PITCH_PER_ACCEL, 8, 0.7, dt);
      m.euler.set(m.pitch.value, 0, 0);
      chassis.body.quaternion.setFromEuler(m.euler);
      chassis.body.position.copy(chassis.pivot).sub(m.pivot.copy(chassis.pivot).applyQuaternion(chassis.body.quaternion));
    }

    // Lamps, from the script (or the celebration after sending).
    const cue = celebration(role, clock.celebrated === null ? -1 : clock.time - clock.celebrated) || lampCue(role, t);
    const lampSetup = { ...setup, frontLights: LAMP_OPTION(cue), rearLights: cue.drl > 0 ? "on" : "off" };

    updateLighting(lighting, parts, lampSetup, false, dt);

    const level = lighting.level;
    const beam = Math.max(0, level.beam.value);
    const glow = Math.max(0, level.drl.value);

    group.updateMatrixWorld();
    forward.set(Math.sin(pose.yaw), beam > 1.2 ? -0.015 : -0.06, Math.cos(pose.yaw)).normalize();
    anchors.forEach((anchor, index) => {
      const lamp = worldRef.current.lamps[LAMP_SLOTS[role] + index];

      lamp.position.copy(anchor).applyMatrix4(group.matrixWorld);
      // A touch outward, as real low beams spread.
      lamp.direction.copy(forward).applyAxisAngle(THREE.Object3D.DEFAULT_UP, (index === 0 ? 1 : -1) * -0.04).normalize();
      lamp.color.copy(lighting.led);
      lamp.beam = beam;
      lamp.glow = glow;
      lamp.power = beam * 0.9 + glow * 0.1;
      lamp.fog = worldRef.current.fog;
    });

    // Fog rolls off the rear tyres while the car moves, and swells around it when it stops.
    const smoke = worldRef.current.smoke;

    if (smoke && chassis && role !== "hero") {
      if (pose.moving && Math.abs(speed) > 0.2) {
        const count = Math.min(3, Math.floor(Math.abs(speed) * dt * 3.2 + Math.random()));

        chassis.corners.slice(2).forEach((corner) => {
          hub.copy(corner.hub).applyMatrix4(group.matrixWorld);

          for (let index = 0; index < count; index += 1) {
            emit(smoke, hub, { x: -Math.sin(pose.yaw) * speed * 0.18, z: -Math.cos(pose.yaw) * speed * 0.18 }, { size: 1.1, grow: 0.8, life: 7, opacity: 0.2 });
          }
        });
      }

      if (m.moving && !pose.moving) {
        for (let index = 0; index < 14; index += 1) {
          const angle = (index / 14) * Math.PI * 2;

          hub.set(pose.x + Math.sin(angle) * 1.4, 0, pose.z + Math.cos(angle) * 2.2);
          emit(smoke, hub, { x: Math.sin(angle) * 0.45, z: Math.cos(angle) * 0.45 }, { size: 1.6, grow: 0.9, life: 8, opacity: 0.16 });
        }
      }
    }

    m.moving = pose.moving;
  }, -2);

  return (
    <group ref={groupRef} name={`request:${role}`}>
      <primitive object={built.root} />
      <primitive object={lighting.group} />
      <ContactShadow opacity={0.9} ready scale={6.5} far={2.5} resolution={512} />
    </group>
  );
}

// Fog over the floor and the beams of all six lamps.
function Atmosphere({ directorRef, worldRef, quality }) {
  const camera = useThree((state) => state.camera);
  const smoke = useMemo(() => createSmoke(quality === "high" ? 260 : 140), [quality]);
  const beams = useMemo(() => [createBeams(), createBeams(), createBeams()], []);

  useEffect(() => {
    const world = worldRef.current;

    seedLayer(smoke, quality === "high" ? 70 : 42);
    world.smoke = smoke;

    return () => {
      world.smoke = null;
      disposeSmoke(smoke);
    };
  }, [smoke, quality, worldRef]);

  useEffect(() => () => beams.forEach(disposeBeams), [beams]);

  useFrame((state, delta) => {
    const clock = directorRef.current;
    const dt = frameTime(delta);
    const t = clock.started ? clock.time : 0;
    const lamps = worldRef.current.lamps;

    worldRef.current.fog = fogLevel(t);
    beams.forEach((group, index) => updateBeams(group, lamps.slice(index * 2, index * 2 + 2), state.clock.elapsedTime, camera));
    setSmokeLamps(smoke, lamps.map((lamp) => (lamp.power > 0.001 ? { ...lamp, power: lamp.beam * 0.32 + lamp.glow * 0.05 } : null)));
    updateSmoke(smoke, dt, state.clock.elapsedTime, camera, worldRef.current.fog);
  }, -1);

  return (
    <>
      <primitive object={smoke.mesh} />
      {beams.map((group, index) => (
        <primitive key={index} object={group.group} />
      ))}
    </>
  );
}

// The camera follows the script, then holds the final composition. Once the form is in, the picture slides down so
// the cars sit under it (or above it on phones): the page says where through layoutRef.
function CameraDirector({ directorRef, layoutRef }) {
  const size = useThree((state) => state.size);
  const aspect = size.width / Math.max(size.height, 1);
  const path = useMemo(() => createCameraPath(aspect), [aspect]);
  const shot = useMemo(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30 }), []);

  const placed = useRef(null);

  useFrame(({ camera }, delta) => {
    const clock = directorRef.current;
    const t = clock.started ? clock.time : 0;

    path.sample(t, shot);
    camera.position.copy(shot.position);
    camera.lookAt(shot.target);
    camera.fov = shot.fov;
    camera.aspect = aspect;

    // Eased, so the cars glide to their new place when the form changes size (the confirmation is shorter).
    const goal = layoutRef.current?.carsY ?? 0.5;

    placed.current = placed.current === null ? goal : placed.current + (goal - placed.current) * (1 - Math.exp(-frameTime(delta) * 2.5));

    const carsAt = placed.current;
    const slide = THREE.MathUtils.smootherstep(t, SLIDE_FROM, SLIDE_TO) * (0.5 - carsAt) * size.height;

    camera.setViewOffset(size.width, size.height, 0, slide, size.width, size.height);
    camera.updateProjectionMatrix();
  }, 0);

  return null;
}

// Bloom on the lamps, the flares and the brightest beam cores; tone mapping and colour space at the end.
function Composer({ quality }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality === "high" ? 4 : 0 });
    const effect = new EffectComposer(gl, target);

    effect.addPass(new RenderPass(scene, camera));
    effect.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), quality === "high" ? 0.85 : 0.7, 0.55, 0.9));
    effect.addPass(new OutputPass());

    return effect;
  }, [gl, scene, camera, quality]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio() * (quality === "high" ? 1 : 0.75));
    composer.setSize(size.width, size.height);
  }, [composer, gl, size, quality]);

  useEffect(() => () => composer.dispose(), [composer]);

  useFrame((state, delta) => {
    composer.render(delta);
  }, 1);

  return null;
}

function Showroom({ quality }) {
  return (
    <>
      <color attach="background" args={["#040506"]} />
      <fogExp2 attach="fog" args={["#05070a", 0.028]} />
      <ambientLight intensity={0.05} />
      {/* A soft key from above the chosen car: the only lamp of the room, the rest is the cars' own light. */}
      <spotLight position={[0, 7.5, 2.2]} angle={0.5} penumbra={0.95} intensity={95} decay={2} color="#dfe6ff" />
      <Environment resolution={256} frames={1} environmentIntensity={0.55}>
        <Lightformer intensity={1.4} rotation-x={Math.PI / 2} position={[0, 6, 0]} scale={[10, 2.4, 1]} />
        <Lightformer intensity={1.1} rotation-y={Math.PI / 2} position={[-9, 1, 0]} scale={[22, 0.3, 1]} />
        <Lightformer intensity={1.1} rotation-y={-Math.PI / 2} position={[9, 1, 0]} scale={[22, 0.3, 1]} />
        <Lightformer intensity={0.25} position={[0, 2, -14]} scale={[24, 4, 1]} color="#9fb4d6" />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.001, 0]}>
        <planeGeometry args={[80, 80]} />
        {quality === "high" ? (
          <MeshReflectorMaterial
            resolution={512}
            blur={[320, 90]}
            mixBlur={1}
            mixStrength={2.2}
            mixContrast={1.1}
            mirror={0.7}
            depthScale={1.1}
            minDepthThreshold={0.35}
            maxDepthThreshold={1.3}
            roughness={0.82}
            metalness={0.55}
            color="#0a0b0d"
          />
        ) : (
          <meshStandardMaterial color="#0b0c0e" roughness={0.38} metalness={0.6} />
        )}
      </mesh>
    </>
  );
}

// Keeps the script's clock: it starts once all three cars are ready (or at the end, for reduced motion), on the
// clamped frame time so a slow frame never skips part of a move.
function Clock({ directorRef, onCue }) {
  useFrame((state, delta) => {
    const clock = directorRef.current;

    if (!clock.started) return;

    clock.time += frameTime(delta);

    if (!clock.formShown && clock.time >= FORM_AT) {
      clock.formShown = true;
      onCue("form");
    }

    if (!clock.ended && clock.time >= END) {
      clock.ended = true;
      onCue("end");
    }
  }, -3);

  return null;
}

export default function RequestScene({ vehicle, setup, layoutRef, reduceMotion, quality, onQuality, onCue, celebrateKey }) {
  const directorRef = useRef({ started: false, time: 0, formShown: false, ended: false, celebrated: null });
  const worldRef = useRef(createWorld());
  const ready = useRef(new Set());
  const sides = useMemo(() => Object.fromEntries(Object.entries(SIDE_CARS).map(([role, id]) => [role, vehicleById(id)])), []);
  const sideSetups = useMemo(() => Object.fromEntries(Object.entries(sides).map(([role, car]) => [role, factoryFor(car)])), [sides]);

  useEffect(() => {
    if (celebrateKey) directorRef.current.celebrated = directorRef.current.time;
  }, [celebrateKey]);

  const onReady = useMemo(
    () => (role) => {
      ready.current.add(role);

      if (ready.current.size === 3 && !directorRef.current.started) {
        Object.assign(directorRef.current, { started: true, time: reduceMotion ? END : 0 });
        onCue("start");
      }
    },
    [reduceMotion, onCue],
  );

  return (
    <Canvas
      className="tz-request__canvas"
      dpr={quality === "high" ? [1, 1.6] : 1}
      camera={{ position: [1.95, 0.6, 4.7], fov: 30, near: 0.05, far: 120 }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <PerformanceMonitor onDecline={() => onQuality("low")} />
      <Showroom quality={quality} />
      <Clock directorRef={directorRef} onCue={onCue} />
      <Suspense fallback={null}>
        <ShowCar role="hero" vehicle={vehicle} setup={setup} directorRef={directorRef} worldRef={worldRef} onReady={onReady} />
        <ShowCar role="audi" vehicle={sides.audi} setup={sideSetups.audi} directorRef={directorRef} worldRef={worldRef} onReady={onReady} />
        <ShowCar role="mercedes" vehicle={sides.mercedes} setup={sideSetups.mercedes} directorRef={directorRef} worldRef={worldRef} onReady={onReady} />
      </Suspense>
      <Atmosphere directorRef={directorRef} worldRef={worldRef} quality={quality} />
      <CameraDirector directorRef={directorRef} layoutRef={layoutRef} />
      <Composer quality={quality} />
    </Canvas>
  );
}
