import * as THREE from "three";
import type { Camera } from "./Camera.js";
import { type CarMeshAsset, loadCarMesh } from "./CarMeshAsset.js";
import type { GpuRasterSurface } from "./GpuRasterSurface.js";
import { COMPACT_CAR_MESH, resolveBody } from "./MeshPresentation.js";
import { projectWorld } from "./Projection.js";
import { ResourceSlot } from "./ResourceSlot.js";
import type { SpriteItem } from "./SceneItem.js";

/** One render target reused synchronously; only this body's triangles share depth. */
export class GpuMeshBodies {
  readonly car = new ResourceSlot<CarMeshAsset>();
  readonly ready = new Set<string>();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  private readonly clearColor = new THREE.Color();
  private enabled = false;
  draws = 0;
  constructor(private readonly surface: GpuRasterSurface) {
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.target.texture.magFilter = this.target.texture.minFilter = THREE.NearestFilter;
    this.target.texture.generateMipmaps = false;
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    if (value && this.car.state === "empty") void this.car.load(loadCarMesh);
  }
  /** Called once before submissions; promise completions only become visible here. */
  beginFrame() {
    this.ready.clear();
    if (this.enabled && this.car.state === "ready") this.ready.add(COMPACT_CAR_MESH);
  }
  draw(camera: Camera, item: SpriteItem): boolean {
    if (resolveBody(item.mesh, this.ready) !== "mesh" || !item.mesh || !this.car.value)
      return false;
    const { surface } = this,
      renderer = surface.renderer;
    surface.flush();
    const radius = item.mesh.radius;
    const resolution = Math.min(1024, Math.max(1, Math.ceil(radius * 2 * camera.scale)));
    if (this.target.width !== resolution || this.target.height !== resolution)
      this.target.setSize(resolution, resolution);
    const object = this.car.value.object;
    object.quaternion.set(...item.mesh.orientation);
    this.scene.add(object);
    // Deliberately oblique: x maps to screen x, z-y maps to screen up.
    this.camera.projectionMatrix.set(
      1 / radius,
      0,
      0,
      0,
      0,
      -1 / radius,
      1 / radius,
      0,
      0,
      -1 / (radius * 4),
      -1 / (radius * 4),
      0,
      0,
      0,
      0,
      1,
    );
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    renderer.getClearColor(this.clearColor);
    const alpha = renderer.getClearAlpha();
    const previous = renderer.getRenderTarget();
    renderer.setScissorTest(false);
    try {
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0, 0);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      renderer.setRenderTarget(previous);
      renderer.setClearColor(this.clearColor, alpha);
      this.scene.remove(object);
    }
    const anchor = projectWorld(camera, item.wx, item.wy, item.zOffset);
    surface.save();
    surface.globalAlpha = item.alpha ?? 1;
    surface.drawTexture(
      this.target.texture,
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
    this.target.dispose();
  }
  dispose() {
    this.ready.clear();
    this.car.dispose();
    this.target.dispose();
  }
  get targetBytes() {
    return this.target.width * this.target.height * 8;
  }
}
