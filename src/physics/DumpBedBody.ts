import RAPIER from "@dimforge/rapier3d-compat";
import type { Entity } from "../entities/Entity.js";
import {
  bedPartLocalVertices,
  bedPartMoves,
  clampBedTilt,
  DUMP_BED,
  DUMP_BED_RATE,
} from "../traffic/DumpBed.js";
import { PHYSICS_DT, PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { MotionIntent, PhysicsBodyState } from "./PhysicsState.js";

/** Every wheeled chassis, solid or articulated, shares the chassis box's inertia
 * with a lowered centre of mass (`centreY` in the collider frame): engine, floor
 * and axles sit low. Articulated parts define contact only, and moving equipment
 * does not move the centre of mass. Half extents in metres, in the collider frame. */
export function setChassisBoxMass(
  desc: RAPIER.ColliderDesc,
  hx: number,
  halfHeight: number,
  hz: number,
  mass: number,
  centreY: number,
) {
  const b = halfHeight;
  desc.setMassProperties(
    mass,
    { x: 0, y: centreY, z: 0 },
    {
      x: (mass / 3) * (b * b + hz * hz),
      y: (mass / 3) * (hx * hx + hz * hz),
      z: (mass / 3) * (hx * hx + b * b),
    },
    { x: 0, y: 0, z: 0, w: 1 },
  );
}

/** The hollow, articulated dump-truck body in the shared world. One compound
 * collider follows the tub angle; the scene's fixed step owns the angle clock, so
 * authority and numerical replay pose the same parts at the same tick. */
export class DumpBedBody {
  private shapeTilt: number;
  /** @param halfY body half height, metres. @param clearance ground clearance, metres. */
  constructor(
    entity: Entity,
    private readonly halfY: number,
    private readonly clearance: number,
  ) {
    this.shapeTilt = Math.fround(clampBedTilt(entity.vehicleBedTilt));
  }

  /** Same collider frame as the ordinary chassis box (raised by half the clearance). */
  private compound(tilt: number, moving = false) {
    const shapes = DUMP_BED.parts
      .filter((part) => !moving || bedPartMoves(part))
      .map((part) => {
        const points = bedPartLocalVertices(part, tilt, this.clearance * SCALE).flatMap((v) => [
          v.x / SCALE,
          v.z / SCALE - this.halfY - this.clearance / 2,
          v.y / SCALE,
        ]);
        const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(points));
        if (!desc) throw Error(`Invalid dump-bed part ${part.name}`);
        return desc.shape;
      });
    return new RAPIER.Compound(
      shapes,
      shapes.map(() => ({ x: 0, y: 0, z: 0 })),
      shapes.map(() => ({ x: 0, y: 0, z: 0, w: 1 })),
    );
  }

  colliderDesc() {
    return new RAPIER.ColliderDesc(this.compound(this.shapeTilt));
  }

  initialState(entity: Entity): Pick<PhysicsBodyState, "bedTilt" | "bedTarget"> {
    const target = Math.fround(clampBedTilt(entity.vehicleBedTarget));
    return {
      ...(this.shapeTilt ? { bedTilt: this.shapeTilt } : {}),
      ...(target ? { bedTarget: target } : {}),
    };
  }

  /** Explicit edits: a bed request, a restored record or a replicated angle. */
  admit(entity: Entity, state: PhysicsBodyState, collider: RAPIER.Collider) {
    const target = Math.fround(clampBedTilt(entity.vehicleBedTarget));
    if (target) state.bedTarget = target;
    else delete state.bedTarget;
    const tilt = Math.fround(clampBedTilt(entity.vehicleBedTilt));
    if (tilt === (state.bedTilt ?? 0)) return;
    if (tilt) state.bedTilt = tilt;
    else delete state.bedTilt;
    this.reshape(state, collider);
  }

  /** Advance a stopped bed one fixed step toward its target. Static terrain/props
   * block the step atomically; dynamic riders and cargo are pushed by contacts. */
  advance(
    state: PhysicsBodyState,
    body: RAPIER.RigidBody,
    collider: RAPIER.Collider,
    statics: RAPIER.Collider | undefined,
  ) {
    const tilt = state.bedTilt ?? 0,
      target = state.bedTarget ?? 0;
    if (tilt === target || Math.hypot(state.vx, state.vy) > 3) return;
    const step = DUMP_BED_RATE * PHYSICS_DT;
    const next = Math.fround(
      target > tilt ? Math.min(target, tilt + step) : Math.max(target, tilt - step),
    );
    if (
      statics?.intersectsShape(
        this.compound(next, true),
        collider.translation(),
        collider.rotation(),
      )
    )
      return;
    if (next) state.bedTilt = next;
    else delete state.bedTilt;
    body.wakeUp();
    this.reshape(state, collider);
  }

  /** Restore/readback: compile the state's angle and publish the replicated fields. */
  publish(entity: Entity, state: PhysicsBodyState, collider: RAPIER.Collider) {
    this.reshape(state, collider);
    if (state.bedTilt) entity.vehicleBedTilt = state.bedTilt;
    else delete entity.vehicleBedTilt;
    if (state.bedTarget) entity.vehicleBedTarget = state.bedTarget;
    else delete entity.vehicleBedTarget;
  }

  private reshape(state: PhysicsBodyState, collider: RAPIER.Collider) {
    const tilt = state.bedTilt ?? 0;
    if (tilt === this.shapeTilt) return;
    collider.setShape(this.compound(tilt));
    this.shapeTilt = tilt;
  }

  /** Driving requires a level bed; authority and replay apply the same lock. */
  static driveIntent(state: PhysicsBodyState, input: MotionIntent): MotionIntent {
    return (state.bedTilt ?? 0) > 0 || (state.bedTarget ?? 0) > 0
      ? { ...input, driveSpeed: 0, steering: 0 }
      : input;
  }
}
