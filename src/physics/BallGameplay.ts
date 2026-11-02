import { BALL_DESPAWN_TIME, BALL_SCARE_DURATION, TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { createGem } from "../entities/Gem.js";
import { startleDeer } from "../wildlife/deerInteractions.js";
import { startleFauna } from "../wildlife/faunaInteractions.js";
import { startleFrog } from "../wildlife/frogInteractions.js";
import { startleMallard } from "../wildlife/mallardInteractions.js";
import { startlePredator } from "../wildlife/predatorAI.js";
import { startleRabbit } from "../wildlife/rabbitInteractions.js";
import { startleRobin } from "../wildlife/robinInteractions.js";
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
    if (!ball.workItem?.owner && state.grounded && Math.hypot(state.vx, state.vy) < 3)
      ball.deathTimer ??= BALL_DESPAWN_TIME;
    if (Math.hypot(state.vx, state.vy, state.vz) < 8) continue;
    for (const id of scene.contactIds(ball.id) ?? []) {
      if (id === ball.ballThrowerId) continue;
      const other = manager.byId.get(id);
      if (!other || other.type === "ball") continue;
      const dx = other.position.wx - ball.position.wx,
        dy = other.position.wy - ball.position.wy;
      const distance = Math.hypot(dx, dy) || 1;
      applyBallImpact(manager, other, ball, dx / distance, dy / distance);
    }
  }
}

/** Gameplay hit reactions shared by collision backends; no position resolution. */
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
    if (other.desiredVelocity) {
      other.desiredVelocity.vx = 0;
      other.desiredVelocity.vy = 0;
    }
    entityManager.spawn(createGem(other.position.wx, other.position.wy));
  } else if (other.predator) {
    startlePredator(other, ball.position);
  } else if (other.fauna) {
    startleFauna(other, ball.position);
  } else if (other.deer) {
    startleDeer(other, ball.position);
  } else if (other.robin) {
    startleRobin(other, ball.position);
  } else if (other.rabbit) {
    startleRabbit(other, ball.position);
  } else if (other.frog) {
    startleFrog(other, ball.position);
  } else if (other.mallard) {
    startleMallard(other, ball.position);
  } else if (ai && !ai.hostile) {
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
