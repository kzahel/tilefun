import { BALL_DESPAWN_TIME, BALL_SCARE_DURATION, TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { createGem } from "../entities/Gem.js";
import { hasDumpBed } from "../traffic/DumpBed.js";
import { startleWildlife } from "../wildlife/WildlifeSpecies.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { PhysicsScene } from "./PhysicsScene.js";

/** Contact consequences/lifetime only. Rapier resolves all ball travel and bounce. */
export function tickSharedBallGameplay(
  manager: EntityManager,
  active: readonly Entity[],
  scene: PhysicsScene,
  getCollision: (x: number, y: number) => number,
) {
  for (const ball of active) {
    if (ball.type !== "ball" || ball.parentId !== undefined) continue;
    const state = scene.bodyState(ball.id);
    if (!state) continue;
    if (
      state.z < -100 ||
      (state.grounded &&
        !ball.workItem?.owner &&
        getCollision(Math.floor(state.x / TILE_SIZE), Math.floor(state.y / TILE_SIZE)) &
          CollisionFlag.Water)
    ) {
      manager.remove(ball.id);
      continue;
    }
    if (
      !keepBedCargo(manager, ball, state.supportId) &&
      !ball.workItem?.owner &&
      state.grounded &&
      Math.hypot(state.vx, state.vy) < 3
    )
      ball.deathTimer ??= BALL_DESPAWN_TIME;
    if (scene.incomingSpeed(ball.id) < 8) continue;
    for (const id of scene.contactIds(ball.id) ?? []) {
      if (id === ball.ballThrowerId || scene.incomingContactSpeed(ball.id, id) < 8) continue;
      const other = manager.byId.get(id);
      if (!other || other.type === "ball") continue;
      const dx = other.position.wx - ball.position.wx,
        dy = other.position.wy - ball.position.wy;
      const distance = Math.hypot(dx, dy) || 1;
      applyBallImpact(manager, other, ball, dx / distance, dy / distance);
    }
  }
}

/** Cargo resting in a dump bed is kept; ordinary cleanup resumes once discharged. */
function keepBedCargo(manager: EntityManager, ball: Entity, supportId: number | undefined) {
  const support = supportId === undefined ? undefined : manager.byId.get(supportId);
  if (!support || !hasDumpBed(support)) return false;
  delete ball.deathTimer;
  return true;
}

/** Gameplay hit reactions after shared physics contacts; no position resolution. */
export function applyBallImpact(
  entityManager: EntityManager,
  other: Entity,
  ball: Entity,
  hitNx: number,
  hitNy: number,
) {
  // Kill hostile entities (angry ghosts etc.)
  const ai = other.wanderAI;
  if (ai?.hostile && other.deathTimer === undefined) {
    other.deathTimer = 0.4;
    ai.hostile = false;
    other.tags?.delete("hostile");
    ai.state = "idle";
    if (other.motionIntent) {
      other.motionIntent.vx = 0;
      other.motionIntent.vy = 0;
    }
    entityManager.spawn(createGem(other.position.wx, other.position.wy));
  } else if (!startleWildlife(other, ball.position) && ai && !ai.hostile) {
    // Scare NPCs (non-hostile entities with wander AI)
    ai.state = "scared";
    ai.scaredTimer = BALL_SCARE_DURATION;
    delete ai.scaredSpeed;
    ai.dirX = hitNx;
    ai.dirY = hitNy;
    ai.timer = 0.3;
    if (other.sprite) other.sprite.moving = true;
  }
}
