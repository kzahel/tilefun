import type { ActorPlacement, WorldGenerator } from "./Generator.js";
import type { Bounds } from "./regional/RegionalPlanner.js";

const ACTOR_RESIDENCY_CAP = 128;

/** Shared bounded preview/inspection adapter; the generator remains the sole placement producer. */
export function actorPlacements(generator: WorldGenerator, bounds: Bounds): ActorPlacement[] {
  const actors = new Map<string, ActorPlacement>();
  if (!generator.actors) return [];
  if (bounds.maxX - bounds.minX > 160 || bounds.maxY - bounds.minY > 160)
    throw new Error("Actor query exceeds its footprint cap.");
  for (let cy = Math.floor(bounds.minY / 16); cy <= Math.floor(bounds.maxY / 16); cy++)
    for (let cx = Math.floor(bounds.minX / 16); cx <= Math.floor(bounds.maxX / 16); cx++) {
      for (const actor of generator.actors(cx, cy)) actors.set(actor.featureId, actor);
      if (actors.size > ACTOR_RESIDENCY_CAP)
        throw new Error("Actor query exceeds its residency cap.");
    }
  return [...actors.values()];
}

/**
 * Whole chunks nearest the footprint centre, within the same residency cap.
 * Dense forests exceed the cap over a full explorer footprint; a preview
 * shows its central residents instead of rejecting the terrain and props.
 */
export function centralActorPlacements(
  generator: WorldGenerator,
  bounds: Bounds,
): ActorPlacement[] {
  if (bounds.maxX - bounds.minX > 160 || bounds.maxY - bounds.minY > 160)
    throw new Error("Actor query exceeds its footprint cap.");
  const mx = (bounds.minX + bounds.maxX) / 32,
    my = (bounds.minY + bounds.maxY) / 32;
  const chunks: { cx: number; cy: number }[] = [];
  for (let cy = Math.floor(bounds.minY / 16); cy <= Math.floor(bounds.maxY / 16); cy++)
    for (let cx = Math.floor(bounds.minX / 16); cx <= Math.floor(bounds.maxX / 16); cx++)
      chunks.push({ cx, cy });
  const distance = (c: { cx: number; cy: number }) => Math.hypot(c.cx + 0.5 - mx, c.cy + 0.5 - my);
  chunks.sort((a, b) => distance(a) - distance(b));
  const actors = new Map<string, ActorPlacement>();
  for (const { cx, cy } of chunks) {
    const chunk = actorPlacements(generator, {
      minX: cx * 16,
      minY: cy * 16,
      maxX: cx * 16 + 15,
      maxY: cy * 16 + 15,
    }).filter((a) => !actors.has(a.featureId));
    if (actors.size + chunk.length > ACTOR_RESIDENCY_CAP) break;
    for (const a of chunk) actors.set(a.featureId, a);
  }
  return [...actors.values()];
}
