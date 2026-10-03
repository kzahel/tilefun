import {
  type RecordMutation,
  type RecordQuery,
  type RecordStore,
  recordAddress,
  type StoredRecord,
  validateQuery,
} from "./RecordStore.js";

/** Transactional reference executor, also used for deterministic fault tests. */
export class MemoryRecordStore implements RecordStore {
  readonly records = new Map<string, StoredRecord>();
  beforeCommit?: (mutations: readonly RecordMutation[]) => Promise<void>;
  commits = 0;
  recordsWritten = 0;
  async open(): Promise<void> {}
  async close(): Promise<void> {}
  async read(collection: string, key: string): Promise<StoredRecord | undefined> {
    return structuredClone(this.records.get(recordAddress({ collection, key })));
  }
  async scan(query: RecordQuery): Promise<StoredRecord[]> {
    validateQuery(query);
    return structuredClone(
      [...this.records.values()]
        .filter(
          (r) =>
            r.collection === query.collection &&
            (query.scope === undefined || r.scope === query.scope) &&
            (query.after === undefined || r.key > query.after),
        )
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .slice(0, query.limit),
    );
  }
  async commit(mutations: readonly RecordMutation[]): Promise<void> {
    const snapshot = structuredClone(mutations);
    await this.beforeCommit?.(snapshot);
    for (const mutation of snapshot) {
      if ("put" in mutation) this.records.set(recordAddress(mutation.put), mutation.put);
      else this.records.delete(recordAddress(mutation.delete));
    }
    this.commits++;
    this.recordsWritten += mutations.length;
  }
}
