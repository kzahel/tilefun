import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { PersistenceCoordinator } from "./PersistenceCoordinator.js";
import type { StoredRecord } from "./RecordStore.js";
import { SqliteRecordStore } from "./SqliteRecordStore.js";

it("SQLite persists indexed records, rolls back batches and holds a process-safe writer lease", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tilefun-records-"));
  const store = new SqliteRecordStore(directory);
  const second = new SqliteRecordStore(directory);
  const record: StoredRecord = {
    collection: "actors",
    key: "a",
    scope: "world:0,0",
    revision: 1,
    value: { bytes: new Uint8Array([1, 2, 3]), position: { x: 12 } },
  };
  try {
    await store.open();
    await expect(second.open()).rejects.toThrow(/locked/);
    await store.commit([{ put: record }]);
    await expect(
      store.commit([
        { put: { ...record, key: "b" } },
        { put: { ...record, key: undefined as unknown as string } },
      ]),
    ).rejects.toThrow();
    expect(await store.read("actors", "b")).toBeUndefined();
    const coordinator = new PersistenceCoordinator(store);
    coordinator.stage([{ put: { ...record, scope: "world:1,0" } }]);
    await coordinator.close();
    await second.open();
    expect(await second.scan({ collection: "actors", scope: "world:0,0", limit: 16 })).toEqual([]);
    const loaded = await second.scan({ collection: "actors", scope: "world:1,0", limit: 16 });
    expect(loaded[0]?.value).toEqual(record.value);
    await second.commit([{ delete: { collection: "actors", key: "a" } }]);
    expect(await second.read("actors", "a")).toBeUndefined();
  } finally {
    await store.close();
    await second.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it("recovers committed WAL records and rolls back an interrupted transaction after process death", async () => {
  const { spawn } = await import("node:child_process");
  const directory = await mkdtemp(join(tmpdir(), "tilefun-crash-"));
  const runCrash = (code: string) =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--experimental-sqlite", "--input-type=module", "-e", code],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      let stderr = "";
      child.stderr.on("data", (data) => {
        stderr += String(data);
      });
      child.on("error", reject);
      child.on("exit", (_code, signal) =>
        signal === "SIGKILL" ? resolve() : reject(Error(stderr)),
      );
    });
  const workerURL = new URL("./sqlite-record-worker.mjs", import.meta.url).href;
  const committed = {
    collection: "actors",
    key: "durable",
    scope: "0,0",
    revision: 1,
    value: { x: 17 },
  };
  const store = new SqliteRecordStore(directory);
  try {
    await runCrash(`import { Worker } from 'node:worker_threads';
      const worker = new Worker(new URL(${JSON.stringify(workerURL)}), { workerData: { directory: ${JSON.stringify(directory)} }, execArgv: ['--experimental-sqlite'] });
      worker.on('error', (error) => { console.error(error); process.exit(1); });
      worker.on('message', (message) => { if (message.error) { console.error(message.error); process.exit(1); }
        if (message.id === 1) worker.postMessage({ id: 2, operation: 'commit', value: [{ put: ${JSON.stringify(committed)} }] });
        else process.kill(process.pid, 'SIGKILL'); });
      worker.postMessage({ id: 1, operation: 'open' });`);
    await runCrash(`import { DatabaseSync } from 'node:sqlite'; import { serialize } from 'node:v8';
      const db = new DatabaseSync(${JSON.stringify(join(directory, "records.sqlite"))});
      db.exec('BEGIN IMMEDIATE');
      db.prepare('INSERT INTO records VALUES (?,?,?,?)').run('actors', 'uncommitted', '0,0', serialize({ ...${JSON.stringify(committed)}, key: 'uncommitted' }));
      process.kill(process.pid, 'SIGKILL');`);
    await store.open();
    expect(await store.read("actors", "durable")).toEqual(committed);
    expect(await store.read("actors", "uncommitted")).toBeUndefined();
    await store.close();
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(join(directory, "records.sqlite"));
    expect(db.prepare("PRAGMA integrity_check").get()?.integrity_check).toBe("ok");
    db.close();
  } finally {
    await store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
