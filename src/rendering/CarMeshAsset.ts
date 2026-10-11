import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { COMPACT_CAR_GLB } from "./CarMeshDefinition.js";
import { VehicleEmergencyLights } from "./VehicleEmergencyLights.js";

/** Retained vehicle resources, shared by game and labs. The outer group owns the
 * entity pose; the inner group converts GLB +Y-up/-X-forward to game +Z-up/+X.
 * Ground origin is authored. A fixed lateral registration fits its width to
 * the compact game view; ambulance keeps its authored width. Tire radius, roof
 * height and camera projection remain unchanged.
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
  private lights?: VehicleEmergencyLights;
  constructor(scene: THREE.Group, lateralScale = 1.3) {
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
      for (const id of ["FL", "FR", "RL", "RR"]) {
        const roll = scene.getObjectByName(`Wheel_${id}_Roll`);
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
      const normalized = new THREE.Group();
      normalized.rotation.set(Math.PI / 2, 0, Math.PI, "ZYX");
      normalized.add(scene);
      const registered = new THREE.Group();
      registered.scale.y = lateralScale;
      registered.add(normalized);
      this.object.add(registered);
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
): Promise<CarMeshAsset> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${path}`);
  return new CarMeshAsset(gltf.scene, lateralScale);
}
