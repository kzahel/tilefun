import type { PersistenceStore, SaveEntry } from "./PersistenceStore.js";

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
  traffic?: import("../traffic/TrafficSystem.js").SavedTraffic[];
  roomPlan?: import("../interiors/GameplayRoom.js").GameplayRoomState;
  interior?: import("../interiors/GameplayInterior.js").InteriorIdentity;
  deletedProceduralIds?: string[];
  proceduralEdits?: SerializedEntity[];
  playerX: number;
  playerY: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  entities?: SerializedEntity[];
  nextEntityId?: number;
  /** Total gems collected (absent in older saves → defaults to 0). */
  gemsCollected?: number;
}

export interface SavedPlayerData {
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

  /** Bind the data accessors once so scheduleSave/flush can use them. */
  bind(getChunk: GetChunkFn, getMeta: GetMetaFn): void {
    this.getChunk = getChunk;
    this.getMeta = getMeta;
  }

  async open(): Promise<void> {
    await this.store.open();
    const version = (await this.store.get("meta", "__format")) as { version: number } | undefined;
    if (version && version.version !== 2)
      throw new Error(
        "This world uses an incompatible save format. Create a new world or explicitly delete the old one.",
      );
    await this.store.save([{ collection: "meta", key: "__format", value: { version: 2 } }]);
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

  /** Drain pending writes before deleting a world or closing a durable store. */
  async flushAsync(): Promise<void> {
    this.flush();
    await this.pending;
    if (this.saveFailed) throw new Error("Could not save world state.", { cause: this.saveError });
    while (this.hasDirty) {
      this.flush();
      await this.pending;
      if (this.saveFailed)
        throw new Error("Could not save world state.", { cause: this.saveError });
    }
  }

  /** Callback invoked after each save with the chunk keys that were written. */
  onChunksSaved: ((keys: string[], getChunk: GetChunkFn) => void) | null = null;

  private doSave(): void {
    if (this.saving) return;
    if (!this.getChunk || !this.getMeta) return;
    if (!this.hasDirty) return;

    this.saving = true;
    const recordEntries = this.dirtyRecords;
    this.dirtyRecords = new Map();
    const chunkKeys = [...this.dirtyChunks];
    this.dirtyChunks.clear();
    const playerEntries = new Map(this.dirtyPlayers);
    this.dirtyPlayers.clear();
    const saveMeta = this.metaDirty;
    this.metaDirty = false;

    const getChunk = this.getChunk,
      getMeta = this.getMeta;
    const snapshots = new Map<string, SavedChunkData>();
    this.pending = Promise.resolve()
      .then(async () => {
        const entries: SaveEntry[] = [...recordEntries.values()].map((snapshot) => snapshot());

        for (const key of chunkKeys) {
          const data = getChunk(key);
          if (data) {
            const record: {
              subgrid: ArrayBuffer;
              roadGrid?: ArrayBuffer;
              heightGrid?: ArrayBuffer;
            } = {
              subgrid: new Uint8Array(data.subgrid).buffer,
            };
            // Only store roadGrid if it has non-zero data
            if (data.roadGrid.some((v) => v !== 0)) {
              record.roadGrid = new Uint8Array(data.roadGrid).buffer;
            }
            if (data.heightGrid.some((v) => v !== 0)) {
              record.heightGrid = new Uint8Array(data.heightGrid).buffer;
            }
            snapshots.set(key, {
              subgrid: new Uint8Array(record.subgrid),
              roadGrid: new Uint8Array(data.roadGrid),
              heightGrid: new Uint8Array(data.heightGrid),
            });
            entries.push({ collection: STORE_CHUNKS, key, value: record });
          }
        }

        for (const [playerId, data] of playerEntries) {
          entries.push({ collection: STORE_PLAYERS, key: playerId, value: data });
        }

        if (saveMeta) {
          entries.push({ collection: STORE_META, key: "state", value: getMeta() });
        }

        this.saveFailed = false;
        await this.store.save(entries);
      })
      .then(
        () => {
          this.saving = false;
          if (this.onChunksSaved && this.getChunk) {
            this.onChunksSaved(chunkKeys, (key) => snapshots.get(key));
          }
        },
        (error) => {
          this.saving = false;
          this.saveError = error;
          this.saveFailed = true;
          for (const [key, snapshot] of recordEntries)
            if (!this.dirtyRecords.has(key)) this.dirtyRecords.set(key, snapshot);
          // Re-mark as dirty so next save attempt includes them
          for (const key of chunkKeys) this.dirtyChunks.add(key);
          for (const [id, data] of playerEntries) {
            if (!this.dirtyPlayers.has(id)) this.dirtyPlayers.set(id, data);
          }
          if (saveMeta) this.metaDirty = true;
        },
      );
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
    this.onChunksSaved = null;
  }
}
