import * as THREE from "three";
import type { GpuShadow } from "../GpuShadowShape.js";
import type { SpriteItem } from "../SceneItem.js";
import type { SunUniforms } from "./FirstPersonMaterials.js";
import {
  BLOB_LOCAL,
  chunkNearSun,
  DYNAMIC_FADE_END,
  DYNAMIC_FADE_START,
  dynamicOrigin,
  dynamicStrength,
  dynamicTexel,
  SUN,
  SUN_FADE_END,
  SUN_FADE_START,
  SUN_MAP_SIZE,
  SUN_RADIUS,
  SUN_SLOPE,
  sunCardRight,
  sunCasterRange,
  sunMapScale,
  sunOrigin,
  sunProjection,
  writeBlob,
} from "./FirstPersonSun.js";

/** Static meshes on this layer are drawn into the sun's shadow map. */
const CASTER_LAYER = 1;
/** Moving meshes on this layer are drawn into the dynamic shadow map. */
const DYNAMIC_LAYER = 2;
/** Far changes that no map step has picked up are drawn after this long. */
const SETTLE_MS = 400;
/** Linear multiplier in shadow, slightly blue like sky light. */
const SHADE = [0.5, 0.53, 0.62] as const;

/** A depth map along the sun's rays, with its required colour attachment. */
function shadowTarget(): THREE.WebGLRenderTarget & { depthTexture: THREE.DepthTexture } {
  const map = new THREE.DepthTexture(SUN_MAP_SIZE, SUN_MAP_SIZE, THREE.UnsignedShortType);
  // Comparison sampling with linear filtering: the GPU blends four tests per lookup.
  map.compareFunction = THREE.LessEqualCompare;
  map.minFilter = map.magFilter = THREE.LinearFilter;
  const target = new THREE.WebGLRenderTarget(SUN_MAP_SIZE, SUN_MAP_SIZE, {
    depthTexture: map,
    // Nothing is drawn to colour; keep its required attachment small.
    format: THREE.RedFormat,
    type: THREE.UnsignedByteType,
    generateMipmaps: false,
    stencilBuffer: false,
  });
  return target as typeof target & { depthTexture: THREE.DepthTexture };
}

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
  /** The map's scale (`sunMapScale`) as last drawn. */
  private scale = 1;
  /** The last frame's eye and how far from it content can change a visible shadow. */
  private eye: { x: number; y: number } | undefined;
  private range = 0;
  private dirty = true;
  private created = false;
  /** When far content first changed since the last redraw (`performance.now()`). */
  private staleSince: number | undefined;

  constructor() {
    this.target = shadowTarget();
    const map = this.target.depthTexture;
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
      sunTexel: { value: 1 },
      // `DynamicShadows` owns these; until it draws a map there is none to read.
      dynMap: { value: map },
      dynMatrix: { value: new THREE.Matrix4() },
      dynFade: { value: new THREE.Vector4(0, 0, -1, 0) },
      dynTexel: { value: 1 },
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
   * where the view's fog hides the world; `cover` how far from `eye` the view
   * must be shaded (the top-down camera zoomed out), which sets the map's scale.
   */
  update(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    eye: { x: number; y: number },
    fogEnd: number,
    lit: boolean,
    cover?: number,
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
    const scale = sunMapScale(cover);
    if (scale !== this.scale) {
      this.scale = scale;
      this.dirty = true;
      const projection = new THREE.Matrix4().fromArray(sunProjection(scale)).transpose();
      this.camera.projectionMatrix.copy(projection);
      this.camera.projectionMatrixInverse.copy(projection).invert();
      this.uniforms.sunMatrix.value.copy(projection);
      this.uniforms.sunTexel.value = scale;
    }
    this.eye = { x: eye.x, y: eye.y };
    this.range = sunCasterRange(fogEnd, scale);
    const origin = sunOrigin(eye.x, eye.y, scale);
    if (origin.x !== this.origin?.x || origin.y !== this.origin?.y) this.dirty = true;
    this.origin = origin;
    this.uniforms.sunOrigin.value.set(origin.x, -origin.y, 0);
    fade.set(eye.x - origin.x, -(eye.y - origin.y), SUN_FADE_START * scale, SUN_FADE_END * scale);
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
    // A headset's eyes replace the camera of every render while its output is
    // enabled (252); the map is the sun's view, drawn once for both eyes.
    const { xr } = renderer;
    const headset = xr.enabled;
    xr.enabled = false;
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
      xr.enabled = headset;
      renderer.setRenderTarget(previous);
    }
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.depth.dispose();
  }
}

/**
 * Dynamic shadows (tactical 266): a second depth map along the sun's rays that
 * holds only moving bodies (vehicle and cargo meshes, animal models and actor
 * cards facing the sun) at the poses the frame draws. It is redrawn every
 * frame, and every receiver takes the darker of it and the sun's map, so moving
 * bodies shade the ground, the static world, each other and themselves.
 *
 * The map follows the view's centre and is as fine as its cover allows
 * (`dynamicTexel`). Beyond its fade a body keeps its contact shadow.
 */
export class DynamicShadows {
  /** Parent for the frame's actor cards facing the sun; mirrored like the
   * view's world root. Drawn only into the map. */
  readonly cardRoot = new THREE.Group();
  /** Every part of a body that casts is drawn with this. */
  readonly depth = new THREE.MeshBasicMaterial({
    colorWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  /** Maps drawn since the view was created. */
  draws = 0;
  /** World pixels per texel this frame; 0 while off. */
  texel = 0;
  private target: ReturnType<typeof shadowTarget> | undefined;
  private readonly camera = new THREE.Camera();
  private readonly cards = new THREE.Scene();
  private readonly projection = new THREE.Matrix4();
  private readonly shift = new THREE.Matrix4();
  private projected = 0;
  private centre = { x: 0, y: 0 };
  private origin = { x: 0, y: 0 };

  constructor(private readonly uniforms: SunUniforms) {
    this.cardRoot.scale.set(1, -1, 1);
    this.cards.add(this.cardRoot);
  }

  /** Marks a moving mesh in the view's scene as a caster. */
  static cast(mesh: THREE.Object3D): void {
    mesh.layers.enable(DYNAMIC_LAYER);
  }

  /**
   * Before the frame's bodies are collected: place the map around `centre` (game
   * axes) so shadows reach `cover` world pixels from it. With `on` false there
   * is no map this frame. Returns whether there is one.
   */
  place(centre: { x: number; y: number }, cover: number, on: boolean): boolean {
    this.texel = on ? dynamicTexel(cover) : 0;
    if (!on) return false;
    this.centre = { x: centre.x, y: centre.y };
    this.origin = dynamicOrigin(centre.x, centre.y, this.texel);
    return true;
  }

  /** How much of a body's dynamic shadow shows where it stands (game axes): 0
   * while off or beyond the fade. Its contact shadow takes the remainder. */
  strength(x: number, y: number): number {
    return this.texel ? dynamicStrength(this.distance(x, y), this.texel) : 0;
  }

  /** How far a point is from the view's centre (game axes). */
  distance(x: number, y: number): number {
    return Math.hypot(x - this.centre.x, y - this.centre.y);
  }

  /**
   * Whether a body within `radius` of a point (game axes, `z` its height) can
   * shade covered ground. The map is the ground seen along the sun's rays, so a
   * raised body is tested where its shadow falls, not where it stands.
   */
  reaches(x: number, y: number, z: number, radius: number): boolean {
    // The body's own height throws its top as far again as it is tall.
    const half = SUN_RADIUS * this.texel + radius * 2;
    return (
      this.texel > 0 &&
      Math.abs(x + SUN_SLOPE.x * z - this.origin.x) < half &&
      Math.abs(y + SUN_SLOPE.y * z - this.origin.y) < half
    );
  }

  /**
   * Draw the frame's map and point receivers at it, after the sun's own update
   * (receivers measure from its origin). `scene` is the view's world: only its
   * meshes marked with `cast` are drawn. `bodies` draws the rest (shared vehicle
   * meshes, posed per draw) through the given camera.
   */
  draw(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    bodies: (camera: THREE.Camera) => void,
  ): void {
    const { uniforms, texel } = this;
    const fade = uniforms.dynFade.value;
    if (!texel) {
      fade.set(0, 0, -1, 0);
      // Receivers still declare the sampler: it reads the sun's map, unused.
      uniforms.dynMap.value = uniforms.sunMap.value;
      this.release();
      return;
    }
    this.target ??= shadowTarget();
    if (this.projected !== texel) {
      this.projected = texel;
      this.projection.fromArray(sunProjection(texel)).transpose();
      this.camera.projectionMatrix.copy(this.projection);
      this.camera.projectionMatrixInverse.copy(this.projection).invert();
    }
    const { origin, centre } = this;
    const sunOrigin = uniforms.sunOrigin.value;
    // Scene axes: game Y mirrored.
    this.shift.makeTranslation(sunOrigin.x - origin.x, sunOrigin.y + origin.y, 0);
    uniforms.dynMatrix.value.multiplyMatrices(this.projection, this.shift);
    uniforms.dynTexel.value = texel;
    uniforms.dynMap.value = this.target.depthTexture;
    fade.set(
      centre.x - sunOrigin.x,
      -centre.y - sunOrigin.y,
      DYNAMIC_FADE_START * texel,
      DYNAMIC_FADE_END * texel,
    );
    this.draws++;
    this.camera.position.set(origin.x, -origin.y, 0);
    this.camera.updateMatrixWorld(true);
    const previous = renderer.getRenderTarget();
    const { overrideMaterial, fog } = scene;
    // As the sun's map: one map for both of a headset's eyes.
    const { xr } = renderer;
    const headset = xr.enabled;
    xr.enabled = false;
    try {
      renderer.setRenderTarget(this.target);
      renderer.clear(false, true, false);
      scene.overrideMaterial = this.depth;
      scene.fog = null;
      this.camera.layers.set(DYNAMIC_LAYER);
      renderer.render(scene, this.camera);
      this.camera.layers.set(0);
      renderer.render(this.cards, this.camera);
      bodies(this.camera);
    } finally {
      scene.overrideMaterial = overrideMaterial;
      scene.fog = fog;
      xr.enabled = headset;
      renderer.setRenderTarget(previous);
    }
  }

  /** The map is as large as the sun's: it is kept only while the mode is on. */
  private release(): void {
    this.target?.depthTexture.dispose();
    this.target?.dispose();
    this.target = undefined;
  }

  dispose(): void {
    this.release();
    this.depth.dispose();
  }
}

/**
 * The fixed view's plain ground shadow (`drawSceneEntry2D`) for a sprite that
 * has one but no depth-pass shape (bodies without a collider, such as gems):
 * an oval `shadowWidth` across and 0.35 of that deep at its feet row, on the
 * ground height the collector resolved.
 */
export function plainShadow(item: SpriteItem): GpuShadow | undefined {
  if (!item.hasShadow || item.gpuShadow || item.shadowWidth <= 0) return undefined;
  const half = item.shadowWidth / 2;
  return {
    x: item.wx,
    y: item.shadowFeetWy,
    ux: half,
    uy: 0,
    vx: 0,
    vy: half * 0.35,
    plane: [0, 0, item.shadowTerrainZ + 1],
    band: 2,
    support: item.shadowTerrainZ,
    mask: "oval",
  };
}

const BLOB_VERTEX = `
// local x, local y (−1…1 across the footprint), shape (0 oval, 1 vehicle), strength
attribute vec4 mask;
varying vec4 vMask;
#include <fog_pars_vertex>
void main() {
  vMask = mask;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
// The analytic masks of the fixed view's depth pass (GpuDeferredShadows).
const BLOB_FRAGMENT = `
varying vec4 vMask;
#include <fog_pars_fragment>
void main() {
  vec2 l = vMask.xy;
  float a = vMask.z < 0.5
    ? (1.0 - length(l)) / 0.2
    : (0.18 - length(max(abs(l) - 0.72, 0.0))) / 0.12;
  a = clamp(a, 0.0, 1.0) * 0.3 * vMask.w;
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

  /** One caster's shadow on the surface at `support` under its centre, at
   * `strength` of its darkness (a caster fading into the dynamic map). */
  push(shadow: GpuShadow, support: number, strength = 1): void {
    if (strength <= 0) return;
    if (this.count * 12 >= this.positions.length) this.grow();
    writeBlob(this.positions, this.count * 12, shadow, support);
    const shape = shadow.mask === "vehicle" ? 1 : 0;
    const m = this.count * 16;
    for (let i = 0; i < 4; i++) {
      this.masks[m + i * 4] = BLOB_LOCAL[i * 2] ?? 0;
      this.masks[m + i * 4 + 1] = BLOB_LOCAL[i * 2 + 1] ?? 0;
      this.masks[m + i * 4 + 2] = shape;
      this.masks[m + i * 4 + 3] = strength;
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
      masks = new Float32Array(quads * 16);
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
      new THREE.BufferAttribute(masks, 4).setUsage(THREE.DynamicDrawUsage),
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
