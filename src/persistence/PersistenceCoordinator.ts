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
  private sequence = 0;
  private generation = 0;
  private readers = new Map<string, Set<{ latest?: RecordMutation }>>();
  error: unknown;
  readonly metrics = { commits: 0, recordsWritten: 0, bytesWritten: 0, highWaterBytes: 0 };

  constructor(
    readonly store: RecordStore,
    readonly limits = { records: 2048, bytes: 32 * 1024 * 1024 },
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
    const next = new Map(this.pending);
    for (const mutation of structuredClone(mutations)) {
      if ("put" in mutation) mutation.put.revision = ++this.sequence;
      next.set(mutationAddress(mutation), mutation);
    }
    const bytes = this.bytes(next) + this.bytes(this.inFlight);
    if (next.size + this.inFlight.size > this.limits.records || bytes > this.limits.bytes)
      throw new SavePressureError("Save queue is full; wait for storage before accepting edits.");
    this.pending = next;
    for (const mutation of mutations) {
      const address = mutationAddress(mutation);
      const accepted = next.get(address);
      if (accepted) for (const reader of this.readers.get(address) ?? []) reader.latest = accepted;
    }
    this.generation++;
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

  /** Merge pending location changes/deletes; caller fences multi-page hydration. */
  async scan(query: RecordQuery): Promise<StoredRecord[]> {
    const generation = this.generation;
    const records = new Map<string, StoredRecord>();
    let after = query.after;
    // Deleted/moved pending records can hide physical rows: fill the requested page.
    for (;;) {
      const page = await this.store.scan({ ...query, ...(after === undefined ? {} : { after }) });
      for (const record of page) records.set(record.key, record);
      for (const mutation of [...this.inFlight.values(), ...this.pending.values()]) {
        const ref = "put" in mutation ? mutation.put : mutation.delete;
        if (ref.collection !== query.collection) continue;
        records.delete(ref.key);
        if (
          "put" in mutation &&
          (query.scope === undefined || mutation.put.scope === query.scope) &&
          (query.after === undefined || ref.key > query.after)
        )
          records.set(ref.key, mutation.put);
      }
      if (generation !== this.generation) throw new Error("Spatial query superseded; retry.");
      const sorted = [...records.keys()].sort();
      const last = page.at(-1)?.key;
      const cutoff = sorted[query.limit - 1];
      if (page.length < query.limit || (last && cutoff && cutoff <= last)) break;
      after = page.at(-1)?.key;
    }
    return structuredClone(
      [...records.values()]
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .slice(0, query.limit),
    );
  }

  /** Drains all accepted mutations. Failure retains the newest state for retry. */
  flush(): Promise<void> {
    if (this.writing) return this.writing;
    this.writing = this.drain().finally(() => {
      this.writing = undefined;
    });
    return this.writing;
  }
  private async drain(): Promise<void> {
    while (this.pending.size) {
      this.inFlight = this.pending;
      this.pending = new Map();
      try {
        await this.store.commit([...this.inFlight.values()]);
        this.metrics.commits++;
        this.generation++;
        this.metrics.recordsWritten += this.inFlight.size;
        this.metrics.bytesWritten += this.bytes(this.inFlight);
        this.error = undefined;
      } catch (error) {
        for (const [key, value] of this.inFlight)
          if (!this.pending.has(key)) this.pending.set(key, value);
        this.error = error;
        throw error;
      } finally {
        this.inFlight.clear();
      }
    }
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.flush();
    await this.store.close();
  }
}
