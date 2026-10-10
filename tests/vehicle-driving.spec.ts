import { expect, type Page, test } from "@playwright/test";
import type { ClientStateView, RemoteStateView } from "../src/client/ClientStateView.js";
import type { GameLoop } from "../src/core/GameLoop.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import type { TapMovement } from "../src/input/TapMovement.js";
import { projectWorld } from "../src/rendering/Projection.js";
import type { RequestMessage } from "../src/shared/requests.js";
import type { WorkerClientTransport } from "../src/transport/WorkerClientTransport.js";

type Game = {
  stateView: ClientStateView;
  remoteView: RemoteStateView;
  loop: GameLoop;
  tapMovement: TapMovement;
  gcSendRequest(request: RequestMessage): Promise<unknown>;
  nextRequestId: number;
  netEmulatedTransport: { base: WorkerClientTransport };
};
test.use({
  channel: "chromium",
  isMobile: true,
  hasTouch: true,
  viewport: { width: 600, height: 800 },
});
async function read(page: Page) {
  return page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
    const p = g.remoteView.serverPlayerEntity;
    const car = g.remoteView.serverEntities.find((e) => e.id === p.parentId);
    return {
      id: p.id,
      parent: p.parentId ?? null,
      x: p.position.wx,
      y: p.position.wy,
      speed: Math.hypot(car?.velocity?.vx ?? 0, car?.velocity?.vy ?? 0),
      type: car?.type,
      editing: g.stateView.editorEnabled,
      target: g.tapMovement.target,
    };
  });
}
async function start(page: Page, backend: string, cars = false) {
  const generation = createDescriptor("regional", 2026);
  const arrival = cars ? { x: 300, y: 519, generation } : undefined;
  await page.goto(
    `/tilefun/?nogamepad&renderer=${backend}&generation=${encodeURIComponent(JSON.stringify(generation))}${arrival ? `&arrival=${encodeURIComponent(JSON.stringify(arrival))}` : ""}`,
  );
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.getByPlaceholder("World name...").fill("Vehicle driving");
  await page.getByRole("button", { name: "New World", exact: true }).tap();
  await expect(page.getByRole("button", { name: "New World", exact: true })).not.toBeVisible();
  await expect(page.locator("#game")).toHaveAttribute(
    "data-generation",
    JSON.stringify(generation),
  );
  await expect.poll(async () => (await read(page)).id).not.toBe(-1);
  if ((await read(page)).editing) await page.keyboard.press("Tab");
}
async function tapMode(page: Page) {
  await page.locator("button[aria-label=Options]").tap();
  await page.getByRole("button", { name: "Tap to move", exact: true }).tap();
  await page.getByRole("button", { name: "Back to game", exact: true }).tap();
}
for (const backend of ["canvas", "gpu"]) {
  test(`car boarding, tap destination, saved inside seat and exit (${backend})`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page, backend, true);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
            return g.stateView.entities.some((e) => e.type.startsWith("vehicle-v1:"));
          }),
        { timeout: 15000 },
      )
      .toBe(true);
    await page.evaluate(async () => {
      const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
      const car = g.stateView.entities.find((e) => e.type.startsWith("vehicle-v1:"));
      if (!car?.collider) throw Error("No car");
      const dir = car.sprite?.direction ?? 3;
      const dx = dir === 3 ? 1 : dir === 2 ? -1 : 0,
        dy = dir === 0 ? 1 : dir === 1 ? -1 : 0;
      const x = car.position.wx + car.collider.offsetX + dx * (car.collider.width / 2 + 12);
      const y =
        car.position.wy +
        car.collider.offsetY -
        car.collider.height / 2 +
        dy * (car.collider.height / 2 + 12);
      await g.gcSendRequest({
        type: "rcon",
        requestId: g.nextRequestId++,
        command: `tp ${x} ${y}`,
      });
    });
    await expect(page.getByRole("button", { name: "Drive car · E", exact: true })).toBeVisible({
      timeout: 15000,
    });
    await tapMode(page);
    await page.getByRole("button", { name: "Drive car · E", exact: true }).tap();
    await expect.poll(async () => (await read(page)).parent).not.toBeNull();
    expect((await read(page)).type).toMatch(/^vehicle-v1:/);
    const before = await read(page);
    const target = await page.evaluate(() => {
      const canvas = document.querySelector("#game") as HTMLCanvasElement;
      const g = (canvas as unknown as { __game: Game }).__game;
      const p = g.stateView.playerEntity;
      const rect = canvas.getBoundingClientRect();
      const view = g.stateView.entities.find((e) => e.id === p.parentId);
      const dir = view?.sprite?.direction ?? 3;
      return {
        p: p.position,
        dx: dir === 2 ? -64 : dir === 3 ? 64 : 0,
        dy: dir === 0 ? 64 : dir === 1 ? -64 : 0,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        camera: (
          g.tapMovement as unknown as { view: import("../src/rendering/RenderFrame.js").RenderView }
        ).view,
        z: p.wz ?? 0,
      };
    });
    const point = projectWorld(
      target.camera,
      target.p.wx + target.dx,
      target.p.wy + target.dy,
      target.z,
    );
    await page.touchscreen.tap(
      target.rect.x + (point.sx * target.rect.width) / target.camera.viewportWidth,
      target.rect.y + (point.sy * target.rect.height) / target.camera.viewportHeight,
    );
    await expect
      .poll(async () => {
        const s = await read(page);
        return Math.hypot(s.x - before.x, s.y - before.y);
      })
      .toBeGreaterThan(16);
    await expect.poll(async () => (await read(page)).target, { timeout: 10000 }).toBeNull();
    await expect.poll(async () => (await read(page)).speed).toBeLessThan(0.1);
    await page.screenshot({ path: `/tmp/tilefun-driving-car-${backend}.png` });
    await page.evaluate(async () => {
      const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
      g.loop.stop();
      g.netEmulatedTransport.base.setHidden(true);
      await g.netEmulatedTransport.base.flush();
      await g.netEmulatedTransport.base.shutdown();
    });
    await page.goto(`/tilefun/?nogamepad&renderer=${backend}`);
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect.poll(async () => (await read(page)).parent).not.toBeNull();
    if ((await read(page)).editing) await page.keyboard.press("Tab");
    await page.getByRole("button", { name: "Get out · E", exact: true }).tap();
    await expect.poll(async () => (await read(page)).parent).toBeNull();
    expect(errors).toEqual([]);
  });
  test(`train side taps start, repeat to stop, reverse, and UI taps stay isolated (${backend})`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page, backend);
    const enter = page.getByRole("button", { name: "Drive train · E", exact: true });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
            return g.stateView.entities.some((e) => e.type.startsWith("train"));
          }),
        { timeout: 15000 },
      )
      .toBe(true);
    await page.evaluate(async () => {
      const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
      const trains = g.stateView.entities.filter((e) => e.type.startsWith("train"));
      const direction = (trains[0]?.velocity?.vx ?? 0) < 0 ? -1 : 1;
      const lead = trains.sort((a, b) => direction * (b.position.wx - a.position.wx))[0];
      if (!lead?.collider) throw Error("No train");
      const x =
        lead.position.wx + lead.collider.offsetX + direction * (lead.collider.width / 2 + 12);
      await g.gcSendRequest({
        type: "rcon",
        requestId: g.nextRequestId++,
        command: `tp ${x} ${lead.position.wy + lead.collider.offsetY}`,
      });
    });
    await expect(enter).toBeVisible({ timeout: 15000 });
    await tapMode(page);
    await expect(enter).toBeEnabled();
    await enter.tap();
    await expect.poll(async () => (await read(page)).parent).not.toBeNull();
    expect((await read(page)).type).toMatch(/^train/);
    await page.touchscreen.tap(530, 300);
    await expect.poll(async () => (await read(page)).speed).toBeGreaterThan(24);
    await page.touchscreen.tap(530, 300);
    await expect.poll(async () => (await read(page)).speed).toBeLessThan(0.1);
    const stopped = await read(page);
    await page.waitForTimeout(400);
    expect(
      Math.hypot((await read(page)).x - stopped.x, (await read(page)).y - stopped.y),
    ).toBeLessThan(1);
    await page.touchscreen.tap(70, 300);
    await expect.poll(async () => (await read(page)).x).toBeLessThan(stopped.x - 8);
    await page.locator("button[aria-label=Options]").tap();
    await expect.poll(async () => (await read(page)).speed).toBeLessThan(0.1);
    await page.getByRole("button", { name: "Back to game", exact: true }).tap();
    expect((await read(page)).speed).toBeLessThan(0.1);
    await page.screenshot({ path: `/tmp/tilefun-driving-train-${backend}.png` });
    await page.getByRole("button", { name: "Get out · E", exact: true }).tap();
    await expect.poll(async () => (await read(page)).parent).toBeNull();
    expect(errors).toEqual([]);
  });
}
