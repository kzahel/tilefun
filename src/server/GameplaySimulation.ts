import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";

/**
 * Mutable session state for a single player's gameplay (gems, knockback, invincibility).
 * In the current single-player setup this lives on the Game object;
 * later it moves into PlayerSession.
 */
export interface GameplaySession {
  player: Entity;
  gemsCollected: number;
  invincibilityTimer: number;
  knockbackVx: number;
  knockbackVy: number;
}

export interface GameplayCallbacks {
  markMetaDirty(): void;
}

/**
 * Tick gameplay logic: invincibility decay and scattered-gem velocity decay.
 * Combat, gem collection, campfire trap, and buddy scare are handled by mods.
 */
export function tickGameplay(
  session: GameplaySession,
  entityManager: EntityManager,
  dt: number,
  _callbacks: GameplayCallbacks,
): void {
  const player = session.player;

  // Tick invincibility + knockback decay
  if (session.invincibilityTimer > 0) {
    session.invincibilityTimer -= dt;
    if (player.velocity) {
      player.velocity.vx += session.knockbackVx * dt * 3;
      player.velocity.vy += session.knockbackVy * dt * 3;
    }
    const decay = Math.max(0, 1 - dt * 5);
    session.knockbackVx *= decay;
    session.knockbackVy *= decay;
    // Flash effect
    player.flashHidden =
      session.invincibilityTimer > 0 && Math.floor(session.invincibilityTimer * 8) % 2 === 0;
  } else {
    player.flashHidden = false;
  }

  // Decay scattered gem velocity
  for (const entity of entityManager.entities) {
    if (entity.type === "gem" && entity.velocity) {
      entity.velocity.vx *= Math.max(0, 1 - dt * 4);
      entity.velocity.vy *= Math.max(0, 1 - dt * 4);
      entity.position.wx += entity.velocity.vx * dt;
      entity.position.wy += entity.velocity.vy * dt;
      if (Math.abs(entity.velocity.vx) < 1 && Math.abs(entity.velocity.vy) < 1) {
        entity.velocity = null;
      }
    }
  }
}
