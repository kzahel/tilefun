import type { Group, Object3D } from "three";
import { FORKLIFT_SCALE, forkliftRig } from "../traffic/Forklift.js";

export class ForkliftMeshRig {
  static load(scene: Group) {
    const mast = scene.getObjectByName("Forklift_Mast");
    if (!mast) return undefined;
    const inner = scene.getObjectByName("Forklift_InnerMast");
    const carriage = scene.getObjectByName("Forklift_Carriage");
    if (!inner || !carriage || inner.parent !== mast || carriage.parent !== mast)
      throw Error("Invalid forklift rig");
    return new ForkliftMeshRig(mast, inner, carriage);
  }

  private constructor(
    private readonly mast: Object3D,
    private readonly inner: Object3D,
    private readonly carriage: Object3D,
  ) {}

  set(pose?: number) {
    const { tilt, lift, extension } = forkliftRig(pose);
    this.mast.rotation.z = -tilt;
    this.carriage.position.y = lift / FORKLIFT_SCALE;
    this.inner.position.y = extension / FORKLIFT_SCALE;
  }
}
