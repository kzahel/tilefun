import type { Entity } from "./Entity.js";

/**
 * A nap is a few ticks an authority realm leaves a waiting actor out of its per-actor
 * passes: nothing about the actor would change, so nothing reads or compares it.
 * RealmNaps starts and ends naps; anything that disturbs an actor calls `wake`.
 */
/** Napping at `tick`; without a tick, chosen to nap and not disturbed since. */
export const isNapping = (entity: Entity, tick = 0): boolean =>
  entity.napFrom !== undefined && (entity.napUntil ?? -1) >= tick;

/** End a nap at the next tick: the actor was touched from outside its own clocks. */
export function wake(entity: Entity): void {
  if (entity.napFrom !== undefined) entity.napUntil = -1;
}
