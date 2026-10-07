import { expect, type Page, test } from "@playwright/test";
import type { ClientStateView, RemoteStateView } from "../src/client/ClientStateView.js";
import type { GameLoop } from "../src/core/GameLoop.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import type { WorkerClientTransport } from "../src/transport/WorkerClientTransport.js";

test.use({ channel: "chromium" });
type Game = {
  stateView: ClientStateView;
  remoteView: RemoteStateView;
  loop: GameLoop;
  netEmulatedTransport: { base: WorkerClientTransport };
};
const read = (page: Page) =>
  page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
    const car = g.stateView.entities.find((e) => e.type === "train-curve-proof-v1");
    const player = g.stateView.playerEntity;
    const server = g.stateView.serverPlayerPosition;
    return {
      editing: g.stateView.editorEnabled,
      x: player.position.wx,
      y: player.position.wy,
      z: player.wz ?? 0,
      serverZ: server?.wz ?? 0,
      trainX: car?.position.wx ?? 0,
      trainY: car?.position.wy ?? 0,
      heading: car?.sprite?.frameRow ?? 0,
      speed: Math.hypot(car?.velocity?.vx ?? 0, car?.velocity?.vy ?? 0),
      naturalProps: g.stateView.props.filter((p) => p.proceduralId?.startsWith("nature:")).length,
      railChunks: [...g.stateView.world.chunks.entries()].filter(([, c]) => c.railPaths.length > 0)
        .length,
    };
  });
for (const backend of ["canvas", "gpu"]) {
  test(`ride a generated train between cities, reopen mid-bend and alight (${backend})`, async ({
    page,
  }) => {
    test.setTimeout(150000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/?nogamepad&renderer=${backend}&generation=${encodeURIComponent(JSON.stringify(createDescriptor("regional", 2026)))}`,
    );
    await page.getByPlaceholder("World name...").fill(`City train ride ${backend}`);
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.locator("#game")).toHaveAttribute(
      "data-generation",
      JSON.stringify(createDescriptor("regional", 2026)),
    );
    await expect.poll(async () => (await read(page)).trainX, { timeout: 15000 }).toBe(2543 * 16);
    await expect
      .poll(async () => (await read(page)).railChunks, { timeout: 15000 })
      .toBeGreaterThan(0);
    if ((await read(page)).editing) await page.keyboard.press("Tab");
    await page.keyboard.down("ArrowDown");
    await page.keyboard.down("Space");
    await page.waitForTimeout(950);
    await page.keyboard.up("ArrowDown");
    await page.keyboard.up("Space");
    await expect.poll(async () => (await read(page)).serverZ).toBe(44);
    await expect
      .poll(async () => (await read(page)).speed, { timeout: 15000 })
      .toBeGreaterThan(100);
    await expect
      .poll(
        async () => {
          const s = await read(page);
          return s.heading % 64 > 16 && s.heading % 64 < 48;
        },
        { timeout: 35000 },
      )
      .toBe(true);
    expect((await read(page)).serverZ).toBe(44);
    expect((await read(page)).naturalProps).toBeGreaterThan(0);
    await page.screenshot({ path: `/tmp/tilefun-city-train-bend-${backend}.png` });
    const saved = await page.evaluate(async () => {
      const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
      g.loop.stop();
      const host = g.netEmulatedTransport.base;
      host.setHidden(true);
      await host.flush();
      while (g.remoteView.pendingMessageCount) g.remoteView.applyPending();
      const player = g.remoteView.serverPlayerEntity,
        car = g.remoteView.entities.find((e) => e.type === "train-curve-proof-v1");
      const result = {
        x: player.position.wx,
        y: player.position.wy,
        z: player.wz,
        trainX: car?.position.wx,
      };
      await host.shutdown();
      return result;
    });
    await page.goto(`/tilefun/?nogamepad&renderer=${backend}`);
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect.poll(async () => (await read(page)).serverZ).toBe(44);
    const restored = await read(page);
    expect(saved.z).toBe(44);
    // Authority may run during startup; allow one second of service travel.
    expect(Math.hypot(restored.x - saved.x, restored.y - saved.y)).toBeLessThan(192);
    if (restored.editing) await page.keyboard.press("Tab");
    await expect
      .poll(
        async () => {
          const s = await read(page);
          expect(s.serverZ).toBe(44);
          return Math.abs(s.trainX - 3422 * 16) < 0.1 && s.speed < 0.1;
        },
        { timeout: 90000, intervals: [500] },
      )
      .toBe(true);
    await page.screenshot({ path: `/tmp/tilefun-city-train-arrival-${backend}.png` });
    await page.keyboard.down("ArrowUp");
    await page.keyboard.down("Space");
    await page.waitForTimeout(950);
    await page.keyboard.up("ArrowUp");
    await page.keyboard.up("Space");
    await expect.poll(async () => (await read(page)).serverZ).toBe(0);
    expect((await read(page)).y).toBeLessThan(-2658 * 16 - 30);
    expect(errors).toEqual([]);
  });
}
test("generated city-train lab supports a saved roof ride on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/workshop.html?geometry=city-trains#/tool/world-geometry");
  const c = page.getByLabel("World geometry scene");
  await expect(c).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Ride train roof", exact: true }).click();
  await expect(c).toHaveAttribute("data-server-z", "44");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
  await expect(c).toHaveAttribute("data-reload-count", "1");
  await expect(c).toHaveAttribute("data-server-z", "44");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-city-train-phone.png", fullPage: true });
});
