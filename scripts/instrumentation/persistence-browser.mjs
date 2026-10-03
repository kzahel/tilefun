import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

// A script-driven real browser executor check with no gameplay/auth/data server.
const server = await createServer({
  configFile: false,
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "storage-fixture",
      configureServer(s) {
        s.middlewares.use("/__storage", (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end("<!doctype html><title>Storage fixture</title>");
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/__storage`);
  const result = await page.evaluate(async () => {
    const { IdbRecordStore } = await import("/src/persistence/IdbRecordStore.ts");
    const { PersistenceCoordinator } = await import("/src/persistence/PersistenceCoordinator.ts");
    const name = `tilefun-conformance-${crypto.randomUUID()}`;
    const store = new IdbRecordStore(name);
    const second = new IdbRecordStore(name);
    await store.open();
    let locked = false;
    try {
      await second.open();
    } catch {
      locked = true;
    }
    const record = {
      collection: "actors",
      key: "a",
      scope: "0,0",
      revision: 1,
      value: { bytes: new Uint8Array([1, 2, 3]) },
    };
    await store.commit([{ put: record }]);
    let aborted = false;
    try {
      await store.commit([
        { put: { ...record, key: "b" } },
        { put: { ...record, key: "c", value: () => {} } },
      ]);
    } catch {
      aborted = true;
    }
    const absent = (await store.read("actors", "b")) === undefined;
    const coordinator = new PersistenceCoordinator(store);
    coordinator.stage([{ put: { ...record, scope: "1,0" } }]);
    await coordinator.close();
    await second.open();
    const old = await second.scan({ collection: "actors", scope: "0,0", limit: 16 });
    const moved = await second.scan({ collection: "actors", scope: "1,0", limit: 16 });
    await second.commit([{ delete: { collection: "actors", key: "a" } }]);
    const deleted = (await second.read("actors", "a")) === undefined;
    await second.close();
    indexedDB.deleteDatabase(name);
    return {
      locked,
      aborted,
      absent,
      old: old.length,
      moved: moved.length,
      bytes: [...moved[0].value.bytes],
      deleted,
    };
  });
  assert.deepEqual(result, {
    locked: true,
    aborted: true,
    absent: true,
    old: 0,
    moved: 1,
    bytes: [1, 2, 3],
    deleted: true,
  });
  const lifecycle = await page.evaluate(async () => {
    const { IdbPersistenceStore } = await import("/src/persistence/IdbPersistenceStore.ts");
    const { streamingConformance } = await import("/src/persistence/StreamingConformance.ts");
    const { RECORD_DATABASE_SUFFIX } = await import("/src/persistence/SaveFormat.ts");
    const name = `tilefun-lifecycle-${crypto.randomUUID()}`;
    try {
      return await streamingConformance(() => new IdbPersistenceStore(name));
    } finally {
      indexedDB.deleteDatabase(`${name}${RECORD_DATABASE_SUFFIX}`);
    }
  });
  assert.equal(lifecycle.chunksVisited, 1000);
  console.log(JSON.stringify({ backend: "IndexedDB", ...lifecycle }));
  console.log(
    "IndexedDB conformance passed: atomic abort, writer lease, spatial move, typed payload, reopen, delete.",
  );
} finally {
  await browser?.close();
  await server.close();
}
