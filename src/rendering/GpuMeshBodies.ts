import * as THREE from "three";
import type { Spritesheet } from "../assets/Spritesheet.js";
import { vehiclePaint } from "../traffic/VehiclePaint.js";
import { applyMeshInstance, loadAuthoredMesh } from "./AuthoredMeshPose.js";
import { authoredTrainForAsset } from "./AuthoredTrainMeshes.js";
import { authoredVehicleForAsset } from "./AuthoredVehicleMeshes.js";
import { CarBodyImageCache, carBodyImageKey } from "./CarBodyImageCache.js";
import type { CarMeshAsset } from "./CarMeshAsset.js";
import { setCarMeshProjection } from "./CarMeshProjection.js";
import { CarPixelOutline } from "./CarPixelOutline.js";
import { CarRenderTargets } from "./CarRenderTargets.js";
import { FrameCarImages } from "./FrameCarImages.js";
import type { GpuSceneSurface } from "./GpuSceneSurface.js";
import { GpuVehicleContents } from "./GpuVehicleContents.js";
import { meshBedFoot, meshChildPoint } from "./MeshGradePose.js";
import {
  AMBULANCE_MESH,
  COMPACT_CAR_MESH,
  FIRE_TRUCK_MESH,
  resolveBody,
} from "./MeshPresentation.js";
import { ResourceSlot } from "./ResourceSlot.js";
import type { SpriteItem } from "./SceneItem.js";
import { VehiclePaintResources } from "./VehiclePaintResources.js";
import type { BodyImage } from "./View3dHost.js";

/** A finished image and its shared resource diagnostics. */
interface DrawnImage extends BodyImage {
  /** Taken from the cache: nothing was rendered for it. */
  readonly reused: boolean;
  readonly painted: boolean;
}

/** Exact finished-image reuse; dirty bodies and opt-in contents share scratch depth. */
export class GpuMeshBodies {
  readonly images = new CarBodyImageCache();
  /** Images lent to 3D views (`bodyImage`): each keeps its own target until the
   * next display frame, because a 3D view draws them all after rendering them. */
  readonly held = new FrameCarImages(16 * 1024 * 1024);
  private heldGroups = 0;
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
  readonly targets = new CarRenderTargets();
  private readonly outline = new CarPixelOutline();
  private readonly clearColor = new THREE.Color();
  draws = 0;
  bedDraws = 0;
  drawCalls = 0;
  paintDraws = 0;
  paintFallbacks = 0;
  constructor(private readonly surface: GpuSceneSurface) {
    for (const assetId of [COMPACT_CAR_MESH, AMBULANCE_MESH, FIRE_TRUCK_MESH])
      this.request(assetId);
  }
  /** Lazy family loads never replace their source sprite before the next frame. */
  request(assetId: string) {
    if (!(authoredVehicleForAsset(assetId) ?? authoredTrainForAsset(assetId))) return undefined;
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
    return this.ready.has(assetId) ? this.slots.get(assetId)?.value?.surfaceGeometry : undefined;
  }
  /** Called once before submissions; promise completions only become visible here.
   * `views`: the last display frame's view count, for the same-frame image memo. */
  beginFrame(views = 1) {
    this.targets.beginFrame();
    this.images.beginFrame(views);
    this.held.beginFrame(true);
    this.heldGroups = 0;
    this.paints.beginFrame();
    this.ready.clear();
    for (const [assetId, slot] of this.slots) if (slot.state === "ready") this.ready.add(assetId);
  }
  /**
   * The outlined body image placed by a view in its scene:
   * the same outlined native-pixel body, with its towed car and bed contents.
   * It stays valid until the next display frame. `shows(radius)` says whether a
   * square of that many world pixels each way from the body's anchor is in
   * view; null when it is not, and nothing is rendered for it. Undefined while
   * the fixed view would show the sprite (assets or paint still loading) or the
   * frame's held images are over budget; the caller then draws the body some
   * other way. Renders into offscreen targets and restores the renderer's target.
   */
  bodyImage(
    item: SpriteItem,
    sheets: ReadonlyMap<string, Spritesheet>,
    shows: (radius: number) => boolean,
  ): BodyImage | null | undefined {
    const image = this.image(item, sheets, shows);
    if (image) {
      this.draws++;
      if (image.painted) this.paintDraws++;
      if (item.bedGroup) this.bedDraws++;
    }
    return image;
  }
  /** `shows`: a 3D view's test of what is in view. Its image must outlive later
   * images of this display frame, so it never lands in the scratch target and
   * never evicts an image used this frame. */
  private image(
    item: SpriteItem,
    sheets: ReadonlyMap<string, Spritesheet>,
    shows: ((radius: number) => boolean) | undefined,
  ): DrawnImage | null | undefined {
    const hold = !!shows;
    const asset = item.mesh ? this.request(item.mesh.assetId)?.value : undefined;
    if (resolveBody(item.mesh, this.ready) !== "mesh" || !item.mesh || !asset) return undefined;
    const definition = authoredVehicleForAsset(item.mesh.assetId);
    const paint = definition && vehiclePaint(definition.vehicle, item.mesh.paintSchemeId);
    const paintTexture = paint && this.paints.request(paint);
    if (paint && !paintTexture) {
      if (!hold) this.paintFallbacks++;
      return undefined; // Complete matching sprite while pending/failed.
    }
    if (item.bedGroup && !this.contents.prepare(item, sheets)) return undefined;
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
      return undefined;
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
    if (shows && !shows(radius)) return null;
    const painted = !!paintTexture;
    const key =
      this.images.enabled && !item.bedGroup && !child && !item.mesh.emergencyEnabled
        ? carBodyImageKey(item.mesh, asset.object.id, paintTexture || undefined)
        : undefined;
    if (key !== undefined) {
      const cached = this.images.get(key);
      if (cached)
        return {
          texture: cached,
          depth: this.images.depth(key),
          radius,
          reused: true,
          painted,
        };
      // An earlier 3D view of this display frame drew the same pose.
      const lent = hold ? this.held.get(key) : undefined;
      if (lent)
        return {
          texture: lent.texture,
          depth: lent.depthTexture,
          radius,
          reused: true,
          painted,
        };
    }
    const { surface } = this,
      renderer = surface.renderer;
    const resolution = Math.min(1024, Math.max(1, Math.ceil(radius * 2)));
    const scratch = this.targets.get(resolution);
    const target = scratch.source;
    const output =
      (key === undefined ? undefined : this.images.admit(key, resolution, hold)) ??
      (hold ? this.held.take(key ?? `group:${this.heldGroups++}`, resolution) : scratch.outline);
    if (!output) return undefined;
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
    // Offscreen body images temporarily suspend the view's scissor.
    const scissor = renderer.getScissorTest();
    let texture = target.texture;
    renderer.setScissorTest(false);
    const restorePaint = paintTexture ? this.paints.bind(object, paintTexture) : undefined;
    const restoreChildPaint =
      childTexture && childAsset ? this.paints.bind(childAsset.object, childTexture) : undefined;
    try {
      renderer.setRenderTarget(target);
      renderer.setClearColor(0, 0);
      renderer.clear();
      renderer.render(this.scene, this.camera);
      // A 3D view keeps its own count over every render of its frame.
      if (!hold) this.drawCalls += renderer.info.render.calls;
      texture = this.outline.render(renderer, target, output);
      if (!hold) this.drawCalls += renderer.info.render.calls;
    } finally {
      restorePaint?.();
      restoreChildPaint?.();
      if (childAsset) this.scene.remove(childAsset.object);
      renderer.setRenderTarget(previous);
      renderer.setScissorTest(scissor);
      renderer.setClearColor(this.clearColor, alpha);
      this.scene.remove(object);
      this.scene.remove(this.contents.group);
    }
    return { texture, depth: output.depthTexture, radius, reused: false, painted };
  }
  recover() {
    this.images.clear();
    this.held.clear();
    this.outline.recover();
    this.targets.clear();
  }
  dispose() {
    this.images.clear();
    this.held.clear();
    this.paints.dispose();
    this.contents.clear();
    this.ready.clear();
    for (const slot of this.slots.values()) slot.dispose();
    this.outline.dispose();
    this.targets.clear();
  }
  get targetBytes() {
    return this.images.bytes + this.images.frameImages.bytes + this.held.bytes + this.targets.bytes;
  }
}
