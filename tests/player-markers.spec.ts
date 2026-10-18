import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import type { ClientStateView } from "../src/client/ClientStateView.js";
import { FsWorldRegistry } from "../src/persistence/FsWorldRegistry.js";
import type { ClientMessage } from "../src/shared/protocol.js";
import type { RequestMessage } from "../src/shared/requests.js";

type Marker = { x: number; y: number; angle: number; offscreen: boolean; time: number };
type Harness = {
  stateView: ClientStateView;
  gcSendRequest(message: RequestMessage): Promise<{ meta: { id: string } }>;
  nextRequestId: number;
  transport: { send(message: ClientMessage): void };
};
type GameCanvas = HTMLCanvasElement & { __game: Harness; __marker?: Marker };
const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
const PORT = 4197;
let child: ChildProcess;
let directory: string;
let worldId: string;

test.describe.configure({ mode: "serial" });
test.use({ channel: "chromium" });
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "tilefun-player-markers-"));
  const registry = new FsWorldRegistry(directory);
  await registry.open();
  worldId = (
    await registry.createWorld("Co-op markers", undefined, undefined, undefined, generation)
  ).id;
  registry.close();
  const environment = { ...process.env };
  delete environment.TILEFUN_ADMIN_TOKEN;
  child = spawn(process.execPath, ["--import", "tsx", "src/server/standalone.ts"], {
    cwd: process.cwd(),
    env: { ...environment, PORT: String(PORT), DATA_DIR: directory, TILEFUN_TRUSTED_COOP: "1" },
    stdio: "pipe",
  });
  let logs = "";
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

async function probe(page: Page) {
  await page.addInitScript(() => {
    // Observe real HUD triangle submissions, without replacing the render path.
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args: Parameters<typeof stroke>) {
      if (
        this.canvas.id === "game" &&
        this.lineWidth === 3 &&
        this.strokeStyle === "rgba(15, 23, 42, 0.65)"
      ) {
        const t = this.getTransform();
        (this.canvas as GameCanvas).__marker = {
          x: t.e,
          y: t.f,
          angle: Math.atan2(t.b, t.a),
          offscreen: this.globalAlpha < 0.9,
          time: performance.now(),
        };
      }
      return stroke.apply(this, args);
    };
  });
}
async function read(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector("#game") as GameCanvas;
    return {
      marker: c.__marker,
      age: c.__marker ? performance.now() - c.__marker.time : Infinity,
      players: c.__game.stateView.entities.filter((e) => e.type === "player").length,
      width: c.width,
      height: c.height,
    };
  });
}
async function teleport(page: Page, x: number, y: number) {
  await page.evaluate(
    async ({ x, y }) => {
      const g = (document.querySelector("#game") as GameCanvas).__game;
      await g.gcSendRequest({
        type: "rcon",
        requestId: g.nextRequestId++,
        command: `tp ${x} ${y}`,
      });
    },
    { x, y },
  );
  await expect
    .poll(() =>
      page.evaluate(
        ({ x, y }) => {
          const p = (document.querySelector("#game") as GameCanvas).__game.stateView.playerEntity
            .position;
          return Math.hypot(p.wx - x, p.wy - y);
        },
        { x, y },
      ),
    )
    .toBeLessThan(1);
}

for (const renderer of ["canvas", "gpu"]) {
  test(`live co-op markers follow nearby/distant players, editor and realm departure (${renderer})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const second = await browser.newContext();
    try {
      const friend = await second.newPage();
      await probe(page);
      const url = `/tilefun/?nogamepad&server=localhost:${PORT}&renderer=${renderer}`;
      // The existing tp diagnostic targets the first connected session.
      await friend.goto(`http://localhost:4174${url}`);
      await expect(friend.locator("#game")).toHaveAttribute("data-ready", "true");
      await page.goto(url);
      await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
      await expect(page.locator("#game")).toHaveAttribute("data-renderer", renderer);
      for (const p of [friend, page]) {
        await p.evaluate(
          async ({ worldId, generation }) => {
            const g = (document.querySelector("#game") as GameCanvas).__game;
            await g.gcSendRequest({
              type: "join-realm",
              requestId: g.nextRequestId++,
              worldId,
              arrival: { x: 0, y: 0, generation },
            });
            g.transport.send({ type: "set-debug", paused: false, noclip: true });
          },
          { worldId, generation },
        );
      }
      await teleport(friend, 50, 20);
      await expect.poll(async () => (await read(page)).marker?.offscreen).toBe(false);
      await page.screenshot({ path: `/tmp/tilefun-player-marker-near-${renderer}.png` });
      for (const [x, y] of [
        [10000, -10000],
        [10000, 0],
        [-10000, 0],
        [0, 10000],
        [0, -10000],
      ]) {
        await teleport(friend, x ?? 0, y ?? 0);
        await expect
          .poll(async () => {
            const { marker, width, height } = await read(page);
            if (!marker?.offscreen) return false;
            if (Math.cos(marker.angle - Math.atan2(y ?? 0, x ?? 0)) < 0.999) return false;
            if (x && Math.sign(marker.x - width / 2) !== Math.sign(x)) return false;
            if (y && Math.sign(marker.y - height / 2) !== Math.sign(y)) return false;
            return true;
          })
          .toBe(true);
      }
      await teleport(friend, 10000, -10000);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect
        .poll(async () => {
          const { marker, width } = await read(page);
          return (
            width === 390 &&
            marker?.offscreen &&
            marker.x > 195 &&
            marker.x <= 362 &&
            marker.y >= 28 &&
            marker.y < 422
          );
        })
        .toBe(true);
      await page.screenshot({ path: `/tmp/tilefun-player-marker-edge-${renderer}.png` });
      await page.keyboard.press("Tab");
      await expect
        .poll(() =>
          page.evaluate(
            () => (document.querySelector("#game") as GameCanvas).__game.stateView.editorEnabled,
          ),
        )
        .toBe(true);
      await expect.poll(async () => (await read(page)).age).toBeLessThan(250);
      await friend.evaluate(async () => {
        const g = (document.querySelector("#game") as GameCanvas).__game;
        await g.gcSendRequest({ type: "leave-realm", requestId: g.nextRequestId++ });
      });
      await expect.poll(async () => (await read(page)).players).toBe(1);
      await expect.poll(async () => (await read(page)).age).toBeGreaterThan(500);
    } finally {
      await page.evaluate(async () => {
        const g = (document.querySelector("#game") as GameCanvas).__game;
        await g.gcSendRequest({ type: "leave-realm", requestId: g.nextRequestId++ });
      });
      await second.close();
    }
  });
}
