// Trace terrain presence and replication while repeatedly changing zoom.
// Isolated Vite, fresh browser storage and bundled Chromium.
// node scripts/first-person/zoom-holes.mjs [--flat] [--headed]
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const out = await mkdtemp(path.join(os.tmpdir(), "tilefun-zoom-holes-"));
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: path.join(out, "cache"),
  optimizeDeps: { entries: ["index.html"] },
  plugins: [react()],
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
let browser;
const report = {
  out,
  fixture: process.argv.includes("--flat") ? "flat" : "regional-2026",
  samples: [],
  errors: [],
};
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}/tilefun`;
  browser = await chromium.launch({
    headless: !process.argv.includes("--headed"),
    channel: "chromium",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(`${origin}/?nogamepad&view=topdown3d`);
  await page.waitForFunction(
    () => document.querySelector("#game")?.dataset.ready === "true",
    undefined,
    { timeout: 60000 },
  );
  await page.evaluate(async (flat) => {
    const g = document.querySelector("#game").__game;
    const { createDescriptor } = await import("/tilefun/src/generation/GenerationDescriptor.ts");
    const generation = flat
      ? { type: "flat", version: "flat-v1", seed: 42, preset: "grass" }
      : createDescriptor("regional", 2026);
    const created = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "Zoom chunk reproduction",
      generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: 300, y: 519, generation },
    });
  }, process.argv.includes("--flat"));
  await page.waitForFunction(
    () =>
      Math.abs(
        document.querySelector("#game").__game.stateView.serverPlayerEntity.position.wx - 4800,
      ) < 1,
  );

  // Observe production application, retaining only terrain presence/revision metadata.
  await page.evaluate(() => {
    const g = document.querySelector("#game").__game;
    const state = g.stateView;
    const expected = new Set([...state.world.chunks.entries()].map(([key]) => key));
    const history = new Map();
    const trace = {
      message: 0,
      reentriesWithoutData: 0,
      firstFailures: [],
      expected,
      phase: "initial",
    };
    window.__chunkTrace = trace;
    const original = state.applyMessage;
    state.applyMessage = function (msg) {
      original.call(this, msg);
      if (msg.type !== "sync-chunks") return;
      const id = ++trace.message;
      const updates = new Map((msg.chunkUpdates ?? []).map((c) => [`${c.cx},${c.cy}`, c.revision]));
      const next = msg.loadedChunkKeys ? new Set(msg.loadedChunkKeys) : expected;
      const changed = new Set([
        ...updates.keys(),
        ...[...expected].filter((key) => !next.has(key)),
        ...[...next].filter((key) => !expected.has(key)),
      ]);
      for (const key of changed) {
        const events = history.get(key) ?? [];
        events.push({
          message: id,
          listed: next.has(key),
          snapshot: updates.has(key) ? updates.get(key) : null,
        });
        if (events.length > 4) events.shift();
        history.set(key, events);
      }
      if (next !== expected) {
        expected.clear();
        for (const key of next) expected.add(key);
      }
      for (const key of changed) {
        const [cx, cy] = key.split(",").map(Number);
        if (expected.has(key) && !state.world.getChunkIfLoaded(cx, cy)) {
          trace.reentriesWithoutData++;
          if (trace.firstFailures.length < 40)
            trace.firstFailures.push({ key, phase: trace.phase, history: [...history.get(key)] });
        }
      }
    };
  });
  const sample = async (phase) => {
    const sample = await page.evaluate(() => {
      const g = document.querySelector("#game").__game;
      const t = window.__chunkTrace;
      const range = g.device.views[0].interestRange();
      const missingData = [],
        missingImages = [],
        advertisedMissing = [];
      for (let cy = range.minCy; cy <= range.maxCy; cy++)
        for (let cx = range.minCx; cx <= range.maxCx; cx++) {
          const chunk = g.stateView.world.getChunkIfLoaded(cx, cy);
          if (!chunk) missingData.push(`${cx},${cy}`);
          else if (!g.renderer.isTerrainReady(chunk)) missingImages.push(`${cx},${cy}`);
        }
      for (const key of t.expected) {
        const [cx, cy] = key.split(",").map(Number);
        if (!g.stateView.world.getChunkIfLoaded(cx, cy)) advertisedMissing.push(key);
      }
      return {
        zoom: g.camera.zoom,
        range,
        missingData,
        missingImages,
        advertisedMissing,
        reentriesWithoutData: t.reentriesWithoutData,
        terrain: g.renderer.getDiagnostics(),
        view: g.firstPerson.viewStats,
      };
    });
    report.samples.push({ phase, ...sample });
    console.log(
      JSON.stringify({
        phase,
        zoom: sample.zoom,
        missingData: sample.missingData.length,
        missingImages: sample.missingImages.length,
        advertisedMissing: sample.advertisedMissing.length,
        reentriesWithoutData: sample.reentriesWithoutData,
        pending: sample.terrain.pending,
      }),
    );
  };
  const stages = [
    [1, 4000],
    [0.1, 10000],
    [0.25, 8000],
    [0.1, 10000],
    [0.25, 8000],
    [0.1, 10000],
  ];
  for (let i = 0; i < stages.length; i++) {
    const [zoom, ms] = stages[i];
    const phase = `stage-${i}-zoom-${zoom}`;
    await page.evaluate(
      ({ zoom, phase }) => {
        const g = document.querySelector("#game").__game;
        window.__chunkTrace.phase = phase;
        g.debugPanel.setZoom(zoom);
      },
      { zoom, phase },
    );
    await page.waitForTimeout(ms);
    await sample(phase);
    await page.screenshot({ path: path.join(out, `${phase}.png`) });
  }
  report.trace = await page.evaluate(() => {
    const t = window.__chunkTrace;
    return {
      messages: t.message,
      reentriesWithoutData: t.reentriesWithoutData,
      firstFailures: t.firstFailures,
    };
  });
  report.storage = await page.evaluate(async () => {
    const g = document.querySelector("#game").__game;
    return g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: "storage_stats",
    });
  });
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await rm(path.join(out, "cache"), { recursive: true, force: true });
  console.log(`REPORT ${out}/report.json`);
}
if (report.errors.length) process.exitCode = 1;
