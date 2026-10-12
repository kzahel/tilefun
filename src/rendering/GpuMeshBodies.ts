import * as THREE from "three";
import { authoredTrainForAsset } from "./AuthoredTrainMeshes.js";
import { authoredVehicleForAsset } from "./AuthoredVehicleMeshes.js";
import type { Camera } from "./Camera.js";
import { type CarMeshAsset, loadCarMesh } from "./CarMeshAsset.js";
import { setCarMeshProjection } from "./CarMeshProjection.js";
import { CarPixelOutline } from "./CarPixelOutline.js";
import type { GpuRasterSurface } from "./GpuRasterSurface.js";
import {
  AMBULANCE_MESH,
  COMPACT_CAR_MESH,
  FIRE_TRUCK_MESH,
  resolveBody,
} from "./MeshPresentation.js";
import { projectWorld } from "./Projection.js";
import { ResourceSlot } from "./ResourceSlot.js";
import type { SpriteItem } from "./SceneItem.js";

/** One render target reused synchronously; only this body's triangles share depth. */
export class GpuMeshBodies {
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
  drawCalls = 0;
  constructor(private readonly surface: GpuRasterSurface) {
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.target.texture.magFilter = this.target.texture.minFilter = THREE.NearestFilter;
    this.target.texture.generateMipmaps = false;
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    if (value)
      for (const assetId of [COMPACT_CAR_MESH, AMBULANCE_MESH, FIRE_TRUCK_MESH])
        this.request(assetId);
  }
  /** Lazy family loads never replace their source sprite before the next frame. */
  private request(assetId: string) {
    const definition = authoredVehicleForAsset(assetId) ?? authoredTrainForAsset(assetId);
    if (!this.enabled || !definition) return undefined;
    let slot = this.slots.get(assetId);
    if (!slot) {
      slot = new ResourceSlot<CarMeshAsset>();
      this.slots.set(assetId, slot);
    }
    if (slot.state === "empty")
      void slot.load(() => loadCarMesh(definition.path, definition.lateralScale));
    return slot;
  }
  get assetStates() {
    return Object.fromEntries(
      [...this.slots].map(([assetId, slot]) => [
        assetId,
        {
          state: slot.state,
          meshes: slot.value?.meshCount ?? 0,
          error: slot.error,
        },
      ]),
    );
  }
  /** Called once before submissions; promise completions only become visible here. */
  beginFrame() {
    this.ready.clear();
    if (this.enabled)
      for (const [assetId, slot] of this.slots) if (slot.state === "ready") this.ready.add(assetId);
  }
  draw(camera: Camera, item: SpriteItem): boolean {
    const asset = item.mesh ? this.request(item.mesh.assetId)?.value : undefined;
    if (resolveBody(item.mesh, this.ready) !== "mesh" || !item.mesh || !asset) return false;
    const { surface } = this,
      renderer = surface.renderer;
    surface.flush();
    const radius = item.mesh.radius;
    const resolution = Math.min(1024, Math.max(1, Math.ceil(radius * 2)));
    if (this.target.width !== resolution || this.target.height !== resolution)
      this.target.setSize(resolution, resolution);
    const object = asset.object;
    object.quaternion.set(...item.mesh.orientation);
    asset.setTravel(item.mesh.wheelTravel ?? 0);
    asset.setEmergency(item.mesh.emergencyEnabled ?? false, item.mesh.presentationTime ?? 0);
    this.scene.add(object);
    setCarMeshProjection(this.camera.projectionMatrix, radius);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    renderer.getClearColor(this.clearColor);
    const alpha = renderer.getClearAlpha();
    const previous = renderer.getRenderTarget();
    let texture = this.target.texture;
    renderer.setScissorTest(false);
    try {
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0, 0);
      renderer.clear();
      renderer.render(this.scene, this.camera);
      this.drawCalls += renderer.info.render.calls;
      texture = this.outline.render(renderer, this.target);
      this.drawCalls += renderer.info.render.calls;
    } finally {
      renderer.setRenderTarget(previous);
      renderer.setClearColor(this.clearColor, alpha);
      this.scene.remove(object);
    }
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
    surface.flush();
    surface.restore();
    this.draws++;
    return true;
  }
  recover() {
    this.outline.recover();
    this.target.dispose();
  }
  dispose() {
    this.ready.clear();
    for (const slot of this.slots.values()) slot.dispose();
    this.outline.dispose();
    this.target.dispose();
  }
  get targetBytes() {
    return (
      this.target.width * this.target.height * 8 +
      this.outline.target.width * this.outline.target.height * 4
    );
  }
}
