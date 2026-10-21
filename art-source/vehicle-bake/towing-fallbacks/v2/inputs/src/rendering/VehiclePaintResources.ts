import * as THREE from "three";
import type { VehiclePaintScheme } from "../traffic/VehiclePaint.js";
import { ResourceSlot } from "./ResourceSlot.js";

type PaintMaterial = THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;

/** One lazy atlas per model/scheme; all cars keep the same geometry/material owners. */
export class VehiclePaintResources {
  private readonly slots = new Map<string, ResourceSlot<THREE.Texture>>();
  private readonly ready = new Set<string>();
  private materials = new WeakMap<THREE.Object3D, Map<PaintMaterial, THREE.Texture>>();
  private disposed = false;
  constructor(
    private readonly loader: (path: string) => Promise<THREE.Texture> = loadPaintTexture,
  ) {}
  beginFrame() {
    this.ready.clear();
    if (!this.disposed)
      for (const [key, slot] of this.slots) if (slot.state === "ready") this.ready.add(key);
  }
  request(paint: VehiclePaintScheme): THREE.Texture | undefined {
    if (this.disposed) return undefined;
    let slot = this.slots.get(paint.atlas);
    if (!slot) {
      slot = new ResourceSlot<THREE.Texture>();
      this.slots.set(paint.atlas, slot);
      void slot.load(() => this.loader(paint.atlas));
    }
    return this.ready.has(paint.atlas) ? (slot.value ?? undefined) : undefined;
  }
  /** Reused mesh draws are synchronous. Always restore in the caller's finally block. */
  bind(object: THREE.Object3D, texture: THREE.Texture): () => void {
    let materials = this.materials.get(object);
    if (!materials) {
      materials = new Map();
      object.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(node.material) ? node.material : [node.material])
          if (
            (material instanceof THREE.MeshBasicMaterial ||
              material instanceof THREE.MeshStandardMaterial) &&
            material.map
          )
            materials?.set(material, material.map);
      });
      if (!materials.size) throw Error("Painted vehicle has no atlas-owned materials");
      this.materials.set(object, materials);
    }
    for (const material of materials.keys()) material.map = texture;
    return () => {
      for (const [material, original] of materials) material.map = original;
    };
  }
  get states() {
    return Object.fromEntries(
      [...this.slots].map(([key, slot]) => [key, { state: slot.state, error: slot.error }]),
    );
  }
  dispose() {
    this.disposed = true;
    this.ready.clear();
    for (const slot of this.slots.values()) slot.dispose();
    this.materials = new WeakMap();
  }
}

async function loadPaintTexture(path: string): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + path);
  texture.flipY = false; // GLTF UV convention, matching the embedded reviewed atlas.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}
