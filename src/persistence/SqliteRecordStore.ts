import { Worker } from "node:worker_threads";
import { SavePressureError } from "./PersistenceCoordinator.js";
import type { RecordMutation, RecordQuery, RecordStore, StoredRecord } from "./RecordStore.js";
import { validateQuery } from "./RecordStore.js";

/** Blocking SQLite work and its writer lease live exclusively on the IO worker. */
export class SqliteRecordStore implements RecordStore {
  private worker: Worker | undefined;
  private sequence = 0;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  constructor(readonly directory: string) {}

  async open(): Promise<void> {
    if (this.worker) return;
    const worker = new Worker(new URL("./sqlite-record-worker.mjs", import.meta.url), {
      workerData: { directory: this.directory },
      execArgv: ["--experimental-sqlite"],
    });
    this.worker = worker;
    worker.on("message", (message: { id: number; value?: unknown; error?: string }) => {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error));
      else request.resolve(message.value);
    });
    const fail = (error: Error) => {
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
      if (this.worker === worker) this.worker = undefined;
    };
    worker.on("error", fail);
    worker.on("exit", (code) => fail(new Error(`Storage worker exited (${code}).`)));
    try {
      await this.request("open");
    } catch (error) {
      await worker.terminate();
      throw error;
    }
  }

  private request(operation: string, value?: unknown): Promise<unknown> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("Storage is not open."));
    if (this.pending.size >= 256)
      return Promise.reject(new SavePressureError("Storage request queue is full."));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        worker.postMessage({ id, operation, value });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  async read(collection: string, key: string): Promise<StoredRecord | undefined> {
    return (await this.request("read", { collection, key })) as StoredRecord | undefined;
  }
  async scan(query: RecordQuery): Promise<StoredRecord[]> {
    validateQuery(query);
    return (await this.request("scan", query)) as StoredRecord[];
  }
  async commit(mutations: readonly RecordMutation[]): Promise<void> {
    await this.request("commit", mutations);
  }
  async close(): Promise<void> {
    const worker = this.worker;
    if (!worker) return;
    await this.request("close");
    this.worker = undefined;
    await worker.terminate();
  }
}
