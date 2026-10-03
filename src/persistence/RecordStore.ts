/** Platform-neutral physical storage contract. No gameplay policy belongs here. */
export interface StoredRecord {
  collection: string;
  key: string;
  /** Spatial lookup key; includes realm identity when sharing a world container. */
  scope?: string;
  revision: number;
  value: unknown;
}

export type RecordMutation =
  | { put: StoredRecord }
  | { delete: { collection: string; key: string } };

export interface RecordQuery {
  collection: string;
  scope?: string;
  /** Exclusive key cursor. Keys use binary string ordering on every backend. */
  after?: string;
  limit: number;
}

export interface RecordStore {
  open(): Promise<void>;
  read(collection: string, key: string): Promise<StoredRecord | undefined>;
  scan(query: RecordQuery): Promise<StoredRecord[]>;
  /** All mutations commit or none do. Resolution is transaction acknowledgement. */
  commit(mutations: readonly RecordMutation[]): Promise<void>;
  /** Called only after shared coordination has drained accepted writes. */
  close(): Promise<void>;
}

export function recordAddress(record: { collection: string; key: string }): string {
  return JSON.stringify([record.collection, record.key]);
}

export function mutationAddress(mutation: RecordMutation): string {
  return recordAddress("put" in mutation ? mutation.put : mutation.delete);
}

export function validateQuery(query: RecordQuery): void {
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 1024)
    throw new Error("Record query limit must be between 1 and 1024.");
}

/** Conservative owned-payload estimate, including typed data and string storage. */
export function recordBytes(value: unknown): number {
  if (value == null) return 8;
  if (typeof value === "string") return 24 + value.length * 2;
  if (typeof value !== "object") return 16;
  if (ArrayBuffer.isView(value)) return 64 + value.byteLength;
  if (value instanceof ArrayBuffer) return 32 + value.byteLength;
  if (value instanceof Map)
    return 64 + [...value].reduce((n, [k, v]) => n + recordBytes(k) + recordBytes(v), 0);
  if (value instanceof Set) return 64 + [...value].reduce<number>((n, v) => n + recordBytes(v), 0);
  return 64 + Object.entries(value).reduce((n, [k, v]) => n + recordBytes(k) + recordBytes(v), 0);
}
