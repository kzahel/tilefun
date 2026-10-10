import { CHUNK_SIZE_PX } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { ChunkRange } from "../world/ChunkManager.js";

interface Observer {
  player: Entity;
  visibleRange: ChunkRange;
}

export function isWildlife(entity: Entity): boolean {
  return !!(
    entity.fauna ||
    entity.deer ||
    entity.robin ||
    entity.rabbit ||
    entity.frog ||
    entity.mallard
  );
}

/** Simulation interest is narrower than residency. Sleeping never accrues dt. */
export class WildlifeActivity {
  private time = 0;
  private readonly awakeUntil = new WeakMap<Entity, number>();

  advance(dt: number): void {
    this.time += dt;
  }

  awake(
    group: readonly Entity[],
    observers: readonly Observer[],
    contacts: readonly Entity[],
    refresh = true,
  ): boolean {
    // Attached groups, followers and ordinary gameplay bodies retain their
    // existing interest. Never freeze one member independently of its root.
    if (
      group.some(
        (e) =>
          !isWildlife(e) ||
          e.parentId !== undefined ||
          e.wanderAI?.following ||
          e.wanderAI?.state === "ridden",
      )
    )
      return true;
    const entity = group[0];
    if (!entity) return false;
    const { wx, wy } = entity.position;
    const cx = Math.floor(wx / CHUNK_SIZE_PX),
      cy = Math.floor(wy / CHUNK_SIZE_PX);
    const interested = (margin: number, radius: number) =>
      observers.some(({ player, visibleRange: r }) => {
        const dx = wx - player.position.wx,
          dy = wy - player.position.wy;
        if (dx * dx + dy * dy <= radius * radius) return true;
        const px = Math.floor(player.position.wx / CHUNK_SIZE_PX),
          py = Math.floor(player.position.wy / CHUNK_SIZE_PX);
        // Extreme zoom or a detached camera cannot wake an unlimited population.
        return (
          cx >= Math.max(r.minCx - margin, px - 2) &&
          cx <= Math.min(r.maxCx + margin, px + 2) &&
          cy >= Math.max(r.minCy - margin, py - 2) &&
          cy <= Math.min(r.maxCy + margin, py + 2)
        );
      });
    const contact = contacts.some((other) => {
      if (other === entity || !other.collider) return false;
      const box = getEntityAABB(other.position, other.collider);
      const dx = Math.max(box.left - wx, 0, wx - box.right),
        dy = Math.max(box.top - wy, 0, wy - box.bottom);
      return dx * dx + dy * dy <= 96 * 96;
    });
    if (interested(1, 192) || contact) {
      if (refresh) this.awakeUntil.set(entity, this.time + 0.5);
      return true;
    }
    return (this.awakeUntil.get(entity) ?? 0) > this.time && interested(2, 256);
  }
}
