import { expect, type Page, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { VEHICLE_PAINTS } from "../src/traffic/VehiclePaint.js";
import type { TrafficCanvas } from "../src/workshop/TrafficPage.js";
import { flushLocalWorld, stopLocalWorld, worldRecords } from "./helpers/local-world.js";

test.use({ channel: "chromium", hasTouch: true });
test.describe.configure({ mode: "parallel" });

type PaintGpu = {
  gpu?: {
    vehiclePaints?: Record<string, { state: string }>;
    vehiclePaintDraws?: number;
    vehiclePaintFallbacks?: number;
  };
};

test("all fourteen reviewed schemes use the shared GPU paint cache in Traffic", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("Generated traffic playground");
  for (const [model, family] of Object.entries(VEHICLE_PAINTS.families)) {
    await page.getByLabel("Playground vehicle", { exact: true }).selectOption(model);
    for (const scheme of family.schemes) {
      await page.getByLabel("Playground paint", { exact: true }).selectOption(scheme.id);
      await expect(canvas).toHaveAttribute("data-paint-scheme", scheme.id);
      await expect(canvas).toHaveAttribute(
        "data-car-sheet",
        `vehicle-v1:${model}:paint:${scheme.id}`,
      );
      await expect
        .poll(() =>
          canvas.evaluate((c: TrafficCanvas, atlas) => {
            const d = c.__presentationDiagnostics?.().terrain as unknown as PaintGpu;
            return {
              state: d?.gpu?.vehiclePaints?.[atlas]?.state,
              drawn: (d?.gpu?.vehiclePaintDraws ?? 0) > 0,
            };
          }, scheme.atlas),
        )
        .toEqual({ state: "ready", drawn: true });
    }
  }
  await page.getByLabel("Playground vehicle", { exact: true }).selectOption("compact-1");
  await expect(canvas).toHaveAttribute("data-paint-scheme", "original");
  await expect(page.getByLabel("Playground paint", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const [model, paint] of [
  ["beetle", "teal"],
  ["pickup", "forest-cream"],
  ["rosso-coupe", "navy-stripes"],
] as const) {
  for (const failure of ["mesh", "atlas"] as const) {
    test(`${model} preserves its ${paint} sprite when ${failure} loading fails`, async ({
      page,
    }) => {
      if (failure === "mesh")
        await page.route(`**/assets/models/vehicles/${model}-*.glb`, (route) => route.abort());
      else
        await page.route(`**/assets/vehicles/paint-v1/${model}-${paint}-atlas.png`, (route) =>
          route.abort(),
        );
      await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
      await page.getByLabel("Playground vehicle", { exact: true }).selectOption(model);
      await page.getByLabel("Playground paint", { exact: true }).selectOption(paint);
      const canvas = page.getByLabel("Generated traffic playground");
      await expect(canvas).toHaveAttribute("data-paint-scheme", paint);
      await expect(canvas).toHaveAttribute("data-car-sheet", `vehicle-v1:${model}:paint:${paint}`);
      if (failure === "atlas") {
        const atlas = VEHICLE_PAINTS.families[model].schemes.find((p) => p.id === paint)?.atlas;
        if (!atlas) throw Error("Missing paint fixture");
        await expect
          .poll(() =>
            canvas.evaluate((c: TrafficCanvas, path) => {
              const d = c.__presentationDiagnostics?.().terrain as unknown as PaintGpu;
              return {
                state: d?.gpu?.vehiclePaints?.[path]?.state,
                fallback: (d?.gpu?.vehiclePaintFallbacks ?? 0) > 0,
              };
            }, atlas),
          )
          .toEqual({ state: "failed", fallback: true });
      }
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.screenshot({
        path: `data/vehicle-bake/paint-runtime-qa/${model}-${paint}-${failure}-fallback.png`,
      });
    });
  }
}

function game(page: Page) {
  return page.evaluate(() => {
    const gc = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    return gc.remoteView.serverEntities
      .filter((e) => e.type.startsWith("vehicle-v1:"))
      .map((e) => ({ id: e.id, type: e.type, paint: e.paintSchemeId, sheet: e.sprite?.sheetKey }));
  });
}

for (const [model, label, paint, paintLabel] of [
  ["beetle", "Beetle-style compact", "teal", "Lagoon teal"],
  ["pickup", "Teal blue pickup truck", "forest-cream", "Forest / cream roof"],
  ["rosso-coupe", "Red sports coupe", "navy-stripes", "Navy / cream stripes"],
] as const) {
  for (const renderer of ["canvas", "gpu&meshes"]) {
    test(`mobile editor places and reloads ${model}/${paint} with ${renderer}`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: 600, height: 800 });
      await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
      await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
      await page.evaluate(async () => {
        const gc = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
        const created = await gc.gcSendRequest({
          type: "create-world",
          requestId: gc.nextRequestId++,
          name: "Painted cars",
          generation,
        });
        await gc.gcSendRequest({
          type: "join-realm",
          requestId: gc.nextRequestId++,
          worldId: created.meta.id,
          arrival: { x: 0, y: 0, generation },
        });
      });
      await page.getByTestId("main-menu-toggle").tap();
      await page.getByRole("button", { name: "Edit", exact: true }).tap();
      await page.locator('[data-editor-tab="vehicles"]').tap();
      await page
        .getByRole("group", { name: "Vehicle picker", exact: true })
        .getByRole("button", { name: label, exact: true })
        .tap();
      const paints = page.getByRole("group", { name: "Vehicle paint", exact: true });
      await paints.getByRole("button", { name: `Paint: ${paintLabel}`, exact: true }).tap();
      await expect(
        paints.getByRole("button", { name: `Paint: ${paintLabel}`, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      const point = await page.evaluate(() => {
        const canvas = document.querySelector("#game") as HTMLCanvasElement;
        const gc = (canvas as unknown as { __game: GameClient }).__game;
        const points = [-160, 0, 160].flatMap((wx) => [-160, 0, 160].map((wy) => ({ wx, wy })));
        const spot = points
          .map((p) => ({
            ...p,
            clearance: Math.min(
              ...gc.remoteView.serverEntities.map((e) =>
                Math.hypot(e.position.wx - p.wx, e.position.wy - p.wy),
              ),
            ),
          }))
          .sort((a, b) => b.clearance - a.clearance)[0];
        if (!spot || spot.clearance < 100) throw Error("No clear vehicle footprint");
        gc.camera.zoom = 1 / 3;
        gc.camera.snapTo(spot.wx, spot.wy + 160);
        const p = gc.camera.worldToScreen(spot.wx, spot.wy),
          rect = canvas.getBoundingClientRect();
        return {
          x: rect.left + (p.sx * rect.width) / canvas.width,
          y: rect.top + (p.sy * rect.height) / canvas.height,
        };
      });
      await page.touchscreen.tap(point.x, point.y);
      await expect
        .poll(() => game(page))
        .toEqual([
          expect.objectContaining({
            type: `vehicle-v1:${model}`,
            paint,
            sheet: `vehicle-v1:${model}:paint:${paint}`,
          }),
        ]);
      await flushLocalWorld(page);
      const records = (await worldRecords(page)).filter((r) => r.collection === "traffic");
      expect(
        records.some((r) => (r.value as { paintSchemeId?: string }).paintSchemeId === paint),
      ).toBe(true);
      await page.screenshot({
        path: `data/vehicle-bake/paint-runtime-qa/${model}-${renderer.replaceAll("&", "-")}-editor.png`,
      });
      await page.getByRole("button", { name: "Exit editor", exact: true }).tap();
      const car = await page.evaluate(async () => {
        const gc = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        const vehicle = gc.remoteView.serverEntities.find((e) => e.type.startsWith("vehicle-v1:"));
        if (!vehicle) throw Error("Missing painted car");
        await gc.gcSendRequest({
          type: "rcon",
          requestId: gc.nextRequestId++,
          command: `tp ${vehicle.position.wx} ${vehicle.position.wy - 16}`,
        });
        return { id: vehicle.id, wx: vehicle.position.wx };
      });
      await page.getByRole("button", { name: /^Drive car(?: · [EY])?$/ }).tap();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const gc = (document.querySelector("#game") as unknown as { __game: GameClient })
              .__game;
            const vehicle = gc.stateView.entities.find(
              (e) => e.id === gc.stateView.playerEntity.parentId,
            );
            return {
              id: vehicle?.id,
              paint: vehicle?.paintSchemeId,
              sheet: vehicle?.sprite?.sheetKey,
            };
          }),
        )
        .toEqual({ id: car.id, paint, sheet: `vehicle-v1:${model}:paint:${paint}` });
      await page.locator("#game").focus();
      await page.keyboard.down("ArrowRight");
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const gc = (document.querySelector("#game") as unknown as { __game: GameClient })
              .__game;
            return gc.remoteView.serverEntities.find((e) => e.id === id)?.position.wx ?? 0;
          }, car.id),
        )
        .toBeGreaterThan(car.wx + 30);
      await page.keyboard.up("ArrowRight");
      await flushLocalWorld(page);
      await stopLocalWorld(page);
      await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
      await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
      await expect
        .poll(() => game(page))
        .toEqual([expect.objectContaining({ paint, sheet: `vehicle-v1:${model}:paint:${paint}` })]);
      await expect(page.getByRole("button", { name: /^Get out(?: · [EY])?$/ })).toBeVisible();
    });
  }
}
