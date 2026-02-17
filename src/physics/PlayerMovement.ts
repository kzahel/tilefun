import {
  DEFAULT_PHYSICAL_HEIGHT,
  JUMP_CUT_MULTIPLIER,
  JUMP_GRAVITY,
  JUMP_VELOCITY,
  PLAYER_ACCELERATE,
  PLAYER_AIR_ACCELERATE,
  PLAYER_AIR_WISHCAP,
  PLAYER_FRAME_DURATION,
  PLAYER_FRICTION,
  PLAYER_SPEED,
  PLAYER_SPRINT_MULTIPLIER,
  PLAYER_STOP_SPEED,
  PLAYER_STOP_THRESHOLD,
  STEP_UP_THRESHOLD,
  TICK_RATE,
} from "../config/constants.js";
import { aabbOverlapsSolid, getEntityAABB } from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { Movement } from "../input/ActionManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { MovementContext } from "./MovementContext.js";
import { getSurfaceProperties } from "./SurfaceFriction.js";
import {
  applyGroundTracking,
  type EntitySurface,
  getEffectiveGroundZ,
  getHighestWalkableEntitySurfaceZ,
  getHighestWalkablePropSurfaceZ,
  getSurfaceZ,
  isElevationBlocked3D,
  type PropSurface,
} from "./surfaceHeight.js";

const BLOCK_MASK = CollisionFlag.Solid | CollisionFlag.Water;

export interface MovementPhysicsParams {
  revision: number;
  gravityScale: number;
  friction: number;
  accelerate: number;
  airAccelerate: number;
  airWishCap: number;
  stopSpeed: number;
  noBunnyHop: boolean;
  smallJumps: boolean;
  platformerAir: boolean;
}

// ── CVars (runtime-tunable, same pattern as gravityScale) ──

/** Monotonic revision counter — incremented when any physics CVar changes. */
let physicsCVarRevision = 0;
export function getPhysicsCVarRevision(): number {
  return physicsCVarRevision;
}

const movementPhysicsParams: Omit<MovementPhysicsParams, "revision"> = {
  gravityScale: 1,
  friction: PLAYER_FRICTION,
  accelerate: PLAYER_ACCELERATE,
  airAccelerate: PLAYER_AIR_ACCELERATE,
  airWishCap: PLAYER_AIR_WISHCAP,
  stopSpeed: PLAYER_STOP_SPEED,
  noBunnyHop: false,
  smallJumps: false,
  platformerAir: true,
};

function setPhysicsParam<K extends keyof Omit<MovementPhysicsParams, "revision">>(
  key: K,
  value: Omit<MovementPhysicsParams, "revision">[K],
): void {
  if (movementPhysicsParams[key] === value) return;
  movementPhysicsParams[key] = value;
  physicsCVarRevision++;
}

export function getMovementPhysicsParams(): MovementPhysicsParams {
  return {
    revision: physicsCVarRevision,
    gravityScale: movementPhysicsParams.gravityScale,
    friction: movementPhysicsParams.friction,
    accelerate: movementPhysicsParams.accelerate,
    airAccelerate: movementPhysicsParams.airAccelerate,
    airWishCap: movementPhysicsParams.airWishCap,
    stopSpeed: movementPhysicsParams.stopSpeed,
    noBunnyHop: movementPhysicsParams.noBunnyHop,
    smallJumps: movementPhysicsParams.smallJumps,
    platformerAir: movementPhysicsParams.platformerAir,
  };
}

export function setGravityScale(scale: number): void {
  setPhysicsParam("gravityScale", scale);
}
export function getGravityScale(): number {
  return movementPhysicsParams.gravityScale;
}

export function setFriction(v: number): void {
  setPhysicsParam("friction", v);
}
export function getFriction(): number {
  return movementPhysicsParams.friction;
}

export function setAccelerate(v: number): void {
  setPhysicsParam("accelerate", v);
}
export function getAccelerate(): number {
  return movementPhysicsParams.accelerate;
}

export function setAirAccelerate(v: number): void {
  setPhysicsParam("airAccelerate", v);
}
export function getAirAccelerate(): number {
  return movementPhysicsParams.airAccelerate;
}

export function setAirWishCap(v: number): void {
  setPhysicsParam("airWishCap", v);
}
export function getAirWishCap(): number {
  return movementPhysicsParams.airWishCap;
}

export function setStopSpeed(v: number): void {
  setPhysicsParam("stopSpeed", v);
}
export function getStopSpeed(): number {
  return movementPhysicsParams.stopSpeed;
}

export function setNoBunnyHop(v: boolean): void {
  setPhysicsParam("noBunnyHop", v);
}
export function getNoBunnyHop(): boolean {
  return movementPhysicsParams.noBunnyHop;
}

export function setSmallJumps(v: boolean): void {
  setPhysicsParam("smallJumps", v);
}
export function getSmallJumps(): boolean {
  return movementPhysicsParams.smallJumps;
}

export function setPlatformerAir(v: boolean): void {
  setPhysicsParam("platformerAir", v);
}
export function getPlatformerAir(): boolean {
  return movementPhysicsParams.platformerAir;
}

let timeScaleCVar = 1;
export function setTimeScale(v: number): void {
  if (timeScaleCVar === v) return;
  timeScaleCVar = v;
  physicsCVarRevision++;
}
export function getTimeScale(): number {
  return timeScaleCVar;
}

let tickRateCVar = TICK_RATE;
export function setServerTickRate(v: number): void {
  if (v <= 0) return;
  if (tickRateCVar === v) return;
  tickRateCVar = v;
  physicsCVarRevision++;
}
export function getServerTickRate(): number {
  return tickRateCVar;
}
export function setServerTickMs(ms: number): void {
  if (ms <= 0) return;
  const tickRate = 1000 / ms;
  if (tickRateCVar === tickRate) return;
  tickRateCVar = tickRate;
  physicsCVarRevision++;
}
export function getServerTickMs(): number {
  return 1000 / tickRateCVar;
}

let physicsMultCVar = 1;
export function setServerPhysicsMult(v: number): void {
  const next = Math.max(1, Math.floor(v));
  if (physicsMultCVar === next) return;
  physicsMultCVar = next;
  physicsCVarRevision++;
}
export function getServerPhysicsMult(): number {
  return physicsMultCVar;
}

export interface JumpInputState {
  jumpConsumed: boolean;
  lastJumpHeld: boolean;
}

export interface SurfaceSample {
  props: readonly PropSurface[];
  entities: readonly EntitySurface[];
}

export type SurfaceSampler = (entity: Entity) => SurfaceSample;

/**
 * Apply player input to velocity and jump-button state, but do not move/collide.
 * Shared by client predictor and server input processing.
 */
export function applyPlayerInputIntent(
  entity: Entity,
  input: Movement,
  dt: number,
  ctx: MovementContext,
  state: JumpInputState,
  physics: MovementPhysicsParams,
): JumpInputState {
  applyMovementPhysics(entity, input, dt, ctx, physics);

  let jumpConsumed = state.jumpConsumed;
  if (input.jump) {
    if (entity.jumpVZ === undefined && !jumpConsumed) {
      initiateJump(entity, physics);
      jumpConsumed = true;
    }
  } else if (jumpConsumed) {
    cutJumpVelocity(entity, physics);
    jumpConsumed = false;
  }

  return {
    jumpConsumed,
    lastJumpHeld: input.jump,
  };
}

/**
 * Apply one player input step including movement/collision/ground/jump.
 * Uses substeps for movement integration when physics tick is higher than command tick.
 */
export function stepPlayerFromInput(
  entity: Entity,
  input: Movement,
  dt: number,
  ctx: MovementContext,
  getHeight: (tx: number, ty: number) => number,
  sampleSurfaces: SurfaceSampler,
  state: JumpInputState,
  physics: MovementPhysicsParams,
  substeps = 1,
): JumpInputState {
  let next = applyPlayerInputIntent(entity, input, dt, ctx, state, physics);
  const steps = Math.max(1, Math.floor(substeps));
  const stepDt = dt / steps;

  for (let i = 0; i < steps; i++) {
    moveAndCollide(entity, stepDt, ctx);
    const surfaces = sampleSurfaces(entity);
    const groundZ = getEffectiveGroundZ(entity, getHeight, surfaces.props, surfaces.entities);
    applyGroundTracking(entity, groundZ, true);
    const landed = tickJumpGravity(
      entity,
      stepDt,
      getHeight,
      physics,
      surfaces.props,
      surfaces.entities,
    );
    if (landed && next.lastJumpHeld && !next.jumpConsumed) {
      initiateJump(entity, physics);
      next = { ...next, jumpConsumed: true };
    }
  }

  return next;
}

/**
 * Apply one mount input step including movement/collision/ground tracking.
 */
export function stepMountFromInput(
  mount: Entity,
  input: Movement,
  dt: number,
  ctx: MovementContext,
  getHeight: (tx: number, ty: number) => number,
  sampleSurfaces: SurfaceSampler,
  rider?: Entity,
  substeps = 1,
): void {
  applyMountInput(mount, input, rider);
  const steps = Math.max(1, Math.floor(substeps));
  const stepDt = dt / steps;
  for (let i = 0; i < steps; i++) {
    moveAndCollide(mount, stepDt, ctx);
    const surfaces = sampleSurfaces(mount);
    const groundZ = getEffectiveGroundZ(mount, getHeight, surfaces.props, surfaces.entities);
    applyGroundTracking(mount, groundZ, false);
  }
}

/**
 * Apply movement input to a mount entity (uses rideSpeed, updates sprite).
 * Shared between server (Realm) and client (PlayerPredictor).
 */
export function applyMountInput(
  mount: Entity,
  input: { dx: number; dy: number; sprinting: boolean },
  rider?: Entity,
): void {
  if (!mount.velocity) return;
  const baseSpeed = mount.wanderAI?.rideSpeed ?? PLAYER_SPEED;
  const speed = input.sprinting ? baseSpeed * PLAYER_SPRINT_MULTIPLIER : baseSpeed;
  mount.velocity.vx = input.dx * speed;
  mount.velocity.vy = input.dy * speed;

  const moving = input.dx !== 0 || input.dy !== 0;
  if (mount.sprite) {
    mount.sprite.moving = moving;
    if (moving) {
      if (mount.wanderAI?.directional === false) {
        // Non-directional sprites (e.g., cow): only flip horizontally, keep frameRow=0
        if (input.dx !== 0) {
          mount.sprite.flipX = input.dx < 0;
        }
      } else {
        if (Math.abs(input.dx) >= Math.abs(input.dy)) {
          mount.sprite.direction = input.dx > 0 ? Direction.Right : Direction.Left;
        } else {
          mount.sprite.direction = input.dy > 0 ? Direction.Down : Direction.Up;
        }
        mount.sprite.frameRow = mount.sprite.direction;
      }
    }
  }

  // Sync rider direction to match mount facing
  if (rider?.sprite && mount.sprite) {
    rider.sprite.direction =
      mount.wanderAI?.directional === false
        ? mount.sprite.flipX
          ? Direction.Left
          : Direction.Right
        : mount.sprite.direction;
    rider.sprite.frameRow = rider.sprite.direction;
  }
}

/** Initiate a jump if the entity is on the ground (no vertical velocity). */
export function initiateJump(entity: Entity, physics: MovementPhysicsParams): void {
  if (entity.jumpVZ === undefined) {
    // sv_nobunnyhop: clamp XY speed to max wishspeed on takeoff
    if (physics.noBunnyHop && entity.velocity) {
      const maxWish = PLAYER_SPEED * PLAYER_SPRINT_MULTIPLIER;
      const speed = Math.sqrt(
        entity.velocity.vx * entity.velocity.vx + entity.velocity.vy * entity.velocity.vy,
      );
      if (speed > maxWish) {
        const scale = maxWish / speed;
        entity.velocity.vx *= scale;
        entity.velocity.vy *= scale;
      }
    }
    const wz = entity.wz ?? 0;
    entity.wz = wz + 0.01;
    entity.jumpVZ = JUMP_VELOCITY;
    entity.jumpZ = 0.01;
  }
}

/** Cut jump velocity when the jump button is released while ascending (variable jump height). */
export function cutJumpVelocity(entity: Entity, physics: MovementPhysicsParams): void {
  if (!physics.smallJumps) return;
  if (entity.jumpVZ !== undefined && entity.jumpVZ > 0) {
    entity.jumpVZ *= JUMP_CUT_MULTIPLIER;
  }
}

/**
 * Tick jump/fall gravity for an entity using absolute Z. Returns true if the
 * entity just landed. Updates wz, groundZ, and the legacy jumpZ for rendering.
 */
export function tickJumpGravity(
  entity: Entity,
  dt: number,
  getHeight: (tx: number, ty: number) => number,
  physics: MovementPhysicsParams,
  props?: readonly PropSurface[],
  entities?: readonly EntitySurface[],
): boolean {
  if (entity.jumpVZ !== undefined && entity.wz !== undefined) {
    const prevWz = entity.wz;
    entity.jumpVZ -= JUMP_GRAVITY * physics.gravityScale * dt;
    entity.wz += entity.jumpVZ * dt;
    // Terrain landing uses center point — not AABB max — so the player
    // actually lands at the lower elevation after walking off a cliff.
    // (Ground *tracking* uses AABB max to prevent premature falls along edges.)
    let groundZ = getSurfaceZ(entity.position.wx, entity.position.wy, getHeight);
    // Check walkable prop/entity surfaces for landing (no height filter — land on
    // any surface we descend through, unlike step-up which uses threshold)
    if (entity.collider) {
      const footprint = getEntityAABB(entity.position, entity.collider);
      if (props) {
        const propZ = getHighestWalkablePropSurfaceZ(footprint, props);
        if (propZ !== undefined && propZ > groundZ) groundZ = propZ;
      }
      if (entities) {
        const entZ = getHighestWalkableEntitySurfaceZ(
          footprint,
          entity.id,
          entity.wz,
          entities,
          prevWz,
        );
        if (entZ !== undefined && entZ > groundZ) groundZ = entZ;
      }
    }
    entity.groundZ = groundZ;
    if (entity.wz <= groundZ) {
      entity.wz = groundZ;
      delete entity.jumpVZ;
      delete entity.jumpZ;
      return true;
    }
    entity.jumpZ = entity.wz - groundZ;
    return false;
  }
  return false;
}

// ── QuakeWorld-style friction & acceleration (adapted for 2D) ──

/**
 * Apply ground friction to an entity's XY velocity.
 * QW PM_Friction adapted for 2D top-down. Callers should skip this while
 * airborne so jumping preserves momentum over slow terrain (water, sand).
 * @param surfaceFriction Multiplier from terrain/road surface properties.
 */
export function applyFriction(
  entity: Entity,
  dt: number,
  surfaceFriction: number,
  physics: MovementPhysicsParams,
): void {
  if (!entity.velocity) return;
  const { vx, vy } = entity.velocity;
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed < PLAYER_STOP_THRESHOLD) {
    entity.velocity.vx = 0;
    entity.velocity.vy = 0;
    return;
  }

  const friction = physics.friction * surfaceFriction;
  const control = Math.max(speed, physics.stopSpeed);
  const drop = control * friction * dt;
  let newspeed = speed - drop;
  if (newspeed < 0) newspeed = 0;
  const scale = newspeed / speed;
  entity.velocity.vx = vx * scale;
  entity.velocity.vy = vy * scale;
}

/**
 * Ground acceleration toward wish direction, capped at wish speed.
 * QW PM_Accelerate adapted for 2D.
 */
export function applyAcceleration(
  entity: Entity,
  wishdirX: number,
  wishdirY: number,
  wishspeed: number,
  accel: number,
  dt: number,
): void {
  if (!entity.velocity || wishspeed <= 0) return;
  const currentspeed = entity.velocity.vx * wishdirX + entity.velocity.vy * wishdirY;
  const addspeed = wishspeed - currentspeed;
  if (addspeed <= 0) return;
  let accelspeed = accel * dt * wishspeed;
  if (accelspeed > addspeed) accelspeed = addspeed;
  entity.velocity.vx += accelspeed * wishdirX;
  entity.velocity.vy += accelspeed * wishdirY;
}

/**
 * Air acceleration with wishspeed cap — QW PM_AirAccelerate adapted for 2D.
 * The cap limits per-frame speed gain from strafing: addspeed uses the capped
 * wishspeed, but accelspeed uses the full wishspeed (matching QW behavior).
 */
export function applyAirAcceleration(
  entity: Entity,
  wishdirX: number,
  wishdirY: number,
  wishspeed: number,
  accel: number,
  dt: number,
  physics: MovementPhysicsParams,
): void {
  if (!entity.velocity || wishspeed <= 0) return;
  const cappedWish = Math.min(wishspeed, physics.airWishCap);
  const currentspeed = entity.velocity.vx * wishdirX + entity.velocity.vy * wishdirY;
  const addspeed = cappedWish - currentspeed;
  if (addspeed <= 0) return;
  let accelspeed = accel * dt * wishspeed;
  if (accelspeed > addspeed) accelspeed = addspeed;
  entity.velocity.vx += accelspeed * wishdirX;
  entity.velocity.vy += accelspeed * wishdirY;
}

/**
 * Apply friction + acceleration from player input. Replaces the old
 * `updatePlayerFromInput` for non-mounted movement.
 *
 * - Computes wish direction and wish speed from input
 * - Looks up surface properties for friction/speed multiplier
 * - Applies QW-style friction then acceleration
 * - Updates sprite direction and animation from input
 */
export function applyMovementPhysics(
  entity: Entity,
  input: Movement,
  dt: number,
  ctx: MovementContext,
  physics: MovementPhysicsParams,
): void {
  if (!entity.velocity) return;

  const airborne = entity.jumpVZ !== undefined;

  // Surface properties for friction and speed (ignored while airborne)
  const defaultTerrain = (_tx: number, _ty: number) => 4; // Grass
  const defaultRoad = (_tx: number, _ty: number) => 0; // None
  const surface = airborne
    ? { friction: 1.0, speedMult: 1.0 }
    : getSurfaceProperties(
        entity.position.wx,
        entity.position.wy,
        ctx.getTerrainAt ?? defaultTerrain,
        ctx.getRoadAt ?? defaultRoad,
        ctx.getCollision,
      );

  // 1. Friction first (QW order) — skip while airborne unless platformer air control
  if (!airborne || physics.platformerAir) {
    applyFriction(entity, dt, surface.friction, physics);
  }

  // 2. Compute wish direction and wish speed
  const { dx, dy } = input;
  const moving = dx !== 0 || dy !== 0;
  if (moving) {
    const len = Math.sqrt(dx * dx + dy * dy);
    const wishdirX = dx / len;
    const wishdirY = dy / len;
    const baseSpeed = input.sprinting ? PLAYER_SPEED * PLAYER_SPRINT_MULTIPLIER : PLAYER_SPEED;
    const wishspeed = baseSpeed * surface.speedMult;
    if (airborne && !physics.platformerAir) {
      applyAirAcceleration(
        entity,
        wishdirX,
        wishdirY,
        wishspeed,
        physics.airAccelerate,
        dt,
        physics,
      );
    } else {
      applyAcceleration(entity, wishdirX, wishdirY, wishspeed, physics.accelerate, dt);
    }
  }

  // 3. Update sprite from input (not velocity — prevents animation during passive slide)
  if (entity.sprite) {
    entity.sprite.moving = moving;
    entity.sprite.frameDuration = input.sprinting
      ? PLAYER_FRAME_DURATION / PLAYER_SPRINT_MULTIPLIER
      : PLAYER_FRAME_DURATION;
    if (moving) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        entity.sprite.direction = dx > 0 ? Direction.Right : Direction.Left;
      } else {
        entity.sprite.direction = dy > 0 ? Direction.Down : Direction.Up;
      }
      entity.sprite.frameRow = entity.sprite.direction;
    }
  }
}

/**
 * Move an entity using its current velocity with per-axis sliding collision.
 *
 * Handles noclip (skip collision) and no-collider (free movement) cases.
 * Does NOT apply speed multipliers — velocity is assumed to already
 * reflect surface properties via the friction/acceleration model.
 */
export function moveAndCollide(entity: Entity, dt: number, ctx: MovementContext): void {
  if (!entity.velocity) return;

  // Noclip or no collider: free movement without speed penalty
  if (ctx.noclip || !entity.collider) {
    entity.position.wx += entity.velocity.vx * dt;
    entity.position.wy += entity.velocity.vy * dt;
    return;
  }

  const dx = entity.velocity.vx * dt;
  const dy = entity.velocity.vy * dt;

  const entityWz = entity.wz ?? 0;
  const entityHeight = entity.collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
  // Airborne entities can't step up — they must be above the surface to pass
  const airborne = entity.jumpVZ !== undefined;
  const elevStepUp = airborne ? 0 : STEP_UP_THRESHOLD;

  const isBlocked = (
    aabb: { left: number; top: number; right: number; bottom: number },
    testPos: { wx: number; wy: number },
  ): boolean => {
    const mask = airborne ? CollisionFlag.Solid : BLOCK_MASK;
    if (aabbOverlapsSolid(aabb, ctx.getCollision, mask)) return true;
    if (ctx.isPropBlocked(aabb, entityWz, entityHeight)) return true;
    if (isElevationBlocked3D(aabb, entityWz, ctx.getHeight, elevStepUp)) return true;
    // Also check feet position — may be outside AABB due to collider offset.
    // Without this, walking south lets feet cross onto elevated tiles before
    // the AABB does, and ground tracking snaps wz up incorrectly.
    const feetSurfaceZ = getSurfaceZ(testPos.wx, testPos.wy, ctx.getHeight);
    if (feetSurfaceZ > entityWz + elevStepUp) return true;
    if (ctx.isEntityBlocked(aabb)) return true;
    return false;
  };

  // Per-axis sliding: try X, then Y with updated X
  const testX = { wx: entity.position.wx + dx, wy: entity.position.wy };
  const xBox = getEntityAABB(testX, entity.collider);
  if (!isBlocked(xBox, testX)) {
    entity.position.wx = testX.wx;
  }

  const testY = { wx: entity.position.wx, wy: entity.position.wy + dy };
  const yBox = getEntityAABB(testY, entity.collider);
  if (!isBlocked(yBox, testY)) {
    entity.position.wy = testY.wy;
  }
}
