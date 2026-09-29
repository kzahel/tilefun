import type { Entity } from "./Entity.js";
import { directionFromVelocity } from "./wanderAI.js";

/** Follow short planned, walkable routes through normal entity collision and animation. */
export function updateRouteAI(entity: Entity, dt: number): void {
  const route = entity.routeAI,
    ai = entity.wanderAI,
    velocity = entity.velocity;
  if (!route || !ai || !velocity || !route.points.length) return;
  velocity.vx = 0;
  velocity.vy = 0;
  if (route.pause > 0) {
    route.pause -= dt;
    if (entity.sprite) entity.sprite.moving = false;
    return;
  }
  const target = route.points[route.index];
  if (!target) return;
  const dx = target.wx - entity.position.wx,
    dy = target.wy - entity.position.wy,
    distance = Math.hypot(dx, dy);
  const moved = Math.hypot(entity.position.wx - route.last.wx, entity.position.wy - route.last.wy);
  route.blocked = moved < 0.05 ? route.blocked + dt : 0;
  route.last = { ...entity.position };
  // Edits and players can obstruct a previously valid route. Pause/reverse, never teleport.
  if (distance <= 2 || route.blocked > 2) {
    route.index =
      (route.index + (route.blocked > 2 ? route.points.length - 1 : 1)) % route.points.length;
    route.pause = 1.5;
    route.blocked = 0;
    ai.state = "idle";
    return;
  }
  const speed = Math.min(ai.speed, distance / Math.max(dt, 0.001));
  ai.state = "walking";
  ai.dirX = dx / distance;
  ai.dirY = dy / distance;
  velocity.vx = ai.dirX * speed;
  velocity.vy = ai.dirY * speed;
  if (entity.sprite) {
    entity.sprite.moving = true;
    if (ai.directional) {
      entity.sprite.direction = directionFromVelocity(dx, dy);
      entity.sprite.frameRow = entity.sprite.direction;
    } else if (dx) entity.sprite.flipX = dx < 0;
  }
}
