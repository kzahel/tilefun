/**
 * Bidirectional mapping between entity type strings and u16 indices
 * for binary protocol encoding. Derived deterministically from
 * ENTITY_DEFS keys, sorted alphabetically for stability.
 */

import { ENTITY_DEFS } from "../entities/EntityDefs.js";

/** Sorted entity type names — the index in this array IS the u16 wire value. */
export const ENTITY_TYPE_LIST: readonly string[] = Object.keys(ENTITY_DEFS).sort();
if (ENTITY_TYPE_LIST.length > 0x10000)
  throw new Error("Entity registry exceeds the u16 wire capacity");

/** Entity type string → u16 index. */
export const ENTITY_TYPE_TO_INDEX: ReadonlyMap<string, number> = new Map(
  ENTITY_TYPE_LIST.map((name, i) => [name, i]),
);

/** u16 index → entity type string. */
export function indexToEntityType(index: number): string | undefined {
  return ENTITY_TYPE_LIST[index];
}
