import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import { aabbOverlapsPropWalls, aabbOverlapsSolid, getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import { descriptorKey } from "../generation/GenerationDescriptor.js";
import { INTERIOR_DOORWAY, INTERIOR_FLOOR } from "../interiors/GameplayInterior.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { Realm } from "./Realm.js";

export interface Arrival {
  x: number;
  y: number;
  generation: GenerationDescriptor;
}
/** Bounded terrain + realized prop check before a player leaves the old realm. */
export function safeArrival(realm: Realm, arrival: Arrival): { wx: number; wy: number } {
  if (
    !Number.isFinite(arrival.x) ||
    !Number.isFinite(arrival.y) ||
    Math.abs(arrival.x) > 2 ** 23 ||
    Math.abs(arrival.y) > 2 ** 23
  )
    throw new Error("Arrival is outside supported coordinates.");
  if (descriptorKey(arrival.generation) !== descriptorKey(realm.generation))
    throw new Error("The destination has a different generator identity.");
  const cx = Math.floor(arrival.x / CHUNK_SIZE),
    cy = Math.floor(arrival.y / CHUNK_SIZE);
  // Explicit bounded warm-up; do not evict chunks belonging to other players.
  const radius = realm.interior ? 1 : 3;
  for (let y = cy - radius; y <= cy + radius; y++)
    for (let x = cx - radius; x <= cx + radius; x++) realm.world.getChunk(x, y);
  realm.realizeProceduralProps();
  const player = createPlayer(0, 0);
  const collider = player.collider;
  if (!collider) throw new Error("Player collider unavailable.");
  const test = (x: number, y: number) => {
    const position = { wx: x * TILE_SIZE, wy: y * TILE_SIZE };
    const aabb = getEntityAABB(position, collider);
    if (realm.interior) {
      const floor = INTERIOR_FLOOR;
      const inside =
        aabb.left >= floor.x &&
        aabb.right <= floor.x + floor.width &&
        aabb.top >= floor.y &&
        aabb.bottom <= floor.y + floor.height;
      const door = INTERIOR_DOORWAY;
      const doorway =
        aabb.left >= door.x &&
        aabb.right <= door.x + door.width &&
        aabb.top >= door.y &&
        aabb.bottom <= door.y + door.height;
      if (!inside && !doorway) return null;
    }
    if (
      aabbOverlapsSolid(
        aabb,
        (tx, ty) => realm.world.getCollision(tx, ty),
        CollisionFlag.Solid | CollisionFlag.Water,
      )
    )
      return null;
    if (
      realm.propManager
        .getPropsNearPosition(position, collider)
        .some((prop) => aabbOverlapsPropWalls(aabb, prop.position, prop, 0, 12))
    )
      return null;
    return position;
  };
  const exact = test(arrival.x, arrival.y);
  if (exact) return exact;
  for (let r = 1; r <= 32; r++)
    for (let i = -r; i <= r; i++) {
      for (const [dx, dy] of [
        [i, -r],
        [i, r],
        [-r, i],
        [r, i],
      ]) {
        const position = test(arrival.x + (dx ?? 0), arrival.y + (dy ?? 0));
        if (position) return position;
      }
    }
  throw new Error("No safe walkable arrival within 32 tiles of this location.");
}
