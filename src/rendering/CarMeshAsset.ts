import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { COMPACT_CAR_GLB } from "./CarMeshDefinition.js";
import { VehicleEmergencyLights } from "./VehicleEmergencyLights.js";
import { batchVehicleGeometry } from "./VehicleGeometryBatches.js";

export interface CarMeshAssetOptions {
  batch?: boolean;
  /** Fixed game-local Z registration. Applied after rigid wheel pose, before yaw. */
  heightScale?: number;
  /** Ground-plane contact cue; native sprite fallback already contains its shadow. */
  contactShadow?: boolean;
  /** Qualified source surfaces retain their independent raster/depth ordering. */
  preserveParts?: readonly string[];
}

/** Retained vehicle resources, shared by game and labs. The outer group owns the
 * entity pose; the inner group converts GLB +Y-up/-X-forward to game +Z-up/+X.
 * Ground origin and wheel rig are authored. Fixed lateral and optional vertical
 * registrations fit the game-camera silhouette around Z=0 before entity yaw.
 * Direct authoring callers keep native height; the world projection stays fixed.
 */
export class CarMeshAsset {
  readonly object = new THREE.Group();
  private readonly resources = new Set<{ dispose(): void }>();
  private readonly bitmaps = new Set<ImageBitmap>();
  private readonly wheels: {
    roll: THREE.Object3D;
    rest: THREE.Quaternion;
    axis: THREE.Vector3;
    radius: number;
  }[] = [];
  private readonly rotation = new THREE.Quaternion();
  readonly meshCount: number;
  /** Compiled draw meshes; meshCount retains the authored source-part count. */
  readonly drawMeshCount: number;
  private lights?: VehicleEmergencyLights;
  private propeller?: THREE.Object3D;
  private propellerRest?: THREE.Quaternion;
  constructor(scene: THREE.Group, lateralScale = 1.3, options?: CarMeshAssetOptions) {
    let meshes = 0;
    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      meshes++;
      this.resources.add(node.geometry);
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        this.resources.add(material);
        material.toneMapped = false;
        for (const value of Object.values(material)) {
          if (!(value instanceof THREE.Texture)) continue;
          value.magFilter = value.minFilter = THREE.NearestFilter;
          value.generateMipmaps = false;
          value.needsUpdate = true;
          this.resources.add(value);
          if (typeof ImageBitmap !== "undefined" && value.image instanceof ImageBitmap)
            this.bitmaps.add(value.image);
        }
      }
    });
    this.meshCount = meshes;
    try {
      const rolls = new Map<string, THREE.Object3D>();
      scene.traverse((node) => {
        const match = /^Wheel_(.+)_Roll$/.exec(node.name);
        if (!match) return;
        const id = match[1];
        if (!id || rolls.has(id)) throw Error(`Duplicate authored car wheel ${id}`);
        rolls.set(id, node);
      });
      const boat = scene.getObjectByName("Boat_Root");
      if (boat?.userData.tilefun_watercraft === 1) {
        if (rolls.size || !scene.getObjectByName("Boat_Hull"))
          throw Error("Invalid authored boat rig");
        const propeller = scene.getObjectByName("Boat_Propeller");
        if (!propeller) throw Error("Missing authored boat propeller");
        this.propeller = propeller;
        this.propellerRest = this.propeller.quaternion.clone();
      } else {
        for (const id of ["FL", "FR", "RL", "RR"])
          if (!rolls.has(id)) throw Error(`Missing authored car wheel ${id}`);
      }
      for (const [id, roll] of rolls) {
        const steer = scene.getObjectByName(`Wheel_${id}_Steer`);
        const radius: unknown = roll?.userData.wheel_radius;
        const axis: unknown = roll?.userData.roll_axis_gltf;
        if (
          !roll ||
          !steer ||
          roll.parent !== steer ||
          typeof radius !== "number" ||
          !Number.isFinite(radius) ||
          radius <= 0 ||
          !Array.isArray(axis) ||
          axis.length !== 3 ||
          !axis.every((v) => typeof v === "number" && Number.isFinite(v)) ||
          Math.hypot(...axis) === 0
        )
          throw Error(`Invalid authored car wheel ${id}`);
        this.wheels.push({
          roll,
          rest: roll.quaternion.clone(),
          axis: new THREE.Vector3(axis[0], axis[1], axis[2]).normalize(),
          radius,
        });
      }
      if (options?.batch)
        for (const name of options.preserveParts ?? [])
          if (!(scene.getObjectByName(name) instanceof THREE.Mesh))
            throw Error(`Missing qualified vehicle part ${name}`);
      this.drawMeshCount = options?.batch
        ? batchVehicleGeometry(
            scene,
            (geometry) => this.resources.add(geometry),
            new Set(options.preserveParts),
          )
        : meshes;
      const normalized = new THREE.Group();
      normalized.rotation.set(Math.PI / 2, 0, Math.PI, "ZYX");
      normalized.add(scene);
      const registered = new THREE.Group();
      registered.scale.y = lateralScale;
      registered.scale.z = options?.heightScale ?? 1;
      registered.add(normalized);
      this.object.add(registered);
      if (options?.contactShadow) {
        this.object.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(this.object, true);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const geometry = new THREE.CircleGeometry(1, 32);
        const material = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          forceSinglePass: true,
          depthWrite: false,
          toneMapped: false,
        });
        const shadow = new THREE.Mesh(geometry, material);
        shadow.name = "Game-contact-shadow";
        shadow.position.set(center.x, center.y, -0.01);
        shadow.scale.set(size.x * 0.48, size.y * 0.48, 1);
        this.object.add(shadow);
        this.resources.add(geometry);
        this.resources.add(material);
      }
      this.lights = new VehicleEmergencyLights(scene, {
        periodSeconds: 1,
        pulseWindows: [
          [0, 0.12],
          [0.2, 0.32],
        ],
        peakGain: 4,
      });
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  /** Absolute pose per draw: a shared resource never carries another car's phase. */
  setTravel(distance: number) {
    if (this.propeller && this.propellerRest) {
      this.rotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), distance / 2);
      this.propeller.quaternion.copy(this.propellerRest).multiply(this.rotation);
    }
    for (const wheel of this.wheels) {
      this.rotation.setFromAxisAngle(wheel.axis, -distance / wheel.radius);
      wheel.roll.quaternion.copy(wheel.rest).multiply(this.rotation);
    }
  }
  setEmergency(enabled: boolean, time: number) {
    this.lights?.setState(enabled, time);
  }
  dispose() {
    this.lights?.dispose();
    for (const resource of this.resources) resource.dispose();
    for (const bitmap of this.bitmaps) bitmap.close();
    this.resources.clear();
    this.bitmaps.clear();
    this.object.clear();
  }
}
export async function loadCarMesh(
  path = COMPACT_CAR_GLB,
  lateralScale = 1.3,
  options?: CarMeshAssetOptions,
): Promise<CarMeshAsset> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${path}`);
  return new CarMeshAsset(gltf.scene, lateralScale, options);
}
