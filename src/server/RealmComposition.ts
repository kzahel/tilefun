import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { type InteriorIdentity, InvalidInteriorError } from "../interiors/GameplayInterior.js";
import { initialRoom, parseGameplayRoom } from "../interiors/GameplayRoom.js";
import { PERSISTENCE_BUDGET } from "../persistence/PersistenceBudget.js";
import type { SavedMeta, SaveManager } from "../persistence/SaveManager.js";
import {
  type PendingWildlifeRespawn,
  WILDLIFE_RESPAWN_LIMIT,
  WILDLIFE_RESPAWN_SCOPE,
} from "../wildlife/WildlifeRespawns.js";
import { around } from "./InterestManager.js";
import type { Realm } from "./Realm.js";

// Realm.loadWorld steps that only need public realm state.

/** Budget and ready-terrain admission for newly loaded managers. */
export function installCapacityGuards(
  realm: Pick<Realm, "world" | "entityManager" | "propManager" | "saveManager" | "records">,
): void {
  realm.entityManager.canPlace = (wx, wy) =>
    Number.isFinite(wx) &&
    Number.isFinite(wy) &&
    !!realm.world.chunks.get(Math.floor(wx / CHUNK_SIZE_PX), Math.floor(wy / CHUNK_SIZE_PX));
  realm.entityManager.canSpawn = (entity) =>
    realm.entityManager.entities.length < PERSISTENCE_BUDGET.actors &&
    !realm.saveManager?.pressured &&
    realm.entityManager.canPlace?.(entity.position.wx, entity.position.wy) !== false;
  realm.propManager.canAdd = (prop) =>
    realm.propManager.props.length < PERSISTENCE_BUDGET.props &&
    !realm.saveManager?.pressured &&
    realm.entityManager.canPlace?.(prop.position.wx, prop.position.wy) !== false;
  realm.entityManager.beforeSpawn = (entity) => {
    if (
      !realm.records?.isHydrating &&
      realm.entityManager.canPlace?.(entity.position.wx, entity.position.wy) === false
    )
      throw new Error("Cannot spawn outside ready terrain.");
    if (realm.entityManager.entities.length >= PERSISTENCE_BUDGET.actors)
      throw new Error("Local actor limit reached.");
  };
  realm.propManager.beforeAdd = () => {
    if (realm.propManager.props.length >= PERSISTENCE_BUDGET.props)
      throw new Error("Local prop limit reached.");
  };
}

/** Traffic may only spawn into ready, unedited, unpressured terrain. */
export function installTrafficGuard(
  realm: Pick<Realm, "vehicleRegistry" | "records" | "saveManager" | "entityManager" | "streaming">,
): void {
  if (realm.vehicleRegistry)
    realm.vehicleRegistry.canSpawn = (id, wx, wy) =>
      !realm.records?.features.has(id) &&
      !realm.saveManager?.pressured &&
      realm.entityManager.entities.length < PERSISTENCE_BUDGET.actors - 16 &&
      !!realm.streaming?.rangeReady(
        around(Math.floor(wx / CHUNK_SIZE_PX), Math.floor(wy / CHUNK_SIZE_PX), 1),
      );
}

/** Restore queued wildlife returns and persist later queue changes. */
export async function loadWildlifeReturns(
  realm: Pick<Realm, "saveManager">,
  saveManager: SaveManager,
  entityManager: EntityManager,
): Promise<void> {
  const returns = await saveManager.loadRecords("meta", WILDLIFE_RESPAWN_SCOPE);
  if (returns.size > WILDLIFE_RESPAWN_LIMIT)
    throw new Error("Wildlife return queue exceeds its limit.");
  for (const [key, value] of returns) {
    const job = value as PendingWildlifeRespawn;
    if (
      !key.startsWith("wildlife-respawn:") ||
      !job.actor?.state.naturalSpawnId ||
      !Number.isFinite(job.remaining) ||
      job.remaining < 0
    )
      throw new Error("Invalid wildlife return record.");
    entityManager.wildlifeRespawns.set(job.actor.persistentId, job);
  }
  entityManager.onWildlifeRespawnChanged = (id, job) => {
    const key = `wildlife-respawn:${id}`;
    realm.saveManager?.markRecordDirty("meta", key, () => ({
      collection: "meta",
      key,
      scope: WILDLIFE_RESPAWN_SCOPE,
      ...(job ? { value: structuredClone(job) } : { value: null, deleted: true }),
    }));
  };
}

/** A saved room must describe the same building floor as the requested interior. */
export function checkSavedInterior(
  interior: InteriorIdentity | null,
  saved: InteriorIdentity | undefined,
): void {
  if (
    interior &&
    saved &&
    (saved.version !== interior.version ||
      saved.featureId !== interior.featureId ||
      saved.parentWorldId !== interior.parentWorldId ||
      saved.floor !== interior.floor)
  )
    throw new InvalidInteriorError("Unsupported saved interior identity.");
}

/** Report any failure to build saved room geometry as an invalid interior. */
export function asInvalidInterior<T>(build: () => T): T {
  try {
    return build();
  } catch (error) {
    throw new InvalidInteriorError("Saved interior geometry is invalid.", { cause: error });
  }
}

/** The saved room plan, or the generated layout for a first visit. */
export function savedRoomState(interior: InteriorIdentity, savedMeta: SavedMeta | null) {
  return savedMeta?.roomPlan ? parseGameplayRoom(savedMeta.roomPlan) : initialRoom(interior);
}
