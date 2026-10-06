import { PERSISTENCE_BUDGET } from "./PersistenceBudget.js";
import type { PersistenceStore, SaveEntry } from "./PersistenceStore.js";
import { SAVE_FORMAT } from "./SaveFormat.js";
import { RealmStore } from "./WorldStorePool.js";

const STORE_CHUNKS = "chunks";
const STORE_META = "meta";
const STORE_PLAYERS = "players";
const SAVE_DEBOUNCE_MS = 2000;

export interface SerializedEntity {
  type: string;
  proceduralId?: string;
  wx: number;
  wy: number;
}

export interface SavedMeta {
  roomPlan?: import("../interiors/GameplayRoom.js").GameplayRoomState;
  interior?: import("../interiors/GameplayInterior.js").InteriorIdentity;
  playerX: number;
  playerY: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  /** Total gems collected (absent in older saves → defaults to 0). */
  gemsCollected?: number;
}

/** Bounded inspection DTO; never persisted as a world-wide actor snapshot. */
export interface InspectionState extends SavedMeta {
  traffic?: import("../traffic/TrafficSystem.js").SavedTraffic[];
  deletedProceduralIds?: string[];
  proceduralEdits?: SerializedEntity[];
  entities?: SerializedEntity[];
  nextEntityId?: number;
}

export interface SavedPlayerData {
  /** Absolute vertical pose, preserving which stacked space the player occupies. */
  wz?: number;
  groundZ?: number;
  jumpVZ?: number;
  /** Preserve total and passive XY motion only for an airborne save. */
  airborneVelocity?: { vx: number; vy: number; momentumX?: number; momentumY?: number };
  mount?: { id: string; offsetX: number; offsetY: number; wz: number; jumpZ: number };
  roofRide?: { identity: string; offsetX: number; offsetY: number };
  returnLocation?: import("../server/PlayerSession.js").PlayerSession["returnLocation"];
  gemsCollected: number;
  x: number;
  y: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
}

export interface SavedChunkData {
  subgrid: Uint8Array;
  roadGrid: Uint8Array;
  heightGrid: Uint8Array;
}

interface SaveBatch {
  entries: SaveEntry[];
  restore: () => void;
}

type GetChunkFn = (key: string) => SavedChunkData | undefined;
type GetMetaFn = () => SavedMeta;

export class SaveManager {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirtyRecords = new Map<string, () => SaveEntry>();
  private dirtyChunks = new Set<string>();
  private dirtyPlayers = new Map<string, SavedPlayerData>();
  private metaDirty = false;
  private saving = false;
  private pending: Promise<void> = Promise.resolve();
  private saveFailed = false;
  private saveError: unknown;
  private getChunk: GetChunkFn | null = null;
  private getMeta: GetMetaFn | null = null;

  constructor(readonly store: PersistenceStore) {}
  get dirtyCount(): number {
    return (
      this.dirtyRecords.size +
      this.dirtyChunks.size +
      this.dirtyPlayers.size +
      Number(this.metaDirty)
    );
  }
  get pressured(): boolean {
    return (
      this.saveFailed ||
      this.store.health.failed ||
      this.store.health.pendingRecords >= PERSISTENCE_BUDGET.dirtySoftLimit ||
      this.store.health.pendingBytes >= PERSISTENCE_BUDGET.scopeBytes ||
      this.dirtyCount >= PERSISTENCE_BUDGET.dirtySoftLimit
    );
  }
  get diagnostics() {
    return { ...this.store.health, dirtyRecords: this.dirtyCount, paused: this.pressured };
  }

  /** Bind the data accessors once so scheduleSave/flush can use them. */
  bind(getChunk: GetChunkFn, getMeta: GetMetaFn): void {
    this.getChunk = getChunk;
    this.getMeta = getMeta;
  }

  async open(): Promise<void> {
    await this.store.open();
    const version = (await this.store.get("meta", "__format")) as { version: number } | undefined;
    if (version && version.version !== SAVE_FORMAT)
      throw new Error(
        "This world uses an incompatible save format. Create a new world or explicitly delete the old one.",
      );
    await this.store.save([
      { collection: "meta", key: "__format", value: { version: SAVE_FORMAT } },
    ]);
  }

  /** Roll back dirty bookkeeping when synchronous chunk publication fails. */
  publishing<T>(publish: () => T): T {
    const records = new Map(this.dirtyRecords),
      chunks = new Set(this.dirtyChunks),
      players = new Map(this.dirtyPlayers),
      meta = this.metaDirty;
    try {
      return publish();
    } catch (error) {
      this.dirtyRecords = records;
      this.dirtyChunks = chunks;
      this.dirtyPlayers = players;
      this.metaDirty = meta;
      throw error;
    }
  }

  markRecordDirty(collection: string, key: string, snapshot: () => SaveEntry): void {
    this.dirtyRecords.set(JSON.stringify([collection, key]), snapshot);
    this.scheduleSave();
  }

  async loadRecords(collection: string, scope?: string): Promise<Map<string, unknown>> {
    if (scope !== undefined) return this.store.readScope(collection, scope);
    const result = new Map<string, unknown>();
    let after: string | undefined;
    for (;;) {
      const page = await this.store.scan(collection, scope, after);
      for (const [key, value] of page) {
        result.set(key, value);
        after = key;
      }
      if (page.size < 256) return result;
    }
  }

  async loadChunk(key: string): Promise<SavedChunkData | undefined> {
    const value = (await this.store.get(STORE_CHUNKS, key)) as
      | { subgrid: ArrayBuffer; roadGrid?: ArrayBuffer; heightGrid?: ArrayBuffer }
      | undefined;
    if (!value) return undefined;
    return {
      subgrid: new Uint8Array(value.subgrid),
      roadGrid: value.roadGrid ? new Uint8Array(value.roadGrid) : new Uint8Array(0),
      heightGrid: value.heightGrid ? new Uint8Array(value.heightGrid) : new Uint8Array(0),
    };
  }

  /** A finite barrier: new mutations made during the write belong to the next save. */
  async flushSnapshot(): Promise<void> {
    await this.pending;
    this.flush();
    await this.pending;
    if (this.saveFailed) throw new Error("Could not save world state.", { cause: this.saveError });
  }

  dirtyInScope(scope: string): boolean {
    if (this.dirtyChunks.has(scope)) return true;
    for (const snapshot of this.dirtyRecords.values()) if (snapshot().scope === scope) return true;
    return false;
  }

  async loadMeta(): Promise<SavedMeta | null> {
    const raw = await this.store.get(STORE_META, "state");
    return (raw as SavedMeta) ?? null;
  }

  async loadPlayerData(playerId: string): Promise<SavedPlayerData | null> {
    const raw = await this.store.get(STORE_PLAYERS, playerId);
    return (raw as SavedPlayerData) ?? null;
  }

  markPlayerDirty(playerId: string, data: SavedPlayerData): void {
    this.dirtyPlayers.set(playerId, data);
    this.scheduleSave();
  }

  markChunkDirty(key: string): void {
    this.dirtyChunks.add(key);
    this.scheduleSave();
  }

  markMetaDirty(): void {
    this.metaDirty = true;
    this.scheduleSave();
  }

  /** Returns true if there are pending dirty items. */
  get hasDirty(): boolean {
    return (
      this.dirtyRecords.size > 0 ||
      this.dirtyChunks.size > 0 ||
      this.dirtyPlayers.size > 0 ||
      this.metaDirty
    );
  }

  /** Schedule a debounced save. */
  private scheduleSave(): void {
    if (this.saveTimer !== null) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.doSave();
    }, SAVE_DEBOUNCE_MS);
  }

  /** Flush immediately (e.g., on visibilitychange → hidden). */
  flush(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.hasDirty) {
      this.doSave();
    }
  }

  /** Finite barrier for mutations preceding this call; live producers may continue. */
  async flushAsync(): Promise<void> {
    await this.flushSnapshot();
  }

  /** Related realm changes in one physical world share one atomic commit. */
  static async flushTogether(managers: readonly SaveManager[]): Promise<void> {
    const unique = [...new Set(managers)];
    if (!unique.length) return;
    await Promise.all(unique.map((manager) => manager.pending));
    const first = unique[0]?.store;
    if (
      !(first instanceof RealmStore) ||
      unique.some(
        (manager) =>
          !(manager.store instanceof RealmStore) || manager.store.physical !== first.physical,
      )
    ) {
      await Promise.all(unique.map((manager) => manager.flushSnapshot()));
      return;
    }
    const batches: { manager: SaveManager; batch: SaveBatch }[] = [];
    try {
      for (const manager of unique) {
        const batch = manager.capture();
        if (batch) batches.push({ manager, batch });
      }
    } catch (error) {
      for (const { manager, batch } of batches) manager.failed(batch, error);
      throw error;
    }
    const entries = batches.flatMap(({ manager, batch }) =>
      (manager.store as RealmStore).encode(batch.entries),
    );
    if (!entries.length) return;
    const saving = first.physical.save(entries);
    for (const { manager, batch } of batches) manager.follow(batch, saving);
    await Promise.all(batches.map(({ manager }) => manager.pending));
    for (const { manager } of batches)
      if (manager.saveFailed)
        throw new Error("Could not save realm transfer.", { cause: manager.saveError });
  }

  private failed(batch: SaveBatch, error: unknown): void {
    batch.restore();
    this.saving = false;
    this.saveFailed = true;
    this.saveError = error;
    this.scheduleSave();
  }
  private follow(batch: SaveBatch, saving: Promise<void>): void {
    this.pending = saving.then(
      () => {
        this.saving = false;
        this.saveFailed = false;
        this.saveError = undefined;
      },
      (error) => this.failed(batch, error),
    );
  }
  private doSave(): void {
    let batch: SaveBatch | undefined;
    try {
      batch = this.capture();
    } catch (error) {
      this.saveFailed = true;
      this.saveError = error;
      this.scheduleSave();
      return;
    }
    if (batch) this.follow(batch, this.store.save(batch.entries));
  }

  private capture(): SaveBatch | undefined {
    if (this.saving || !this.getChunk || !this.getMeta || !this.hasDirty) return undefined;
    this.saving = true;
    const records = this.dirtyRecords,
      chunks = this.dirtyChunks,
      players = this.dirtyPlayers,
      meta = this.metaDirty;
    this.dirtyRecords = new Map();
    this.dirtyChunks = new Set();
    this.dirtyPlayers = new Map();
    this.metaDirty = false;
    const batch: SaveBatch = {
      entries: [],
      restore: () => {
        for (const [key, snapshot] of records)
          if (!this.dirtyRecords.has(key)) this.dirtyRecords.set(key, snapshot);
        for (const key of chunks) this.dirtyChunks.add(key);
        for (const [key, data] of players)
          if (!this.dirtyPlayers.has(key)) this.dirtyPlayers.set(key, data);
        this.metaDirty ||= meta;
      },
    };
    try {
      for (const snapshot of records.values()) batch.entries.push(snapshot());
      for (const key of chunks) {
        const data = this.getChunk(key);
        if (!data) throw new Error(`Dirty chunk ${key} was released before saving.`);
        batch.entries.push({
          collection: STORE_CHUNKS,
          key,
          value: {
            subgrid: new Uint8Array(data.subgrid).buffer,
            ...(data.roadGrid.some((v) => v !== 0)
              ? { roadGrid: new Uint8Array(data.roadGrid).buffer }
              : {}),
            ...(data.heightGrid.some((v) => v !== 0)
              ? { heightGrid: new Uint8Array(data.heightGrid).buffer }
              : {}),
          },
        });
      }
      for (const [key, value] of players)
        batch.entries.push({ collection: STORE_PLAYERS, key, value });
      if (meta) batch.entries.push({ collection: STORE_META, key: "state", value: this.getMeta() });
      return batch;
    } catch (error) {
      this.failed(batch, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }

  async close(): Promise<void> {
    await this.flushAsync();
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.store.close();
    this.dirtyRecords.clear();
    this.dirtyChunks.clear();
    this.dirtyPlayers.clear();
    this.metaDirty = false;
    this.getChunk = null;
    this.getMeta = null;
  }
}
