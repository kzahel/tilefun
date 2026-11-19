import * as THREE from "three";
import { Direction } from "../../entities/Entity.js";
import type { SpriteItem } from "../SceneItem.js";
import { WILDLIFE_MESHES, type WildlifeMeshDefinition } from "../WildlifeMeshCatalog.js";

const MAX_ANIMALS = 24;
const HEADING = [0, Math.PI, Math.PI / 2, -Math.PI / 2] as const;

interface Part {
  readonly source: THREE.Mesh;
  readonly instances: THREE.InstancedMesh;
  readonly base: THREE.Quaternion;
}

/** One registered animal's parts share instanced draws across the view. */
class WildlifeMeshBatch {
  private readonly material = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly group = new THREE.Group();
  private readonly body = new THREE.Object3D();
  private readonly angles = new THREE.Euler();
  private readonly rotation = new THREE.Quaternion();
  private readonly transform = new THREE.Matrix4();
  private readonly gltfToWorld = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  private readonly parts: Part[] = [];
  private source: THREE.Group | undefined;
  private loading = true;
  private disposed = false;
  private count = 0;
  private scale = 1;

  constructor(
    root: THREE.Group,
    shade: (material: THREE.Material) => void,
    private readonly definition: WildlifeMeshDefinition,
  ) {
    root.add(this.group);
    shade(this.material);
    void this.load();
  }

  begin(): void {
    this.count = 0;
  }

  push(item: SpriteItem, topDown: boolean): "loading" | "drawn" | "failed" {
    if (!this.source) return this.loading ? "loading" : "failed";

    this.body.position.set(item.wx, item.wy, item.zOffset);
    this.body.rotation.z = HEADING[item.facing ?? item.frameRow] ?? HEADING[Direction.Down];
    const fit = topDown ? this.definition.topDown : undefined;
    this.body.scale.set(
      this.scale * (fit?.width ?? 1),
      this.scale,
      this.scale * (fit?.height ?? 1),
    );
    this.body.updateMatrix();
    if (this.definition.pose) {
      for (const { source, base } of this.parts) {
        this.angles.set(0, 0, 0);
        this.definition.pose(source.name, item.frameCol, this.angles);
        source.quaternion.copy(base).multiply(this.rotation.setFromEuler(this.angles));
      }
    }
    this.source.updateMatrixWorld(true);
    for (const part of this.parts) {
      this.transform
        .copy(this.body.matrix)
        .multiply(this.gltfToWorld)
        .multiply(part.source.matrixWorld);
      part.instances.setMatrixAt(this.count, this.transform);
    }
    this.count++;
    return "drawn";
  }

  end(): void {
    for (const { instances } of this.parts) {
      instances.count = this.count;
      if (this.count) instances.instanceMatrix.needsUpdate = true;
    }
  }

  private async load(): Promise<void> {
    try {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      if (this.disposed) return;
      const { scene } = await new GLTFLoader().loadAsync(
        `${import.meta.env.BASE_URL}${this.definition.path}`,
      );
      const bounds = new THREE.Box3().setFromObject(scene);
      const height = bounds.max.y - bounds.min.y;
      const materials = new Set<THREE.Material>();
      scene.traverse((source) => {
        if (!(source instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(source.material) ? source.material : [source.material])
          materials.add(material);
        if (this.disposed || !(height > 0)) {
          source.geometry.dispose();
          return;
        }
        const instances = new THREE.InstancedMesh(source.geometry, this.material, MAX_ANIMALS);
        instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // Each batch can span the whole view and is rebuilt from visible actors every frame.
        instances.frustumCulled = false;
        instances.count = 0;
        this.group.add(instances);
        this.parts.push({ source, instances, base: source.quaternion.clone() });
      });
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial && material.map) {
          if (this.parts.length) {
            // The embedded atlas belongs to this view. Sample its authored hard edges.
            material.map.minFilter = THREE.NearestFilter;
            material.map.magFilter = THREE.NearestFilter;
            this.material.map = material.map;
          } else {
            material.map.dispose();
          }
        }
        material.dispose();
      }
      if (!this.parts.length) return;
      this.scale = this.definition.height / height;
      this.source = scene;
    } catch (error) {
      console.warn(`3D animal could not load: ${this.definition.path}`, error);
    } finally {
      this.loading = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.group.removeFromParent();
    this.material.map?.dispose();
    this.material.dispose();
    for (const { instances } of this.parts) {
      instances.geometry.dispose();
      instances.dispose();
    }
    this.parts.length = 0;
    this.source = undefined;
  }
}

export class FirstPersonWildlifeMeshes {
  private readonly batches = new Map<string, WildlifeMeshBatch>();
  private enabled = true;
  private topDown = false;
  private count = 0;

  constructor(
    private readonly root: THREE.Group,
    private readonly shade: (material: THREE.Material) => void,
  ) {}

  begin(enabled: boolean, topDown: boolean): void {
    this.enabled = enabled;
    this.topDown = topDown;
    this.count = 0;
    for (const batch of this.batches.values()) batch.begin();
  }

  push(item: SpriteItem): boolean {
    if (
      !this.enabled ||
      this.count === MAX_ANIMALS ||
      item.scaleY !== undefined ||
      (item.alpha !== undefined && item.alpha !== 1)
    )
      return false;

    let batch = this.batches.get(item.sheetKey);
    if (!batch) {
      const definition = WILDLIFE_MESHES.get(item.sheetKey);
      if (!definition) return false;
      batch = new WildlifeMeshBatch(this.root, this.shade, definition);
      this.batches.set(item.sheetKey, batch);
    }
    const result = batch.push(item, this.topDown);
    if (result === "drawn") this.count++;
    return result !== "failed";
  }

  end(): number {
    for (const batch of this.batches.values()) batch.end();
    return this.count;
  }

  dispose(): void {
    for (const batch of this.batches.values()) batch.dispose();
    this.batches.clear();
  }
}
