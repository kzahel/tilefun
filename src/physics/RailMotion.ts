import RAPIER from "@dimforge/rapier3d-compat";
import type { Entity } from "../entities/Entity.js";
import { isTrain } from "../railway/Train.js";
import { physicsBodyDimensions } from "./PhysicsBodies.js";
import { PHYSICS_DT, PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { MotionIntent, PhysicsBodyState } from "./PhysicsState.js";

/** The subset of a scene body read by prescribed rail motion. */
export interface RailBody {
  entity: Entity;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  halfY: number;
  state: PhysicsBodyState;
  queryRadius: number;
}

export const railGroup = (e: Entity) => e.physicsGroupId ?? e.id;

/** A consist stops as one group when any moving car would sweep into static
 * geometry or another body during this tick. Read-only shape casts. */
export function blockedRailGroups(
  moving: readonly RailBody[],
  bodies: ReadonlyMap<number, RailBody>,
  statics: RAPIER.Collider | undefined,
  intents: ReadonlyMap<number, MotionIntent>,
): Set<number> {
  const blocked = new Set<number>();
  for (const entry of moving) {
    if (!isTrain(entry.entity)) continue;
    const input = intents.get(entry.entity.id);
    if (!input || (!input.vx && !input.vy)) continue;
    const d = physicsBodyDimensions(entry.entity),
      p = entry.body.translation(),
      q = entry.body.rotation();
    const shape = new RAPIER.Cuboid(
      d.width / 2 / SCALE - 0.01,
      entry.halfY - 0.02,
      d.depth / 2 / SCALE - 0.01,
    );
    const motion = {
      x: (input.vx * PHYSICS_DT) / SCALE,
      y: 0,
      z: (input.vy * PHYSICS_DT) / SCALE,
    };
    const group = railGroup(entry.entity);
    const candidates = [
      statics,
      ...[...bodies.values()]
        .filter(
          (other) =>
            other !== entry &&
            !(isTrain(other.entity) && railGroup(other.entity) === group) &&
            other.state.z < entry.state.z + d.height - 0.5 &&
            Math.hypot(other.state.x - entry.state.x, other.state.y - entry.state.y) <
              d.width + other.queryRadius * SCALE + 8,
        )
        .map((other) => other.collider),
    ];
    if (
      candidates.some((c) => c?.castShape({ x: 0, y: 0, z: 0 }, shape, p, q, motion, 0, 1, false))
    )
      blocked.add(group);
  }
  return blocked;
}

/** This tick's admitted rail trajectory, so riders neither lag a start nor slide
 * one extra tick after a station stop. */
export function prescribedRailVelocity(
  state: PhysicsBodyState,
  input: MotionIntent | undefined,
  blocked: boolean,
  tick: number,
): RAPIER.Vector {
  const stopped =
    !input || blocked || (input.controlUntil !== undefined && tick >= input.controlUntil);
  return {
    x: stopped ? 0 : input.vx / SCALE,
    y: stopped ? 0 : ((input.altitude ?? state.z) - state.z) / SCALE / PHYSICS_DT,
    z: stopped ? 0 : input.vy / SCALE,
  };
}
