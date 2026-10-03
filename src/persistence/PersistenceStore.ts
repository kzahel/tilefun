/** A single entry to write: collection name, key, and opaque value. */
export interface SaveEntry {
  collection: string;
  key: string;
  value: unknown;
  scope?: string;
  deleted?: boolean;
}

/**
 * Generic key-value persistence store with named collections.
 * Knows nothing about game data — just stores and retrieves opaque values.
 *
 * Implemented by the shared record facade over IndexedDB or SQLite executors.
 */
export interface PersistenceStore {
  readonly health: {
    pendingRecords: number;
    pendingBytes: number;
    failed: boolean;
    oldestPendingMs: number;
    metrics: {
      commits: number;
      recordsWritten: number;
      bytesWritten: number;
      highWaterBytes: number;
      highWaterRecords: number;
      indexPages: number;
      lastCommitMs: number;
      maxCommitMs: number;
    };
  };
  open(): Promise<void>;
  close(): void | Promise<void>;

  /** Get a single value by collection and key. Returns undefined if not found. */
  get(collection: string, key: string): Promise<unknown>;

  /** Get all entries in a collection as a map of key → value. */
  getAll(collection: string): Promise<Map<string, unknown>>;

  /** Bounded spatial page, ordered by record key. */
  scan(
    collection: string,
    scope: string | undefined,
    after?: string,
    limit?: number,
  ): Promise<Map<string, unknown>>;

  /** Bounded whole-scope hydration with concurrent move/delete reconciliation. */
  readScope(collection: string, scope: string, maximum?: number): Promise<Map<string, unknown>>;

  /** Atomically write a batch of entries across any collections. */
  save(entries: SaveEntry[]): Promise<void>;

  /** Clear all data in all collections. */
  clear(): Promise<void>;
}
