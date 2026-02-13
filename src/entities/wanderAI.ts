import { Direction, type Entity } from "./Entity.js";

/**
 * Update wander AI for an entity. Transitions between idle and walking.
 * Uses a random callback for testability.
 */
export function updateWanderAI(entity: Entity, dt: number, random: () => number): void {
  const ai = entity.wanderAI;
  const vel = entity.velocity;
  if (!ai || !vel) return;

  ai.timer -= dt;

  if (ai.timer <= 0) {
    if (ai.state === "idle") {
      ai.state = "walking";
      ai.timer = ai.walkMin + random() * (ai.walkMax - ai.walkMin);
      const angle = random() * Math.PI * 2;
      ai.dirX = Math.cos(angle);
      ai.dirY = Math.sin(angle);
    } else {
      ai.state = "idle";
      ai.timer = ai.idleMin + random() * (ai.idleMax - ai.idleMin);
      ai.dirX = 0;
      ai.dirY = 0;
    }
  }

  const { sprite } = entity;

  if (ai.state === "walking") {
    vel.vx = ai.dirX * ai.speed;
    vel.vy = ai.dirY * ai.speed;
    if (sprite) {
      sprite.moving = true;
      if (ai.directional) {
        sprite.direction = directionFromVelocity(ai.dirX, ai.dirY);
        sprite.frameRow = sprite.direction;
      }
    }
  } else {
    vel.vx = 0;
    vel.vy = 0;
    if (sprite) {
      sprite.moving = false;
    }
  }
}

/** Derive a 4-way Direction from a velocity vector. */
export function directionFromVelocity(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? Direction.Left : Direction.Right;
  }
  return dy < 0 ? Direction.Up : Direction.Down;
}

/** Reverse direction when collision blocks movement. */
export function onWanderBlocked(entity: Entity): void {
  const ai = entity.wanderAI;
  if (!ai) return;
  ai.dirX = -ai.dirX;
  ai.dirY = -ai.dirY;
}

/**
 * Extended AI update with chase and follow behavior.
 * Falls back to normal wander for entities without chase/follow fields.
 */
export function updateBehaviorAI(
  entity: Entity,
  dt: number,
  random: () => number,
  playerPos: { wx: number; wy: number },
  buddies?: readonly Entity[],
): void {
  const ai = entity.wanderAI;
  const vel = entity.velocity;
  if (!ai || !vel) return;

  const dx = playerPos.wx - entity.position.wx;
  const dy = playerPos.wy - entity.position.wy;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq);

  // --- Chase logic (hostile baddies) ---
  if (ai.chaseRange && ai.hostile && !ai.following) {
    // Find closest target: player or any buddy
    let targetDx = dx;
    let targetDy = dy;
    let targetDist = dist;
    if (buddies) {
      for (const buddy of buddies) {
        const bdx = buddy.position.wx - entity.position.wx;
        const bdy = buddy.position.wy - entity.position.wy;
        const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
        if (bdist < targetDist) {
          targetDx = bdx;
          targetDy = bdy;
          targetDist = bdist;
        }
      }
    }

    if (targetDist < ai.chaseRange) {
      ai.state = "chasing";
      const speed = ai.chaseSpeed ?? ai.speed;
      if (targetDist > 2) {
        vel.vx = (targetDx / targetDist) * speed;
        vel.vy = (targetDy / targetDist) * speed;
      }
      if (entity.sprite) {
        entity.sprite.moving = true;
      }
      return;
    }
    if (ai.state === "chasing") {
      // Lost all targets — return to wandering
      ai.state = "idle";
      ai.timer = ai.idleMin + random() * (ai.idleMax - ai.idleMin);
    }
  }

  // --- Follow logic (buddies) ---
  if (ai.following) {
    const leash = ai.followLeash ?? 200;
    if (dist > leash) {
      ai.following = false;
      ai.state = "idle";
      ai.timer = ai.idleMin + random() * (ai.idleMax - ai.idleMin);
      vel.vx = 0;
      vel.vy = 0;
      if (entity.sprite) entity.sprite.moving = false;
      return;
    }
    const followDist = ai.followDistance ?? 20;
    if (dist > followDist) {
      ai.state = "following";
      const speed = ai.chaseSpeed ?? ai.speed * 1.5;
      vel.vx = (dx / dist) * speed;
      vel.vy = (dy / dist) * speed;
      if (entity.sprite) {
        entity.sprite.moving = true;
        if (ai.directional) {
          entity.sprite.direction = directionFromVelocity(dx, dy);
          entity.sprite.frameRow = entity.sprite.direction;
        }
      }
      return;
    }
    // Close enough — idle near player
    vel.vx = 0;
    vel.vy = 0;
    if (entity.sprite) {
      entity.sprite.moving = false;
    }
    return;
  }

  // --- Default: normal wander ---
  updateWanderAI(entity, dt, random);
}
