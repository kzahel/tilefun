import { TILE_SIZE } from "../config/constants.js";
import { baseGameMod } from "../game/base-game.js";
import { createDescriptor, descriptorFromMetadata } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { districtBuilding } from "../generation/regional/DistrictBuildings.js";
import { DistrictStrategy } from "../generation/regional/DistrictStrategy.js";
import { FarmsteadSource } from "../generation/regional/FarmsteadPlanner.js";
import { withLivedInLayout } from "../interiors/BuildingDoors.js";
import {
  exteriorEntrance,
  type InteriorIdentity,
  parseInteriorId,
} from "../interiors/GameplayInterior.js";
import type { IWorldRegistry, WorldMeta } from "../persistence/IWorldRegistry.js";
import type { PersistenceStore } from "../persistence/PersistenceStore.js";
import { worldCompatibility } from "../persistence/WorldCompatibility.js";
import type { RealmInfo } from "../shared/protocol.js";
import { Realm } from "./Realm.js";

/** How long an empty (non-default) realm stays loaded before being destroyed. */
const REALM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

type ParsedInterior = NonNullable<ReturnType<typeof parseInteriorId>>;

export interface RealmDirectoryDeps {
  registry: IWorldRegistry;
  createStore: (worldId: string) => PersistenceStore;
  /** Track durable/realm operations for the server's lifecycle fence. */
  track: <T>(operation: Promise<T>) => Promise<T>;
  reportStorageFailure: (error: unknown) => void;
}

/** A farmstead house/shed owner from its feature id, located on the generated plan. */
function farmsteadLot(terrain: DistrictStrategy, featureId: string, farm: RegExpExecArray) {
  const plan = new FarmsteadSource(terrain.world).owner(
    Number(farm[1]),
    Number(farm[2]),
    farm[3] as "east" | "south",
  );
  const prop = plan?.props.find((p) => p.featureId === featureId);
  const entrance =
    prop &&
    exteriorEntrance({
      type: prop.propType,
      position: { wx: prop.wx, wy: prop.wy },
    });
  return prop && entrance
    ? {
        buildingType: prop.propType,
        anchor: { x: prop.wx / TILE_SIZE, y: prop.wy / TILE_SIZE },
        entrance: { x: entrance.wx / TILE_SIZE, y: entrance.wy / TILE_SIZE },
      }
    : undefined;
}

function buildingLot(terrain: DistrictStrategy, featureId: string) {
  const farm = /^farmstead:(-?\d+):(-?\d+):(east|south):(?:house|shed)$/.exec(featureId);
  if (farm) return farmsteadLot(terrain, featureId, farm);
  const match = /^settlement:(-?\d+):(-?\d+):/.exec(featureId);
  if (!match) throw new Error("Invalid building owner.");
  return districtBuilding(terrain.districts.owner(Number(match[1]), Number(match[2])), featureId);
}

/** Interior realms derive their metadata from the parent world's generated building plan. */
async function interiorMetadata(
  registry: IWorldRegistry,
  worldId: string,
  parsed: ParsedInterior,
): Promise<WorldMeta> {
  const parent = await registry.getWorld(parsed.parentWorldId);
  if (!parent) throw new Error("Parent world not found.");
  if (worldCompatibility(parent)) throw new Error(worldCompatibility(parent));
  const generation = descriptorFromMetadata(parent);
  if (generation.type !== "regional")
    throw new Error("This generator has no enterable building plans.");
  const terrain = createGenerator(generation).terrain;
  if (!(terrain instanceof DistrictStrategy)) throw new Error("World has no enterable districts.");
  const lot = buildingLot(terrain, parsed.featureId);
  if (!lot) throw new Error("Building is absent from the generated plan.");
  const interior: InteriorIdentity = withLivedInLayout(
    {
      version: "interior-v1",
      ...parsed,
      buildingType: lot.buildingType,
      floor: 0,
      returnX: lot.entrance.x,
      returnY: lot.entrance.y,
    },
    { wx: lot.anchor.x * TILE_SIZE, wy: lot.anchor.y * TILE_SIZE },
  );
  return {
    ...parent,
    id: worldId,
    name: lot.buildingType,
    generation: createDescriptor("flat", generation.seed),
    interior,
  };
}

/** Loaded realms keyed by worldId: lookup, loading, the default realm and idle eviction. */
export class RealmDirectory {
  private readonly realms = new Map<string, Realm>();
  private readonly retiringRealms = new Map<string, Promise<void>>();
  private readonly loadingRealms = new Map<string, Promise<Realm>>();
  /** The default realm's worldId (set during init, used for new connections). */
  defaultRealmId: string | null = null;

  constructor(private readonly deps: RealmDirectoryDeps) {
    // Create a default realm (will be loaded with a world in init() or loadWorld())
    const defaultRealm = new Realm([baseGameMod]);
    // Use a sentinel key until a real world is loaded
    defaultRealm.currentWorldId = "__default__";
    this.realms.set("__default__", defaultRealm);
    this.defaultRealmId = "__default__";
  }

  get(worldId: string): Realm | undefined {
    return this.realms.get(worldId);
  }

  values(): IterableIterator<Realm> {
    return this.realms.values();
  }

  entries(): IterableIterator<[string, Realm]> {
    return this.realms.entries();
  }

  delete(worldId: string): void {
    this.realms.delete(worldId);
  }

  /**
   * Get or create a realm for the given worldId.
   * If a realm is already loaded for this world, returns it.
   * Otherwise, creates a new Realm and loads the world into it.
   */
  async getOrCreate(worldId: string): Promise<Realm> {
    const retiring = this.retiringRealms.get(worldId);
    if (retiring) await retiring;
    const existing = this.realms.get(worldId);
    if (existing) {
      if (!existing.sessions.size) existing.idleSince = Date.now();
      return existing;
    }

    const pending = this.loadingRealms.get(worldId);
    if (pending) return pending;
    const loading = this.load(worldId);
    this.loadingRealms.set(worldId, loading);
    try {
      return await loading;
    } finally {
      this.loadingRealms.delete(worldId);
    }
  }

  private async load(worldId: string): Promise<Realm> {
    const realm = new Realm([baseGameMod]);
    try {
      await realm.loadWorld(
        worldId,
        this.deps.registry,
        this.deps.createStore,
        await this.metadata(worldId),
      );
      realm.idleSince = Date.now();
      this.realms.set(worldId, realm);
      return realm;
    } catch (error) {
      await realm.destroy();
      throw error;
    }
  }

  /**
   * Load a world into the given default realm (used during init and for backward compat).
   * Re-keys the realm in the map from its old key to the new worldId.
   */
  async loadIntoDefault(
    worldId: string,
    activeRealm: () => Realm,
  ): Promise<{ cameraX: number; cameraY: number; cameraZoom: number }> {
    await this.metadata(worldId);
    const realm = activeRealm();

    // Re-key in the realms map
    if (this.defaultRealmId && this.defaultRealmId !== worldId) {
      this.realms.delete(this.defaultRealmId);
    }
    this.realms.set(worldId, realm);
    this.defaultRealmId = worldId;

    const cam = await realm.loadWorld(worldId, this.deps.registry, this.deps.createStore);
    return cam;
  }

  async metadata(worldId: string): Promise<WorldMeta | undefined> {
    const known = await this.deps.registry.getWorld(worldId);
    if (known) {
      if (worldCompatibility(known)) throw new Error(worldCompatibility(known));
      return known;
    }
    const parsed = parseInteriorId(worldId);
    if (!parsed) return undefined;
    return interiorMetadata(this.deps.registry, worldId, parsed);
  }

  /**
   * Mark a non-default realm as idle when it has no players.
   * The realm stays loaded for REALM_IDLE_TIMEOUT_MS to allow quick rejoin.
   * Actual cleanup happens in checkIdle() during tick().
   */
  tryUnload(worldId: string): void {
    if (worldId === this.defaultRealmId) return;
    const realm = this.realms.get(worldId);
    if (!realm || realm.sessions.size > 0) return;

    // Realm.removePlayer already sets idleSince — just log for visibility
    console.log(
      `[tilefun] realm idle, will unload in ${REALM_IDLE_TIMEOUT_MS / 1000}s: ${worldId}`,
    );
  }

  /**
   * Check all non-default realms for idle timeout expiration and destroy them.
   * Called from tick(); `residentsMoving` holds every realm while a resident crosses a door.
   */
  checkIdle(residentsMoving: boolean): void {
    const now = Date.now();
    for (const [worldId, realm] of this.realms) {
      if (worldId === this.defaultRealmId) continue;
      if (realm.idleSince === null) continue;
      if (
        residentsMoving ||
        realm.backgroundResidents.size ||
        [...realm.entityManager.entities].some((e) => e.resident?.transferring)
      )
        continue;
      if (now - realm.idleSince >= REALM_IDLE_TIMEOUT_MS) this.retire(worldId, realm);
    }
  }

  private retire(worldId: string, realm: Realm): void {
    console.log(`[tilefun] unloading idle realm: ${worldId}`);
    realm.idleSince = null;
    const retiring = (async () => {
      try {
        await realm.flushAsync();
        if (realm.sessions.size) return;
        await realm.destroy();
        this.realms.delete(worldId);
      } catch (error) {
        realm.idleSince = Date.now();
        throw error;
      }
    })();
    this.retiringRealms.set(worldId, retiring);
    void this.deps
      .track(retiring.finally(() => this.retiringRealms.delete(worldId)))
      .catch((error) => this.deps.reportStorageFailure(error));
  }

  /** Build a RealmInfo list: all registered worlds with live player counts. */
  async realmList(): Promise<RealmInfo[]> {
    const worlds = await this.deps.registry.listWorlds();
    return worlds.map((w): RealmInfo => {
      const info: RealmInfo = {
        id: w.id,
        name: w.name,
        playerCount: this.realms.get(w.id)?.sessions.size ?? 0,
        createdAt: w.createdAt,
        lastPlayedAt: w.lastPlayedAt,
      };
      info.incompatibleReason = worldCompatibility(w);
      info.generation = descriptorFromMetadata(w);
      return info;
    });
  }
}
