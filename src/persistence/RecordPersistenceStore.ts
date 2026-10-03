import { PERSISTENCE_BUDGET } from "./PersistenceBudget.js";
import { PersistenceCoordinator } from "./PersistenceCoordinator.js";
import type { PersistenceStore, SaveEntry } from "./PersistenceStore.js";
import type { RecordStore } from "./RecordStore.js";

export const WORLD_COLLECTIONS = [
  "meta",
  "chunks",
  "players",
  "entities",
  "props",
  "features",
  "actorOrigins",
  "traffic",
];

/** Shared domain-facing facade; all adapters use exactly this coordination path. */
export class RecordPersistenceStore implements PersistenceStore {
  coordinator: PersistenceCoordinator;
  private closing: Promise<void> | undefined;
  constructor(
    readonly executor: RecordStore,
    private readonly collections = WORLD_COLLECTIONS,
  ) {
    this.coordinator = new PersistenceCoordinator(executor);
  }
  get health() {
    return {
      oldestPendingMs: this.coordinator.oldestPendingMs,
      metrics: { ...this.coordinator.metrics },
      pendingRecords: this.coordinator.pendingRecords,
      pendingBytes: this.coordinator.pendingBytes,
      failed: this.coordinator.error !== undefined,
    };
  }
  async open(): Promise<void> {
    if (this.closing) {
      await this.closing;
      this.closing = undefined;
      this.coordinator = new PersistenceCoordinator(this.executor);
    }
    await this.executor.open();
  }
  close(): Promise<void> {
    this.closing ??= this.coordinator.close().catch((error) => {
      this.closing = undefined;
      throw error;
    });
    return this.closing;
  }
  private validate(collection: string): void {
    let name = collection;
    if (collection.startsWith("[")) {
      const namespace = JSON.parse(collection) as unknown;
      if (
        !Array.isArray(namespace) ||
        namespace.length !== 2 ||
        typeof namespace[0] !== "string" ||
        !namespace[0] ||
        typeof namespace[1] !== "string"
      )
        throw new Error("Invalid realm namespace.");
      name = namespace[1];
    }
    if (!this.collections.includes(name)) throw new Error("Invalid collection.");
  }
  async get(collection: string, key: string): Promise<unknown> {
    this.validate(collection);
    return (await this.coordinator.read(collection, key))?.value;
  }
  async scan(
    collection: string,
    scope: string | undefined,
    after?: string,
    limit = 256,
  ): Promise<Map<string, unknown>> {
    this.validate(collection);
    const records = await this.coordinator.scan({
      collection,
      limit,
      ...(scope === undefined ? {} : { scope }),
      ...(after === undefined ? {} : { after }),
    });
    return new Map(records.map((r) => [r.key, r.value]));
  }
  async readScope(
    collection: string,
    scope: string,
    maximum = PERSISTENCE_BUDGET.scopeRecords as number,
  ): Promise<Map<string, unknown>> {
    this.validate(collection);
    return new Map(
      (await this.coordinator.readScope(collection, scope, maximum)).map((record) => [
        record.key,
        record.value,
      ]),
    );
  }
  /** Administrative/transitional enumeration only; streaming uses bounded scan. */
  async getAll(collection: string): Promise<Map<string, unknown>> {
    const result = new Map<string, unknown>();
    let after: string | undefined;
    for (;;) {
      const page = await this.scan(collection, undefined, after);
      for (const [key, value] of page) {
        result.set(key, value);
        after = key;
      }
      if (page.size < 256) return result;
    }
  }
  async save(entries: SaveEntry[]): Promise<void> {
    for (const entry of entries) this.validate(entry.collection);
    this.coordinator.stage(
      entries.map((entry) =>
        entry.deleted
          ? { delete: { collection: entry.collection, key: entry.key } }
          : {
              put: {
                collection: entry.collection,
                key: entry.key,
                value: entry.value,
                revision: 0,
                ...(entry.scope === undefined ? {} : { scope: entry.scope }),
              },
            },
      ),
    );
    await this.coordinator.flush();
  }
  async clear(): Promise<void> {
    for (const collection of this.collections) {
      for (;;) {
        const page = await this.scan(collection, undefined);
        if (!page.size) break;
        await this.save(
          [...page.keys()].map((key) => ({ collection, key, value: undefined, deleted: true })),
        );
      }
    }
  }
}
