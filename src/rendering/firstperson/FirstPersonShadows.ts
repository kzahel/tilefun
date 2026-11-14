import * as THREE from "three";
import type { GpuShadow } from "../GpuShadowShape.js";
import type { SunUniforms } from "./FirstPersonMaterials.js";
import {
  BLOB_LOCAL,
  chunkNearSun,
  SUN,
  SUN_FADE_END,
  SUN_FADE_START,
  SUN_MAP_SIZE,
  sunCardRight,
  sunCasterRange,
  sunOrigin,
  sunProjection,
  writeBlob,
} from "./FirstPersonSun.js";

/** Static meshes on this layer are drawn into the sun's shadow map. */
const CASTER_LAYER = 1;
/** Far changes that no map step has picked up are drawn after this long. */
const SETTLE_MS = 400;
/** Linear multiplier in shadow, slightly blue like sky light. */
const SHADE = [0.5, 0.53, 0.62] as const;

/**
 * The sun's shadow in the first-person view (tactical 247): one depth map of the
 * static world (ground relief, prop solids and standing cards), redrawn only when
 * that content changes or the eye crosses a snap step. Every frame's cost is one
 * depth comparison per pixel. Moving bodies are not in the map; they receive its
 * shadow and get contact shadows from `BlobShadows`.
 */
export class SunShadows {
  readonly uniforms: SunUniforms;
  /** Sun-facing axis for the static cards' shadow copies (game axes). */
  readonly cardRight = { value: new THREE.Vector2() };
  /** Parent for those copies; mirrored like the view's world root. */
  readonly cardRoot = new THREE.Group();
  redraws = 0;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly camera = new THREE.Camera();
  private readonly cards = new THREE.Scene();
  private readonly depth = new THREE.MeshBasicMaterial({
    colorWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  private origin: { x: number; y: number } | undefined;
  /** The last frame's eye and how far from it content can change a visible shadow. */
  private eye: { x: number; y: number } | undefined;
  private range = 0;
  private dirty = true;
  private created = false;
  /** When far content first changed since the last redraw (`performance.now()`). */
  private staleSince: number | undefined;

  constructor() {
    const map = new THREE.DepthTexture(SUN_MAP_SIZE, SUN_MAP_SIZE, THREE.UnsignedShortType);
    // Comparison sampling with linear filtering: the GPU blends four tests per lookup.
    map.compareFunction = THREE.LessEqualCompare;
    map.minFilter = map.magFilter = THREE.LinearFilter;
    this.target = new THREE.WebGLRenderTarget(SUN_MAP_SIZE, SUN_MAP_SIZE, {
      depthTexture: map,
      // Nothing is drawn to colour; keep its required attachment small.
      format: THREE.RedFormat,
      type: THREE.UnsignedByteType,
      generateMipmaps: false,
      stencilBuffer: false,
    });
    const projection = new THREE.Matrix4().fromArray(sunProjection()).transpose();
    this.camera.projectionMatrix.copy(projection);
    this.camera.projectionMatrixInverse.copy(projection).invert();
    this.uniforms = {
      sunMap: { value: map },
      sunMatrix: { value: projection },
      sunOrigin: { value: new THREE.Vector3() },
      sunDir: { value: new THREE.Vector3(SUN.x, -SUN.y, SUN.z) },
      sunFade: { value: new THREE.Vector4(0, 0, -1, 0) },
      sunShade: { value: new THREE.Color(...SHADE) },
    };
    const right = sunCardRight();
    this.cardRight.value.set(right.x, right.y);
    this.cardRoot.scale.set(1, -1, 1);
    this.cards.add(this.cardRoot);
  }

  /** The graphics context was restored: the map is empty and must be set up again. */
  reset(): void {
    this.created = false;
    this.dirty = true;
  }

  /** Marks a static world mesh as a shadow caster. */
  static cast(mesh: THREE.Object3D): void {
    mesh.layers.enable(CASTER_LAYER);
  }

  /** Static casters changed: everywhere, or in one chunk. A chunk too far away to
   * change a visible shadow now waits for the map's next step, or `SETTLE_MS` when
   * the eye is not moving (chunks arriving behind the fog while it opens). */
  invalidate(cx?: number, cy?: number): void {
    if (cx === undefined || cy === undefined || !this.eye) this.dirty = true;
    else if (chunkNearSun(cx, cy, this.eye, this.range)) this.dirty = true;
    else this.staleSince ??= performance.now();
  }

  /**
   * Before the view's frame: point receivers at this eye and redraw the map if it
   * is stale. `scene` is the view's world; only its caster-layer meshes are drawn.
   * With `lit` false (rooms, shadows off) every receiver is fully lit. `fogEnd` is
   * where the view's fog hides the world.
   */
  update(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    eye: { x: number; y: number },
    fogEnd: number,
    lit: boolean,
  ): void {
    // Receivers declare a shadow sampler even while unlit, and a draw with anything
    // but a comparison depth texture bound to it is invalid: create the map now.
    if (!this.created) {
      this.created = true;
      renderer.initRenderTarget(this.target);
    }
    const fade = this.uniforms.sunFade.value;
    if (!lit) {
      // A fade that ends at distance 0 leaves everything lit without a lookup.
      fade.set(0, 0, -1, 0);
      this.origin = this.eye = undefined;
      return;
    }
    this.eye = { x: eye.x, y: eye.y };
    this.range = sunCasterRange(fogEnd);
    const origin = sunOrigin(eye.x, eye.y);
    if (origin.x !== this.origin?.x || origin.y !== this.origin?.y) this.dirty = true;
    this.origin = origin;
    this.uniforms.sunOrigin.value.set(origin.x, -origin.y, 0);
    fade.set(eye.x - origin.x, -(eye.y - origin.y), SUN_FADE_START, SUN_FADE_END);
    if (this.staleSince !== undefined && performance.now() - this.staleSince >= SETTLE_MS)
      this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    this.staleSince = undefined;
    this.redraws++;
    this.camera.position.set(origin.x, -origin.y, 0);
    this.camera.updateMatrixWorld(true);
    const previous = renderer.getRenderTarget();
    const { overrideMaterial, fog } = scene;
    renderer.setRenderTarget(this.target);
    renderer.clear(false, true, false);
    try {
      scene.overrideMaterial = this.depth;
      scene.fog = null;
      this.camera.layers.set(CASTER_LAYER);
      renderer.render(scene, this.camera);
      this.camera.layers.set(0);
      renderer.render(this.cards, this.camera);
    } finally {
      scene.overrideMaterial = overrideMaterial;
      scene.fog = fog;
      renderer.setRenderTarget(previous);
    }
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.depth.dispose();
  }
}

const BLOB_VERTEX = `
attribute vec3 mask; // local x, local y (−1…1 across the footprint), shape (0 oval, 1 vehicle)
varying vec3 vMask;
#include <fog_pars_vertex>
void main() {
  vMask = mask;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
// The analytic masks of the fixed view's depth pass (GpuDeferredShadows).
const BLOB_FRAGMENT = `
varying vec3 vMask;
#include <fog_pars_fragment>
void main() {
  vec2 l = vMask.xy;
  float a = vMask.z < 0.5
    ? (1.0 - length(l)) / 0.2
    : (0.18 - length(max(abs(l) - 0.72, 0.0))) / 0.12;
  a = clamp(a, 0.0, 1.0) * 0.3;
  if (a <= 0.0) discard;
  #ifdef USE_FOG
    a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`;

/**
 * Contact shadows under moving bodies: one soft dark quad per caster on the
 * surface under it, all in one draw. Shapes come from the shared collector, as in
 * the fixed view's depth pass.
 */
export class BlobShadows {
  count = 0;
  readonly mesh: THREE.Mesh;
  private positions = new Float32Array(0);
  private masks = new Float32Array(0);
  private readonly material = new THREE.ShaderMaterial({
    vertexShader: BLOB_VERTEX,
    fragmentShader: BLOB_FRAGMENT,
    uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });

  constructor(parent: THREE.Object3D) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  begin(): void {
    this.count = 0;
  }

  /** One caster's shadow on the surface at `support` under its centre. */
  push(shadow: GpuShadow, support: number): void {
    if (this.count * 12 >= this.positions.length) this.grow();
    const p = this.count * 12;
    writeBlob(this.positions, p, shadow, support);
    const shape = shadow.mask === "vehicle" ? 1 : 0;
    for (let i = 0; i < 4; i++) {
      this.masks[p + i * 3] = BLOB_LOCAL[i * 2] ?? 0;
      this.masks[p + i * 3 + 1] = BLOB_LOCAL[i * 2 + 1] ?? 0;
      this.masks[p + i * 3 + 2] = shape;
    }
    this.count++;
  }

  end(): void {
    this.mesh.visible = this.count > 0;
    if (!this.count) return;
    const geometry = this.mesh.geometry;
    (geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute("mask") as THREE.BufferAttribute).needsUpdate = true;
    geometry.setDrawRange(0, this.count * 6);
  }

  private grow(): void {
    const quads = Math.max(64, (this.positions.length / 12) * 2);
    const positions = new Float32Array(quads * 12),
      masks = new Float32Array(quads * 12);
    positions.set(this.positions);
    masks.set(this.masks);
    this.positions = positions;
    this.masks = masks;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      "mask",
      new THREE.BufferAttribute(masks, 3).setUsage(THREE.DynamicDrawUsage),
    );
    const index = quads * 4 > 65535 ? new Uint32Array(quads * 6) : new Uint16Array(quads * 6);
    for (let q = 0; q < quads; q++)
      index.set(
        [0, 1, 2, 0, 2, 3].map((i) => q * 4 + i),
        q * 6,
      );
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    this.mesh.geometry.dispose();
    this.mesh.geometry = geometry;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
