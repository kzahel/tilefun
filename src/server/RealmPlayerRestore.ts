import { TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { SavedPlayerData } from "../persistence/SaveManager.js";
import { getSurfaceZ } from "../physics/surfaceHeight.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import { isEntityOnWater } from "./RealmPhysics.js";
import { safeArrival } from "./SafeArrival.js";

type SavedPlayer = SavedPlayerData | null | undefined;

/** Restore a saved height and, for airborne records, the jump in progress. */
export function restoreSavedBody(player: Entity, saved: SavedPlayer): void {
  if (saved?.wz === undefined || !Number.isFinite(saved.wz)) return;
  player.wz = saved.wz;
  player.groundZ =
    saved.groundZ !== undefined && Number.isFinite(saved.groundZ) ? saved.groundZ : saved.wz;
  if (saved.jumpVZ === undefined || !Number.isFinite(saved.jumpVZ)) return;
  player.jumpVZ = saved.jumpVZ;
  const motion = saved.airborneVelocity;
  if (motion && Number.isFinite(motion.vx) && Number.isFinite(motion.vy)) {
    player.velocity = { vx: motion.vx, vy: motion.vy };
  }
  player.jumpZ = saved.wz - (player.groundZ ?? saved.wz);
}

/**
 * The supported respawn pose for an arriving player, or undefined when an old
 * airborne record over water needs {@link dryRespawn}.
 */
export function savedRespawn(
  realm: Pick<Realm, "world">,
  player: Entity,
  saved: SavedPlayer,
  spawnX: number,
  spawnY: number,
): { wx: number; wy: number; wz?: number } | undefined {
  const savedSafe = saved?.lastSafePosition;
  if (savedSafe && [savedSafe.wx, savedSafe.wy, savedSafe.wz ?? 0].every(Number.isFinite))
    return { ...savedSafe };
  const respawn = {
    wx: spawnX,
    wy: spawnY,
    wz: player.wz ?? getSurfaceZ(spawnX, spawnY, (x, y) => realm.world.getHeightAt(x, y)),
  };
  if (
    savedSafe ||
    player.jumpVZ === undefined ||
    !isEntityOnWater(realm.world, { ...player, wz: 0 })
  )
    return respawn;
  return undefined;
}

/**
 * Old airborne records have no supported history. Use the existing bounded
 * admission search instead of making the airborne position a respawn loop.
 */
export async function dryRespawn(realm: Realm, spawnX: number, spawnY: number) {
  const dry = await safeArrival(realm, {
    x: spawnX / TILE_SIZE,
    y: spawnY / TILE_SIZE,
    generation: realm.generation,
  });
  return { ...dry, wz: getSurfaceZ(dry.wx, dry.wy, (x, y) => realm.world.getHeightAt(x, y)) };
}

/**
 * Reseat a saved driver; returns the on-foot restoration to await when the
 * vehicle is gone (reseating itself completes synchronously).
 */
export function restoreDriving(
  realm: Pick<Realm, "entityManager" | "vehicles">,
  session: PlayerSession,
  driving: NonNullable<SavedPlayerData["driving"]>,
  spawnX: number,
  spawnY: number,
): Promise<void> | undefined {
  const vehicle = realm.entityManager.entities.find((e) => e.proceduralId === driving.identity);
  const exit = driving.exit;
  const fallback =
    exit && Number.isFinite(exit.wx) && Number.isFinite(exit.wy)
      ? exit
      : { wx: spawnX, wy: spawnY };
  if (vehicle && realm.vehicles.available(vehicle.id)) {
    session.gameplaySession.lastSafePosition = { ...fallback };
    realm.vehicles.enter(session, vehicle.id, true);
    return undefined;
  }
  return realm.vehicles.restoreOnFoot(session, fallback);
}
