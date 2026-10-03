import type { RecordMutation, RecordQuery, RecordStore, StoredRecord } from "./RecordStore.js";
import { validateQuery } from "./RecordStore.js";

/** Thin IndexedDB executor: record envelopes and indices only, no game policy. */
export class IdbRecordStore implements RecordStore {
  private db: IDBDatabase | undefined;
  private release: (() => void) | undefined;
  private lease: Promise<void> | undefined;
  constructor(
    readonly name: string,
    private readonly readOnly = false,
  ) {}

  async open(): Promise<void> {
    if (this.db) return;
    const held = new Promise<void>((resolve) => {
      this.release = resolve;
    });
    if (!this.readOnly)
      await new Promise<void>((resolve, reject) => {
        this.lease = navigator.locks.request(
          `tilefun-writer:${this.name}`,
          { ifAvailable: true },
          async (lock) => {
            if (!lock) {
              reject(new Error("World is already open in another authority."));
              return;
            }
            resolve();
            await held;
          },
        );
        void this.lease.catch(reject);
      });
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(this.name, 1);
        request.onupgradeneeded = () => {
          const records = request.result.createObjectStore("records", {
            keyPath: ["collection", "key"],
          });
          records.createIndex("scope", ["collection", "scope", "key"]);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("World database upgrade is blocked."));
      });
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  private transaction(mode: IDBTransactionMode): IDBTransaction {
    if (!this.db) throw new Error("Storage is not open.");
    return this.db.transaction("records", mode);
  }
  async read(collection: string, key: string): Promise<StoredRecord | undefined> {
    const tx = this.transaction("readonly");
    const request = tx.objectStore("records").get([collection, key]);
    await this.complete(tx);
    return request.result as StoredRecord | undefined;
  }
  async scan(query: RecordQuery): Promise<StoredRecord[]> {
    validateQuery(query);
    const tx = this.transaction("readonly");
    const store = tx.objectStore("records");
    const prefix = query.scope === undefined ? [query.collection] : [query.collection, query.scope];
    const range = IDBKeyRange.bound([...prefix, query.after ?? ""], [...prefix, []], true, true);
    const source = query.scope === undefined ? store : store.index("scope");
    const request = source.getAll(range, query.limit);
    await this.complete(tx);
    return request.result as StoredRecord[];
  }
  async commit(mutations: readonly RecordMutation[]): Promise<void> {
    if (this.readOnly) throw new Error("Read-only storage.");
    const tx = this.transaction("readwrite");
    const completion = this.complete(tx);
    try {
      const store = tx.objectStore("records");
      for (const mutation of mutations) {
        if ("put" in mutation) store.put(mutation.put);
        else store.delete([mutation.delete.collection, mutation.delete.key]);
      }
    } catch (error) {
      tx.abort();
      await completion.catch(() => {});
      throw error;
    }
    await completion;
  }
  private complete(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Storage transaction aborted."));
      tx.onerror = () => reject(tx.error ?? new Error("Storage transaction failed."));
    });
  }
  async close(): Promise<void> {
    this.db?.close();
    this.db = undefined;
    this.release?.();
    await this.lease;
    this.release = undefined;
    this.lease = undefined;
  }
}
