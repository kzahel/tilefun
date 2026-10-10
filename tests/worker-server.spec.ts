import { expect, type Page, test } from "@playwright/test";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { NaturalLandscape } from "../src/generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";

async function flatWorld(page: Page) {
  await page.goto(
    `/tilefun/?perf&nogamepad&generation=${encodeURIComponent(JSON.stringify(createDescriptor("flat", 2026)))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-generator", "flat");
  await page.waitForFunction(() => {
    // biome-ignore lint/suspicious/noExplicitAny: test hook
    const g = (document.querySelector("#game") as any).__game;
    return g.stateView.playerEntity.id > 0 && g.stateView.world.chunks.loadedCount > 0;
  });
}

const hostState = (page: Page) =>
  page.evaluate(async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test hook
    const g = (document.querySelector("#game") as any).__game;
    return {
      server: g.server,
      transport: g.transport.getDebugInfo(),
      metrics: await g.transport.getDiagnostics(),
      position: { ...g.stateView.playerEntity.position },
      tick: g.stateView.serverTick,
    };
  });

test("lake travel and rejected open-water travel keep the local Worker, map and streaming alive", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const generation = createDescriptor("regional", 2026);
  const landscape = new NaturalLandscape(regionalWorld(2026), "thicket");
  const pond = landscape.pond(1, -2);
  if (!pond) throw Error("Missing seeded pond");
  await flatWorld(page);
  await page.evaluate(async (generation) => {
    // biome-ignore lint/suspicious/noExplicitAny: test hook
    const g = (document.querySelector("#game") as any).__game;
    const { meta } = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "Lake travel regression",
      generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: meta.id,
    });
  }, generation);
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#game")).toHaveAttribute("data-generator", "regional");
  const travel = (x: number, y: number) =>
    page.evaluate(
      async ({ x, y, generation }) => {
        // biome-ignore lint/suspicious/noExplicitAny: test hook
        const g = (document.querySelector("#game") as any).__game;
        try {
          await g.gcSendRequest({
            type: "join-realm",
            requestId: g.nextRequestId++,
            worldId: g.mainMenu.currentWorldId,
            arrival: { x, y, generation },
          });
          return null;
        } catch (error) {
          return String(error);
        }
      },
      { x, y, generation },
    );
  for (let visit = 0; visit < 3; visit++) {
    expect(await travel(pond.x, pond.y)).toBeNull();
    await expect
      .poll(() =>
        page.evaluate(() => {
          // biome-ignore lint/suspicious/noExplicitAny: test hook
          const g = (document.querySelector("#game") as any).__game;
          const p = g.remoteView.serverPlayerEntity.position;
          return g.stateView.world.getCollision(Math.floor(p.wx / 16), Math.floor(p.wy / 16));
        }),
      )
      .toBe(0);
    const before = await hostState(page);
    expect(await travel(-4000, -4000)).toContain("No safe walkable arrival within 32 tiles");
    await expect.poll(async () => (await hostState(page)).tick).toBeGreaterThan(before.tick);
    await page.getByRole("button", { name: "Open world map" }).click();
    await expect(page.getByTestId("world-map")).toHaveAttribute("data-settled", "true");
    await expect(page.getByTestId("world-map-player")).toHaveCount(1);
    await page.keyboard.press("Escape");
    expect(await travel(300 + visit * 1000, 519)).toBeNull();
    await expect
      .poll(() =>
        page.evaluate(() => {
          // biome-ignore lint/suspicious/noExplicitAny: test hook
          const g = (document.querySelector("#game") as any).__game;
          const range = g.camera.getVisibleChunkRange();
          for (let cy = range.minCy; cy <= range.maxCy; cy++)
            for (let cx = range.minCx; cx <= range.maxCx; cx++)
              if (!g.stateView.world.chunks.get(cx, cy)) return false;
          return true;
        }),
      )
      .toBe(true);
  }
  expect((await hostState(page)).transport.transport).toContain("(ready)");
  await expect(page.locator("#tilefun-error-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("single player renders while its authoritative Worker is busy", async ({ page }) => {
  await flatWorld(page);
  const before = await hostState(page);
  expect(before.server).toBeNull();
  expect(before.transport.transport).toContain("Worker");
  const worker = page.workers().find((w) => w.url().includes("local-server.worker"));
  if (!worker) throw Error("No local authority Worker");
  const frameTimes = page.evaluate(async () => {
    const times: number[] = [];
    const until = performance.now() + 700;
    while (performance.now() < until) {
      await new Promise(requestAnimationFrame);
      times.push(Date.now());
    }
    return times;
  });
  // Deliberately occupy only the authority's JS thread. No gameplay test command.
  const stalled = await worker.evaluate(() => {
    const start = Date.now();
    while (Date.now() - start < 350) {
      /* controlled CPU saturation */
    }
    return { start, end: Date.now() };
  });
  const during = (await frameTimes).filter((t) => t > stalled.start && t < stalled.end);
  expect(during.length).toBeGreaterThan(3);
  await expect.poll(async () => (await hostState(page)).tick).toBeGreaterThan(before.tick);
  const state = await hostState(page);
  expect(state.metrics.authority.channel.highWaterBytes).toBeLessThan(16 * 1024 * 1024);
  await page.screenshot({ path: "/tmp/tilefun-worker-independent-render.png" });
});

test("an unhandled local Worker failure offers reload with the authority stack", async ({
  page,
}) => {
  await flatWorld(page);
  const worker = page.workers().find((w) => w.url().includes("local-server.worker"));
  if (!worker) throw Error("No local authority Worker");
  await worker.evaluate(() => {
    function injectedAuthorityFailure() {
      return Promise.reject(new Error("Injected local authority failure"));
    }
    void injectedAuthorityFailure();
  });
  const overlay = page.locator("#tilefun-error-overlay");
  await expect(overlay).toContainText("Injected local authority failure");
  await expect(overlay.locator("pre")).toContainText("injectedAuthorityFailure");
  await overlay.getByRole("button", { name: "Reload", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#tilefun-error-overlay")).toHaveCount(0);
  // The generation handoff URL opens the world picker again after reload.
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Open world map" }).click();
  await expect(page.getByTestId("world-map")).toHaveAttribute("data-settled", "true");
});

test("Worker saves player and edits before shutdown and restores them on reopen", async ({
  page,
}) => {
  await flatWorld(page);
  const start = await hostState(page);
  await page.keyboard.down("ArrowRight");
  await expect
    .poll(async () => (await hostState(page)).position.wx)
    .toBeGreaterThan(start.position.wx + 32);
  await page.keyboard.up("ArrowRight");
  await page.evaluate(async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test hook
    const g = (document.querySelector("#game") as any).__game;
    g.transport.send({ type: "set-editor-mode", enabled: true });
    g.transport.send({ type: "edit-elevation", tx: 0, ty: 0, height: 2, gridSize: 1 });
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        // biome-ignore lint/suspicious/noExplicitAny: test hook
        const g = (document.querySelector("#game") as any).__game;
        return g.stateView.world.getHeightAt(0, 0);
      }),
    )
    .toBe(2);
  const saved = await page.evaluate(async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test hook
    const g = (document.querySelector("#game") as any).__game;
    g.transport.send({ type: "set-editor-mode", enabled: false });
    const host = g.netEmulatedTransport.base;
    // Freeze authority, then consume its final replica before comparing durable
    // state. A pre-fence predicted pose may legitimately be one input ahead.
    g.loop.stop();
    host.setHidden(true);
    await host.flush();
    while (g.remoteView.pendingMessageCount) g.remoteView.applyPending();
    const position = { ...g.remoteView.serverPlayerEntity.position };
    await host.shutdown();
    return position;
  });
  await page.goto("/tilefun/?nogamepad");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => (await hostState(page)).position.wx).toBeCloseTo(saved.wx, 0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        // biome-ignore lint/suspicious/noExplicitAny: test hook
        return (document.querySelector("#game") as any).__game.stateView.world.getHeightAt(0, 0);
      }),
    )
    .toBe(2);
});

test("physics settings replicate across isolated heaps and lifecycle pause resumes", async ({
  page,
}) => {
  await flatWorld(page);
  await page.evaluate(async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test hook
    const g = (document.querySelector("#game") as any).__game;
    await g.consoleEngine.rconSend("sv_gravity 0.5");
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        // biome-ignore lint/suspicious/noExplicitAny: test hook
        return (document.querySelector("#game") as any).__game.stateView.physicsParameters
          .gravityScale;
      }),
    )
    .toBe(0.5);
  const paused = await page.evaluate(async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test hook
    const g = (document.querySelector("#game") as any).__game;
    const host = g.netEmulatedTransport.base;
    host.setHidden(true);
    await host.flush();
    return host.getDiagnostics();
  });
  expect(paused.authority.hidden).toBe(true);
  const again = await hostState(page);
  expect(again.metrics.authority.ticks).toBe(paused.authority.ticks);
  await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: test hook
    (document.querySelector("#game") as any).__game.netEmulatedTransport.base.setHidden(false);
  });
  await expect
    .poll(async () => (await hostState(page)).metrics.authority.ticks)
    .toBeGreaterThan(paused.authority.ticks);
});
