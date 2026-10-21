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
    front: boolean;
  }[] = [];
  private readonly rotation = new THREE.Quaternion();
  readonly meshCount: number;
  /** Compiled draw meshes; meshCount retains the authored source-part count. */
  readonly drawMeshCount: number;
  private lights?: VehicleEmergencyLights;
  private propeller?: THREE.Object3D;
  private propellerRest?: THREE.Quaternion;
  private transportRamp?: THREE.Object3D;
  private transportRampRest?: THREE.Quaternion;
  private towBoom?: THREE.Object3D;
  private towCradle?: THREE.Object3D;
  private towBoomY = 0;
  private towCradlePosition?: THREE.Vector3;
  private dumpBed?: THREE.Object3D;
  private dumpGate?: THREE.Object3D;
  private dumpBedRest?: THREE.Quaternion;
  private dumpGateRest?: THREE.Quaternion;
  private dumpRams: {
    node: THREE.Object3D;
    mount: THREE.Vector3;
    length: number;
    rest: THREE.Quaternion;
  }[] = [];
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
      const ramp = scene.getObjectByName("Transport_Loading_Ramp");
      if (ramp) {
        if (ramp.userData.tilefun_transport_ramp !== 1) throw Error("Invalid transporter ramp");
        this.transportRamp = ramp;
        this.transportRampRest = ramp.quaternion.clone();
      }
      const boom = scene.getObjectByName("Tow_Lift_Boom"),
        cradle = scene.getObjectByName("Tow_Lift_Cradle");
      if (boom || cradle) {
        if (
          !boom ||
          !cradle ||
          boom.parent !== cradle.parent ||
          boom.userData.tilefun_tow_boom !== 1 ||
          cradle.userData.tilefun_tow_cradle !== 1
        )
          throw Error("Invalid tow lift rig");
        this.towBoom = boom;
        this.towCradle = cradle;
        this.towBoomY = boom.position.y;
        this.towCradlePosition = cradle.position.clone();
      }
      const bed = scene.getObjectByName("Dump_Bed_Hinge"),
        gate = scene.getObjectByName("Dump_Tailgate_Hinge");
      if (bed || gate) {
        if (
          !bed ||
          !gate ||
          gate.parent !== bed ||
          bed.userData.tilefun_dump_bed !== 1 ||
          gate.userData.tilefun_dump_tailgate !== 1
        )
          throw Error("Invalid dump equipment rig");
        this.dumpBed = bed;
        this.dumpGate = gate;
        this.dumpBedRest = bed.quaternion.clone();
        this.dumpGateRest = gate.quaternion.clone();
        scene.traverse((node) => {
          if (node.userData.tilefun_dump_ram === 1) {
            const mount = node.userData.bed_mount_gltf,
              length = node.userData.rest_length;
            if (
              !Array.isArray(mount) ||
              mount.length !== 3 ||
              !mount.every(Number.isFinite) ||
              !Number.isFinite(length) ||
              length <= 0
            )
              throw Error("Invalid dump ram");
            this.dumpRams.push({
              node,
              mount: new THREE.Vector3(mount[0], mount[1], mount[2]),
              length,
              rest: node.quaternion.clone(),
            });
          }
        });
        if (this.dumpRams.length !== 2) throw Error("Missing dump hydraulic rams");
      }
      const rolls = new Map<string, THREE.Object3D>();
      scene.traverse((node) => {
        const match = /^Wheel_(.+)_Roll$/.exec(node.name);
        if (!match) return;
        const id = match[1];
        if (!id || rolls.has(id)) throw Error(`Duplicate authored car wheel ${id}`);
        rolls.set(id, node);
      });
      const boat = scene.getObjectByName("Boat_Root");
      const cycleCandidates: THREE.Object3D[] = [];
      let hasBoatMarker = false;
      scene.traverse((node) => {
        if (node.name === "Motorcycle_Root" || Object.hasOwn(node.userData, "tilefun_motorcycle"))
          cycleCandidates.push(node);
        if (Object.hasOwn(node.userData, "tilefun_watercraft")) hasBoatMarker = true;
      });
      if (cycleCandidates.length) {
        const cycle = cycleCandidates[0];
        if (
          cycleCandidates.length !== 1 ||
          !cycle ||
          cycle.name !== "Motorcycle_Root" ||
          cycle.userData.tilefun_motorcycle !== 1 ||
          hasBoatMarker
        )
          throw Error("Invalid authored motorcycle root or ambiguous boat marker");
        const ids: unknown = cycle.userData.wheel_ids;
        if (
          !Array.isArray(ids) ||
          (ids.length !== 2 && ids.length !== 3) ||
          ids[0] !== "F" ||
          ids[1] !== "R" ||
          (ids.length === 3 && ids[2] !== "SC") ||
          rolls.size !== ids.length ||
          ids.some((id) => !rolls.has(id))
        )
          throw Error("Invalid authored motorcycle wheel inventory");
        const steers = new Map<string, THREE.Object3D>();
        scene.traverse((node) => {
          const match = /^Wheel_(.+)_Steer$/.exec(node.name);
          if (match) {
            const id = match[1];
            if (!id || steers.has(id)) throw Error("Duplicate authored motorcycle steer");
            steers.set(id, node);
          }
          if (
            (Object.hasOwn(node.userData, "wheel_radius") ||
              Object.hasOwn(node.userData, "roll_axis_gltf")) &&
            ![...rolls.values()].includes(node)
          )
            throw Error("Authored motorcycle wheel metadata outside a roll node");
        });
        const inside = (node: THREE.Object3D, ancestor: THREE.Object3D) => {
          for (let parent: THREE.Object3D | null = node; parent; parent = parent.parent)
            if (parent === ancestor) return true;
          return false;
        };
        scene.traverse((node) => {
          if (node instanceof THREE.Mesh && !inside(node, cycle))
            throw Error("Authored motorcycle mesh outside marked root");
        });
        if (steers.size !== ids.length) throw Error("Invalid authored motorcycle steer inventory");
        for (const id of ids) {
          const roll = rolls.get(id),
            steer = steers.get(id);
          if (
            !roll ||
            !steer ||
            roll.parent !== steer ||
            !inside(roll, cycle) ||
            !inside(steer, cycle)
          )
            throw Error(`Invalid authored motorcycle wheel ownership ${id}`);
          let hasMesh = false;
          roll.traverse((node) => {
            if (node instanceof THREE.Mesh) hasMesh = true;
          });
          if (
            !hasMesh ||
            [...rolls.values()].some((other) => other !== roll && inside(steer, other))
          )
            throw Error(`Empty or nested authored motorcycle wheel ${id}`);
        }
      } else if (boat?.userData.tilefun_watercraft === 1) {
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
          front: id.startsWith("F"),
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
  setTravel(distance: number, liftedFront = false) {
    if (this.propeller && this.propellerRest) {
      this.rotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), distance / 2);
      this.propeller.quaternion.copy(this.propellerRest).multiply(this.rotation);
    }
    for (const wheel of this.wheels) {
      this.rotation.setFromAxisAngle(
        wheel.axis,
        wheel.front && liftedFront ? 0 : -distance / wheel.radius,
      );
      wheel.roll.quaternion.copy(wheel.rest).multiply(this.rotation);
    }
  }
  setTransportRamp(deployed = false) {
    if (!this.transportRamp || !this.transportRampRest) return;
    this.transportRamp.quaternion
      .copy(this.transportRampRest)
      .multiply(
        this.rotation.setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          deployed ? Math.PI - Math.atan2(24.65, 76) : 0,
        ),
      );
  }
  setTowLift(active = false) {
    if (!this.towBoom || !this.towCradle || !this.towCradlePosition) return;
    const scale = 400 / 23;
    this.towBoom.scale.x = active ? 1 : 7 / 36;
    this.towBoom.position.y = this.towBoomY - (active ? 0 : 6 / scale);
    this.towCradle.position.copy(this.towCradlePosition);
    if (!active) {
      this.towCradle.position.x -= 29 / scale;
      this.towCradle.position.y -= 6 / scale;
    }
  }
  setEmergency(enabled: boolean, time: number) {
    this.lights?.setState(enabled, time);
  }
  setDumpBed(tilt = 0, gateAngle = 0) {
    if (!this.dumpBed || !this.dumpGate) return;
    const axis = new THREE.Vector3(0, 0, -1);
    if (this.dumpBed && this.dumpBedRest)
      this.dumpBed.quaternion
        .copy(this.dumpBedRest)
        .multiply(this.rotation.setFromAxisAngle(axis, tilt));
    if (this.dumpGate && this.dumpGateRest)
      this.dumpGate.quaternion
        .copy(this.dumpGateRest)
        .multiply(this.rotation.setFromAxisAngle(axis, -gateAngle));
    this.object.updateMatrixWorld(true);
    for (const ram of this.dumpRams) {
      if (!ram.node.parent) continue;
      const end = this.dumpBed.localToWorld(ram.mount.clone());
      const delta = ram.node.parent.worldToLocal(end).sub(ram.node.position);
      ram.node.scale.y = delta.length() / ram.length;
      this.rotation.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0).applyQuaternion(ram.rest),
        delta.normalize(),
      );
      ram.node.quaternion.copy(this.rotation).multiply(ram.rest);
    }
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
