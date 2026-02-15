import type { PersistenceStore, SaveEntry } from "./PersistenceStore.js";

const DB_VERSION = 2;

/**
 * IndexedDB implementation of PersistenceStore.
 * Each collection maps to an IDB object store.
 */
export class IdbPersistenceStore implements PersistenceStore {
  private db: IDBDatabase | null = null;

  constructor(
    private readonly dbName: string,
    private readonly collections: string[],
  ) {}

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of this.collections) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
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

  async get(collection: string, key: string): Promise<unknown> {
    const db = this.db;
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(collection, "readonly");
      const req = tx.objectStore(collection).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(collection: string): Promise<Map<string, unknown>> {
    const db = this.db;
    if (!db) return new Map();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(collection, "readonly");
      const store = tx.objectStore(collection);
      const req = store.openCursor();
      const result = new Map<string, unknown>();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          result.set(cursor.key as string, cursor.value);
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async save(entries: SaveEntry[]): Promise<void> {
    const db = this.db;
    if (!db || entries.length === 0) return;
    const collections = [...new Set(entries.map((e) => e.collection))];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(collections, "readwrite");
      for (const entry of entries) {
        tx.objectStore(entry.collection).put(entry.value, entry.key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    const db = this.db;
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.collections, "readwrite");
      for (const name of this.collections) {
        tx.objectStore(name).clear();
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
