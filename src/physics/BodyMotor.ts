import type RAPIER from "@dimforge/rapier3d-compat";
import { isTrain } from "../railway/Train.js";
import { assistedJumpVelocity } from "./JumpAssist.js";
import { carryingSupportId } from "./PhysicsBodies.js";
import { PHYSICS_DT, PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { MotionIntent } from "./PhysicsState.js";
import { prescribedRailVelocity, railGroup } from "./RailMotion.js";
import type { SceneBody } from "./SceneBody.js";
import { type SupportMotion, supportVelocityAt } from "./SupportMotion.js";
import { vehicleMotor } from "./VehicleMotor.js";

export const AT_REST: RAPIER.Vector = Object.freeze({ x: 0, y: 0, z: 0 });

/** No motion, jump, prescribed pose, drive or network deadline. */
export function isIdle(intent: MotionIntent | undefined) {
  return (
    !intent ||
    (intent.vx === 0 &&
      intent.vy === 0 &&
      !intent.jump &&
      !intent.jumpPressed &&
      intent.altitude === undefined &&
      intent.heading === undefined &&
      intent.driveSpeed === undefined &&
      intent.steering === undefined &&
      intent.controlUntil === undefined)
  );
}

/** Bodies whose motion a rider inherits this step, read before any motor changes. */
export function supportMotions(
  riders: readonly SceneBody[],
  bodies: ReadonlyMap<number, SceneBody>,
  intents: ReadonlyMap<number, MotionIntent>,
  blockedRails: ReadonlySet<unknown>,
  tick: number,
) {
  const supports = new Map<number, SupportMotion>();
  for (const rider of riders) {
    if (rider.state.supportId === undefined) continue;
    if (rider.kind === "loose" || rider.kind === "fixed") continue;
    const id = carryingSupportId(rider.entity, rider.state.supportId, bodies);
    const entry = id === -1 || supports.has(id) ? undefined : bodies.get(id);
    if (!entry) continue;
    supports.set(
      id,
      isTrain(entry.entity)
        ? {
            linear: prescribedRailVelocity(
              entry.state,
              intents.get(id),
              blockedRails.has(railGroup(entry.entity)),
              tick,
            ),
          }
        : {
            linear: entry.body.linvel(),
            ...(entry.chassis ? { chassis: entry.body } : {}),
          },
    );
  }
  return supports;
}

/** Held, buffered and fresh presses: whether this tick asks for a jump. */
function jumpRequested(state: SceneBody["state"], input: MotionIntent) {
  const pressed = input.jumpPressed || (input.jump && !state.jumpHeld);
  state.jumpHeld = input.jump ?? false;
  if (!state.jumpHeld && !input.jumpPressed) delete state.jumpQueued;
  if (pressed && !state.grounded) state.jumpQueued = true;
  return pressed || state.jumpQueued;
}

/** A grounded body takes its support's horizontal velocity; airborne, it keeps it. */
function inheritSupport(state: SceneBody["state"], support: RAPIER.Vector | undefined) {
  if (!state.grounded) return;
  if (support?.x) state.inheritedVx = support.x * SCALE;
  else delete state.inheritedVx;
  if (support?.z) state.inheritedVy = support.z * SCALE;
  else delete state.inheritedVy;
}

/** Set one character or unwheeled vehicle motor from its admitted input. */
export function driveMotor(
  entry: SceneBody,
  input: MotionIntent,
  idle: boolean,
  supports: ReadonlyMap<number, SupportMotion>,
  bodies: ReadonlyMap<number, SceneBody>,
  gravity: number,
) {
  const state = entry.state;
  // A sleeping body has no velocity; only a wake changes that.
  const asleep = entry.body.isSleeping();
  const velocity = asleep ? AT_REST : entry.body.linvel();
  const carrier = supports.get(carryingSupportId(entry.entity, state.supportId, bodies));
  const support =
    carrier && supportVelocityAt(carrier, carrier.chassis ? entry.body.translation() : AT_REST);
  const jump = jumpRequested(state, input);
  const drive =
    entry.kind === "vehicle"
      ? vehicleMotor(
          entry.entity.type,
          state.heading,
          (velocity.x - (support?.x ?? 0)) * SCALE,
          (velocity.z - (support?.z ?? 0)) * SCALE,
          state.grounded,
          input,
        )
      : undefined;
  inheritSupport(state, support);
  const x = ((drive?.vx ?? input.vx) + (state.inheritedVx ?? 0)) / SCALE,
    z = ((drive?.vy ?? input.vy) + (state.inheritedVy ?? 0)) / SCALE;
  // A grounded motor follows the support tangent. Keeping last tick's tiny
  // downward velocity makes a fixed box snag at a ramp/deck junction.
  let vertical = state.grounded
    ? -(state.normalX * x + state.normalZ * z) / Math.max(0.5, state.normalY)
    : velocity.y;
  if (input.altitude !== undefined) {
    // A prescribed landing may meet a loose body or an edited higher floor.
    // Do not keep driving through solved support: the solver would accumulate
    // an upward separation velocity that launches the actor on motor release.
    if (!state.grounded || input.altitude > state.groundZ + 0.15)
      vertical = (input.altitude / SCALE + entry.halfY - entry.body.translation().y) / PHYSICS_DT;
  } else if (jump && state.grounded) {
    delete state.jumpQueued;
    vertical =
      assistedJumpVelocity(entry.entity, state, bodies.values(), gravity) / SCALE +
      (support?.y ?? 0);
    state.grounded = false;
    delete state.supportId;
  }
  // A grounded motor asking for no motion may rest. Its velocity is still
  // cleared while awake, as before, but an unmoved body stops resetting the
  // solver's sleep timer; once asleep it is left alone until something wakes it.
  const still = !drive && state.grounded && x === 0 && z === 0 && vertical === 0;
  entry.still = still;
  if (!still) entry.settling = true;
  if (!(still && asleep)) entry.body.setLinvel({ x, y: vertical, z }, !(still && entry.unmoved));
  // Asleep on static ground with an idle motor: every input to this function is
  // cached state, so it repeats exactly until a readback, edit or intent.
  entry.dormant =
    still && asleep && idle && entry.entity.type !== "player" && state.supportId === undefined;
  if (drive?.yawRate !== undefined) entry.body.setAngvel({ x: 0, y: -drive.yawRate, z: 0 }, true);
}
