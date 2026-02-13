import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { createGem } from "../entities/Gem.js";

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
 * Tick gameplay logic: gem collection, baddie contact + knockback, buddy scare,
 * invincibility decay, and scattered-gem velocity decay.
 *
 * Pure function of (session, entityManager, dt) — no DOM, no Camera, no SaveManager.
 */
export function tickGameplay(
  session: GameplaySession,
  entityManager: EntityManager,
  dt: number,
  callbacks: GameplayCallbacks,
): void {
  const player = session.player;
  const px = player.position.wx;
  const py = player.position.wy + (player.collider?.offsetY ?? 0);

  // Check for gem collection (use player body center, not feet)
  for (const entity of entityManager.entities) {
    if (entity.type !== "gem") continue;
    const dx = entity.position.wx - px;
    const dy = entity.position.wy - py;
    if (dx * dx + dy * dy < 18 * 18) {
      entityManager.remove(entity.id);
      session.gemsCollected++;
      callbacks.markMetaDirty();
      break;
    }
  }

  // Baddie contact check (knockback + gem loss)
  if (session.invincibilityTimer <= 0) {
    for (const entity of entityManager.entities) {
      if (!entity.wanderAI?.hostile) continue;
      const dx = entity.position.wx - px;
      const dy = entity.position.wy - py;
      if (dx * dx + dy * dy < 12 * 12) {
        // Knockback away from baddie
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        session.knockbackVx = (-dx / dist) * 200;
        session.knockbackVy = (-dy / dist) * 200;

        // Scatter lost gems
        const lost = Math.min(3, session.gemsCollected);
        session.gemsCollected -= lost;
        for (let i = 0; i < lost; i++) {
          const angle = (Math.PI * 2 * i) / Math.max(lost, 1) + Math.random() * 0.5;
          const gem = entityManager.spawn(
            createGem(px + Math.cos(angle) * 8, py + Math.sin(angle) * 8),
          );
          gem.velocity = {
            vx: Math.cos(angle) * 80,
            vy: Math.sin(angle) * 80,
          };
        }

        session.invincibilityTimer = 1.5;
        callbacks.markMetaDirty();
        break;
      }
    }
  }

  // Baddie vs buddy contact: scare buddy away (stop following + knockback)
  for (const baddie of entityManager.entities) {
    if (!baddie.wanderAI?.hostile) continue;
    for (const buddy of entityManager.entities) {
      if (!buddy.wanderAI?.following) continue;
      const bdx = buddy.position.wx - baddie.position.wx;
      const bdy = buddy.position.wy - baddie.position.wy;
      if (bdx * bdx + bdy * bdy < 14 * 14) {
        buddy.wanderAI.following = false;
        buddy.wanderAI.state = "walking";
        const flee = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
        buddy.wanderAI.dirX = bdx / flee;
        buddy.wanderAI.dirY = bdy / flee;
        buddy.wanderAI.timer = 1.5;
        if (buddy.velocity) {
          buddy.velocity.vx = (bdx / flee) * 60;
          buddy.velocity.vy = (bdy / flee) * 60;
        }
        break;
      }
    }
  }

  // Hostile entities destroyed by campfire contact (ghost trap!)
  for (const baddie of entityManager.entities) {
    if (!baddie.wanderAI?.hostile || baddie.deathTimer !== undefined) continue;
    for (const fire of entityManager.entities) {
      if (fire.type !== "campfire") continue;
      const dx = baddie.position.wx - fire.position.wx;
      const dy = baddie.position.wy - fire.position.wy;
      if (dx * dx + dy * dy < 16 * 16) {
        // Start death animation — flash for 0.4s then vanish
        baddie.deathTimer = 0.4;
        baddie.wanderAI.hostile = false;
        baddie.wanderAI.state = "idle";
        if (baddie.velocity) {
          baddie.velocity.vx = 0;
          baddie.velocity.vy = 0;
        }
        // Reward: spawn a gem where the baddie dies
        entityManager.spawn(createGem(baddie.position.wx, baddie.position.wy));
        break;
      }
    }
  }

  // Tick death timers — flash rapidly, remove when expired
  const dead: number[] = [];
  for (const entity of entityManager.entities) {
    if (entity.deathTimer === undefined) continue;
    entity.deathTimer -= dt;
    entity.flashHidden = Math.floor(entity.deathTimer * 16) % 2 === 0;
    if (entity.deathTimer <= 0) {
      dead.push(entity.id);
    }
  }
  for (const id of dead) {
    entityManager.remove(id);
  }

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
