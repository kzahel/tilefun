/** A single entry to write: collection name, key, and opaque value. */
export interface SaveEntry {
  collection: string;
  key: string;
  value: unknown;
}

/**
 * Generic key-value persistence store with named collections.
 * Knows nothing about game data — just stores and retrieves opaque values.
 *
 * Implementations: IdbPersistenceStore (browser), future SqlitePersistenceStore (server).
 */
export interface PersistenceStore {
  open(): Promise<void>;
  close(): void;

  /** Get a single value by collection and key. Returns undefined if not found. */
  get(collection: string, key: string): Promise<unknown>;

  /** Get all entries in a collection as a map of key → value. */
  getAll(collection: string): Promise<Map<string, unknown>>;

  /** Atomically write a batch of entries across any collections. */
  save(entries: SaveEntry[]): Promise<void>;

  /** Clear all data in all collections. */
  clear(): Promise<void>;
}
