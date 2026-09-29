import type { ActorPlacement, WorldGenerator } from "./Generator.js";
import type { Bounds } from "./regional/RegionalPlanner.js";

/** Shared bounded preview/inspection adapter; the generator remains the sole placement producer. */
export function actorPlacements(generator: WorldGenerator, bounds: Bounds): ActorPlacement[] {
  const actors = new Map<string, ActorPlacement>();
  if (!generator.actors) return [];
  if (bounds.maxX - bounds.minX > 160 || bounds.maxY - bounds.minY > 160)
    throw new Error("Actor query exceeds its footprint cap.");
  for (let cy = Math.floor(bounds.minY / 16); cy <= Math.floor(bounds.maxY / 16); cy++)
    for (let cx = Math.floor(bounds.minX / 16); cx <= Math.floor(bounds.maxX / 16); cx++) {
      for (const actor of generator.actors(cx, cy)) actors.set(actor.featureId, actor);
      if (actors.size > 128) throw new Error("Actor query exceeds its residency cap.");
    }
  return [...actors.values()];
}
