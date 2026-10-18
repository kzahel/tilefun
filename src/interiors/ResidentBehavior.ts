import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import { setSpriteClip, setSpriteClipElapsed } from "../entities/spriteAnimation.js";

export interface ResidentStop extends PositionComponent {
  id: string;
  action: "read" | "clean" | "cook" | "eat" | "browse" | "rest" | "exit" | "enter";
  seconds: number;
  facing?: Direction;
}
export interface ResidentBehavior {
  homeRealm: string;
  parentRealm: string;
  doorId: string;
  place: "inside" | "outside";
  inside: ResidentStop[];
  outside: ResidentStop[];
  index: number;
  phase: "walk" | "act" | "transfer";
  elapsed: number;
  retry: number;
  path: PositionComponent[];
  /** Transfers freeze the actor until its two realm records commit atomically. */
  transferring?: boolean;
  cat?: boolean;
}

/** Bounded four-neighbor BFS, only on activity changes or an obstructed path.
 * Actual footprint checks include wall rails, furniture and occupied stations. */
export function residentPath(
  from: PositionComponent,
  to: PositionComponent,
  clear: (p: PositionComponent) => boolean,
): PositionComponent[] | null {
  const step = 4;
  const ox = from.wx,
    oy = from.wy;
  const endX = Math.round((to.wx - ox) / step),
    endY = Math.round((to.wy - oy) / step);
  const key = (x: number, y: number) => `${x},${y}`;
  const queue: [number, number][] = [[0, 0]],
    previous = new Map<string, string | null>([["0,0", null]]);
  for (let i = 0; i < queue.length && i < 8192; i++) {
    const point = queue[i];
    if (!point) break;
    const [x, y] = point;
    if (x === endX && y === endY) {
      if (!clear(to)) return null;
      const route: PositionComponent[] = [{ ...to }];
      for (let cursor = key(x, y); cursor !== "0,0"; ) {
        const [px = 0, py = 0] = cursor.split(",").map(Number);
        route.push({ wx: ox + px * step, wy: oy + py * step });
        cursor = previous.get(cursor) ?? "0,0";
      }
      return route.reverse();
    }
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ] as const) {
      const nx = x + dx,
        ny = y + dy,
        k = key(nx, ny);
      if (previous.has(k) || Math.abs(nx) > 96 || Math.abs(ny) > 96) continue;
      if (!clear({ wx: ox + nx * step, wy: oy + ny * step })) continue;
      previous.set(k, key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

export function restoreResidentPose(entity: Entity): void {
  const r = entity.resident,
    s = entity.sprite;
  if (!r || !s) return;
  const acting = r.phase !== "walk" || r.transferring;
  s.moving = !acting;
  const stop = (r.place === "inside" ? r.inside : r.outside)[r.index];
  if (acting) {
    s.direction = stop?.facing ?? Direction.Down;
    s.frameRow = r.cat ? 0 : s.direction;
  }
  const roleAction: Record<string, ResidentStop["action"]> = {
    "indoor-reader": "read",
    "indoor-cleaner": "clean",
    "indoor-chef": "cook",
    "indoor-diner": "eat",
  };
  const active = acting && stop?.action === roleAction[entity.type];
  setSpriteClip(entity, r.cat ? (acting ? 0 : 1) : active ? 1 : undefined);
  setSpriteClipElapsed(entity, active || r.cat ? r.elapsed * 1000 : undefined);
}

/** Shared authority controller; never teleports to a seat or through an obstruction. */
export function updateResident(
  entity: Entity,
  dt: number,
  clear: (p: PositionComponent) => boolean,
  peers: readonly Entity[],
): void {
  const r = entity.resident;
  if (!r || !entity.velocity) return;
  entity.velocity.vx = entity.velocity.vy = 0;
  const stops = r.place === "inside" ? r.inside : r.outside,
    stop = stops[r.index];
  if (!stop || r.transferring || r.phase === "transfer") {
    restoreResidentPose(entity);
    return;
  }
  r.elapsed += dt;
  if (
    r.phase === "act" &&
    Math.hypot(stop.wx - entity.position.wx, stop.wy - entity.position.wy) > 3
  ) {
    r.phase = "walk";
    r.elapsed = 0;
    r.path = [];
  }
  if (r.phase === "act") {
    if (r.elapsed >= stop.seconds) {
      if (stop.action === "exit" || stop.action === "enter") r.phase = "transfer";
      else {
        r.index = (r.index + 1) % stops.length;
        r.phase = "walk";
        r.elapsed = 0;
        r.path = [];
      }
    }
  } else {
    const distance = Math.hypot(stop.wx - entity.position.wx, stop.wy - entity.position.wy);
    const reserved = peers.some((other) => {
      const o = other.resident;
      return (
        other !== entity &&
        o &&
        !o.transferring &&
        o.place === r.place &&
        o.homeRealm === r.homeRealm &&
        (o.place === "inside" ? o.inside : o.outside)[o.index]?.id === stop.id &&
        (o.phase === "act" || other.id < entity.id)
      );
    });
    if (distance <= 1 && !reserved) {
      r.phase = "act";
      r.elapsed = 0;
      r.path = [];
    } else if (!reserved) {
      r.retry = Math.max(0, r.retry - dt);
      if (!r.path.length && !r.retry) {
        r.path = residentPath(entity.position, stop, clear) ?? [];
        r.retry = 2;
      }
      while (
        r.path[0] &&
        Math.hypot(r.path[0].wx - entity.position.wx, r.path[0].wy - entity.position.wy) < 1
      )
        r.path.shift();
      const next = r.path[0];
      if (next) {
        if (!clear(next)) {
          r.path = [];
          r.retry = 2;
        } else {
          const dx = next.wx - entity.position.wx,
            dy = next.wy - entity.position.wy;
          const length = Math.hypot(dx, dy),
            speed = Math.min(r.cat ? 14 : 24, length / dt);
          entity.velocity.vx = (dx / length) * speed;
          entity.velocity.vy = (dy / length) * speed;
          if (entity.sprite) {
            entity.sprite.direction =
              Math.abs(dx) > Math.abs(dy)
                ? dx < 0
                  ? Direction.Left
                  : Direction.Right
                : dy < 0
                  ? Direction.Up
                  : Direction.Down;
            if (r.cat) entity.sprite.flipX = dx < 0;
            else entity.sprite.frameRow = entity.sprite.direction;
          }
        }
      }
    }
  }
  restoreResidentPose(entity);
  if (entity.sprite && !entity.velocity.vx && !entity.velocity.vy) entity.sprite.moving = false;
}
