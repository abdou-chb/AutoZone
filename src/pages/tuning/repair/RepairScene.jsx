import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, MeshReflectorMaterial, OrbitControls, PerformanceMonitor, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import ContactShadow from "../ContactShadow";
import { brushedTexture, carbonTexture, classifyParts, normaliseCar, rigChassis } from "../car-parts";
import { APPLIED_GROUPS, applyGroups } from "../customise";
import { frameTime } from "../motion";
import { factoryFor } from "../options";
import { REFERENCE_SIZE, vehicleById } from "../vehicles";
import { AREAS } from "./repair-areas";

// The repair scene: one car on a dark studio floor, lit like an automotive commercial (a key light, a blue and a red
// rim, soft fog, a reflective floor). A short camera move settles into free orbit; pins on the car mark the places a
// problem can be reported. It reuses the configurator's car-building and the request scene's studio, so nothing here
// is new 3D infrastructure. See docs/audit/tuning-zone.md ("Repair experience").

// Camera stops in "Golf space" (scaled to each car). The areas are framed from outside, so no door or bonnet has to
// open (that is configurator-only logic).
const VIEWS = {
  hero: { position: [6.2, 1.5, 6.8], target: [0, 0.62, 0], fov: 32 },
  engine: { position: [2.4, 2.1, 5.4], target: [0, 0.78, 1.4], fov: 34 },
  frontWheel: { position: [3.5, 0.62, 2.5], target: [0.82, 0.4, 1.3], fov: 30 },
  body: { position: [9.6, 1.12, 0.4], target: [0, 0.62, -0.1], fov: 28 },
  cabin: { position: [2.45, 1.52, 0.1], target: [0.12, 0.72, -0.15], fov: 40 },
};

const AREA_VIEW = { engine: "engine", "front-wheel": "frontWheel", body: "body", cabin: "cabin" };

// The opening move: a wide establishing shot, in towards the front, then a gentle swing to the resting three-quarter.
const INTRO = [
  { t: 0, position: [8.4, 1.25, 9.2], target: [0, 0.55, 0.2], fov: 30 },
  { t: 1.2, position: [2.6, 0.95, 8.0], target: [0, 0.6, 1.3], fov: 32 },
  { t: 2.8, position: [6.2, 1.5, 6.8], target: [0, 0.62, 0], fov: 32 },
];
const INTRO_END = INTRO[INTRO.length - 1].t;

const smoother = (u) => {
  const x = THREE.MathUtils.clamp(u, 0, 1);

  return x * x * x * (x * (x * 6 - 15) + 10);
};

function sampleIntro(time, out) {
  let a = INTRO[0];
  let b = INTRO[1];

  for (let index = 0; index < INTRO.length - 1; index += 1) {
    if (time >= INTRO[index].t) {
      a = INTRO[index];
      b = INTRO[index + 1];
    }
  }

  const u = smoother((time - a.t) / (b.t - a.t));

  out.position.fromArray(a.position).lerp(new THREE.Vector3().fromArray(b.position), u);
  out.target.fromArray(a.target).lerp(new THREE.Vector3().fromArray(b.target), u);
  out.fov = THREE.MathUtils.lerp(a.fov, b.fov, u);

  return out;
}

function Car({ vehicle, onReady, onFrame }) {
  const { scene } = useGLTF(vehicle.url, false, true);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const stage = useThree((state) => state.scene);
  const built = useMemo(() => {
    const root = normaliseCar(scene.clone(true), vehicle.length);

    rigChassis(root, vehicle.chassis);

    const parts = classifyParts(root, vehicle.parts, vehicle.chassis);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());

    return { root, parts, frame: { x: size.x / REFERENCE_SIZE.x, y: size.y / REFERENCE_SIZE.y, z: size.z / REFERENCE_SIZE.z } };
  }, [scene, vehicle]);
  const textures = useMemo(() => ({ carbon: carbonTexture(), brushed: brushedTexture() }), []);

  useEffect(() => {
    onFrame(built.frame);
    applyGroups(built.parts, factoryFor(vehicle), textures, [...APPLIED_GROUPS, "finish"]);
  }, [built, vehicle, textures, onFrame]);

  useEffect(() => {
    let live = true;

    built.root.traverse((node) => [node.material].flat().forEach((material) => Object.values(material || {}).forEach((value) => value?.isTexture && gl.initTexture(value))));
    gl.compileAsync(built.root, camera, stage)
      .catch(() => {})
      .then(() => live && onReady());

    return () => {
      live = false;
    };
  }, [built, gl, camera, stage, onReady]);

  useEffect(
    () => () => {
      const shared = new Set();

      scene.traverse((node) => [node.material].flat().forEach((material) => material && shared.add(material)));
      built.root.traverse((node) => [node.material].flat().forEach((material) => material && !shared.has(material) && material.dispose()));
      textures.carbon.dispose();
      textures.brushed.dispose();
    },
    [scene, built, textures],
  );

  return (
    <group>
      <primitive object={built.root} />
      <ContactShadow opacity={0.9} ready scale={7} far={2.6} resolution={512} />
    </group>
  );
}

// A pin at an area: a dot the customer can click to report a problem there, pulsing when it is the active area.
function Pin({ id, position, label, active, dimmed, onPick }) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} occlude={false} style={{ pointerEvents: "auto" }}>
      <button type="button" className={`tz-rp-pin${active ? " is-active" : ""}${dimmed ? " is-dim" : ""}`} onClick={() => onPick(id)}>
        <span className="tz-rp-pin__dot" />
        <span className="tz-rp-pin__label">{label}</span>
      </button>
    </Html>
  );
}

function Director({ controlsRef, directorRef, frameRef, reduceMotion, onSettled }) {
  const goal = useMemo(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 32 }), []);
  const shot = useMemo(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 32 }), []);

  const frameView = (view, out) => {
    const frame = frameRef.current;

    out.position.set(view.position[0] * frame.x, view.position[1] * frame.y, view.position[2] * frame.z);
    out.target.set(view.target[0] * frame.x, view.target[1] * frame.y, view.target[2] * frame.z);
    out.fov = view.fov;

    return out;
  };

  useFrame(({ camera }, delta) => {
    const director = directorRef.current;
    const orbit = controlsRef.current;

    if (!director.ready || !orbit) return;

    const dt = frameTime(delta);

    if (director.mode === "intro") {
      director.time += reduceMotion ? INTRO_END : dt;

      const done = director.time >= INTRO_END;

      sampleIntro(director.time, shot);
      frameShot(camera, orbit, shot, frameRef.current.y);

      if (done) {
        director.mode = "free";
        orbit.enabled = true;
        orbit.update();
        onSettled();
      }

      return;
    }

    if (director.mode === "focus") {
      frameView(director.view === "hero" ? VIEWS.hero : VIEWS[director.view], goal);

      const step = reduceMotion ? 1 : 1 - Math.exp(-dt * 4.5);

      camera.position.lerp(goal.position, step);
      orbit.target.lerp(goal.target, step);
      camera.fov = THREE.MathUtils.lerp(camera.fov, goal.fov, step);
      camera.updateProjectionMatrix();
      orbit.update();

      if (camera.position.distanceToSquared(goal.position) < 1e-5 && orbit.target.distanceToSquared(goal.target) < 1e-5) {
        director.mode = "free";
        orbit.enabled = true;
      }
    }
  });

  return null;
}

function frameShot(camera, orbit, shot, frameY) {
  camera.position.copy(shot.position);
  orbit.target.copy(shot.target);
  camera.fov = shot.fov;
  camera.updateProjectionMatrix();
  orbit.target.y = Math.max(orbit.target.y, 0.3 * frameY);
  orbit.update();
}

function Studio({ quality }) {
  return (
    <>
      <color attach="background" args={["#0a0c10"]} />
      <fogExp2 attach="fog" args={["#0a0c12", 0.03]} />
      <ambientLight intensity={0.12} />
      {/* Key light from high front, a cool rim from the left, a warm-red rim from the right: the automotive look. */}
      <spotLight position={[2.5, 7, 5]} angle={0.55} penumbra={0.9} intensity={70} decay={2} color="#eef2ff" />
      <spotLight position={[-7, 2.4, -3]} angle={0.7} penumbra={1} intensity={40} decay={2} color="#2f6bff" />
      <spotLight position={[7, 2.2, -3.5]} angle={0.7} penumbra={1} intensity={34} decay={2} color="#ff3b46" />
      <Environment resolution={256} frames={1} environmentIntensity={0.5}>
        <Lightformer intensity={1.5} rotation-x={Math.PI / 2} position={[0, 6, 0]} scale={[10, 3, 1]} />
        <Lightformer intensity={1.2} rotation-y={Math.PI / 2} position={[-8, 1.4, 0]} scale={[18, 0.4, 1]} color="#bcd0ff" />
        <Lightformer intensity={1} rotation-y={-Math.PI / 2} position={[8, 1.4, 0]} scale={[18, 0.4, 1]} color="#ffd0d4" />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.001, 0]}>
        <planeGeometry args={[80, 80]} />
        {quality === "high" ? (
          <MeshReflectorMaterial resolution={512} blur={[300, 90]} mixBlur={1} mixStrength={2} mixContrast={1.1} mirror={0.6} depthScale={1} minDepthThreshold={0.3} maxDepthThreshold={1.3} roughness={0.85} metalness={0.5} color="#0b0d11" />
        ) : (
          <meshStandardMaterial color="#0c0e12" roughness={0.5} metalness={0.5} />
        )}
      </mesh>
    </>
  );
}

export default function RepairScene({ vehicleId, focusArea, activeAreas, reduceMotion, quality, onQuality, onReady, onPickArea, labels }) {
  const vehicle = useMemo(() => vehicleById(vehicleId), [vehicleId]);
  const frameRef = useRef({ x: 1, y: 1, z: 1 });
  const [frame, setFrame] = useState(null);
  const onFrame = useMemo(
    () => (value) => {
      frameRef.current = value;
      setFrame(value);
    },
    [],
  );
  const controls = useRef(null);
  const directorRef = useRef({ ready: false, mode: "intro", time: 0, view: "hero" });
  const [settled, setSettled] = useState(false);

  // Frame the chosen area, then hand control back to the customer.
  useEffect(() => {
    const director = directorRef.current;

    if (!director.ready) return;

    director.view = focusArea && AREA_VIEW[focusArea] ? AREA_VIEW[focusArea] : "hero";
    director.mode = "focus";

    if (controls.current) controls.current.enabled = false;
  }, [focusArea]);

  const ready = useMemo(
    () => () => {
      if (!directorRef.current.ready) {
        directorRef.current.ready = true;
        if (reduceMotion) {
          directorRef.current.mode = "focus";
          directorRef.current.view = "hero";
          setSettled(true);
        }
        onReady?.();
      }
    },
    [onReady, reduceMotion],
  );

  return (
    <Canvas
      className="tz-rp__canvas"
      dpr={quality === "high" ? [1, 1.6] : 1}
      camera={{ position: [8.4, 1.25, 9.2], fov: 30, near: 0.05, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <PerformanceMonitor onDecline={() => onQuality("low")} />
      <Studio quality={quality} />
      <Suspense fallback={null}>
        <Car vehicle={vehicle} onReady={ready} onFrame={onFrame} />
      </Suspense>
      {settled &&
        frame &&
        Object.entries(AREAS).map(([id, area]) => (
            <Pin
              key={id}
              id={id}
              position={[area.point[0] * frame.x, area.point[1] * frame.y + 0.08, area.point[2] * frame.z]}
              label={labels[id]}
              active={focusArea === id}
              dimmed={activeAreas.length > 0 && !activeAreas.includes(id)}
              onPick={onPickArea}
            />
        ))}
      <Director controlsRef={controls} directorRef={directorRef} frameRef={frameRef} reduceMotion={reduceMotion} onSettled={() => setSettled(true)} />
      <OrbitControls ref={controls} makeDefault enabled={false} enablePan={false} enableDamping dampingFactor={0.08} minDistance={3.4} maxDistance={14} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
  );
}
