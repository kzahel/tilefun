import {
  applyMigrations,
  CURRENT_SAVE_VERSION,
  FORMAT_VERSION_KEY,
  type FormatVersionRecord,
  MIGRATIONS,
} from "./migrations.js";
import type { PersistenceStore } from "./PersistenceStore.js";

const STORE_CHUNKS = "chunks";
const STORE_META = "meta";
const STORE_PLAYERS = "players";
const SAVE_DEBOUNCE_MS = 2000;

export interface SerializedEntity {
  type: string;
  wx: number;
  wy: number;
}

export interface SavedMeta {
  playerX: number;
  playerY: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  entities: SerializedEntity[];
  nextEntityId: number;
  /** Total gems collected (absent in older saves → defaults to 0). */
  gemsCollected?: number;
}

export interface SavedPlayerData {
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
  private dirtyChunks = new Set<string>();
  private dirtyPlayers = new Map<string, SavedPlayerData>();
  private metaDirty = false;
  private saving = false;
  private getChunk: GetChunkFn | null = null;
  private getMeta: GetMetaFn | null = null;

  constructor(private readonly store: PersistenceStore) {}

  /** Bind the data accessors once so scheduleSave/flush can use them. */
  bind(getChunk: GetChunkFn, getMeta: GetMetaFn): void {
    this.getChunk = getChunk;
    this.getMeta = getMeta;
  }

  async open(): Promise<void> {
    await this.store.open();
    await this.runMigrations();
    await this.store.save([
      {
        collection: STORE_META,
        key: FORMAT_VERSION_KEY,
        value: { version: CURRENT_SAVE_VERSION } satisfies FormatVersionRecord,
      },
    ]);
  }

  async loadChunks(): Promise<
    Map<string, { subgrid: Uint8Array; roadGrid: Uint8Array | null; heightGrid: Uint8Array | null }>
  > {
    const raw = await this.store.getAll(STORE_CHUNKS);
    const result = new Map<
      string,
      { subgrid: Uint8Array; roadGrid: Uint8Array | null; heightGrid: Uint8Array | null }
    >();
    for (const [key, value] of raw) {
      const v = value as {
        subgrid: ArrayBuffer;
        roadGrid?: ArrayBuffer;
        heightGrid?: ArrayBuffer;
      };
      result.set(key, {
        subgrid: new Uint8Array(v.subgrid),
        roadGrid: v.roadGrid ? new Uint8Array(v.roadGrid) : null,
        heightGrid: v.heightGrid ? new Uint8Array(v.heightGrid) : null,
      });
    }
    return result;
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
    return this.dirtyChunks.size > 0 || this.dirtyPlayers.size > 0 || this.metaDirty;
  }

  /** Schedule a debounced save. */
  private scheduleSave(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
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

  /** Callback invoked after each save with the chunk keys that were written. */
  onChunksSaved: ((keys: string[], getChunk: GetChunkFn) => void) | null = null;

  private doSave(): void {
    if (this.saving) return;
    if (!this.getChunk || !this.getMeta) return;
    if (!this.hasDirty) return;

    this.saving = true;
    const chunkKeys = [...this.dirtyChunks];
    this.dirtyChunks.clear();
    const playerEntries = new Map(this.dirtyPlayers);
    this.dirtyPlayers.clear();
    const saveMeta = this.metaDirty;
    this.metaDirty = false;

    const entries: { collection: string; key: string; value: unknown }[] = [];

    for (const key of chunkKeys) {
      const data = this.getChunk(key);
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
        entries.push({ collection: STORE_CHUNKS, key, value: record });
      }
    }

    for (const [playerId, data] of playerEntries) {
      entries.push({ collection: STORE_PLAYERS, key: playerId, value: data });
    }

    if (saveMeta) {
      entries.push({ collection: STORE_META, key: "state", value: this.getMeta() });
    }

    this.store.save(entries).then(
      () => {
        this.saving = false;
        if (this.onChunksSaved && this.getChunk) {
          this.onChunksSaved(chunkKeys, this.getChunk);
        }
      },
      () => {
        this.saving = false;
        // Re-mark as dirty so next save attempt includes them
        for (const key of chunkKeys) this.dirtyChunks.add(key);
        for (const [id, data] of playerEntries) {
          if (!this.dirtyPlayers.has(id)) this.dirtyPlayers.set(id, data);
        }
        if (saveMeta) this.metaDirty = true;
      },
    );
  }

  private async runMigrations(): Promise<void> {
    const raw = await this.store.get(STORE_META, FORMAT_VERSION_KEY);
    const record = raw as FormatVersionRecord | undefined;
    const version = record?.version ?? 1;

    if (version > CURRENT_SAVE_VERSION) {
      console.warn(
        `[tilefun] Save format v${version} is newer than app v${CURRENT_SAVE_VERSION}. ` +
          "Data may have been saved by a newer version.",
      );
      return;
    }
    if (version >= CURRENT_SAVE_VERSION) return;

    console.log(
      `[tilefun] Save format v${version} → v${CURRENT_SAVE_VERSION}, running migrations...`,
    );

    const rawMeta =
      ((await this.store.get(STORE_META, "state")) as Record<string, unknown>) ?? null;
    const rawChunks = (await this.store.getAll(STORE_CHUNKS)) as Map<
      string,
      Record<string, unknown>
    >;
    const result = applyMigrations(version, rawMeta, rawChunks, MIGRATIONS, CURRENT_SAVE_VERSION);

    const entries: { collection: string; key: string; value: unknown }[] = [];
    for (const [key, data] of result.chunks) {
      entries.push({ collection: STORE_CHUNKS, key, value: data });
    }
    if (result.meta) {
      entries.push({ collection: STORE_META, key: "state", value: result.meta });
    }
    entries.push({
      collection: STORE_META,
      key: FORMAT_VERSION_KEY,
      value: { version: result.version } satisfies FormatVersionRecord,
    });
    await this.store.save(entries);

    console.log(`[tilefun] Migrations complete. Save format is now v${CURRENT_SAVE_VERSION}.`);
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }

  close(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.store.close();
    this.dirtyChunks.clear();
    this.dirtyPlayers.clear();
    this.metaDirty = false;
    this.getChunk = null;
    this.getMeta = null;
    this.onChunksSaved = null;
  }
}
