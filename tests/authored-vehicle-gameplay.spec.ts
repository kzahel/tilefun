import { expect, type Page, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { AUTONOMOUS_ORIGINAL_VEHICLES } from "../src/traffic/AutonomousOriginalVehicles.fixture.js";
import type { SavedTraffic } from "../src/traffic/TrafficSystem.js";
import type { TrafficCanvas } from "../src/workshop/TrafficPage.js";
import { flushLocalWorld, worldRecords } from "./helpers/local-world.js";

test.use({ channel: "chromium" });

test("every compact uses its own GLB in the shared traffic presentation", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  for (const number of [1, 2, 3, 4, 5, 6]) {
    await page.getByLabel("Playground vehicle", { exact: true }).selectOption(`compact-${number}`);
    await expect(canvas).toHaveAttribute("data-ready", "true");
    const assetId = `compact-${number}-authored-${number <= 2 ? "v7" : "v1"}`;
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas, id) => {
          const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
            gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
          };
          return gpu?.gpu?.vehicleAssets?.[id];
        }, assetId),
      )
      .toMatchObject({ state: "ready", meshes: 55, drawMeshes: 8 });
    expect(
      await canvas.evaluate(
        (c: TrafficCanvas) => c.__presentationDiagnostics?.().meshEligibleVehicleTypes,
      ),
    ).toContain(`vehicle-v1:compact-${number}`);
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
      )
      .toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

test("every additional sedan loads its own GLB in shared traffic", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  for (const color of ["red", "beige", "cyan", "orange", "silver", "olive", "dark"]) {
    const vehicle = `unindexed-sedan-${color}`;
    await page.getByLabel("Playground vehicle", { exact: true }).selectOption(vehicle);
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas, id) => {
          const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
            gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
          };
          return gpu?.gpu?.vehicleAssets?.[id];
        }, `${vehicle}-authored-v1`),
      )
      .toMatchObject({ state: "ready", meshes: 32, drawMeshes: 5 });
    expect(
      await canvas.evaluate(
        (c: TrafficCanvas) => c.__presentationDiagnostics?.().meshEligibleVehicleTypes,
      ),
    ).toContain(`vehicle-v1:${vehicle}`);
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
      )
      .toBeGreaterThan(0);
  }
});

test("every bus loads its own GLB in shared traffic", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  for (const number of [1, 2, 3, 4, 5, 6]) {
    const vehicle = `bus-${number}`;
    await page.getByLabel("Playground vehicle", { exact: true }).selectOption(vehicle);
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas, id) => {
          const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
            gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
          };
          return gpu?.gpu?.vehicleAssets?.[id];
        }, `${vehicle}-authored-v1`),
      )
      .toMatchObject({ state: "ready", meshes: 39 });
    expect(
      await canvas.evaluate(
        (c: TrafficCanvas) => c.__presentationDiagnostics?.().meshEligibleVehicleTypes,
      ),
    ).toContain(`vehicle-v1:${vehicle}`);
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
      )
      .toBeGreaterThan(0);
  }
});

test("every large car loads its own GLB in shared traffic", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  for (let number = 7; number <= 26; number++) {
    const vehicle = number === 12 ? "sedan-12" : `car-${number}`;
    await page.getByLabel("Playground vehicle", { exact: true }).selectOption(vehicle);
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas, id) => {
          const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
            gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
          };
          return gpu?.gpu?.vehicleAssets?.[id];
        }, `${vehicle}-authored-v1`),
      )
      .toMatchObject({ state: "ready", meshes: 34 });
    expect(
      await canvas.evaluate(
        (c: TrafficCanvas) => c.__presentationDiagnostics?.().meshEligibleVehicleTypes,
      ),
    ).toContain(`vehicle-v1:${vehicle}`);
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.().meshDraws ?? 0),
      )
      .toBeGreaterThan(0);
  }
});

for (const vehicle of [
  "compact-6",
  "unindexed-sedan-dark",
  "bus-6",
  "car-7",
  "car-15",
  "car-24",
  "garbage-truck-green",
  "garbage-truck-orange",
  "fire-truck-ladder-2",
  "police-car",
  "ambulance",
]) {
  test(`failed ${vehicle} fetch keeps the traffic scene and sprite fallback available`, async ({
    page,
  }) => {
    const revision = vehicle === "ambulance" ? "v3" : vehicle === "police-car" ? "v2" : "v1";
    await page.route(`**/assets/models/vehicles/${vehicle}-${revision}.glb`, (route) =>
      route.abort(),
    );
    await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
    await page.getByLabel("Playground vehicle", { exact: true }).selectOption(vehicle);
    const canvas = page.getByLabel("Generated traffic playground");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        canvas.evaluate((c: TrafficCanvas, id) => {
          const gpu = c.__presentationDiagnostics?.().terrain as unknown as {
            gpu?: { vehicleAssets?: Record<string, { state: string; meshes: number }> };
          };
          return gpu?.gpu?.vehicleAssets?.[id];
        }, `${vehicle}-authored-${revision}`),
      )
      .toMatchObject({ state: "failed", meshes: 0 });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-ready", "true");
  });
}

type VehicleGpuDiagnostics = {
  gpu?: {
    meshDraws: number;
    vehicleAssets?: Record<string, { state: string; meshes: number; drawMeshes: number }>;
  };
};

for (const family of AUTONOMOUS_ORIGINAL_VEHICLES) {
  const originals = (page: Page) =>
    page.evaluate((model) => {
      const game = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      return game.remoteView.serverEntities
        .filter((entity) => entity.type === `vehicle-v1:${model}`)
        .map((entity) => ({
          id: entity.id,
          type: entity.type,
          wx: entity.position.wx,
          wy: entity.position.wy,
          vx: entity.velocity?.vx ?? 0,
          vy: entity.velocity?.vy ?? 0,
        }));
    }, family.model);

  const savedOriginals = async (page: Page) =>
    (await worldRecords(page))
      .filter((record) => record.collection === "traffic")
      .map((record) => ({ key: record.key, value: record.value as SavedTraffic }))
      .filter((record) => record.value.model === family.model);

  async function originalPoint(page: Page, wx: number, wy: number) {
    return page.evaluate(
      ({ wx, wy }) => {
        const canvas = document.querySelector("#game") as HTMLCanvasElement;
        const game = (canvas as unknown as { __game: GameClient }).__game;
        game.camera.zoom = 1 / 3;
        game.camera.snapTo(wx, wy + 160);
        const point = game.camera.worldToScreen(wx, wy);
        const rect = canvas.getBoundingClientRect();
        return {
          x: rect.left + (point.sx * rect.width) / canvas.width,
          y: rect.top + (point.sy * rect.height) / canvas.height,
        };
      },
      { wx, wy },
    );
  }

  async function reopenOriginalWorld(page: Page, renderer: string) {
    await page.evaluate(async () => {
      const game = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      game.loop.stop();
      const host = game.netEmulatedTransport.base as unknown as {
        setHidden(value: boolean): void;
        flush(): Promise<void>;
        shutdown(): Promise<void>;
      };
      host.setHidden(true);
      await host.flush();
      await host.shutdown();
    });
    const saved = await savedOriginals(page);
    await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    return saved;
  }

  async function expectOriginalFallback(page: Page) {
    const frames = await page.evaluate(async (spritePath) => {
      const image = new Image();
      image.src = `/tilefun/${spritePath}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) throw Error("Missing fallback inspection context");
      context.drawImage(image, 0, 0);
      return {
        width: image.width,
        height: image.height,
        occupied: [0, 1, 2, 3].map((frame) => {
          const pixels = context.getImageData(0, frame * 224, 192, 224).data;
          let count = 0;
          for (let alpha = 3; alpha < pixels.length; alpha += 4)
            if ((pixels[alpha] ?? 0) > 0) count++;
          return count;
        }),
      };
    }, family.spritePath);
    expect(frames.width).toBe(192);
    expect(frames.height).toBe(896);
    for (const occupied of frames.occupied) expect(occupied).toBeGreaterThan(500);
  }

  for (const failed of [false, true]) {
    test(`${family.title} shares GPU traffic presentation and roof support with ${failed ? "failed-mesh sprite fallback" : "its own mesh"}`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      if (failed) await page.route(`**/${family.modelPath}`, (route) => route.abort());
      await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
      const canvas = page.getByLabel("Generated traffic playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await page.getByLabel("Playground vehicle", { exact: true }).selectOption(family.model);
      await expect(canvas).toHaveAttribute("data-ready", "true");
      const diagnostics = () =>
        canvas.evaluate(
          (surface: TrafficCanvas, { assetId }) => {
            const report = surface.__presentationDiagnostics?.();
            const terrain = report?.terrain as VehicleGpuDiagnostics | undefined;
            return {
              asset: terrain?.gpu?.vehicleAssets?.[assetId],
              meshDraws: report?.meshDraws ?? 0,
              eligible: report?.meshEligibleVehicleTypes,
            };
          },
          { assetId: family.assetId },
        );
      await expect
        .poll(async () => (await diagnostics()).asset?.state)
        .toBe(failed ? "failed" : "ready");
      expect((await diagnostics()).eligible).toContain(`vehicle-v1:${family.model}`);
      if (failed) {
        expect((await diagnostics()).asset).toMatchObject({
          state: "failed",
          meshes: 0,
          drawMeshes: 0,
        });
        await expectOriginalFallback(page);
      } else {
        expect((await diagnostics()).asset?.drawMeshes).toBe(family.meshCount);
        await expect.poll(async () => (await diagnostics()).meshDraws).toBeGreaterThan(0);
      }
      await page.getByRole("button", { name: "Start on roof", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-player-z", String(family.bounds[2]));
      const before = Number(await canvas.getAttribute("data-car-x"));
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-car-x")))
        .toBeGreaterThan(before + 15);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.screenshot({
        path: testInfo.outputPath(`${family.model}-traffic.png`),
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
  }

  test.describe(`${family.title} mobile editor gameplay`, () => {
    test.use({
      viewport: { width: 600, height: 800 },
      isMobile: true,
      hasTouch: true,
    });

    for (const { renderer, failed } of [
      { renderer: "canvas", failed: false },
      { renderer: "gpu&meshes", failed: false },
      { renderer: "gpu&meshes", failed: true },
    ]) {
      test(`${family.title} palette placement, boarding, driving, save/reload and deletion (${renderer}${failed ? ", failed mesh" : ""})`, async ({
        page,
      }, testInfo) => {
        test.setTimeout(60_000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        if (failed) await page.route(`**/${family.modelPath}`, (route) => route.abort());
        await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
        await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
        await page.evaluate(async () => {
          const game = (document.querySelector("#game") as unknown as { __game: GameClient })
            .__game;
          const generation = {
            type: "flat",
            version: "flat-v1",
            seed: 42,
            preset: "grass",
          } as const;
          const created = await game.gcSendRequest({
            type: "create-world",
            requestId: game.nextRequestId++,
            name: "Original vehicle editor gameplay",
            generation,
          });
          await game.gcSendRequest({
            type: "join-realm",
            requestId: game.nextRequestId++,
            worldId: created.meta.id,
            arrival: { x: 0, y: 0, generation },
          });
        });
        await page.getByTestId("main-menu-toggle").tap();
        await page.getByRole("button", { name: "Edit", exact: true }).tap();
        await page.locator('[data-editor-tab="vehicles"]').tap();
        const picker = page.getByRole("group", { name: "Vehicle picker" });
        await picker.getByRole("button", { name: family.name, exact: true }).tap();
        await expect(page.getByTestId("editor-selection")).toHaveText(family.name);
        const ground = await page.evaluate(() => {
          const game = (document.querySelector("#game") as unknown as { __game: GameClient })
            .__game;
          return [-200, -120, 0, 120, 200]
            .flatMap((wx) => [-200, -120, 0, 120, 200].map((wy) => ({ wx, wy })))
            .filter(({ wx, wy }) =>
              [-80, 80].every((dx) =>
                [-80, 80].every((dy) =>
                  game.stateView.world.getChunkIfLoaded(
                    Math.floor((wx + dx) / 256),
                    Math.floor((wy + dy) / 256),
                  ),
                ),
              ),
            )
            .map((point) => ({
              ...point,
              clearance: Math.min(
                ...game.remoteView.serverEntities.map((entity) =>
                  Math.hypot(entity.position.wx - point.wx, entity.position.wy - point.wy),
                ),
              ),
            }))
            .sort((a, b) => b.clearance - a.clearance)[0];
        });
        if (!ground || ground.clearance < 120)
          throw Error("No clear loaded original vehicle placement footprint");
        const spot = await originalPoint(page, ground.wx, ground.wy);
        const touch = await page.context().newCDPSession(page);
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ ...spot, id: 1 }],
        });
        await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await touch.detach();
        await expect.poll(async () => (await originals(page)).length).toBe(1);
        const car = (await originals(page))[0];
        if (!car) throw Error("No placed original vehicle");
        expect(car.type).toBe(`vehicle-v1:${family.model}`);
        await flushLocalWorld(page);
        const placedRecords = await savedOriginals(page);
        expect(placedRecords).toHaveLength(1);
        const placed = placedRecords[0];
        if (!placed) throw Error("Missing durable placed original vehicle");
        expect(placed.value).toMatchObject({
          model: family.model,
          placed: true,
          persistentId: placed.key,
        });
        expect(placed.value.identity).toMatch(/^placed-vehicle-v1:/);
        if (renderer.includes("meshes")) {
          const diagnostics = () =>
            page.evaluate(() => {
              const game = (document.querySelector("#game") as unknown as { __game: GameClient })
                .__game;
              const report = game.renderer.getDiagnostics() as VehicleGpuDiagnostics;
              return report.gpu;
            });
          await expect
            .poll(async () => (await diagnostics())?.vehicleAssets?.[family.assetId])
            .toMatchObject(
              failed
                ? { state: "failed", meshes: 0, drawMeshes: 0 }
                : { state: "ready", drawMeshes: family.meshCount },
            );
          if (!failed)
            await expect.poll(async () => (await diagnostics())?.meshDraws ?? 0).toBeGreaterThan(0);
        }
        if (failed || renderer === "canvas") await expectOriginalFallback(page);
        await page.screenshot({ path: testInfo.outputPath(`${family.model}-placed.png`) });
        await page.touchscreen.tap(spot.x, spot.y);
        await expect.poll(async () => (await originals(page)).length).toBe(1);
        await page.getByRole("button", { name: "Exit editor", exact: true }).tap();
        await page.evaluate(async ({ wx, wy }) => {
          const game = (document.querySelector("#game") as unknown as { __game: GameClient })
            .__game;
          await game.gcSendRequest({
            type: "rcon",
            requestId: game.nextRequestId++,
            command: `tp ${wx} ${wy - 16}`,
          });
        }, car);
        await page.getByRole("button", { name: /^Drive car(?: · [EY])?$/ }).tap();
        const parent = () =>
          page.evaluate(
            () =>
              (document.querySelector("#game") as unknown as { __game: GameClient }).__game
                .remoteView.serverPlayerEntity.parentId,
          );
        await expect.poll(parent).toBe(car.id);
        await page.locator("#game").focus();
        await page.keyboard.down("ArrowRight");
        await expect
          .poll(async () => (await originals(page))[0]?.wx ?? 0)
          .toBeGreaterThan(car.wx + 30);
        await page.keyboard.up("ArrowRight");
        await expect
          .poll(async () => {
            const current = (await originals(page))[0];
            return current ? Math.hypot(current.vx, current.vy) : Infinity;
          })
          .toBeLessThan(0.01);
        const driven = (await originals(page))[0];
        const savedRecords = await reopenOriginalWorld(page, renderer);
        expect(savedRecords).toHaveLength(1);
        const saved = savedRecords[0];
        if (!saved) throw Error("Missing saved original vehicle");
        expect(saved.key).toBe(placed.key);
        expect(saved.value).toMatchObject({
          model: family.model,
          placed: true,
          identity: placed.value.identity,
          persistentId: placed.key,
        });
        await expect
          .poll(async () => (await originals(page))[0]?.type)
          .toBe(`vehicle-v1:${family.model}`);
        const restored = (await originals(page))[0];
        if (!restored) throw Error("Missing rehydrated original vehicle");
        expect(restored.wx).toBeCloseTo(saved.value.wx ?? NaN, 3);
        expect(restored.wy).toBeCloseTo(saved.value.wy ?? NaN, 3);
        expect(restored.wx).toBeGreaterThan(car.wx + 30);
        expect(driven?.wx).toBeGreaterThan(car.wx + 30);
        const restoredRecord = (await savedOriginals(page)).find(
          (record) => record.key === placed.key,
        );
        expect(restoredRecord?.value).toMatchObject({
          identity: placed.value.identity,
          placed: true,
        });
        // Runtime entity IDs are remapped during hydration; boarding follows the
        // newly restored entity while the saved identity remains unchanged.
        await expect.poll(parent).toBe(restored.id);
        await page.getByRole("button", { name: /^Get out(?: · [EY])?$/ }).tap();
        const parked = (await originals(page))[0];
        if (!parked) throw Error("Lost original vehicle after reload");
        await page.waitForTimeout(350);
        expect((await originals(page))[0]).toEqual(parked);
        await page.getByTestId("main-menu-toggle").tap();
        await page.getByRole("button", { name: "Edit", exact: true }).tap();
        await page.locator('[data-editor-tab="vehicles"]').tap();
        await picker.getByRole("button", { name: "Delete", exact: true }).tap();
        const body = await originalPoint(page, parked.wx, parked.wy - 20);
        await page.touchscreen.tap(body.x, body.y);
        await expect.poll(async () => (await originals(page)).length).toBe(0);
        expect(await reopenOriginalWorld(page, renderer)).toEqual([]);
        await expect.poll(async () => (await originals(page)).length).toBe(0);
        expect(await savedOriginals(page)).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  });
}
