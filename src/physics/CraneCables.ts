import RAPIER from "@dimforge/rapier3d-compat";
import { CONSTRUCTION_PALLET, WRECKING_BALL } from "../entities/ConstructionCargo.js";
import { craneLinkage, craneRig } from "../traffic/MobileCrane.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { SceneBody } from "./SceneBody.js";

interface Cable {
  crane: SceneBody;
  payload: SceneBody;
  length: number;
  joint: RAPIER.ImpulseJoint;
}

/** One unilateral Rapier rope per hooked body. The solver owns swing and
 * contact response, and both authority and replay reconstruct the same rope. */
export class CraneCables {
  private readonly active = new Map<number, Cable>();

  sync(world: RAPIER.World, bodies: ReadonlyMap<number, SceneBody>, live: readonly SceneBody[]) {
    for (const [id, cable] of this.active) {
      if (
        bodies.get(id) !== cable.crane ||
        cable.crane.entity.vehicleCraneLoadId !== cable.payload.entity.id ||
        bodies.get(cable.payload.entity.id) !== cable.payload ||
        !cable.joint.isValid()
      ) {
        if (cable.joint.isValid()) world.removeImpulseJoint(cable.joint, true);
        this.active.delete(id);
      }
    }
    for (const crane of live) {
      const id = crane.entity.vehicleCraneLoadId;
      if (id === undefined) continue;
      const payload = bodies.get(id);
      if (!payload || ![CONSTRUCTION_PALLET, WRECKING_BALL].includes(payload.entity.type)) continue;
      const tip = craneLinkage(crane.state.excavatorPose).tip;
      const length = craneRig(crane.state.excavatorPose).cable / SCALE;
      const anchor = { x: tip.x / SCALE, y: tip.z / SCALE - crane.halfY, z: tip.y / SCALE };
      const old = this.active.get(crane.entity.id);
      if (old?.length === length) {
        old.joint.setAnchor1(anchor);
      } else {
        if (old) world.removeImpulseJoint(old.joint, true);
        const joint = world.createImpulseJoint(
          RAPIER.JointData.rope(length, anchor, { x: 0, y: payload.halfY, z: 0 }),
          crane.body,
          payload.body,
          true,
        );
        this.active.set(crane.entity.id, { crane, payload, length, joint });
      }
    }
  }

  pairs() {
    return this.active.values();
  }
}
