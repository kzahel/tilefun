import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { deserialize, serialize } from "node:v8";
import { containedPath } from "./fsPaths.js";
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
      mkdirSync(this.collectionPath(name), { recursive: true });
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
    const dir = this.collectionPath(collection);
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
        const buf = await readFile(containedPath(this.baseDir, `${collection}/${filename}`));
        result.set(key, deserialize(buf));
      } catch {
        // Skip corrupted files
      }
    }
    return result;
  }

  async scan(
    collection: string,
    scope: string | undefined,
    after?: string,
    limit = 256,
  ): Promise<Map<string, unknown>> {
    if (scope !== undefined) throw new Error("Legacy file store has no spatial index.");
    return new Map(
      [...(await this.getAll(collection))]
        .filter(([key]) => after === undefined || key > after)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .slice(0, limit),
    );
  }

  async readScope(): Promise<Map<string, unknown>> {
    throw new Error("Legacy file store has no spatial index.");
  }

  async save(entries: SaveEntry[]): Promise<void> {
    // Write each entry atomically: write to .tmp, then rename
    const writes = entries.map(async (entry) => {
      const filePath = this.filePath(entry.collection, entry.key);
      const tmpPath = containedPath(
        this.baseDir,
        `${entry.collection}/${entry.key.replace(/[/\\]/g, "_")}.v8.tmp`,
      );
      const buf = serialize(entry.value);
      await writeFile(tmpPath, buf);
      renameSync(tmpPath, filePath);
    });
    await Promise.all(writes);
  }

  async clear(): Promise<void> {
    for (const name of this.collections) {
      const dir = this.collectionPath(name);
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
    this.collectionPath(collection);
    // Sanitize key for filesystem (replace / and \ with _)
    const safeKey = key.replace(/[/\\]/g, "_");
    return containedPath(this.baseDir, `${collection}/${safeKey}.v8`);
  }

  private collectionPath(collection: string): string {
    if (!this.collections.includes(collection) || !/^[a-zA-Z0-9_-]+$/.test(collection))
      throw new Error("Invalid collection.");
    return containedPath(this.baseDir, collection);
  }
}
