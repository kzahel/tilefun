/** Shared host-independent admission bounds. Keep atomic gameplay groups intact. */
export const PERSISTENCE_BUDGET = {
  queueRecords: 65_536,
  queueBytes: 64 * 1024 * 1024,
  dirtySoftLimit: 2048,
  actors: 4096,
  props: 8192,
  scopeRecords: 4096,
  scopeBytes: 8 * 1024 * 1024,
  queryChanges: 8192,
  editQueue: 64,
} as const;
