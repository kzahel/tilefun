import { TILE_SIZE } from "../config/constants.js";
import { descriptorFromMetadata, descriptorKey } from "../generation/GenerationDescriptor.js";
import { InvalidInteriorError } from "../interiors/GameplayInterior.js";
import type { IWorldRegistry, WorldMeta } from "../persistence/IWorldRegistry.js";
import type { PlayerLocation, PlayerLocationStore } from "../persistence/PlayerLocationStore.js";
import { worldCompatibility } from "../persistence/WorldCompatibility.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import type { RealmDirectory } from "./RealmDirectory.js";
import type { RealmDestination } from "./RealmTransitions.js";
import { raisedStanding, safeArrival } from "./SafeArrival.js";

export interface ResumeContext {
  locations: PlayerLocationStore | null;
  registry: IWorldRegistry;
  realms: RealmDirectory;
}

/** The saved realm, when it still exists with the same parent world and generation. */
async function savedRealm(realms: RealmDirectory, saved: PlayerLocation) {
  let meta: WorldMeta | undefined;
  try {
    meta = await realms.metadata(saved.realmId);
  } catch (error) {
    console.warn("[tilefun] Saved player destination is unavailable", error);
  }
  if (
    !meta ||
    (meta.interior?.parentWorldId ?? meta.id) !== saved.parentWorldId ||
    descriptorKey(descriptorFromMetadata(meta)) !== descriptorKey(saved.generation)
  )
    return undefined;
  try {
    return await realms.getOrCreate(saved.realmId);
  } catch (error) {
    if (!(error instanceof InvalidInteriorError)) throw error;
    console.warn("[tilefun] Saved interior is invalid", error);
    return undefined;
  }
}

async function savedDestination(
  realm: Realm,
  saved: PlayerLocation,
): Promise<RealmDestination | undefined> {
  try {
    const arrival = {
      x: saved.player.x / TILE_SIZE,
      y: saved.player.y / TILE_SIZE,
      generation: realm.generation,
    };
    const { x, y, wz, groundZ } = saved.player;
    // A player saved on a deck or a bridge's top is checked standing there (226).
    const standingZ = raisedStanding(realm, { position: { wx: x, wy: y }, wz, groundZ });
    const position = await safeArrival(realm, arrival, { standingZ });
    const exact = position.wx === x && position.wy === y;
    return {
      realm,
      allowInterior: true,
      // Resume exact saved progress, including moving-roof support. A relocated
      // fallback is explicit ground travel and must discard that old support.
      ...(exact ? {} : { arrival }),
      savedPlayer: saved.player,
      returnLocation: saved.player.returnLocation ?? null,
    };
  } catch (error) {
    console.warn("[tilefun] Saved player position is invalid", error);
    return undefined;
  }
}

/** A removed/invalid interior falls back to its parent, never another player's latest world. */
async function parentDestination(
  { registry, realms }: ResumeContext,
  saved: PlayerLocation,
): Promise<RealmDestination | undefined> {
  const savedParent = await registry.getWorld(saved.parentWorldId);
  if (!savedParent || worldCompatibility(savedParent)) return undefined;
  const realm = await realms.getOrCreate(saved.parentWorldId);
  const fallback = saved.player.returnLocation;
  if (fallback?.worldId === saved.parentWorldId) {
    try {
      await safeArrival(realm, fallback);
      return { realm, arrival: fallback, returnLocation: null };
    } catch {
      /* Use the parent's saved visit if its old doorway is no longer safe. */
    }
  }
  return { realm, returnLocation: null };
}

/** Where a (re)joining player resumes: their saved place, its parent world, or `fallbackId`. */
export async function resumeDestination(
  context: ResumeContext,
  session: PlayerSession,
  fallbackId: string,
): Promise<RealmDestination> {
  const saved = await context.locations?.load(session.persistId);
  if (saved) {
    const realm = await savedRealm(context.realms, saved);
    const destination =
      (realm && (await savedDestination(realm, saved))) ??
      (await parentDestination(context, saved));
    if (destination) return destination;
  }
  return { realm: await context.realms.getOrCreate(fallbackId), returnLocation: null };
}
