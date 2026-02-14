/** Current save format version. Bump when adding a new migration. */
export const CURRENT_SAVE_VERSION = 1;

/** Key used to store the format version in the meta object store. */
export const FORMAT_VERSION_KEY = "__format";

/** Shape of the version record stored in IDB. */
export interface FormatVersionRecord {
  version: number;
}

/**
 * A migration transforms raw save data from version N to version N+1.
 * Both meta and chunks are provided as plain objects (raw IDB shapes)
 * and may be mutated in place.
 */
export interface SaveMigration {
  /** The version this migration upgrades FROM. */
  fromVersion: number;
  /** Human-readable description for logging. */
  description: string;
  /** Transform the raw meta record. Null if no meta exists yet. */
  migrateMeta(raw: Record<string, unknown> | null): Record<string, unknown> | null;
  /** Transform a single raw chunk record. Called once per chunk. */
  migrateChunk(key: string, raw: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Registry of all migrations, ordered by fromVersion.
 * To add a migration: push a new entry with fromVersion = CURRENT_SAVE_VERSION,
 * then bump CURRENT_SAVE_VERSION.
 */
export const MIGRATIONS: SaveMigration[] = [];

/**
 * Apply migrations to raw save data, chaining from `fromVersion` up to
 * `targetVersion`. Pure function — used by SaveManager and directly testable.
 */
export function applyMigrations(
  fromVersion: number,
  meta: Record<string, unknown> | null,
  chunks: Map<string, Record<string, unknown>>,
  migrations: SaveMigration[],
  targetVersion: number,
): {
  meta: Record<string, unknown> | null;
  chunks: Map<string, Record<string, unknown>>;
  version: number;
} {
  let version = fromVersion;
  while (version < targetVersion) {
    const migration = migrations.find((m) => m.fromVersion === version);
    if (!migration) {
      throw new Error(`No migration from save version ${version}`);
    }
    meta = migration.migrateMeta(meta);
    const newChunks = new Map<string, Record<string, unknown>>();
    for (const [key, raw] of chunks) {
      newChunks.set(key, migration.migrateChunk(key, raw));
    }
    chunks = newChunks;
    version++;
  }
  return { meta, chunks, version };
}
