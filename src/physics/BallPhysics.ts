import {
  BALL_DESPAWN_TIME,
  BALL_GRAVITY,
  BOUNCE_FRICTION,
  BOUNCE_RESTITUTION,
  BOUNCE_STOP_VZ,
  CHUNK_SIZE_PX,
  DEFAULT_PHYSICAL_HEIGHT,
  TILE_SIZE,
} from "../config/constants.js";
import { aabbOverlapsSolid, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { hasVehicleBed, vehicleBedMovementBlocks } from "../traffic/VehicleBed.js";
import { slideOnVehicleBed } from "../traffic/VehicleBedSlide.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { zRangesOverlap } from "./AABB3D.js";
import { applyBallImpact } from "./BallGameplay.js";
import {
  getSurfaceZ,
  resolveGroundZForLanding,
  resolveGroundZForTracking,
} from "./surfaceHeight.js";

export { applyBallImpact } from "./BallGameplay.js";

const WALL_MASK = CollisionFlag.Solid;

/**
 * Tick physics for all ball (projectile) entities.
 * Handles XY movement with wall bouncing, gravity, ground bouncing,
 * and entity collision with push impulses.
 */
export function tickBallPhysics(
  entityManager: EntityManager,
  dt: number,
  getCollision: (tx: number, ty: number) => number,
  getHeight: (tx: number, ty: number) => number,
  active: readonly Entity[] = entityManager.entities,
  resolveBall?: (ball: Entity, dt: number) => boolean,
): void {
  const toRemove: number[] = [];
  const beds = entityManager.entities.filter(hasVehicleBed);

  for (const ball of active) {
    if (ball.type !== "ball") continue;
    if (ball.parentId !== undefined) continue;
    if (!ball.velocity) continue;

    // Save prev position for render interpolation
    ball.prevPosition = { wx: ball.position.wx, wy: ball.position.wy };
    if (ball.wz !== undefined) ball.prevWz = ball.wz;
    if (ball.jumpZ !== undefined) ball.prevJumpZ = ball.jumpZ;

    if (resolveBall) {
      if (resolveBall(ball, dt)) toRemove.push(ball.id);
      entityManager.spatialHash.update(ball);
      continue;
    }

    slideOnVehicleBed(ball, dt, beds);

    // ── XY movement with wall bouncing ──
    const dx = ball.velocity.vx * dt;
    const dy = ball.velocity.vy * dt;
    const bedBlocked = (box: ReturnType<typeof getEntityAABB>) =>
      beds.some((e) => vehicleBedMovementBlocks(e, box, ball));

    if (ball.collider) {
      // Try X
      const testX = { wx: ball.position.wx + dx, wy: ball.position.wy };
      const xBox = getEntityAABB(testX, ball.collider);
      if (aabbOverlapsSolid(xBox, getCollision, WALL_MASK) || bedBlocked(xBox)) {
        ball.velocity.vx = -ball.velocity.vx * BOUNCE_RESTITUTION;
      } else {
        ball.position.wx = testX.wx;
      }

      // Try Y
      const testY = { wx: ball.position.wx, wy: ball.position.wy + dy };
      const yBox = getEntityAABB(testY, ball.collider);
      if (aabbOverlapsSolid(yBox, getCollision, WALL_MASK) || bedBlocked(yBox)) {
        ball.velocity.vy = -ball.velocity.vy * BOUNCE_RESTITUTION;
      } else {
        ball.position.wy = testY.wy;
      }
    } else {
      ball.position.wx += dx;
      ball.position.wy += dy;
    }

    // ── Water check: remove ball if it lands on water ──
    const ballTx = Math.floor(ball.position.wx / TILE_SIZE);
    const ballTy = Math.floor(ball.position.wy / TILE_SIZE);
    const tileFlags = getCollision(ballTx, ballTy);
    if (tileFlags & CollisionFlag.Water) {
      // Only despawn if ball is at or near ground level (not flying over)
      const groundZ = getSurfaceZ(ball.position.wx, ball.position.wy, getHeight);
      const ballZ = ball.wz ?? 0;
      // Player toys remain on the water surface until their owner retires them.
      if (ballZ - groundZ < 4 && !ball.workItem?.owner) {
        toRemove.push(ball.id);
        continue;
      }
    }

    // ── Gravity + vertical bounce ──
    if (ball.jumpVZ !== undefined && ball.wz !== undefined) {
      const previousZ = ball.wz;
      ball.jumpVZ -= BALL_GRAVITY * dt;
      ball.wz += ball.jumpVZ * dt;

      const groundZ = resolveGroundZForLanding(ball, getHeight, [], beds, previousZ);
      ball.groundZ = groundZ;

      if (ball.wz <= groundZ) {
        const impactSpeed = Math.abs(ball.jumpVZ);
        if (impactSpeed < BOUNCE_STOP_VZ) {
          // Ball stops bouncing
          ball.wz = groundZ;
          Reflect.set(ball, "jumpVZ", undefined);
          Reflect.set(ball, "jumpZ", undefined);
          // Friction: decelerate horizontal velocity
          ball.velocity.vx *= 0.9;
          ball.velocity.vy *= 0.9;
          // Mark for despawn if nearly stopped
          const hSpeed = Math.sqrt(
            ball.velocity.vx * ball.velocity.vx + ball.velocity.vy * ball.velocity.vy,
          );
          if (hSpeed < 5) {
            ball.velocity.vx = 0;
            ball.velocity.vy = 0;
            if (!ball.workItem?.owner && !roofSupport(ball, beds))
              ball.deathTimer = BALL_DESPAWN_TIME;
          }
        } else {
          // Bounce
          ball.wz = groundZ + 0.01;
          ball.jumpVZ = impactSpeed * BOUNCE_RESTITUTION;
          ball.jumpZ = 0.01;
          ball.velocity.vx *= BOUNCE_FRICTION;
          ball.velocity.vy *= BOUNCE_FRICTION;
        }
      } else {
        ball.jumpZ = ball.wz - groundZ;
      }
    } else {
      // Ball is on the ground — snap to terrain height and apply rolling friction
      const groundZ = resolveGroundZForTracking(ball, getHeight, [], beds);
      const onBed = groundZ > getSurfaceZ(ball.position.wx, ball.position.wy, getHeight) + 0.1;
      ball.groundZ = groundZ;
      if ((ball.wz ?? 0) > groundZ + 0.1) {
        ball.jumpVZ = 0;
        ball.jumpZ = (ball.wz ?? 0) - groundZ;
      } else {
        ball.wz = groundZ;
        Reflect.set(ball, "jumpZ", undefined);
      }
      ball.velocity.vx *= 1 - 3 * dt;
      ball.velocity.vy *= 1 - 3 * dt;
      const hSpeed = Math.sqrt(
        ball.velocity.vx * ball.velocity.vx + ball.velocity.vy * ball.velocity.vy,
      );
      if (hSpeed < 3 && ball.deathTimer === undefined) {
        ball.velocity.vx = 0;
        ball.velocity.vy = 0;
        if (!ball.workItem?.owner && !onBed) ball.deathTimer = BALL_DESPAWN_TIME;
      }
    }
    if (roofSupport(ball, beds)) delete ball.deathTimer;

    // ── Entity collision: bounce off and push entities ──
    if (ball.collider) {
      const ballBox = getEntityAABB(ball.position, ball.collider);
      const ballWz = ball.wz ?? 0;
      const ballH = ball.collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;

      const minCx = Math.floor(ballBox.left / CHUNK_SIZE_PX);
      const maxCx = Math.floor(ballBox.right / CHUNK_SIZE_PX);
      const minCy = Math.floor(ballBox.top / CHUNK_SIZE_PX);
      const maxCy = Math.floor(ballBox.bottom / CHUNK_SIZE_PX);
      const nearby = entityManager.spatialHash.queryRange(minCx, minCy, maxCx, maxCy);
      if (ball.ballThrowerId !== undefined) {
        const thrower = entityManager.byId.get(ball.ballThrowerId);
        if (
          !thrower?.collider ||
          !aabbsOverlap(ballBox, getEntityAABB(thrower.position, thrower.collider)) ||
          !zRangesOverlap(
            ballWz,
            ballH,
            thrower.wz ?? 0,
            thrower.collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT,
          )
        )
          delete ball.ballThrowerId;
      }

      for (const other of nearby) {
        // Hollow tub contacts were resolved per axis; never bounce off its broad body.
        if (hasVehicleBed(other)) continue;
        // A fetching dog deliberately reaches for its settled target. A moving
        // projectile still uses the ordinary hit/startle response.
        if (
          (other.animalWork?.kind === "dog" || other.animalWork?.kind === "cat") &&
          other.animalWork.targetId === ball.persistentId &&
          (other.animalWork?.kind === "cat" || ball.jumpVZ === undefined) &&
          Math.hypot(ball.velocity.vx, ball.velocity.vy) <
            (other.animalWork?.kind === "cat" ? 80 : 8)
        )
          continue;
        if (
          other === ball ||
          other.type === "ball" ||
          other.id === ball.ballThrowerId ||
          !other.collider
        )
          continue;
        // Z-range overlap check
        const otherWz = other.wz ?? 0;
        const otherH = other.collider.physicalHeight ?? DEFAULT_PHYSICAL_HEIGHT;
        if (!zRangesOverlap(ballWz, ballH, otherWz, otherH)) continue;

        const otherBox = getEntityAABB(other.position, other.collider);
        if (!aabbsOverlap(ballBox, otherBox)) continue;

        // Hit! Push the entity
        const hitDx = other.position.wx - ball.position.wx;
        const hitDy = other.position.wy - ball.position.wy;
        const hitDist = Math.sqrt(hitDx * hitDx + hitDy * hitDy) || 1;
        const hitNx = hitDx / hitDist;
        const hitNy = hitDy / hitDist;

        applyBallImpact(entityManager, other, ball, hitNx, hitNy);

        // Bounce the ball away from entity
        ball.velocity.vx = -hitNx * Math.abs(ball.velocity.vx) * BOUNCE_RESTITUTION;
        ball.velocity.vy = -hitNy * Math.abs(ball.velocity.vy) * BOUNCE_RESTITUTION;

        // Separate ball from entity
        const overlapX =
          ball.position.wx < other.position.wx
            ? otherBox.left - ballBox.right
            : otherBox.right - ballBox.left;
        const overlapY =
          ball.position.wy < other.position.wy
            ? otherBox.top - ballBox.bottom
            : otherBox.bottom - ballBox.top;
        if (Math.abs(overlapX) < Math.abs(overlapY)) {
          ball.position.wx += overlapX;
        } else {
          ball.position.wy += overlapY;
        }

        break; // One collision per tick is enough
      }
    }

    // ── Remove balls that fell off the world ──
    if (ball.wz !== undefined && ball.wz < -100) {
      toRemove.push(ball.id);
    }
  }

  for (const id of toRemove) {
    entityManager.remove(id);
  }
}
