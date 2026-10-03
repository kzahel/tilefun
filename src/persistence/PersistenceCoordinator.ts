import { PERSISTENCE_BUDGET } from "./PersistenceBudget.js";
import {
  mutationAddress,
  type RecordMutation,
  type RecordQuery,
  type RecordStore,
  recordBytes,
  type StoredRecord,
} from "./RecordStore.js";

export class SavePressureError extends Error {}

/** One coordinator on every host. Only the executor is platform-specific. */
export class PersistenceCoordinator {
  private pending = new Map<string, RecordMutation>();
  private inFlight = new Map<string, RecordMutation>();
  private writing: Promise<void> | undefined;
  private closing = false;
  private acceptedEpoch = 0;
  private committedEpoch = 0;
  private barriers = new Set<{
    epoch: number;
    resolve: () => void;
    reject: (error: unknown) => void;
  }>();
  private sequence = 0;
  private queries = new Set<{
    collection: string;
    mutations: Map<string, RecordMutation>;
    overflow: boolean;
  }>();
  private readers = new Map<string, Set<{ latest?: RecordMutation }>>();
  private dirtySince = 0;
  get oldestPendingMs(): number {
    return this.dirtySince ? Date.now() - this.dirtySince : 0;
  }
  error: unknown;
  readonly metrics = {
    commits: 0,
    recordsWritten: 0,
    bytesWritten: 0,
    highWaterBytes: 0,
    highWaterRecords: 0,
    indexPages: 0,
    lastCommitMs: 0,
    maxCommitMs: 0,
  };

  constructor(
    readonly store: RecordStore,
    readonly limits = {
      records: PERSISTENCE_BUDGET.queueRecords as number,
      bytes: PERSISTENCE_BUDGET.queueBytes as number,
    },
  ) {}

  get dirty(): boolean {
    return this.pending.size > 0 || this.inFlight.size > 0;
  }
  get pendingRecords(): number {
    return this.pending.size + this.inFlight.size;
  }
  get pendingBytes(): number {
    return this.bytes(this.pending) + this.bytes(this.inFlight);
  }
  private bytes(records: Map<string, RecordMutation>): number {
    let bytes = 0;
    for (const value of records.values()) bytes += recordBytes(value);
    return bytes;
  }

  /** Immutable all-or-nothing admission; rejects before changing accepted state. */
  stage(mutations: readonly RecordMutation[]): void {
    if (this.closing) throw new Error("World is closing.");
    if (!mutations.length) return;
    const next = new Map(this.pending);
    for (const mutation of structuredClone(mutations)) {
      if ("put" in mutation) mutation.put.revision = ++this.sequence;
      next.set(mutationAddress(mutation), mutation);
    }
    const bytes = this.bytes(next) + this.bytes(this.inFlight);
    if (next.size + this.inFlight.size > this.limits.records || bytes > this.limits.bytes)
      throw new SavePressureError("Save queue is full; wait for storage before accepting edits.");
    if (!this.dirtySince) this.dirtySince = Date.now();
    this.pending = next;
    this.acceptedEpoch++;
    for (const mutation of mutations) {
      const address = mutationAddress(mutation);
      const accepted = next.get(address);
      if (accepted) for (const reader of this.readers.get(address) ?? []) reader.latest = accepted;
    }
    for (const query of this.queries)
      for (const mutation of next.values()) {
        const ref = "put" in mutation ? mutation.put : mutation.delete;
        if (ref.collection !== query.collection || query.overflow) continue;
        query.mutations.set(ref.key, mutation);
        if (query.mutations.size > PERSISTENCE_BUDGET.queryChanges) {
          query.overflow = true;
          query.mutations.clear();
        }
      }
    this.metrics.highWaterRecords = Math.max(this.metrics.highWaterRecords, this.pendingRecords);
    this.metrics.highWaterBytes = Math.max(this.metrics.highWaterBytes, bytes);
  }

  async read(collection: string, key: string): Promise<StoredRecord | undefined> {
    const address = JSON.stringify([collection, key]);
    const mutation = this.pending.get(address) ?? this.inFlight.get(address);
    if (mutation) return structuredClone("put" in mutation ? mutation.put : undefined);
    const reader: { latest?: RecordMutation } = {};
    const readers = this.readers.get(address) ?? new Set();
    this.readers.set(address, readers);
    readers.add(reader);
    try {
      const stored = await this.store.read(collection, key);
      return reader.latest
        ? structuredClone("put" in reader.latest ? reader.latest.put : undefined)
        : stored;
    } finally {
      readers.delete(reader);
      if (!readers.size) this.readers.delete(address);
    }
  }

  /** A live query token preserves intervening moves/deletes even after commit
   * removes them from the pending maps. No world-wide version invalidates an
   * unrelated load. Tokens exist only for the bounded duration of this query. */
  private async query(
    query: RecordQuery,
    maximum: number,
    entireScope: boolean,
  ): Promise<StoredRecord[]> {
    const observer = {
      collection: query.collection,
      mutations: new Map<string, RecordMutation>(),
      overflow: false,
    };
    for (const mutation of [...this.inFlight.values(), ...this.pending.values()]) {
      const ref = "put" in mutation ? mutation.put : mutation.delete;
      if (ref.collection === query.collection) observer.mutations.set(ref.key, mutation);
      if (observer.mutations.size > PERSISTENCE_BUDGET.queryChanges)
        throw new SavePressureError("Spatial query changed too much; retry after saving.");
    }
    this.queries.add(observer);
    const records = new Map<string, StoredRecord>();
    let after = query.after;
    try {
      for (;;) {
        this.metrics.indexPages++;
        const page = await this.store.scan({ ...query, ...(after === undefined ? {} : { after }) });
        for (const record of page) records.set(record.key, record);
        if (observer.overflow)
          throw new SavePressureError("Spatial query changed too much; retry after saving.");
        for (const [key, mutation] of observer.mutations) {
          records.delete(key);
          if (
            "put" in mutation &&
            (query.scope === undefined || mutation.put.scope === query.scope) &&
            (query.after === undefined || key > query.after)
          )
            records.set(key, mutation.put);
        }
        if (
          entireScope &&
          (records.size > maximum ||
            recordBytes([...records.values()]) > PERSISTENCE_BUDGET.scopeBytes)
        )
          throw new SavePressureError("Chunk exceeds the actor load budget.");
        const sorted = [...records.keys()].sort();
        const last = page.at(-1)?.key,
          cutoff = sorted[maximum - 1];
        if (page.length < query.limit || (!entireScope && last && cutoff && cutoff <= last)) break;
        after = last;
      }
      return structuredClone(
        [...records.values()]
          .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
          .slice(0, maximum),
      );
    } finally {
      this.queries.delete(observer);
    }
  }

  async scan(query: RecordQuery): Promise<StoredRecord[]> {
    return this.query(query, query.limit, false);
  }
  async readScope(
    collection: string,
    scope: string,
    maximum = PERSISTENCE_BUDGET.scopeRecords as number,
  ): Promise<StoredRecord[]> {
    return this.query({ collection, scope, limit: 64 }, maximum, true);
  }

  /** A finite acknowledgement barrier, even when another realm keeps producing. */
  flush(): Promise<void> {
    if (this.committedEpoch >= this.acceptedEpoch) return Promise.resolve();
    const barrier = new Promise<void>((resolve, reject) => {
      this.barriers.add({ epoch: this.acceptedEpoch, resolve, reject });
    });
    this.startWriter();
    return barrier;
  }
  private startWriter(): void {
    if (this.writing) return;
    this.writing = this.drain()
      .catch((error) => {
        for (const barrier of this.barriers) barrier.reject(error);
        this.barriers.clear();
      })
      .finally(() => {
        this.writing = undefined;
        if (this.barriers.size) this.startWriter();
      });
  }
  private async drain(): Promise<void> {
    while (this.pending.size) {
      const epoch = this.acceptedEpoch;
      this.inFlight = this.pending;
      this.pending = new Map();
      try {
        const start = performance.now();
        await this.store.commit([...this.inFlight.values()]);
        this.metrics.lastCommitMs = performance.now() - start;
        this.metrics.maxCommitMs = Math.max(this.metrics.maxCommitMs, this.metrics.lastCommitMs);
        this.metrics.commits++;
        this.metrics.recordsWritten += this.inFlight.size;
        this.metrics.bytesWritten += this.bytes(this.inFlight);
        this.error = undefined;
        this.committedEpoch = epoch;
        for (const barrier of this.barriers)
          if (barrier.epoch <= epoch) {
            this.barriers.delete(barrier);
            barrier.resolve();
          }
      } catch (error) {
        for (const [key, value] of this.inFlight)
          if (!this.pending.has(key)) this.pending.set(key, value);
        this.error = error;
        throw error;
      } finally {
        this.inFlight.clear();
        if (!this.pending.size) this.dirtySince = 0;
      }
    }
  }

  async close(): Promise<void> {
    this.closing = true;
    try {
      await this.flush();
      await this.writing;
      await this.store.close();
    } catch (error) {
      this.closing = false;
      throw error;
    }
  }
}
