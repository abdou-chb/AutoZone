import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { HorizontalBlurShader } from "three/examples/jsm/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/examples/jsm/shaders/VerticalBlurShader.js";

// Soft shadow under one car, drawn once from below. Adapted from drei's ContactShadows (MIT) for the showroom, where
// cars come and go: it is drawn once the car is visible (a car waiting out of sight would leave it empty), and it gives
// its render targets back when the car leaves (drei's keeps them, about 16 MB of GPU memory per car).
function createShadow({ scale, far, resolution }) {
  const target = new THREE.WebGLRenderTarget(resolution, resolution);
  const blurTarget = new THREE.WebGLRenderTarget(resolution, resolution);
  target.texture.generateMipmaps = blurTarget.texture.generateMipmaps = false;

  const plane = new THREE.PlaneGeometry(scale, scale).rotateX(Math.PI / 2);
  const blurPlane = new THREE.Mesh(plane);
  const depth = new THREE.MeshDepthMaterial();
  depth.depthTest = depth.depthWrite = false;
  depth.onBeforeCompile = (shader) => {
    shader.uniforms = { ...shader.uniforms, ucolor: { value: new THREE.Color("#000000") } };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform vec3 ucolor;\nvoid main() {")
      .replace("vec4( vec3( 1.0 - fragCoordZ ), opacity );", "vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );");
  };

  const horizontal = new THREE.ShaderMaterial(HorizontalBlurShader);
  const vertical = new THREE.ShaderMaterial(VerticalBlurShader);
  horizontal.depthTest = vertical.depthTest = false;

  const camera = new THREE.OrthographicCamera(-scale / 2, scale / 2, scale / 2, -scale / 2, 0, far);

  function blurPass(gl, amount) {
    blurPlane.visible = true;
    blurPlane.material = horizontal;
    horizontal.uniforms.tDiffuse.value = target.texture;
    horizontal.uniforms.h.value = amount / 256;
    gl.setRenderTarget(blurTarget);
    gl.render(blurPlane, camera);
    blurPlane.material = vertical;
    vertical.uniforms.tDiffuse.value = blurTarget.texture;
    vertical.uniforms.v.value = amount / 256;
    gl.setRenderTarget(target);
    gl.render(blurPlane, camera);
    blurPlane.visible = false;
  }

  return {
    camera,
    plane,
    texture: target.texture,
    draw(gl, scene, group, blur) {
      const { background, overrideMaterial } = scene;

      group.visible = false;
      scene.background = null;
      scene.overrideMaterial = depth;
      gl.setRenderTarget(target);
      gl.render(scene, camera);
      blurPass(gl, blur);
      blurPass(gl, blur * 0.4);
      gl.setRenderTarget(null);
      group.visible = true;
      scene.overrideMaterial = overrideMaterial;
      scene.background = background;
    },
    dispose() {
      target.dispose();
      blurTarget.dispose();
      plane.dispose();
      depth.dispose();
      horizontal.dispose();
      vertical.dispose();
    },
  };
}

export default function ContactShadow({ opacity, ready, scale = 12, blur = 2.4, far = 3, resolution = 1024 }) {
  const ref = useRef(null);
  const drawn = useRef(false);
  const shadow = useMemo(() => createShadow({ scale, far, resolution }), [scale, far, resolution]);

  useEffect(() => () => shadow.dispose(), [shadow]);

  useFrame(({ gl, scene }) => {
    if (!drawn.current && ready && ref.current) {
      drawn.current = true;
      shadow.draw(gl, scene, ref.current, blur);
    }
  });

  return (
    <group ref={ref} rotation-x={Math.PI / 2}>
      <mesh geometry={shadow.plane} scale={[1, -1, 1]} rotation={[-Math.PI / 2, 0, 0]} dispose={null}>
        <meshBasicMaterial transparent map={shadow.texture} opacity={opacity} depthWrite={false} />
      </mesh>
      <primitive object={shadow.camera} />
    </group>
  );
}
