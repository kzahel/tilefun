import type { Entity } from "../entities/Entity.js";

/**
 * Native wildlife brain components, in authoritative dispatch order. AI ticks,
 * player/ball startles and planning seeds use the first component present in
 * this order. Adding a kind here makes `WILDLIFE_SPECIES` incomplete until its
 * update and startle entries are declared.
 */
export const WILDLIFE_KINDS = [
  "predator",
  "fauna",
  "deer",
  "robin",
  "rabbit",
  "frog",
  "mallard",
] as const satisfies readonly (keyof Entity)[];
export type WildlifeKind = (typeof WILDLIFE_KINDS)[number];
export type WildlifeBrain = NonNullable<Entity[WildlifeKind]>;

export function wildlifeKind(entity: Entity): WildlifeKind | undefined {
  for (const kind of WILDLIFE_KINDS) if (entity[kind]) return kind;
  return undefined;
}

/** The first native brain in dispatch order, matching `predator ?? fauna ?? … ?? mallard`. */
export function wildlifeBrain(entity: Entity): WildlifeBrain | undefined {
  const kind = wildlifeKind(entity);
  return kind ? entity[kind] : undefined;
}

export const isWildlife = (entity: Entity): boolean => wildlifeKind(entity) !== undefined;
