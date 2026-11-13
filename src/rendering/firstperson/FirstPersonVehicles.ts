import * as THREE from "three";
import { vehiclePaint } from "../../traffic/VehiclePaint.js";
import { applyMeshInstance, loadAuthoredMesh } from "../AuthoredMeshPose.js";
import { authoredVehicleForAsset } from "../AuthoredVehicleMeshes.js";
import type { CarMeshAsset } from "../CarMeshAsset.js";
import { ResourceSlot } from "../ResourceSlot.js";
import type { SpriteItem } from "../SceneItem.js";
import { VehiclePaintResources } from "../VehiclePaintResources.js";

/**
 * The first-person view's authored vehicle and train meshes (229): view-owned
 * assets, loaded on first sight and drawn one body at a time with the shared pose.
 * `shade` adds the view's shading to each loaded material once (247).
 */
export class FirstPersonVehicles {
  private readonly scene = new THREE.Scene();
  private readonly holder = new THREE.Group();
  private readonly slots = new Map<string, ResourceSlot<CarMeshAsset>>();
  private readonly paints = new VehiclePaintResources();
  private readonly shaded = new WeakSet<CarMeshAsset>();
  private readonly ready = new Set<string>();

  constructor(private readonly shade: (material: THREE.Material) => void) {
    // The view mirrors game Y once at each scene root.
    const root = new THREE.Group();
    root.scale.set(1, -1, 1);
    root.add(this.holder);
    this.scene.add(root);
  }

  set fog(fog: THREE.Fog | null) {
    this.scene.fog = fog;
  }

  /** Start of a frame: the asset IDs whose meshes can be drawn in it. */
  beginFrame(): ReadonlySet<string> {
    this.paints.beginFrame();
    this.ready.clear();
    for (const [assetId, slot] of this.slots) if (slot.state === "ready") this.ready.add(assetId);
    return this.ready;
  }

  /** Starts a load on first sight; true only once the asset is ready. */
  drawable(assetId: string): boolean {
    if (this.ready.has(assetId)) return true;
    if (!this.slots.has(assetId)) {
      const slot = new ResourceSlot<CarMeshAsset>();
      this.slots.set(assetId, slot);
      const load = loadAuthoredMesh(assetId);
      if (load) void slot.load(() => load);
      else slot.state = "failed";
    }
    return false;
  }

  draw(renderer: THREE.WebGLRenderer, camera: THREE.Camera, item: SpriteItem): boolean {
    const mesh = item.mesh;
    const asset = mesh ? this.slots.get(mesh.assetId)?.value : undefined;
    if (!mesh || !asset) return false;
    const definition = authoredVehicleForAsset(mesh.assetId);
    const paint = definition && vehiclePaint(definition.vehicle, mesh.paintSchemeId);
    const paintTexture = paint ? this.paints.request(paint) : undefined;
    this.shadeOnce(asset);
    applyMeshInstance(asset, mesh);
    this.holder.position.set(item.wx, item.wy, item.zOffset);
    this.holder.add(asset.object);
    const restore = paintTexture ? this.paints.bind(asset.object, paintTexture) : undefined;
    try {
      renderer.render(this.scene, camera);
    } finally {
      restore?.();
      this.holder.remove(asset.object);
    }
    return true;
  }

  private shadeOnce(asset: CarMeshAsset): void {
    if (this.shaded.has(asset)) return;
    this.shaded.add(asset);
    asset.object.traverse((node) => {
      // The asset's own contact disc is not a lit surface.
      if (!(node instanceof THREE.Mesh) || node.name === "Game-contact-shadow") return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material])
        this.shade(material);
    });
  }

  dispose(): void {
    for (const slot of this.slots.values()) slot.dispose();
    this.slots.clear();
    this.ready.clear();
    this.paints.dispose();
  }
}
