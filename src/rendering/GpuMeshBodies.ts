import * as THREE from "three";
import type { Spritesheet } from "../assets/Spritesheet.js";
import { vehiclePaint } from "../traffic/VehiclePaint.js";
import { applyMeshInstance, loadAuthoredMesh } from "./AuthoredMeshPose.js";
import { authoredTrainForAsset } from "./AuthoredTrainMeshes.js";
import { authoredVehicleForAsset } from "./AuthoredVehicleMeshes.js";
import type { Camera } from "./Camera.js";
import { CarBodyImageCache, carBodyImageKey } from "./CarBodyImageCache.js";
import type { CarMeshAsset } from "./CarMeshAsset.js";
import { setCarMeshProjection } from "./CarMeshProjection.js";
import { CarPixelOutline } from "./CarPixelOutline.js";
import { CarRenderTargets } from "./CarRenderTargets.js";
import type { GpuRasterSurface } from "./GpuRasterSurface.js";
import { GpuVehicleContents } from "./GpuVehicleContents.js";
import { meshBedFoot, meshChildPoint } from "./MeshGradePose.js";
import {
  AMBULANCE_MESH,
  COMPACT_CAR_MESH,
  FIRE_TRUCK_MESH,
  resolveBody,
} from "./MeshPresentation.js";
import { projectWorld } from "./Projection.js";
import { ResourceSlot } from "./ResourceSlot.js";
import type { SpriteItem } from "./SceneItem.js";
import { VehiclePaintResources } from "./VehiclePaintResources.js";
import { WORLD_DEPTH_RANGE } from "./WorldDepth.js";

/** Exact finished-image reuse; dirty bodies and opt-in contents share scratch depth. */
export class GpuMeshBodies {
  readonly images = new CarBodyImageCache();
  readonly paints = new VehiclePaintResources();
  readonly contents = new GpuVehicleContents();
  readonly car = new ResourceSlot<CarMeshAsset>();
  readonly ambulance = new ResourceSlot<CarMeshAsset>();
  readonly fireTruck = new ResourceSlot<CarMeshAsset>();
  private readonly slots = new Map<string, ResourceSlot<CarMeshAsset>>([
    [COMPACT_CAR_MESH, this.car],
    [AMBULANCE_MESH, this.ambulance],
    [FIRE_TRUCK_MESH, this.fireTruck],
  ]);
  readonly ready = new Set<string>();
  readonly shadowCasters = new Set<number>();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  readonly targets = new CarRenderTargets();
  private readonly outline = new CarPixelOutline();
  private readonly clearColor = new THREE.Color();
  private enabled = false;
  draws = 0;
  bedDraws = 0;
  drawCalls = 0;
  paintDraws = 0;
  paintFallbacks = 0;
  /** Diagnostic baseline keeps the old immediate cached-image submission. */
  deferCachedImages = true;
  constructor(private readonly surface: GpuRasterSurface) {}
  setEnabled(value: boolean) {
    if (!value) {
      this.surface.flush();
      this.images.clear();
      this.targets.clear();
    }
    this.enabled = value;
    if (value)
      for (const assetId of [COMPACT_CAR_MESH, AMBULANCE_MESH, FIRE_TRUCK_MESH])
        this.request(assetId);
  }
  /** Lazy family loads never replace their source sprite before the next frame. */
  request(assetId: string) {
    if (!this.enabled || !(authoredVehicleForAsset(assetId) ?? authoredTrainForAsset(assetId)))
      return undefined;
    let slot = this.slots.get(assetId);
    if (!slot) {
      slot = new ResourceSlot<CarMeshAsset>();
      this.slots.set(assetId, slot);
    }
    if (slot.state === "empty")
      void slot.load(() => loadAuthoredMesh(assetId) ?? Promise.reject(Error(assetId)));
    return slot;
  }
  get assetStates() {
    return Object.fromEntries(
      [...this.slots].map(([assetId, slot]) => [
        assetId,
        {
          state: slot.state,
          meshes: slot.value?.meshCount ?? 0,
          drawMeshes: slot.value?.drawMeshCount ?? 0,
          error: slot.error,
        },
      ]),
    );
  }
  surfaceGeometry(assetId: string) {
    return this.enabled && this.ready.has(assetId)
      ? this.slots.get(assetId)?.value?.surfaceGeometry
      : undefined;
  }
  /** Called once before submissions; promise completions only become visible here.
   * `views`: the last display frame's view count, for the same-frame image memo. */
  beginFrame(views = 1) {
    this.shadowCasters.clear();
    this.targets.beginFrame();
    this.images.beginFrame(views);
    this.paints.beginFrame();
    this.ready.clear();
    if (this.enabled)
      for (const [assetId, slot] of this.slots) if (slot.state === "ready") this.ready.add(assetId);
  }
  draw(
    camera: Camera,
    item: SpriteItem,
    sheets: ReadonlyMap<string, Spritesheet> = new Map(),
  ): boolean {
    const asset = item.mesh ? this.request(item.mesh.assetId)?.value : undefined;
    if (resolveBody(item.mesh, this.ready) !== "mesh" || !item.mesh || !asset) return false;
    const definition = authoredVehicleForAsset(item.mesh.assetId);
    const paint = definition && vehiclePaint(definition.vehicle, item.mesh.paintSchemeId);
    const paintTexture = paint && this.paints.request(paint);
    if (paint && !paintTexture) {
      this.paintFallbacks++;
      return false; // Complete matching sprite while pending/failed.
    }
    if (item.bedGroup && !this.contents.prepare(item, sheets)) return false;
    const child = item.towGroup,
      childAsset = child?.mesh ? this.request(child.mesh.assetId)?.value : undefined;
    const childDefinition = child?.mesh && authoredVehicleForAsset(child.mesh.assetId);
    const childPaint =
      childDefinition && vehiclePaint(childDefinition.vehicle, child?.mesh?.paintSchemeId);
    const childTexture = childPaint && this.paints.request(childPaint);
    if (
      child &&
      (!child.mesh ||
        !childAsset ||
        !this.ready.has(child.mesh.assetId) ||
        (childPaint && !childTexture))
    )
      return false;
    const key =
      this.images.enabled && !item.bedGroup && !child && !item.mesh.emergencyEnabled
        ? carBodyImageKey(item.mesh, asset.object.id, paintTexture || undefined)
        : undefined;
    const cached = key === undefined ? undefined : this.images.get(key);
    if (cached) {
      this.composite(
        camera,
        item,
        cached,
        Math.ceil(item.mesh.radius),
        key === undefined ? undefined : this.images.depth(key),
        !this.deferCachedImages,
      );
      if (paintTexture) this.paintDraws++;
      if (item.shadowCasterId !== undefined) this.shadowCasters.add(item.shadowCasterId);
      return true;
    }
    const { surface } = this,
      renderer = surface.renderer;
    surface.flush();
    let radius = item.mesh.radius;
    for (const content of item.bedGroup?.contents ?? []) {
      const foot = meshBedFoot(item, content);
      const bottom = foot.y - foot.z + content.drawOffsetY;
      radius = Math.max(
        radius,
        Math.abs(foot.x) + content.spriteWidth / 2,
        Math.abs(bottom),
        Math.abs(bottom - content.spriteHeight * (content.scaleY ?? 1)),
      );
    }
    const childPoint = child?.mesh ? meshChildPoint(item, child) : undefined;
    if (child?.mesh && childPoint)
      radius = Math.max(
        radius,
        Math.abs(childPoint.x) + child.mesh.radius,
        Math.abs(childPoint.y - childPoint.z) + child.mesh.radius,
      );
    radius = Math.ceil(radius);
    const resolution = Math.min(1024, Math.max(1, Math.ceil(radius * 2)));
    const scratch = this.targets.get(resolution);
    const target = scratch.source;
    const object = asset.object;
    applyMeshInstance(asset, item.mesh);
    this.scene.add(object);
    if (child?.mesh && childAsset) {
      const mesh = child.mesh,
        o = childAsset.object;
      o.quaternion.set(...mesh.orientation);
      if (mesh.towPitch || mesh.gradePitch)
        o.quaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            -(mesh.towPitch || mesh.gradePitch || 0),
          ),
        );
      if (mesh.gradeRoll)
        o.quaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), mesh.gradeRoll),
        );
      if (childPoint) o.position.set(childPoint.x, childPoint.y, childPoint.z);
      if (item.mesh.gradePitch || item.mesh.gradeRoll) {
        const parentGrade = object.quaternion
          .clone()
          .multiply(new THREE.Quaternion(...item.mesh.orientation).invert());
        o.quaternion.premultiply(parentGrade);
      }
      childAsset.setTravel(mesh.wheelTravel ?? 0, !!mesh.towPitch);
      childAsset.setTransportRamp(false);
      childAsset.setTowLift(false);
      childAsset.setDumpBed(0, 0);
      childAsset.setEmergency(mesh.emergencyEnabled ?? false, mesh.presentationTime ?? 0);
      this.scene.add(o);
    }
    if (item.bedGroup) this.scene.add(this.contents.group);
    setCarMeshProjection(this.camera.projectionMatrix, radius);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    renderer.getClearColor(this.clearColor);
    const alpha = renderer.getClearAlpha();
    const previous = renderer.getRenderTarget();
    let texture = target.texture;
    let depth: THREE.Texture | null = target.depthTexture;
    renderer.setScissorTest(false);
    const restorePaint = paintTexture ? this.paints.bind(object, paintTexture) : undefined;
    const restoreChildPaint =
      childTexture && childAsset ? this.paints.bind(childAsset.object, childTexture) : undefined;
    try {
      renderer.setRenderTarget(target);
      renderer.setClearColor(0, 0);
      renderer.clear();
      renderer.render(this.scene, this.camera);
      this.drawCalls += renderer.info.render.calls;
      const output =
        (key === undefined ? undefined : this.images.admit(key, resolution)) ?? scratch.outline;
      texture = this.outline.render(renderer, target, output);
      depth = output.depthTexture;
      this.drawCalls += renderer.info.render.calls;
    } finally {
      restorePaint?.();
      restoreChildPaint?.();
      if (childAsset) this.scene.remove(childAsset.object);
      renderer.setRenderTarget(previous);
      renderer.setClearColor(this.clearColor, alpha);
      this.scene.remove(object);
      this.scene.remove(this.contents.group);
    }
    this.composite(camera, item, texture, radius, depth);
    if (item.shadowCasterId !== undefined) this.shadowCasters.add(item.shadowCasterId);
    if (item.bedGroup) this.bedDraws++;
    if (paintTexture) this.paintDraws++;
    return true;
  }
  private composite(
    camera: Camera,
    item: SpriteItem,
    texture: THREE.Texture,
    radius: number,
    depth: THREE.Texture | null | undefined,
    immediate = true,
  ) {
    const { surface } = this;
    const anchor = projectWorld(camera, item.wx, item.wy, item.zOffset);
    surface.save();
    surface.globalAlpha = item.alpha ?? 1;
    const subpixel = camera.worldRaster && item.subpixel;
    surface.imageSmoothingEnabled = !!subpixel;
    const size = subpixel ? Math.round(radius * 2 * camera.scale) : radius * 2 * camera.scale;
    if (depth) {
      surface.setDepthPlane(0, 0, 0.5 - (item.wy + item.zOffset - camera.y) / WORLD_DEPTH_RANGE);
      surface.drawDepthTexture(
        texture,
        depth,
        anchor.sx - size / 2,
        anchor.sy - size / 2,
        size,
        size,
        (8 * radius) / WORLD_DEPTH_RANGE,
      );
    } else surface.drawTexture(texture, anchor.sx - size / 2, anchor.sy - size / 2, size, size);
    if (immediate) surface.flush();
    surface.restore();
    this.draws++;
  }
  recover() {
    this.surface.flush();
    this.images.clear();
    this.outline.recover();
    this.targets.clear();
  }
  dispose() {
    this.surface.flush();
    this.images.clear();
    this.paints.dispose();
    this.contents.clear();
    this.ready.clear();
    for (const slot of this.slots.values()) slot.dispose();
    this.outline.dispose();
    this.targets.clear();
  }
  get targetBytes() {
    return this.images.bytes + this.images.frameImages.bytes + this.targets.bytes;
  }
}
