import { expect, type Page, test } from "@playwright/test";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

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
    const position = { ...g.stateView.playerEntity.position };
    await g.netEmulatedTransport.base.shutdown();
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
