import RAPIER from "@dimforge/rapier3d-compat";
import type { Entity } from "../entities/Entity.js";
import type { ExcavatorAction } from "../shared/ExcavatorInput.js";
import { required } from "../shared/required.js";
import {
  type ArmMotorProfile,
  advanceExcavatorPose,
  excavatorBrakeTarget,
  excavatorHoldTarget,
  excavatorLinkage,
  fineExcavatorPose,
} from "../traffic/Excavator.js";
import { FORKLIFT, FORKLIFT_REST, forkliftRig, isForklift } from "../traffic/Forklift.js";
import { CRANE_REST, craneLinkage, isMobileCrane } from "../traffic/MobileCrane.js";
import { rotateBodyVector, worldRotation } from "./BodyRotation.js";
import { forkliftShapes } from "./ForkliftShapes.js";
import { PHYSICS_DT, PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { MotionIntent, PhysicsBodyState } from "./PhysicsState.js";

const ZERO = { x: 0, y: 0, z: 0 };
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
// Conservative centreline solids under the actual working pieces. The tip
// contact stops a little before the rendered teeth so they can skim the dirt.
const PROFILES = [
  { length: 43, halfHeight: 3.2, halfWidth: 2.7 },
  { length: 32, halfHeight: 2.2, halfWidth: 1.9 },
  { length: 14.4, halfHeight: 1.1, halfWidth: 6.7 },
] as const;

/** The same stopped, position-driven attachments are solved in authority and
 * prediction. The joints change the body's contact shape, not its inertia. */
export class ExcavatorBody {
  private pose: number;
  private readonly profile: ArmMotorProfile | undefined;
  private stabilized = false;
  private readonly chassis: RAPIER.RoundCuboid;

  constructor(
    entity: Entity,
    hx: number,
    private halfY: number,
    private hz: number,
    private clearance: number,
  ) {
    this.profile = isMobileCrane(entity) ? "crane" : isForklift(entity) ? "forklift" : undefined;
    this.pose = this.readPose(entity);
    const bevel = 1 / SCALE;
    this.chassis = new RAPIER.RoundCuboid(
      hx - bevel,
      halfY - clearance / 2 - bevel,
      hz - bevel,
      bevel,
    );
  }

  private links(pose: number, whole: boolean) {
    if (this.profile === "forklift")
      return forkliftShapes(pose, this.halfY, this.hz, this.clearance, whole);
    const arm = this.profile === "crane" ? craneLinkage(pose) : undefined;
    if (arm) {
      const { start, tip, yaw, pitch, length } = arm;
      const sy = -Math.sin(yaw / 2);
      const cy = Math.cos(yaw / 2);
      const sp = Math.sin(pitch / 2);
      const cp = Math.cos(pitch / 2);
      const translation = {
        x: (start.x + tip.x) / (2 * SCALE),
        y: (start.z + tip.z) / (2 * SCALE) - this.halfY - this.clearance / 2,
        z: (start.y + tip.y) / (2 * SCALE),
      };
      const rotation = { x: sy * sp, y: sy * cp, z: cy * sp, w: cy * cp };
      const boom = new RAPIER.Cuboid(length / (2 * SCALE), 4 / SCALE, 4.5 / SCALE);
      return whole
        ? new RAPIER.Compound([this.chassis, boom], [ZERO, translation], [IDENTITY, rotation])
        : new RAPIER.Compound([boom], [translation], [rotation]);
    }
    const { points, yaw, pitches } = excavatorLinkage(pose);
    const shapes: RAPIER.Shape[] = [];
    const translations: RAPIER.Vector[] = [];
    const rotations: RAPIER.Rotation[] = [];
    if (whole) {
      shapes.push(this.chassis);
      translations.push(ZERO);
      rotations.push(IDENTITY);
    }
    const sy = -Math.sin(yaw / 2);
    const cy = Math.cos(yaw / 2);
    for (const [i, profile] of PROFILES.entries()) {
      const from = required(points[i]);
      const to = required(points[i + 1]);
      const fraction = i === 2 ? profile.length / 32 : 0.5;
      const pitch = required(pitches[i]) / 2;
      const sp = Math.sin(pitch);
      const cp = Math.cos(pitch);
      shapes.push(
        new RAPIER.Cuboid(
          profile.length / 2 / SCALE,
          profile.halfHeight / SCALE,
          profile.halfWidth / SCALE,
        ),
      );
      translations.push({
        x: (from.x + (to.x - from.x) * fraction) / SCALE,
        y: (from.z + (to.z - from.z) * fraction) / SCALE - this.halfY - this.clearance / 2,
        z: (from.y + (to.y - from.y) * fraction) / SCALE,
      });
      rotations.push({ x: sy * sp, y: sy * cp, z: cy * sp, w: cy * cp });
    }
    return new RAPIER.Compound(shapes, translations, rotations);
  }

  colliderDesc() {
    return new RAPIER.ColliderDesc(this.links(this.pose, true));
  }

  private readPose(entity: Entity) {
    const rest =
      this.profile === "crane"
        ? CRANE_REST
        : this.profile === "forklift"
          ? FORKLIFT_REST
          : undefined;
    return fineExcavatorPose(entity.vehicleExcavator ?? rest);
  }

  admit(entity: Entity, state: PhysicsBodyState, collider: RAPIER.Collider) {
    state.excavatorPose = this.readPose(entity);
    if (entity.vehicleExcavatorTarget === undefined) delete state.excavatorTarget;
    else state.excavatorTarget = fineExcavatorPose(entity.vehicleExcavatorTarget);
    if (entity.vehicleExcavatorRate === undefined) delete state.excavatorRate;
    else state.excavatorRate = entity.vehicleExcavatorRate;
    this.reshape(state.excavatorPose, collider);
  }

  advance(
    state: PhysicsBodyState,
    body: RAPIER.RigidBody,
    collider: RAPIER.Collider,
    statics: RAPIER.Collider | undefined,
    world: RAPIER.World,
    action: ExcavatorAction | undefined,
    loaded = false,
  ) {
    const pose = state.excavatorPose ?? this.pose;
    this.acceptControl(state, pose, action);
    const target = state.excavatorTarget;
    const moving = Math.hypot(state.vx, state.vy) > 3;
    if (this.profile === "crane")
      this.stabilize(body, (loaded || action !== undefined || target !== undefined) && !moving);
    if (target === undefined || moving) return;
    const { pose: next, rate } = advanceExcavatorPose(
      pose,
      target,
      state.excavatorRate ?? 0,
      PHYSICS_DT,
      this.profile,
    );
    if (
      statics?.intersectsShape(
        this.links(next, false),
        collider.translation(),
        collider.rotation(),
      ) ||
      this.forksWouldPressDown(pose, next, world, body, collider)
    ) {
      delete state.excavatorTarget;
      delete state.excavatorRate;
      return;
    }
    state.excavatorPose = next;
    if (next === target) delete state.excavatorTarget;
    if (rate) state.excavatorRate = rate;
    else delete state.excavatorRate;
    body.wakeUp();
    this.reshape(next, collider);
  }

  private forksWouldPressDown(
    pose: number,
    next: number,
    world: RAPIER.World,
    body: RAPIER.RigidBody,
    collider: RAPIER.Collider,
  ) {
    if (this.profile !== "forklift" || next === pose) return false;
    const from = forkliftRig(pose);
    const to = forkliftRig(next);
    if (to.lift >= from.lift && to.tilt >= from.tilt) return false;
    const pivot = collider.translation();
    const rotation = collider.rotation();
    const { mastX, mastZ, deck } = FORKLIFT;
    const dx = (deck.back + deck.tip) / 2 - mastX;
    const dz = deck.bottom + to.lift - mastZ;
    const tiltSin = Math.sin(to.tilt);
    const tiltCos = Math.cos(to.tilt);
    const underside = rotateBodyVector(
      worldRotation(rotation),
      mastX + dx * tiltCos - dz * tiltSin,
      0,
      mastZ + dx * tiltSin + dz * tiltCos - (this.halfY + this.clearance / 2) * SCALE,
    );
    // The object carried above may overlap the probe as it settles. Only
    // bodies with their centre at or beneath the blades oppose lowering.
    const supportHeight = pivot.y + (underside.z + 1) / SCALE;
    return !!world.intersectionWithShape(
      pivot,
      rotation,
      forkliftShapes(next, this.halfY, this.hz, this.clearance, false, true),
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      collider,
      body,
      (candidate) => candidate.translation().y <= supportHeight,
    );
  }

  private stabilize(body: RAPIER.RigidBody, active: boolean) {
    if (active === this.stabilized) return;
    this.stabilized = active;
    body.lockTranslations(active, true);
    body.lockRotations(active, true);
    if (active) {
      body.setLinvel(ZERO, true);
      body.setAngvel(ZERO, true);
    }
  }

  private acceptControl(
    state: PhysicsBodyState,
    pose: number,
    action: ExcavatorAction | undefined,
  ) {
    const held = state.excavatorHeld;
    const target = state.excavatorTarget;
    if (held && held !== action) {
      delete state.excavatorHeld;
      if (target !== undefined) {
        const stop = excavatorBrakeTarget(pose, target, state.excavatorRate ?? 0, this.profile);
        if (stop !== pose) {
          state.excavatorTarget = stop;
          return;
        }
        delete state.excavatorTarget;
        delete state.excavatorRate;
      }
    }
    if (!action) return;
    if (action === held) {
      if (target !== undefined && (action === "swing-left" || action === "swing-right"))
        state.excavatorTarget = excavatorHoldTarget(pose, action);
      return;
    }
    // Finish any braking stroke before powering a different joint.
    if (state.excavatorTarget !== undefined) return;
    state.excavatorHeld = action;
    const goal = excavatorHoldTarget(pose, action);
    if (goal !== pose) state.excavatorTarget = goal;
  }

  publish(entity: Entity, state: PhysicsBodyState, collider: RAPIER.Collider) {
    if (state.excavatorPose !== undefined) {
      const pose = fineExcavatorPose(state.excavatorPose);
      state.excavatorPose = pose;
      this.reshape(pose, collider);
      entity.vehicleExcavator = pose;
    }
    if (state.excavatorTarget === undefined) delete entity.vehicleExcavatorTarget;
    else {
      const target = fineExcavatorPose(state.excavatorTarget);
      state.excavatorTarget = target;
      entity.vehicleExcavatorTarget = target;
    }
    if (state.excavatorRate === undefined) delete entity.vehicleExcavatorRate;
    else entity.vehicleExcavatorRate = state.excavatorRate;
  }

  private reshape(pose: number, collider: RAPIER.Collider) {
    if (pose === this.pose) return;
    collider.setShape(this.links(pose, true));
    this.pose = pose;
  }

  static driveIntent(state: PhysicsBodyState, input: MotionIntent): MotionIntent {
    return state.excavatorTarget === undefined ? input : { ...input, driveSpeed: 0, steering: 0 };
  }
}
