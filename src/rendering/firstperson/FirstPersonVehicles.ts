import * as THREE from "three";
import { vehiclePaint } from "../../traffic/VehiclePaint.js";
import { applyMeshInstance } from "../AuthoredMeshPose.js";
import { authoredVehicleForAsset } from "../AuthoredVehicleMeshes.js";
import type { CarMeshAsset } from "../CarMeshAsset.js";
import type { SpriteItem } from "../SceneItem.js";
import type { SharedMeshAssets } from "../View3dHost.js";

/** One mesh of a shared asset, its own material and this view's lit copy. */
interface Twin {
  readonly mesh: THREE.Mesh;
  readonly original: THREE.Material;
  readonly lit: THREE.Material;
}

/** State the shared pose and paint binding change on an asset's own materials
 * per draw (paint atlas, emergency-light colour and gain). */
function follow(lit: THREE.Material, original: THREE.Material): void {
  const from = original as THREE.MeshStandardMaterial,
    to = lit as THREE.MeshStandardMaterial;
  if (to.map !== from.map) to.map = from.map;
  if (to.color && from.color) to.color.copy(from.color);
  if (from.emissiveIntensity !== undefined) to.emissiveIntensity = from.emissiveIntensity;
  to.opacity = from.opacity;
  to.visible = from.visible;
}

/**
 * The first-person view's authored vehicle and train bodies. The meshes, textures
 * and paint atlases are the render host's (249): the fixed view and every 3D view
 * draw one loaded copy, posed per draw with the shared pose. This view owns only
 * lit copies of the materials, which add its shadow shading (247) without
 * changing the shader the fixed view compiles.
 */
export class FirstPersonVehicles {
  private readonly scene = new THREE.Scene();
  private readonly holder = new THREE.Group();
  private readonly twins = new Map<CarMeshAsset, Twin[]>();

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

  /** True once the host's asset is ready; the first call starts its load. */
  drawable(meshes: SharedMeshAssets, assetId: string): boolean {
    return !!meshes.asset(assetId);
  }

  draw(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    meshes: SharedMeshAssets,
    item: SpriteItem,
  ): boolean {
    const mesh = item.mesh;
    const asset = mesh ? meshes.asset(mesh.assetId) : undefined;
    if (!mesh || !asset) return false;
    const definition = authoredVehicleForAsset(mesh.assetId);
    const paint = definition && vehiclePaint(definition.vehicle, mesh.paintSchemeId);
    const paintTexture = paint ? meshes.paint(paint) : undefined;
    const twins = this.twinsFor(asset);
    applyMeshInstance(asset, mesh);
    this.holder.position.set(item.wx, item.wy, item.zOffset);
    this.holder.add(asset.object);
    // The paint goes onto the asset's own materials; the lit copies then follow them.
    const restore = paintTexture ? meshes.bindPaint(asset.object, paintTexture) : undefined;
    for (const twin of twins) {
      follow(twin.lit, twin.original);
      twin.mesh.material = twin.lit;
    }
    try {
      renderer.render(this.scene, camera);
    } finally {
      for (const twin of twins) twin.mesh.material = twin.original;
      restore?.();
      this.holder.remove(asset.object);
    }
    return true;
  }

  /** Lit copies of an asset's materials, made once. Textures stay shared. */
  private twinsFor(asset: CarMeshAsset): Twin[] {
    let twins = this.twins.get(asset);
    if (twins) return twins;
    twins = [];
    const copies = new Map<THREE.Material, THREE.Material>();
    asset.object.traverse((node) => {
      // The asset's own contact disc is not a lit surface; multi-material meshes
      // are not authored for vehicles.
      if (
        !(node instanceof THREE.Mesh) ||
        node.name === "Game-contact-shadow" ||
        Array.isArray(node.material)
      )
        return;
      const original: THREE.Material = node.material;
      let lit = copies.get(original);
      if (!lit) {
        lit = original.clone();
        this.shade(lit);
        copies.set(original, lit);
      }
      twins?.push({ mesh: node, original, lit });
    });
    this.twins.set(asset, twins);
    return twins;
  }

  dispose(): void {
    for (const twins of this.twins.values()) for (const twin of twins) twin.lit.dispose();
    this.twins.clear();
  }
}
