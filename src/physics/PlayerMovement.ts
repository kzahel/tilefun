import {
  DEFAULT_PHYSICAL_HEIGHT,
  JUMP_CUT_MULTIPLIER,
  JUMP_GRAVITY,
  JUMP_VELOCITY,
  PLAYER_SPEED,
  PLAYER_SPRINT_MULTIPLIER,
  STEP_UP_THRESHOLD,
} from "../config/constants.js";
import { aabbOverlapsSolid, getEntityAABB, getSpeedMultiplier } from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { MovementContext } from "./MovementContext.js";
import {
  type EntitySurface,
  getHighestWalkableEntitySurfaceZ,
  getHighestWalkablePropSurfaceZ,
  getSurfaceZ,
  isElevationBlocked3D,
  type PropSurface,
} from "./surfaceHeight.js";

const BLOCK_MASK = CollisionFlag.Solid | CollisionFlag.Water;

// ── Gravity scale (set via sv_gravity CVar) ──
let gravityScale = 1;
export function setGravityScale(scale: number): void {
  gravityScale = scale;
}
export function getGravityScale(): number {
  return gravityScale;
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
export function initiateJump(entity: Entity): void {
  if (entity.jumpVZ === undefined) {
    const wz = entity.wz ?? 0;
    entity.wz = wz + 0.01;
    entity.jumpVZ = JUMP_VELOCITY;
    entity.jumpZ = 0.01;
  }
}

/** Cut jump velocity when the jump button is released while ascending (variable jump height). */
export function cutJumpVelocity(entity: Entity): void {
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
  props?: readonly PropSurface[],
  entities?: readonly EntitySurface[],
): boolean {
  if (entity.jumpVZ !== undefined && entity.wz !== undefined) {
    const prevWz = entity.wz;
    entity.jumpVZ -= JUMP_GRAVITY * gravityScale * dt;
    entity.wz += entity.jumpVZ * dt;
    let groundZ = getSurfaceZ(entity.position.wx, entity.position.wy, getHeight);
    // Check walkable prop surfaces for landing (no height filter — land on
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

/**
 * Move an entity using its current velocity, applying terrain speed multiplier
 * and per-axis sliding collision via the provided MovementContext.
 *
 * Handles noclip (skip collision) and no-collider (free movement) cases.
 */
export function moveAndCollide(entity: Entity, dt: number, ctx: MovementContext): void {
  if (!entity.velocity) return;

  // Noclip or no collider: free movement without speed penalty
  if (ctx.noclip || !entity.collider) {
    entity.position.wx += entity.velocity.vx * dt;
    entity.position.wy += entity.velocity.vy * dt;
    return;
  }

  const speedMult = getSpeedMultiplier(entity.position, ctx.getCollision);
  const dx = entity.velocity.vx * dt * speedMult;
  const dy = entity.velocity.vy * dt * speedMult;

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
