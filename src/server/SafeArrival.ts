import { CHUNK_SIZE, TILE_SIZE } from "../config/constants.js";
import {
  type AABB,
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import { descriptorKey } from "../generation/GenerationDescriptor.js";
import { INTERIOR_DOORWAY, INTERIOR_FLOOR } from "../interiors/GameplayInterior.js";
import type { Arrival } from "../shared/protocol.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { Realm } from "./Realm.js";

export type { Arrival } from "../shared/protocol.js";

/**
 * Shared physics settles resting contacts within its allowed linear error
 * (1 mm, 0.016px), so a player saved against a wall can overlap it slightly
 * (for example 165.99991 against a 166px edge). Resume that pose exactly
 * rather than relocating it a tile away.
 */
const CONTACT_TOLERANCE = 1 / 32;

/** The search reaches 32 tiles; a body's centre can sit this far beyond its edge. */
const BODY_REACH = 33 * TILE_SIZE + 64;

/** Solid bodies a player arriving near `arrival` must keep clear of. */
function bodiesNear(realm: Realm, arrival: Arrival): AABB[] {
  const x = arrival.x * TILE_SIZE,
    y = arrival.y * TILE_SIZE;
  return realm.entityManager.entities.flatMap((entity) =>
    entity.collider &&
    entity.collider.solid !== false &&
    Math.abs(entity.position.wx - x) < BODY_REACH &&
    Math.abs(entity.position.wy - y) < BODY_REACH
      ? [getEntityAABB(entity.position, entity.collider)]
      : [],
  );
}

/**
 * Bounded terrain + realized prop check before a player leaves the old realm. With
 * `clearOfBodies` it also keeps off other bodies, such as a guest's host or its car (226).
 */
export async function safeArrival(
  realm: Realm,
  arrival: Arrival,
  { clearOfBodies = false }: { clearOfBodies?: boolean | undefined } = {},
): Promise<{ wx: number; wy: number }> {
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
  await realm.ensureReady({
    minCx: cx - radius,
    minCy: cy - radius,
    maxCx: cx + radius,
    maxCy: cy + radius,
  });
  realm.realizeProceduralProps();
  const bodies = clearOfBodies ? bodiesNear(realm, arrival) : [];
  const player = createPlayer(0, 0);
  const collider = player.collider;
  if (!collider) throw new Error("Player collider unavailable.");
  const test = (x: number, y: number) => {
    const position = { wx: x * TILE_SIZE, wy: y * TILE_SIZE };
    const box = getEntityAABB(position, collider);
    const aabb = {
      left: box.left + CONTACT_TOLERANCE,
      top: box.top + CONTACT_TOLERANCE,
      right: box.right - CONTACT_TOLERANCE,
      bottom: box.bottom - CONTACT_TOLERANCE,
    };
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
      if (realm.indoorFloor) {
        if (
          !realm.indoorFloor({
            x: aabb.left,
            y: aabb.top,
            width: aabb.right - aabb.left,
            height: aabb.bottom - aabb.top,
          })
        )
          return null;
      } else if (!inside && !doorway) return null;
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
    if (bodies.some((body) => aabbsOverlap(aabb, body))) return null;
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
