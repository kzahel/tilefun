const REGISTRY_DB = "tilefun-registry";
const REGISTRY_VERSION = 1;
const STORE_WORLDS = "worlds";

export type WorldType = "generated" | "flat" | "island";

export interface WorldMeta {
  id: string;
  name: string;
  createdAt: number;
  lastPlayedAt: number;
  /** Noise seed for generated worlds. Missing = 42 (back-compat). */
  seed?: number;
  /** World generation type. Missing = "generated" (back-compat). */
  worldType?: WorldType;
}

export function dbNameForWorld(id: string): string {
  return `tilefun-world-${id}`;
}

export class WorldRegistry {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(REGISTRY_DB, REGISTRY_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_WORLDS)) {
          db.createObjectStore(STORE_WORLDS, { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async listWorlds(): Promise<WorldMeta[]> {
    const db = this.db;
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WORLDS, "readonly");
      const store = tx.objectStore(STORE_WORLDS);
      const req = store.getAll();
      req.onsuccess = () => {
        const worlds = req.result as WorldMeta[];
        worlds.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
        resolve(worlds);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getWorld(id: string): Promise<WorldMeta | undefined> {
    const db = this.db;
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WORLDS, "readonly");
      const req = tx.objectStore(STORE_WORLDS).get(id);
      req.onsuccess = () => resolve(req.result as WorldMeta | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async createWorld(
    name: string,
    worldType: WorldType = "generated",
    seed?: number,
  ): Promise<WorldMeta> {
    const db = this.db;
    if (!db) throw new Error("Registry not open");
    const now = Date.now();
    const meta: WorldMeta = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      lastPlayedAt: now,
      seed: seed ?? Math.floor(Math.random() * 2147483647),
      worldType,
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WORLDS, "readwrite");
      tx.objectStore(STORE_WORLDS).put(meta);
      tx.oncomplete = () => resolve(meta);
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateLastPlayed(id: string): Promise<void> {
    const db = this.db;
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WORLDS, "readwrite");
      const store = tx.objectStore(STORE_WORLDS);
      const req = store.get(id);
      req.onsuccess = () => {
        const meta = req.result as WorldMeta | undefined;
        if (meta) {
          meta.lastPlayedAt = Date.now();
          store.put(meta);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async renameWorld(id: string, name: string): Promise<void> {
    const db = this.db;
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WORLDS, "readwrite");
      const store = tx.objectStore(STORE_WORLDS);
      const req = store.get(id);
      req.onsuccess = () => {
        const meta = req.result as WorldMeta | undefined;
        if (meta) {
          meta.name = name;
          store.put(meta);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteWorld(id: string): Promise<void> {
    const db = this.db;
    if (!db) return;
    // Remove from registry
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_WORLDS, "readwrite");
      tx.objectStore(STORE_WORLDS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // Delete the per-world database
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbNameForWorld(id));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
