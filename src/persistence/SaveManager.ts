const DB_NAME = "tilefun";
const DB_VERSION = 1;
const STORE_CHUNKS = "chunks";
const STORE_META = "meta";
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
}

type GetChunkFn = (key: string) => Uint8Array | undefined;
type GetMetaFn = () => SavedMeta;

export class SaveManager {
  private db: IDBDatabase | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirtyChunks = new Set<string>();
  private metaDirty = false;
  private saving = false;
  private getChunk: GetChunkFn | null = null;
  private getMeta: GetMetaFn | null = null;

  /** Bind the data accessors once so scheduleSave/flush can use them. */
  bind(getChunk: GetChunkFn, getMeta: GetMetaFn): void {
    this.getChunk = getChunk;
    this.getMeta = getMeta;
  }

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          db.createObjectStore(STORE_CHUNKS);
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async loadChunks(): Promise<Map<string, Uint8Array>> {
    const db = this.db;
    if (!db) return new Map();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHUNKS, "readonly");
      const store = tx.objectStore(STORE_CHUNKS);
      const req = store.openCursor();
      const result = new Map<string, Uint8Array>();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const value = cursor.value as { subgrid: ArrayBuffer };
          result.set(cursor.key as string, new Uint8Array(value.subgrid));
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async loadMeta(): Promise<SavedMeta | null> {
    const db = this.db;
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, "readonly");
      const store = tx.objectStore(STORE_META);
      const req = store.get("state");
      req.onsuccess = () => resolve((req.result as SavedMeta) ?? null);
      req.onerror = () => reject(req.error);
    });
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
    return this.dirtyChunks.size > 0 || this.metaDirty;
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
    const db = this.db;
    if (!db || this.saving) return;
    if (!this.getChunk || !this.getMeta) return;
    if (!this.hasDirty) return;

    this.saving = true;
    const chunkKeys = [...this.dirtyChunks];
    this.dirtyChunks.clear();
    const saveMeta = this.metaDirty;
    this.metaDirty = false;

    const tx = db.transaction([STORE_CHUNKS, STORE_META], "readwrite");
    const chunkStore = tx.objectStore(STORE_CHUNKS);
    const metaStore = tx.objectStore(STORE_META);

    for (const key of chunkKeys) {
      const subgrid = this.getChunk(key);
      if (subgrid) {
        chunkStore.put({ subgrid: subgrid.buffer.slice(0) }, key);
      }
    }

    if (saveMeta) {
      metaStore.put(this.getMeta(), "state");
    }

    tx.oncomplete = () => {
      this.saving = false;
      if (this.onChunksSaved && this.getChunk) {
        this.onChunksSaved(chunkKeys, this.getChunk);
      }
    };
    tx.onerror = () => {
      this.saving = false;
      // Re-mark as dirty so next save attempt includes them
      for (const key of chunkKeys) this.dirtyChunks.add(key);
      if (saveMeta) this.metaDirty = true;
    };
  }

  async clear(): Promise<void> {
    const db = this.db;
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CHUNKS, STORE_META], "readwrite");
      tx.objectStore(STORE_CHUNKS).clear();
      tx.objectStore(STORE_META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
