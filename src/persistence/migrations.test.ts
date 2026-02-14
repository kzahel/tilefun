import { describe, expect, it } from "vitest";
import { applyMigrations, type SaveMigration } from "./migrations.js";

describe("applyMigrations", () => {
  it("returns data unchanged when already at target version", () => {
    const meta = { playerX: 5 };
    const chunks = new Map<string, Record<string, unknown>>();
    const result = applyMigrations(1, meta, chunks, [], 1);
    expect(result.version).toBe(1);
    expect(result.meta).toEqual({ playerX: 5 });
    expect(result.chunks.size).toBe(0);
  });

  it("applies a single migration", () => {
    const migrations: SaveMigration[] = [
      {
        fromVersion: 1,
        description: "add score to meta",
        migrateMeta(raw) {
          if (raw) raw.score = 0;
          return raw;
        },
        migrateChunk(_key, raw) {
          raw.biome = "plains";
          return raw;
        },
      },
    ];
    const chunks = new Map([
      ["0,0", { subgrid: new Uint8Array(4) }],
      ["1,0", { subgrid: new Uint8Array(4) }],
    ]);
    const result = applyMigrations(1, { playerX: 10 }, chunks, migrations, 2);
    expect(result.version).toBe(2);
    expect(result.meta).toEqual({ playerX: 10, score: 0 });
    expect(result.chunks.get("0,0")).toHaveProperty("biome", "plains");
    expect(result.chunks.get("1,0")).toHaveProperty("biome", "plains");
  });

  it("chains two migrations in order", () => {
    const migrations: SaveMigration[] = [
      {
        fromVersion: 1,
        description: "add foo",
        migrateMeta(raw) {
          if (raw) raw.foo = "bar";
          return raw;
        },
        migrateChunk(_key, raw) {
          raw.extra = true;
          return raw;
        },
      },
      {
        fromVersion: 2,
        description: "add baz",
        migrateMeta(raw) {
          if (raw) raw.baz = 42;
          return raw;
        },
        migrateChunk(_key, raw) {
          return raw;
        },
      },
    ];
    const chunks = new Map([["0,0", { subgrid: new ArrayBuffer(8) }]]);
    const result = applyMigrations(1, { playerX: 0 }, chunks, migrations, 3);
    expect(result.version).toBe(3);
    expect(result.meta).toEqual({ playerX: 0, foo: "bar", baz: 42 });
    expect(result.chunks.get("0,0")).toHaveProperty("extra", true);
  });

  it("handles null meta", () => {
    const migrations: SaveMigration[] = [
      {
        fromVersion: 1,
        description: "handle null meta",
        migrateMeta(raw) {
          return raw;
        },
        migrateChunk(_key, raw) {
          return raw;
        },
      },
    ];
    const result = applyMigrations(1, null, new Map(), migrations, 2);
    expect(result.version).toBe(2);
    expect(result.meta).toBeNull();
  });

  it("throws when migration is missing", () => {
    expect(() => applyMigrations(1, null, new Map(), [], 2)).toThrow(
      "No migration from save version 1",
    );
  });

  it("passes chunk key to migrateChunk", () => {
    const seenKeys: string[] = [];
    const migrations: SaveMigration[] = [
      {
        fromVersion: 1,
        description: "track keys",
        migrateMeta(raw) {
          return raw;
        },
        migrateChunk(key, raw) {
          seenKeys.push(key);
          return raw;
        },
      },
    ];
    const chunks = new Map([
      ["0,0", {}],
      ["1,2", {}],
      ["-3,5", {}],
    ]);
    applyMigrations(1, null, chunks, migrations, 2);
    expect(seenKeys.sort()).toEqual(["-3,5", "0,0", "1,2"]);
  });
});
