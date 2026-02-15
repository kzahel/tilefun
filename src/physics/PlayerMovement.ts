import {
  JUMP_GRAVITY,
  JUMP_VELOCITY,
  PLAYER_SPEED,
  PLAYER_SPRINT_MULTIPLIER,
} from "../config/constants.js";
import {
  aabbOverlapsSolid,
  getEntityAABB,
  getEntityElevation,
  getSpeedMultiplier,
  isElevationBlocked,
} from "../entities/collision.js";
import { Direction, type Entity } from "../entities/Entity.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { MovementContext } from "./MovementContext.js";

const BLOCK_MASK = CollisionFlag.Solid | CollisionFlag.Water;

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

/** Initiate a jump if the entity is on the ground. */
export function initiateJump(entity: Entity): void {
  if (!(entity.jumpZ ?? 0)) {
    entity.jumpZ = 0.01;
    entity.jumpVZ = JUMP_VELOCITY;
  }
}

/**
 * Tick jump gravity for an entity. Returns true if the entity just landed.
 */
export function tickJumpGravity(entity: Entity, dt: number): boolean {
  if (entity.jumpZ !== undefined && entity.jumpZ > 0 && entity.jumpVZ !== undefined) {
    entity.jumpVZ -= JUMP_GRAVITY * dt;
    entity.jumpZ += entity.jumpVZ * dt;
    if (entity.jumpZ <= 0) {
      delete entity.jumpZ;
      delete entity.jumpVZ;
      return true;
    }
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

  const currentElev = getEntityElevation(entity, ctx.getHeight);
  const jumpZ = entity.jumpZ ?? 0;

  const isBlocked = (aabb: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }): boolean => {
    if (aabbOverlapsSolid(aabb, ctx.getCollision, BLOCK_MASK)) return true;
    if (ctx.isPropBlocked(aabb)) return true;
    if (isElevationBlocked(aabb, currentElev, jumpZ, ctx.getHeight)) return true;
    if (ctx.isEntityBlocked(aabb)) return true;
    return false;
  };

  // Per-axis sliding: try X, then Y with updated X
  const testX = { wx: entity.position.wx + dx, wy: entity.position.wy };
  const xBox = getEntityAABB(testX, entity.collider);
  if (!isBlocked(xBox)) {
    entity.position.wx = testX.wx;
  }

  const testY = { wx: entity.position.wx, wy: entity.position.wy + dy };
  const yBox = getEntityAABB(testY, entity.collider);
  if (!isBlocked(yBox)) {
    entity.position.wy = testY.wy;
  }
}
