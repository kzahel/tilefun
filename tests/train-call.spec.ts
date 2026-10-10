import { expect, type Page, test } from "@playwright/test";
import { required } from "../src/art/ArtCatalog.js";
import type { ClientStateView, RemoteStateView } from "../src/client/ClientStateView.js";
import type { GameLoop } from "../src/core/GameLoop.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";
import { RailwayPlanner } from "../src/railway/RailwayPlanner.js";
import type { RequestMessage } from "../src/shared/requests.js";
import type { WorkerClientTransport } from "../src/transport/WorkerClientTransport.js";

type Game = {
  stateView: ClientStateView;
  remoteView: RemoteStateView;
  loop: GameLoop;
  gcSendRequest(request: RequestMessage): Promise<unknown>;
  nextRequestId: number;
  netEmulatedTransport: { base: WorkerClientTransport };
};
test.use({
  channel: "chromium",
  isMobile: true,
  hasTouch: true,
  viewport: { width: 390, height: 844 },
});

async function read(page: Page) {
  return page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
    const cars = g.remoteView.serverEntities.filter((e) =>
      e.type.startsWith("train-curve-proof-v1"),
    );
    const train = cars.find((e) => e.type === "train-curve-proof-v1");
    return {
      editing: g.stateView.editorEnabled,
      trainX: train?.position.wx ?? 0,
      speed: Math.hypot(train?.velocity?.vx ?? 0, train?.velocity?.vy ?? 0),
      count: cars.length,
      ids: cars.map((c) => c.id),
    };
  });
}
async function teleport(page: Page, x: number, y: number) {
  await page.evaluate(
    async ({ x, y }) => {
      const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
      await g.gcSendRequest({
        type: "rcon",
        requestId: g.nextRequestId++,
        command: `tp ${x} ${y}`,
      });
    },
    { x, y },
  );
  // RCON acknowledges before its asynchronous ready-terrain teleport finishes.
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ x, y }) => {
            const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
            const p = g.remoteView.serverPlayerEntity.position;
            return Math.hypot(p.wx - x, p.wy - y);
          },
          { x, y },
        ),
      { timeout: 15000 },
    )
    .toBeLessThan(1);
}

for (const backend of ["canvas", "gpu"]) {
  test(`call a departed train by touch at either station and keep it after reload (${backend})`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const generation = createDescriptor("regional", 2026);
    const planner = new RailwayPlanner(regionalWorld(2026));
    const start = required(planner.start());
    const line = required(
      planner.query({
        minX: start.x - 1,
        maxX: start.x + 1,
        minY: start.y - 1,
        maxY: start.y + 1,
      })[0],
    );
    const [first, second] = line.stations;
    await page.goto(
      `/tilefun/?nogamepad&renderer=${backend}&generation=${encodeURIComponent(JSON.stringify(generation))}`,
    );
    await page.getByPlaceholder("World name...").fill(`Train call ${backend}`);
    await page.getByRole("button", { name: "New World", exact: true }).tap();
    await expect(page.locator("#game")).toHaveAttribute(
      "data-generation",
      JSON.stringify(generation),
    );
    await expect.poll(async () => (await read(page)).count, { timeout: 15000 }).toBe(3);
    if ((await read(page)).editing) await page.keyboard.press("Tab");
    await teleport(page, (first.x - 12) * 16, (first.y - 3) * 16);
    const call = page.getByRole("button", { name: "Call train · E", exact: true });
    await expect(call).toBeVisible();
    await expect
      .poll(async () => (await read(page)).trainX, { timeout: 20000 })
      .toBeGreaterThan(first.x * 16 + 100);
    const ids = (await read(page)).ids;
    await call.tap();
    await expect(
      page.getByRole("status").filter({ hasText: "Poof! Your train is here." }),
    ).toBeVisible();
    await expect.poll(async () => (await read(page)).trainX).toBe(first.x * 16);
    expect((await read(page)).speed).toBe(0);
    expect((await read(page)).ids).toEqual(ids);
    await page.screenshot({ path: `/tmp/tilefun-train-call-${backend}.png` });
    await page.keyboard.press("Tab");
    await expect(call).not.toBeVisible();
    await page.keyboard.press("Tab");
    await teleport(page, (second.x - 12) * 16, (second.y - 3) * 16);
    await expect(call).toBeVisible({ timeout: 15000 });
    await expect(call).toBeEnabled();
    await page.keyboard.press("e");
    await expect
      .poll(async () => (await read(page)).trainX, { timeout: 15000 })
      .toBe(second.x * 16);
    expect((await read(page)).count).toBe(3);
    await page.evaluate(async () => {
      const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
      g.loop.stop();
      const host = g.netEmulatedTransport.base;
      host.setHidden(true);
      await host.flush();
      await host.shutdown();
    });
    await page.goto(`/tilefun/?nogamepad&renderer=${backend}`);
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect
      .poll(async () => (await read(page)).trainX, { timeout: 15000 })
      .toBe(second.x * 16);
    expect((await read(page)).count).toBe(3);
    expect(errors).toEqual([]);
  });
}
