import { expect, type Page, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";

const vehicles = (page: Page) =>
  page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    return g.remoteView.serverEntities
      .filter((e) => e.type.startsWith("vehicle-v1:"))
      .map((e) => ({
        id: e.id,
        type: e.type,
        wx: e.position.wx,
        wy: e.position.wy,
        state: e.emergencyState,
      }));
  });
async function point(page: Page, wx: number, wy: number) {
  return page.evaluate(
    ({ wx, wy }) => {
      const canvas = document.querySelector("#game") as HTMLCanvasElement;
      const g = (canvas as unknown as { __game: GameClient }).__game;
      g.camera.zoom = 1 / 3;
      g.camera.snapTo(wx, wy + 160);
      const p = g.camera.worldToScreen(wx, wy),
        rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + (p.sx * rect.width) / canvas.width,
        y: rect.top + (p.sy * rect.height) / canvas.height,
      };
    },
    { wx, wy },
  );
}
async function reopen(page: Page, renderer: string) {
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    g.loop.stop();
    const host = g.netEmulatedTransport.base as unknown as {
      setHidden(v: boolean): void;
      flush(): Promise<void>;
      shutdown(): Promise<void>;
    };
    host.setHidden(true);
    await host.flush();
    await host.shutdown();
  });
  await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
}
test.use({
  channel: "chromium",
  viewport: { width: 600, height: 800 },
  isMobile: true,
  hasTouch: true,
});
for (const [model, label] of [
  ["ambulance", "Ambulance"],
  ["rosso-coupe", "Red sports coupe"],
]) {
  for (const renderer of ["canvas", "gpu&meshes"]) {
    test(`place, drive, save and delete ${model} through the mobile editor in a roadless world (${renderer})`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
      await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
      await page.evaluate(async () => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
        const created = await g.gcSendRequest({
          type: "create-world",
          requestId: g.nextRequestId++,
          name: "Placed vehicles",
          generation,
        });
        await g.gcSendRequest({
          type: "join-realm",
          requestId: g.nextRequestId++,
          worldId: created.meta.id,
          arrival: { x: 0, y: 0, generation },
        });
        g.camera.zoom = 1 / 3;
      });
      await page.getByTestId("main-menu-toggle").tap();
      await page.getByRole("button", { name: "Edit", exact: true }).tap();
      await page.locator('[data-editor-tab="vehicles"]').tap();
      const picker = page.getByRole("group", { name: "Vehicle picker" });
      await expect(picker.getByRole("button")).toHaveCount(47);
      expect((await page.getByTestId("editor-panel").boundingBox())?.height).toBeLessThanOrEqual(
        400,
      );
      await picker.getByRole("button", { name: "Raised-ladder firetruck", exact: true }).tap();
      await expect(page.getByTestId("editor-selection")).toHaveText("Raised-ladder firetruck");
      await picker.getByRole("button", { name: label, exact: true }).tap();
      // Ambient chickens move in flat worlds. Choose a loaded, clear footprint
      // rather than accidentally testing the legitimate body-overlap rejection.
      const ground = await page.evaluate(() => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        const points = [-200, -120, 0, 120, 200].flatMap((wx) =>
          [-200, -120, 0, 120, 200].map((wy) => ({ wx, wy })),
        );
        return points
          .filter(({ wx, wy }) =>
            [-64, 64].every((dx) =>
              [-32, 32].every((dy) =>
                g.stateView.world.getChunkIfLoaded(
                  Math.floor((wx + dx) / 256),
                  Math.floor((wy + dy) / 256),
                ),
              ),
            ),
          )
          .map((p) => ({
            ...p,
            clearance: Math.min(
              ...g.remoteView.serverEntities.map((e) =>
                Math.hypot(e.position.wx - p.wx, e.position.wy - p.wy),
              ),
            ),
          }))
          .sort((a, b) => b.clearance - a.clearance)[0];
      });
      if (!ground || ground.clearance < 100) throw Error("No clear loaded placement footprint");
      const spot = await point(page, ground.wx, ground.wy);
      const touch = await page.context().newCDPSession(page);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ ...spot, id: 1 }],
      });
      const preview = await page.evaluate(() => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        return [g.editorMode.cursorWorldX, g.editorMode.cursorWorldY];
      });
      expect(preview[0]).toBeCloseTo(ground.wx, 0);
      expect(preview[1]).toBeCloseTo(ground.wy, 0);
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await touch.detach();
      await expect.poll(async () => (await vehicles(page)).length).toBe(1);
      const car = (await vehicles(page))[0];
      if (!car) throw Error("No placed ambulance");
      expect(car.type).toBe(`vehicle-v1:${model}`);
      if (model === "rosso-coupe" && renderer.includes("meshes")) {
        await expect
          .poll(() =>
            page.evaluate(() => {
              const g = (document.querySelector("#game") as unknown as { __game: GameClient })
                .__game;
              const d = g.renderer.getDiagnostics() as {
                gpu?: { vehicleAssets?: Record<string, { state: string; drawMeshes: number }> };
              };
              return d.gpu?.vehicleAssets?.["rosso-coupe-authored-v3"];
            }),
          )
          .toEqual(expect.objectContaining({ state: "ready", drawMeshes: 5 }));
      }
      await page.screenshot({
        path: `/tmp/tilefun-placement-picker-${renderer.replaceAll("&", "-")}.png`,
      });
      await page.touchscreen.tap(spot.x, spot.y); // No overlapping duplicate.
      await page.getByRole("button", { name: "Exit editor", exact: true }).tap();
      await expect.poll(async () => (await vehicles(page)).length).toBe(1);
      await page.evaluate(async ({ wx, wy }) => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        await g.gcSendRequest({
          type: "rcon",
          requestId: g.nextRequestId++,
          command: `tp ${wx} ${wy - 16}`,
        });
      }, car);
      await page.getByRole("button", { name: /^Drive car(?: · [EY])?$/ }).tap();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
            return g.remoteView.serverPlayerEntity.parentId;
          }),
        )
        .toBe(car.id);
      await page.locator("#game").focus();
      if (model === "ambulance") {
        await page.keyboard.press("l", { delay: 80 });
        await expect.poll(async () => (await vehicles(page))[0]?.state).toBe(3);
      }
      await page.keyboard.down("ArrowRight");
      await expect
        .poll(async () => (await vehicles(page))[0]?.wx ?? 0)
        .toBeGreaterThan(car.wx + 30);
      await page.keyboard.up("ArrowRight");
      await reopen(page, renderer);
      await expect.poll(async () => (await vehicles(page))[0]?.type).toBe(`vehicle-v1:${model}`);
      if (model === "ambulance")
        await expect.poll(async () => (await vehicles(page))[0]?.state).toBe(3);
      await expect(page.getByRole("button", { name: /^Get out(?: · [EY])?$/ })).toBeVisible();
      await page.getByRole("button", { name: /^Get out(?: · [EY])?$/ }).tap();
      const parked = (await vehicles(page))[0];
      if (!parked) throw Error("Lost vehicle");
      await page.waitForTimeout(350);
      expect((await vehicles(page))[0]).toEqual(parked);
      await page.getByTestId("main-menu-toggle").tap();
      await page.getByRole("button", { name: "Edit", exact: true }).tap();
      await page.locator('[data-editor-tab="vehicles"]').tap();
      await picker.getByRole("button", { name: "Delete", exact: true }).tap();
      const body = await point(page, parked.wx, parked.wy - 20);
      await page.touchscreen.tap(body.x, body.y);
      await expect.poll(async () => (await vehicles(page)).length).toBe(0);
      await page.screenshot({
        path: `/tmp/tilefun-vehicle-placement-${renderer.replaceAll("&", "-")}.png`,
      });
      await reopen(page, renderer);
      await expect.poll(async () => (await vehicles(page)).length).toBe(0);
      expect(errors).toEqual([]);
    });
  }
}
