import { CHUNK_SIZE_PX } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { isWildlife } from "../wildlife/WildlifeKinds.js";
import type { ChunkRange } from "../world/ChunkManager.js";

interface Observer {
  player: Entity;
  visibleRange: ChunkRange;
}

/** Simulation interest is narrower than residency. Sleeping never accrues dt. */
export class WildlifeActivity {
  private time = 0;
  private readonly awakeUntil = new WeakMap<Entity, number>();

  advance(dt: number): void {
    this.time += dt;
  }

  /** Whether the group simulates this tick. `refresh` extends the hysteresis of a
   * group that is awake by direct interest; pass false to preview without it. */
  awake(
    group: readonly Entity[],
    observers: readonly Observer[],
    contacts: readonly Entity[],
    refresh = true,
  ): boolean {
    const verdict = this.interest(group, observers, contacts);
    if (refresh && verdict === "direct" && group[0]) this.keep(group[0]);
    return verdict !== "asleep";
  }

  /** Whether a wildlife-only group simulates this tick. A sleeping group needs no
   * readiness query and restarts its decision clock; a body not yet placed on its
   * terrain is admitted as soon as that terrain is ready, without hysteresis. */
  admit(
    group: readonly Entity[],
    observers: readonly Observer[],
    contacts: readonly Entity[],
    supported: (group: readonly Entity[]) => boolean,
  ): boolean {
    const fresh = group.some((member) => member.wz === undefined);
    const interest = fresh ? "held" : this.interest(group, observers, contacts);
    if (interest === "asleep") {
      for (const member of group) member.tickAccumulator = 0;
      return false;
    }
    if (!supported(group)) return false;
    if (interest === "direct" && group[0]) this.keep(group[0]);
    return true;
  }

  private keep(entity: Entity): void {
    this.awakeUntil.set(entity, this.time + 0.5);
  }

  /** "held": awake regardless of observers; "direct": near an observer or a moving
   * body; "lingering": recently direct and still loosely in view. */
  private interest(
    group: readonly Entity[],
    observers: readonly Observer[],
    contacts: readonly Entity[],
  ): "held" | "direct" | "lingering" | "asleep" {
    // Attached groups, followers and ordinary gameplay bodies retain their
    // existing interest. Never freeze one member independently of its root.
    for (const e of group)
      if (
        !isWildlife(e) ||
        e.parentId !== undefined ||
        e.wanderAI?.following ||
        e.wanderAI?.state === "ridden"
      )
        return "held";
    const entity = group[0];
    if (!entity) return "asleep";
    const { wx, wy } = entity.position;
    if (inView(wx, wy, observers, 1, 192) || touched(entity, wx, wy, contacts)) return "direct";
    return (this.awakeUntil.get(entity) ?? 0) > this.time && inView(wx, wy, observers, 2, 256)
      ? "lingering"
      : "asleep";
  }
}

function inView(
  wx: number,
  wy: number,
  observers: readonly Observer[],
  margin: number,
  radius: number,
): boolean {
  const cx = Math.floor(wx / CHUNK_SIZE_PX),
    cy = Math.floor(wy / CHUNK_SIZE_PX);
  for (const { player, visibleRange: r } of observers) {
    const dx = wx - player.position.wx,
      dy = wy - player.position.wy;
    if (dx * dx + dy * dy <= radius * radius) return true;
    const px = Math.floor(player.position.wx / CHUNK_SIZE_PX),
      py = Math.floor(player.position.wy / CHUNK_SIZE_PX);
    // Extreme zoom or a detached camera cannot wake an unlimited population.
    if (
      cx >= Math.max(r.minCx - margin, px - 2) &&
      cx <= Math.min(r.maxCx + margin, px + 2) &&
      cy >= Math.max(r.minCy - margin, py - 2) &&
      cy <= Math.min(r.maxCy + margin, py + 2)
    )
      return true;
  }
  return false;
}

function touched(entity: Entity, wx: number, wy: number, contacts: readonly Entity[]): boolean {
  for (const other of contacts) {
    if (other === entity || !other.collider) continue;
    const box = getEntityAABB(other.position, other.collider);
    const dx = Math.max(box.left - wx, 0, wx - box.right),
      dy = Math.max(box.top - wy, 0, wy - box.bottom);
    if (dx * dx + dy * dy <= 96 * 96) return true;
  }
  return false;
}
