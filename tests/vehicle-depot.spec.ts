import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { RacetrackSource } from "../src/generation/regional/RacetrackPlanner.js";
import { vehicleDepot } from "../src/generation/regional/VehicleDepotPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";
import type { Camera } from "../src/rendering/Camera.js";
import type { Chunk } from "../src/world/Chunk.js";
import { chooseVehicleAction } from "./helpers/context-actions.js";
import { flushLocalWorld, stopLocalWorld } from "./helpers/local-world.js";

test.use({ channel: "chromium", hasTouch: true, viewport: { width: 1280, height: 850 } });
test("generated depot is a named map destination with real parked cars and walkable ramps", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const track = new RacetrackSource(regionalWorld(2026)).owner(0, 0);
  if (!track) throw Error("Missing fixture track");
  const depot = vehicleDepot(track);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/?nogamepad&renderer=gpu&meshes");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await page.evaluate(
    async ({ arrival, generation }) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const world = await g.gcSendRequest({
        type: "create-world",
        requestId: g.nextRequestId++,
        name: "Vehicle depot",
        generation,
      });
      await g.gcSendRequest({
        type: "join-realm",
        requestId: g.nextRequestId++,
        worldId: world.meta.id,
        arrival: { ...arrival, generation },
      });
    },
    { arrival: depot.arrival, generation: createDescriptor("regional", 2026) },
  );
  const slot = depot.vehicles.find((v) => v.model === "car-transporter");
  if (!slot) throw Error("No transporter slot");
  const facts = () =>
    page.evaluate(({ wx, wy }) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const truck = g.remoteView.serverEntities.find(
        (e) =>
          e.type === "vehicle-v1:car-transporter" &&
          Math.hypot(e.position.wx - wx, e.position.wy - wy) < 8,
      );
      const p = g.remoteView.serverPlayerEntity;
      return {
        truck: truck
          ? { id: truck.id, x: truck.position.wx, y: truck.position.wy, ramp: truck.vehicleRamp }
          : null,
        player: { x: p.position.wx, y: p.position.wy, z: p.wz ?? 0 },
      };
    }, slot);
  await expect.poll(async () => (await facts()).truck, { timeout: 30000 }).not.toBeNull();
  await page.getByRole("button", { name: "Open world map" }).click();
  const map = page.getByTestId("world-map");
  const destination = map.getByTestId("world-map-depot").filter({ hasText: depot.name });
  await expect(destination).toBeVisible({ timeout: 15000 });
  await destination.focus();
  await destination.press("Enter");
  await expect(map).toHaveAttribute("data-x", String(depot.arrival.x));
  await expect(map).toHaveAttribute("data-y", String(depot.arrival.y));
  await page.screenshot({ path: testInfo.outputPath("depot-map.png") });
  await map.getByRole("button", { name: "Travel to selected point" }).click();
  await expect(map).toBeHidden();
  await expect
    .poll(async () =>
      Math.hypot(
        (await facts()).player.x - depot.arrival.x * 16,
        (await facts()).player.y - depot.arrival.y * 16,
      ),
    )
    .toBeLessThan(64);
  const truck = (await facts()).truck;
  if (!truck) throw Error("No generated truck");
  await page.evaluate(async (center) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: `tp ${center.x * 16} ${center.y * 16}`,
    });
    (Reflect.get(g, "debugPanel") as { setZoom(value: number): void }).setZoom(0.25);
  }, depot.center);
  await expect.poll(async () => (await facts()).player.x).toBeCloseTo(depot.center.x * 16, 1);
  await expect
    .poll(() =>
      page.evaluate((slots) => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        return slots.filter((slot) =>
          g.remoteView.serverEntities.some(
            (e) =>
              e.type === `vehicle-v1:${slot.model}` &&
              Math.hypot(e.position.wx - slot.wx, e.position.wy - slot.wy) < 8,
          ),
        ).length;
      }, depot.vehicles),
    )
    .toBe(7);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
          const camera = Reflect.get(g, "camera") as Camera;
          if (camera.zoom !== 0.25) return false;
          const player = g.remoteView.serverPlayerEntity.position;
          if (Math.hypot(camera.x - player.wx, camera.y - player.wy) > 0.5) return false;
          const renderer = Reflect.get(g, "renderer") as {
            hasTerrain(c: Chunk): boolean;
            isTerrainReady(c: Chunk): boolean;
          };
          const r = camera.getVisibleChunkRange();
          for (let cy = r.minCy; cy <= r.maxCy; cy++)
            for (let cx = r.minCx; cx <= r.maxCx; cx++) {
              const p = camera.worldToScreen(cx * 256, cy * 256),
                size = 256 * camera.scale;
              if (p.sx + size <= 0 || p.sy + size <= 0 || p.sx >= 1280 || p.sy >= 850) continue;
              const chunk = g.stateView.world.getChunkIfLoaded(cx, cy);
              if (!chunk || !renderer.hasTerrain(chunk) || !renderer.isTerrainReady(chunk))
                return false;
            }
          return true;
        }),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath("depot-overview.png") });
  await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    (Reflect.get(g, "debugPanel") as { setZoom(value: number): void }).setZoom(1);
  });
  await page.evaluate(async (t) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: `tp ${t.x} ${t.y + 40}`,
    });
  }, truck);
  await chooseVehicleAction(page, "Deploy ramp");
  await expect.poll(async () => (await facts()).truck?.ramp).toBe(1);
  await page.evaluate(async (t) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: `tp ${t.x - 171} ${t.y + 16}`,
    });
  }, truck);
  await expect.poll(async () => (await facts()).player.x).toBeCloseTo(truck.x - 171, 1);
  await expect.poll(async () => (await facts()).player.y).toBeCloseTo(truck.y + 16, 1);
  await page.locator("#game").focus();
  await page.keyboard.down("ArrowRight");
  try {
    await expect
      .poll(async () => (await facts()).player.x, { intervals: [20] })
      .toBeGreaterThan(truck.x - 45);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await expect.poll(async () => (await facts()).player.z).toBeCloseTo(24.65, 1);
  await page.screenshot({ path: testInfo.outputPath("depot-walking.png") });
  await flushLocalWorld(page);
  await stopLocalWorld(page);
  await page.reload();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await expect.poll(async () => (await facts()).truck?.ramp).toBe(1);
  await stopLocalWorld(page);
  await page.goto("/tilefun/?nogamepad&renderer=canvas");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  await expect.poll(async () => (await facts()).player.z).toBeCloseTo(24.65, 1);
  await page.screenshot({ path: testInfo.outputPath("depot-walking-canvas.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open world map" }).tap();
  await expect(destination).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: testInfo.outputPath("depot-phone-map.png") });
  expect(errors).toEqual([]);
});
