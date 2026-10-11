import * as THREE from "three";
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
    if (value && this.car.state === "empty") void this.car.load(() => loadCarMesh());
    if (value && this.ambulance.state === "empty")
      void this.ambulance.load(() => loadCarMesh("assets/models/vehicles/ambulance-v2.glb", 1));
    if (value && this.fireTruck.state === "empty")
      void this.fireTruck.load(() =>
        loadCarMesh("assets/models/vehicles/fire-truck-ladder-1-v2.glb", 1),
      );
  }
  /** Called once before submissions; promise completions only become visible here. */
  beginFrame() {
    this.ready.clear();
    if (this.enabled && this.car.state === "ready") this.ready.add(COMPACT_CAR_MESH);
    if (this.enabled && this.ambulance.state === "ready") this.ready.add(AMBULANCE_MESH);
    if (this.enabled && this.fireTruck.state === "ready") this.ready.add(FIRE_TRUCK_MESH);
  }
  draw(camera: Camera, item: SpriteItem): boolean {
    const asset =
      item.mesh?.assetId === FIRE_TRUCK_MESH
        ? this.fireTruck.value
        : item.mesh?.assetId === AMBULANCE_MESH
          ? this.ambulance.value
          : this.car.value;
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
    this.car.dispose();
    this.ambulance.dispose();
    this.fireTruck.dispose();
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
