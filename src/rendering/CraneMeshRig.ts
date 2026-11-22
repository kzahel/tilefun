import * as THREE from "three";
import { CRANE_SCALE, craneLinkage, craneRig } from "../traffic/MobileCrane.js";

export interface CraneCableEnd {
  x: number;
  y: number;
  z: number;
  wrecking: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Absolute GLB joint transforms. The hook and cable end follow the solved
 * payload independently of the boom, so the cable stays taut on screen. */
export class CraneMeshRig {
  static load(scene: THREE.Group, retain: (resource: { dispose(): void }) => void) {
    const slew = scene.getObjectByName("Crane_Slew");
    if (!slew) return undefined;
    const boom = scene.getObjectByName("Crane_Boom");
    const middle = scene.getObjectByName("Crane_Middle");
    const tip = scene.getObjectByName("Crane_Tip");
    const hook = scene.getObjectByName("Crane_Hook");
    if (
      !boom ||
      !middle ||
      !tip ||
      !hook?.parent ||
      boom.parent !== slew ||
      middle.parent !== boom ||
      tip.parent !== middle
    )
      throw Error("Invalid mobile crane rig");
    const geometry = new THREE.CylinderGeometry(0.55 / CRANE_SCALE, 0.55 / CRANE_SCALE, 1, 6);
    const material = new THREE.MeshBasicMaterial({ color: 0x414955, toneMapped: false });
    retain(geometry);
    retain(material);
    const cable = new THREE.Mesh(geometry, material);
    hook.parent.add(cable);
    return new CraneMeshRig(slew, boom, middle, tip, hook, cable);
  }

  private readonly start = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly delta = new THREE.Vector3();
  private constructor(
    private readonly slew: THREE.Object3D,
    private readonly boom: THREE.Object3D,
    private readonly middle: THREE.Object3D,
    private readonly tip: THREE.Object3D,
    private readonly hook: THREE.Object3D,
    private readonly cable: THREE.Mesh,
  ) {}

  set(pose: number | undefined, payload?: CraneCableEnd) {
    const { yaw, pitch, extension, cable } = craneRig(pose);
    const tip = craneLinkage(pose).tip;
    this.slew.rotation.y = yaw;
    this.boom.rotation.z = -pitch;
    this.middle.position.x = -extension / (2 * CRANE_SCALE);
    this.tip.position.x = this.middle.position.x;
    this.start.set(-tip.x / CRANE_SCALE, tip.z / CRANE_SCALE, tip.y / CRANE_SCALE);
    const end = payload ?? { x: tip.x, y: tip.y, z: Math.max(1, tip.z - cable), wrecking: false };
    this.end.set(-end.x / CRANE_SCALE, end.z / CRANE_SCALE, end.y / CRANE_SCALE);
    this.hook.position.copy(this.end);
    this.hook.visible = !end.wrecking;
    this.delta.subVectors(this.end, this.start);
    this.cable.visible = this.delta.lengthSq() > 1e-6;
    this.cable.scale.y = this.delta.length();
    this.cable.position.copy(this.start).lerp(this.end, 0.5);
    this.cable.quaternion.setFromUnitVectors(UP, this.delta.normalize());
  }
}
