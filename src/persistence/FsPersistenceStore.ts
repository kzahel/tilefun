import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deserialize, serialize } from "node:v8";
import type { PersistenceStore, SaveEntry } from "./PersistenceStore.js";

/**
 * Filesystem implementation of PersistenceStore for Node.js.
 * Uses node:v8 serialize/deserialize — the filesystem equivalent of
 * IDB's structured clone (handles ArrayBuffer, Uint8Array, etc. natively).
 *
 * Layout:
 *   {baseDir}/{collection}/{key}.v8
 */
export class FsPersistenceStore implements PersistenceStore {
  constructor(
    private readonly baseDir: string,
    private readonly collections: string[],
  ) {}

  async open(): Promise<void> {
    mkdirSync(this.baseDir, { recursive: true });
    for (const name of this.collections) {
      mkdirSync(join(this.baseDir, name), { recursive: true });
    }
  }

  close(): void {
    // No-op for filesystem
  }

  async get(collection: string, key: string): Promise<unknown> {
    const filePath = this.filePath(collection, key);
    try {
      const buf = await readFile(filePath);
      return deserialize(buf);
    } catch {
      return undefined;
    }
  }

  async getAll(collection: string): Promise<Map<string, unknown>> {
    const dir = join(this.baseDir, collection);
    const result = new Map<string, unknown>();
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return result;
    }
    for (const filename of entries) {
      if (!filename.endsWith(".v8")) continue;
      const key = filename.slice(0, -3); // remove .v8
      try {
        const buf = await readFile(join(dir, filename));
        result.set(key, deserialize(buf));
      } catch {
        // Skip corrupted files
      }
    }
    return result;
  }

  async save(entries: SaveEntry[]): Promise<void> {
    // Write each entry atomically: write to .tmp, then rename
    const writes = entries.map(async (entry) => {
      const filePath = this.filePath(entry.collection, entry.key);
      const tmpPath = `${filePath}.tmp`;
      const buf = serialize(entry.value);
      await writeFile(tmpPath, buf);
      renameSync(tmpPath, filePath);
    });
    await Promise.all(writes);
  }

  async clear(): Promise<void> {
    for (const name of this.collections) {
      const dir = join(this.baseDir, name);
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true });
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  /** Remove the entire data directory for this store. */
  removeAll(): void {
    if (existsSync(this.baseDir)) {
      rmSync(this.baseDir, { recursive: true });
    }
  }

  private filePath(collection: string, key: string): string {
    // Sanitize key for filesystem (replace / and \ with _)
    const safeKey = key.replace(/[/\\]/g, "_");
    return join(this.baseDir, collection, `${safeKey}.v8`);
  }
}
