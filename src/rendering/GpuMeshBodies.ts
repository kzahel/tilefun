import * as THREE from "three";
import type { Spritesheet } from "../assets/Spritesheet.js";
import { vehiclePaint } from "../traffic/VehiclePaint.js";
import { authoredTrainForAsset } from "./AuthoredTrainMeshes.js";
import { authoredVehicleForAsset, vehicleMeshHeightScale } from "./AuthoredVehicleMeshes.js";
import type { Camera } from "./Camera.js";
import { CarBodyImageCache, carBodyImageKey } from "./CarBodyImageCache.js";
import { type CarMeshAsset, loadCarMesh } from "./CarMeshAsset.js";
import { setCarMeshProjection } from "./CarMeshProjection.js";
import { CarPixelOutline } from "./CarPixelOutline.js";
import type { GpuRasterSurface } from "./GpuRasterSurface.js";
import { GpuVehicleContents } from "./GpuVehicleContents.js";
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
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
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
  constructor(private readonly surface: GpuRasterSurface) {
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.target.texture.magFilter = this.target.texture.minFilter = THREE.NearestFilter;
    this.target.texture.generateMipmaps = false;
  }
  setEnabled(value: boolean) {
    if (!value) {
      this.surface.flush();
      this.images.clear();
    }
    this.enabled = value;
    if (value)
      for (const assetId of [COMPACT_CAR_MESH, AMBULANCE_MESH, FIRE_TRUCK_MESH])
        this.request(assetId);
  }
  /** Lazy family loads never replace their source sprite before the next frame. */
  private request(assetId: string) {
    const vehicle = authoredVehicleForAsset(assetId);
    const definition = vehicle ?? authoredTrainForAsset(assetId);
    if (!this.enabled || !definition) return undefined;
    let slot = this.slots.get(assetId);
    if (!slot) {
      slot = new ResourceSlot<CarMeshAsset>();
      this.slots.set(assetId, slot);
    }
    if (slot.state === "empty")
      void slot.load(() =>
        loadCarMesh(definition.path, definition.lateralScale, {
          batch: !!vehicle,
          heightScale: vehicle ? vehicleMeshHeightScale(vehicle.vehicle) : 1,
          contactShadow: !!vehicle,
          preserveParts: vehicle?.batchPreserveParts ?? [],
        }),
      );
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
  /** Called once before submissions; promise completions only become visible here. */
  beginFrame() {
    this.images.beginFrame();
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
      this.composite(camera, item, cached, Math.ceil(item.mesh.radius), !this.deferCachedImages);
      if (paintTexture) this.paintDraws++;
      return true;
    }
    const { surface } = this,
      renderer = surface.renderer;
    surface.flush();
    let radius = item.mesh.radius;
    for (const content of item.bedGroup?.contents ?? []) {
      const bottom = content.wy - item.wy - content.zOffset + item.zOffset + content.drawOffsetY;
      radius = Math.max(
        radius,
        Math.abs(content.wx - item.wx) + content.spriteWidth / 2,
        Math.abs(bottom),
        Math.abs(bottom - content.spriteHeight * (content.scaleY ?? 1)),
      );
    }
    if (child?.mesh)
      radius = Math.max(
        radius,
        Math.abs(child.wx - item.wx) + child.mesh.radius,
        Math.abs(child.wy - item.wy - child.zOffset + item.zOffset) + child.mesh.radius,
      );
    radius = Math.ceil(radius);
    const resolution = Math.min(1024, Math.max(1, Math.ceil(radius * 2)));
    if (this.target.width !== resolution || this.target.height !== resolution)
      this.target.setSize(resolution, resolution);
    const object = asset.object;
    object.quaternion.set(...item.mesh.orientation);
    const yaw = 2 * Math.atan2(item.mesh.orientation[2], item.mesh.orientation[3]);
    if (item.mesh.towPitch || item.mesh.gradePitch)
      object.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          -(item.mesh.towPitch || item.mesh.gradePitch || 0),
        ),
      );
    if (item.mesh.gradeRoll)
      object.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), item.mesh.gradeRoll),
      );
    object.position.set(
      (item.mesh.towOffsetX ?? 0) * Math.cos(yaw),
      (item.mesh.towOffsetX ?? 0) * Math.sin(yaw),
      (item.mesh.towOffsetZ ?? 0) + (item.mesh.gradeOffsetZ ?? 0),
    );
    asset.setTransportRamp(item.mesh.transportRamp ?? false);
    asset.setTowLift(item.mesh.towActive ?? false);
    asset.setTravel(item.mesh.wheelTravel ?? 0, !!item.mesh.towPitch);
    asset.setDumpBed(item.mesh.bedTilt ?? 0, item.mesh.bedGateAngle ?? 0);
    asset.setEmergency(item.mesh.emergencyEnabled ?? false, item.mesh.presentationTime ?? 0);
    this.scene.add(object);
    if (child?.mesh && childAsset) {
      const mesh = child.mesh,
        o = childAsset.object,
        yaw = 2 * Math.atan2(mesh.orientation[2], mesh.orientation[3]);
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
      o.position.set(
        child.wx - item.wx + (mesh.towOffsetX ?? 0) * Math.cos(yaw),
        child.wy - item.wy + (mesh.towOffsetX ?? 0) * Math.sin(yaw),
        child.zOffset - item.zOffset + (mesh.towOffsetZ ?? 0) + (mesh.gradeOffsetZ ?? 0),
      );
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
    let texture = this.target.texture;
    renderer.setScissorTest(false);
    const restorePaint = paintTexture ? this.paints.bind(object, paintTexture) : undefined;
    const restoreChildPaint =
      childTexture && childAsset ? this.paints.bind(childAsset.object, childTexture) : undefined;
    try {
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0, 0);
      renderer.clear();
      renderer.render(this.scene, this.camera);
      this.drawCalls += renderer.info.render.calls;
      texture = this.outline.render(
        renderer,
        this.target,
        key === undefined ? undefined : this.images.admit(key, resolution),
      );
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
    this.composite(camera, item, texture, radius);
    if (item.bedGroup) this.bedDraws++;
    if (paintTexture) this.paintDraws++;
    return true;
  }
  private composite(
    camera: Camera,
    item: SpriteItem,
    texture: THREE.Texture,
    radius: number,
    immediate = true,
  ) {
    const { surface } = this;
    const anchor = projectWorld(camera, item.wx, item.wy, item.zOffset);
    surface.save();
    surface.globalAlpha = item.alpha ?? 1;
    surface.drawTexture(
      texture,
      anchor.sx - radius * camera.scale,
      anchor.sy - radius * camera.scale,
      radius * 2 * camera.scale,
      radius * 2 * camera.scale,
    );
    if (immediate) surface.flush();
    surface.restore();
    this.draws++;
  }
  recover() {
    this.surface.flush();
    this.images.clear();
    this.outline.recover();
    this.target.dispose();
  }
  dispose() {
    this.surface.flush();
    this.images.clear();
    this.paints.dispose();
    this.contents.clear();
    this.ready.clear();
    for (const slot of this.slots.values()) slot.dispose();
    this.outline.dispose();
    this.target.dispose();
  }
  get targetBytes() {
    return (
      this.images.bytes +
      this.target.width * this.target.height * 8 +
      this.outline.target.width * this.outline.target.height * 4
    );
  }
}
