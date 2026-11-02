import {
  BALL_DESPAWN_TIME,
  BALL_GRAVITY,
  BOUNCE_FRICTION,
  BOUNCE_RESTITUTION,
  BOUNCE_STOP_VZ,
  JUMP_GRAVITY,
  TILE_SIZE,
} from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { applyBallImpact } from "./BallPhysics.js";
import type { MovementContext } from "./MovementContext.js";
import type { MovementPhysicsParams } from "./PlayerMovement.js";

/** Ordinary ball intent/bounce policy, with collision and support owned exclusively
 * by the realm's Rapier motor. Returns true when ordinary lifetime rules retire it.
 */
export function controlledBallMotion(
  ball: Entity,
  dt: number,
  context: MovementContext,
  physics: MovementPhysicsParams,
  entities: EntityManager,
): boolean {
  const velocity = ball.velocity;
  if (!velocity || !context.moveCharacter) return false;
  const original = { ...velocity },
    impact = (ball.jumpVZ ?? 0) - BALL_GRAVITY * dt;
  const result = context.moveCharacter(ball, dt, {
    ...physics,
    gravityScale: BALL_GRAVITY / JUMP_GRAVITY,
    walkSpeed: Math.max(1, Math.hypot(velocity.vx, velocity.vy)),
  });
  for (const normal of result.collisionNormals ?? []) {
    if (Math.abs(normal.y) >= 0.5) continue;
    const closing = original.vx * normal.x + original.vy * normal.z;
    if (closing < 0) {
      velocity.vx = original.vx - (1 + BOUNCE_RESTITUTION) * closing * normal.x;
      velocity.vy = original.vy - (1 + BOUNCE_RESTITUTION) * closing * normal.z;
    }
  }
  if (result.landed && Math.abs(impact) >= BOUNCE_STOP_VZ) {
    ball.jumpVZ = Math.abs(impact) * BOUNCE_RESTITUTION;
    velocity.vx *= BOUNCE_FRICTION;
    velocity.vy *= BOUNCE_FRICTION;
  } else if (ball.jumpVZ === undefined) {
    velocity.vx *= Math.max(0, 1 - 3 * dt);
    velocity.vy *= Math.max(0, 1 - 3 * dt);
    if (Math.hypot(velocity.vx, velocity.vy) < 3) {
      velocity.vx = velocity.vy = 0;
      if (!ball.workItem?.owner) ball.deathTimer ??= BALL_DESPAWN_TIME;
    }
  }
  if (result.contactEntityId !== undefined && Math.hypot(original.vx, original.vy) > 5) {
    const other = entities.byId.get(result.contactEntityId);
    if (other) {
      const dx = other.position.wx - ball.position.wx,
        dy = other.position.wy - ball.position.wy,
        distance = Math.hypot(dx, dy) || 1;
      applyBallImpact(entities, other, ball, dx / distance, dy / distance);
    }
  }
  if ((ball.wz ?? 0) < -100) return true;
  return (
    !ball.workItem?.owner &&
    (ball.jumpZ ?? 0) < 4 &&
    !!(
      context.getCollision(
        Math.floor(ball.position.wx / TILE_SIZE),
        Math.floor(ball.position.wy / TILE_SIZE),
      ) & CollisionFlag.Water
    )
  );
}
