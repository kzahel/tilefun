import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import type { ClientStateView } from "../src/client/ClientStateView.js";
import type { ClientMessage, FrameMessage } from "../src/shared/protocol.js";
import type { IClientTransport } from "../src/transport/Transport.js";
import { installRtcProbe } from "./helpers/rtc-delivery-probe.js";

interface TestGame {
  transport: IClientTransport;
  stateView: ClientStateView;
  gcSendRequest(message: unknown): Promise<{ meta: { id: string } }>;
  nextRequestId: number;
}

declare global {
  interface HTMLCanvasElement {
    __game: TestGame;
  }
}

const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
const PORT = 4194;
let child: ChildProcess;
let directory: string;
let logs = "";

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "tilefun-rtc-delivery-"));
  const environment = { ...process.env };
  delete environment.TILEFUN_ADMIN_TOKEN;
  child = spawn(process.execPath, ["--import", "tsx", "src/server/standalone.ts"], {
    cwd: process.cwd(),
    env: {
      ...environment,
      PORT: String(PORT),
      NET_TRANSPORT: "webrtc",
      DATA_DIR: directory,
      TILEFUN_TRUSTED_COOP: "1",
    },
    stdio: "pipe",
  });
  child.stdout?.on("data", (chunk) => {
    logs += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    logs += chunk;
  });
  await expect
    .poll(
      async () => {
        if (child.exitCode !== null) throw new Error(logs);
        return fetch(`http://localhost:${PORT}/api/world-list`).then(
          (r) => r.ok,
          () => false,
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);
});
test.afterAll(async () => {
  if (child && child.exitCode === null) {
    await new Promise<void>((resolve) => {
      const kill = setTimeout(() => child.kill("SIGKILL"), 5000);
      child.once("exit", () => {
        clearTimeout(kill);
        resolve();
      });
      child.kill("SIGTERM");
    });
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function open(page: Page) {
  await installRtcProbe(page);
  await page.goto(`/tilefun/?server=localhost:${PORT}&transport=webrtc`);
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__rtcProbe.channels
          .filter((c) => c.readyState === "open")
          .map((c) => c.label)
          .sort(),
      ),
    )
    .toEqual(["entities", "sync"]);
  const options = await page.evaluate(() =>
    window.__rtcProbe.channels.map((c) => ({
      label: c.label,
      ordered: c.ordered,
      maxRetransmits: c.maxRetransmits,
    })),
  );
  expect(options).toContainEqual({ label: "entities", ordered: false, maxRetransmits: 0 });
  expect(options).toContainEqual({ label: "sync", ordered: true, maxRetransmits: null });
  await page.evaluate(() => {
    const game = document.querySelector<HTMLCanvasElement>("#game")?.__game;
    if (!game) throw new Error("Missing game fixture");
    const view = game.stateView as ClientStateView & { applyFrame(message: FrameMessage): void };
    const apply = view.applyFrame.bind(view);
    view.applyFrame = (message) => {
      apply(message);
      window.__rtcProbe.appliedFrames++;
    };
  });
}
async function createWorld(page: Page) {
  return page.evaluate(async (generation) => {
    const game = document.querySelector<HTMLCanvasElement>("#game")?.__game;
    if (!game) throw new Error("Missing game fixture");
    const result = await game.gcSendRequest({
      type: "create-world",
      requestId: game.nextRequestId++,
      name: "RTC delivery fixture",
      generation,
    });
    return result.meta.id;
  }, generation);
}
async function enter(page: Page, worldId: string) {
  await page.evaluate(
    async ({ worldId, generation }) => {
      const game = document.querySelector<HTMLCanvasElement>("#game")?.__game;
      if (!game) throw new Error("Missing game fixture");
      await game.gcSendRequest({
        type: "join-realm",
        requestId: game.nextRequestId++,
        worldId,
        arrival: { x: 0, y: 0, generation },
      });
      game.transport.send({ type: "set-debug", paused: true, noclip: false });
    },
    { worldId, generation },
  );
  await cleanFrames(page, 15);
}
async function send(page: Page, message: ClientMessage) {
  await page.evaluate((message) => {
    const game = document.querySelector<HTMLCanvasElement>("#game")?.__game;
    if (!game) throw new Error("Missing game fixture");
    game.transport.send(message);
  }, message);
}
async function chickens(page: Page) {
  return page.evaluate(() => {
    const game = document.querySelector<HTMLCanvasElement>("#game")?.__game;
    if (!game) throw new Error("Missing game fixture");
    return game.stateView.entities
      .filter((e) => e.type === "chicken")
      .map((e) => e.id)
      .sort();
  });
}
async function clearChickens(page: Page) {
  for (const id of await chickens(page)) {
    await send(page, { type: "edit-delete-entity", entityId: id });
  }
  await expect.poll(() => chickens(page)).toEqual([]);
}
async function cleanFrames(page: Page, count = 120) {
  const applied = () => page.evaluate(() => window.__rtcProbe.appliedFrames);
  const start = await applied();
  // Count actual replica applications: realm tick counters may restart on entry,
  // and incoming packets can keep the pending queue continuously nonempty.
  await expect
    .poll(applied, { timeout: 15_000, intervals: [100] })
    .toBeGreaterThanOrEqual(start + count);
}
async function receipt(page: Page) {
  return page.evaluate(() => ({
    dropped: window.__rtcProbe.dropped,
    appliedFrames: window.__rtcProbe.appliedFrames,
    entitiesFrames: window.__rtcProbe.entitiesFrames,
    syncFrames: window.__rtcProbe.syncFrames,
    bytes: window.__rtcProbe.bytes,
  }));
}

test("reliable RTC delivers spawns with unreliable faults armed, channel closure and reconnect", async ({
  browser,
  page,
}, info) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  const healthy = await context.newPage();
  try {
    await open(page);
    await open(healthy);
    const world = await createWorld(healthy);
    await enter(page, world);
    await enter(healthy, world);
    await clearChickens(healthy);
    await expect.poll(() => chickens(page)).toEqual([]);
    await page.evaluate(() => {
      window.__rtcProbe.mode = "drop-baseline";
    });
    await send(healthy, { type: "edit-spawn", entityType: "chicken", wx: 50, wy: 50 });
    await expect.poll(() => chickens(healthy)).toHaveLength(1);
    await expect.poll(() => chickens(page)).toEqual(await chickens(healthy));
    await cleanFrames(page);
    const beforeClosure = await receipt(page);
    expect(beforeClosure.dropped).toBe(0);
    expect(beforeClosure.entitiesFrames).toBe(0);
    expect(beforeClosure.syncFrames).toBeGreaterThan(0);
    await page.evaluate(() =>
      window.__rtcProbe.channels.find((c) => c.label === "entities")?.close(),
    );
    await cleanFrames(page);
    expect(await chickens(page)).toEqual(await chickens(healthy));
    const afterClosure = await receipt(page);
    expect(afterClosure.syncFrames).toBeGreaterThan(beforeClosure.syncFrames);
    await page.reload();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect.poll(() => chickens(page)).toEqual(await chickens(healthy));
    const id = (await chickens(healthy))[0];
    if (id === undefined) throw new Error("Missing healthy chicken");
    await send(healthy, { type: "edit-delete-entity", entityId: id });
    await expect.poll(() => chickens(page)).toEqual([]);
    await expect.poll(() => chickens(healthy)).toEqual([]);
    await info.attach("delivery-evidence", {
      body: JSON.stringify({ beforeClosure, afterClosure, reconnectConverged: true }),
      contentType: "application/json",
    });
  } finally {
    await context.close();
  }
});

test("reliable RTC delivers exits and orders a world reset behind delayed old-world baselines", async ({
  browser,
  page,
}, info) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  const healthy = await context.newPage();
  try {
    await open(page);
    await open(healthy);
    const world = await createWorld(healthy);
    await enter(page, world);
    await enter(healthy, world);
    await clearChickens(healthy);
    await expect.poll(() => chickens(page)).toEqual([]);
    await send(healthy, { type: "edit-spawn", entityType: "chicken", wx: 50, wy: 50 });
    await expect.poll(() => chickens(page)).toHaveLength(1);
    const id = (await chickens(page))[0];
    if (id === undefined) throw new Error("Missing subject chicken");
    await page.evaluate(() => {
      window.__rtcProbe.mode = "drop-exit";
    });
    await send(healthy, { type: "edit-delete-entity", entityId: id });
    await expect.poll(() => chickens(healthy)).toEqual([]);
    await expect.poll(() => chickens(page)).toEqual([]);
    await cleanFrames(page);
    expect((await receipt(page)).dropped).toBe(0);
    const destination = await createWorld(healthy);
    await page.evaluate(() => {
      window.__rtcProbe.mode = "hold-sync";
    });
    await send(healthy, { type: "edit-spawn", entityType: "chicken", wx: 70, wy: 50 });
    await expect.poll(() => chickens(healthy)).toHaveLength(1);
    const oldIds = await chickens(healthy);
    // Hold the entire ordered stream, including control and fragments. A baseline
    // is definitely waiting before we request the transition on reliable input.
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__rtcProbe.held.some(({ event }) => {
            if (!(event.data instanceof ArrayBuffer) || event.data.byteLength < 19) return false;
            const data = new DataView(event.data);
            return data.getUint8(0) === 0x01 && data.getUint16(13, true) > 0;
          }),
        ),
      )
      .toBe(true);
    expect(await chickens(page)).toEqual([]);
    await send(page, {
      type: "join-realm",
      requestId: 900001,
      worldId: destination,
      arrival: { x: 0, y: 0, generation },
    });
    // realm-joined is a small JSON envelope; do not release until the real server
    // has queued the reset behind that baseline on the same channel.
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__rtcProbe.held.some(({ event }) => {
            if (!(event.data instanceof ArrayBuffer) || event.data.byteLength < 2) return false;
            const data = new Uint8Array(event.data);
            return (
              data[0] === 0xff &&
              JSON.parse(new TextDecoder().decode(data.subarray(1))).type === "realm-joined"
            );
          }),
        ),
      )
      .toBe(true);
    const heldMessages = await page.evaluate(() => window.__rtcProbe.held.length);
    await page.evaluate(() => window.__rtcProbe.release());
    await cleanFrames(page);
    expect((await chickens(page)).some((id) => oldIds.includes(id))).toBe(false);
    const delivery = await receipt(page);
    expect(delivery.entitiesFrames).toBe(0);
    expect(delivery.syncFrames).toBeGreaterThan(0);
    expect(delivery.dropped).toBe(0);
    await info.attach("delivery-evidence", {
      body: JSON.stringify({ ...delivery, heldMessages, staleWorldEntities: 0 }),
      contentType: "application/json",
    });
  } finally {
    await context.close();
  }
});
