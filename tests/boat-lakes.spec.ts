import { expect, type Page, test } from "@playwright/test";
import { TerrainId } from "../src/autotile/TerrainId.js";
import { BOAT_MESH } from "../src/boats/Boat.js";
import type { ClientStateView, RemoteStateView } from "../src/client/ClientStateView.js";
import type { GameClient } from "../src/client/GameClient.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import type { GpuRenderBackend } from "../src/rendering/GpuRenderBackend.js";
import type { RequestMessage } from "../src/shared/requests.js";
import { stopLocalWorld } from "./helpers/local-world.js";

test.use({ channel: "chromium" });
type Game = {
  stateView: ClientStateView;
  remoteView: RemoteStateView;
  renderer: GpuRenderBackend;
  nextRequestId: number;
  gcSendRequest(request: RequestMessage): Promise<unknown>;
};
async function read(page: Page) {
  return page.locator("#game").evaluate((canvas) => {
    const g = (canvas as unknown as { __game: Game }).__game;
    const boat = g.remoteView.serverEntities.find((e) => e.type === "vehicle-v1:explorer-boat");
    const p = g.remoteView.serverPlayerEntity;
    return {
      parent: p.parentId ?? -1,
      boat: boat && {
        id: boat.id,
        x: boat.position.wx,
        y: boat.position.wy,
        z: boat.wz,
        heading: boat.vehicleHeading,
      },
      editing: g.stateView.editorEnabled,
      z: p.wz,
    };
  });
}
test("a boat placed from the south shore offers boarding across the water gap", async ({
  page,
}) => {
  await page.goto("/tilefun/?nogamepad&renderer=gpu&meshes");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" } as const;
    const created = await g.gcSendRequest({
      type: "create-world",
      requestId: g.nextRequestId++,
      name: "South shore boat",
      generation,
    });
    await g.gcSendRequest({
      type: "join-realm",
      requestId: g.nextRequestId++,
      worldId: created.meta.id,
      arrival: { x: 0, y: 1, generation },
    });
  });
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('[data-editor-tab="vehicles"]').click();
  await page.getByRole("button", { name: "Explorer motorboat", exact: true }).click();
  await page.evaluate((water) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    for (let ty = -10; ty <= -1; ty++)
      for (let tx = -5; tx <= 5; tx++)
        g.transport.send({
          type: "edit-terrain-tile",
          tx,
          ty,
          terrainId: water,
          paintMode: "positive",
          bridgeDepth: 0,
        });
  }, TerrainId.ShallowWater);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        return g.stateView.world.getCollisionIfLoaded(0, -1);
      }),
    )
    .toBe(2);
  const point = await page.evaluate(() => {
    const canvas = document.querySelector("#game") as HTMLCanvasElement;
    const g = (canvas as unknown as { __game: GameClient }).__game;
    g.camera.zoom = 1 / 3;
    g.camera.snapTo(0, 80);
    const p = g.camera.worldToScreen(0, -88);
    const bounds = canvas.getBoundingClientRect();
    return {
      x: bounds.left + (p.sx * bounds.width) / canvas.width,
      y: bounds.top + (p.sy * bounds.height) / canvas.height,
    };
  });
  await page.mouse.move(point.x, point.y);
  await page.screenshot({ path: "/tmp/tilefun-boat-south-placement.png" });
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => (await read(page)).boat).toBeDefined();
  const placed = (await read(page)).boat;
  expect(placed?.x).toBeCloseTo(0, 0);
  expect(placed?.y).toBeCloseTo(-88, 0);
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    await g.gcSendRequest({ type: "rcon", requestId: g.nextRequestId++, command: "tp 0 12" });
  });
  await expect(page.getByRole("button", { name: /^Drive boat/ })).toBeVisible();
  await page.screenshot({ path: "/tmp/tilefun-boat-south-shore.png" });
  await page.getByRole("button", { name: /^Drive boat/ }).click();
  await expect.poll(async () => (await read(page)).parent).toBe(placed?.id);
  await page.getByRole("button", { name: /^Get out/ }).click();
  await expect.poll(async () => (await read(page)).parent).toBe(-1);
  await stopLocalWorld(page);
});
for (const renderer of ["canvas", "gpu", "gpu&meshes"]) {
  test(`natural boat drives and retains its open seat and parked pose (${renderer})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const generation = createDescriptor("regional", 2026);
    const arrival = { x: 812.9465317726135, y: -907.1952428035438, generation };
    await page.goto(
      `/tilefun/?nogamepad&renderer=${renderer}&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.getByPlaceholder("World name...").fill(`Boat ${renderer}`);
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect.poll(async () => (await read(page)).boat).toBeDefined();
    if ((await read(page)).editing) await page.keyboard.press("Tab");
    await page.getByRole("button", { name: /^Drive boat/ }).click();
    await expect.poll(async () => (await read(page)).parent).toBe((await read(page)).boat?.id);
    expect((await read(page)).z).toBe(8);
    if (renderer.includes("meshes"))
      await expect
        .poll(() =>
          page
            .locator("#game")
            .evaluate(
              (canvas, id) =>
                (canvas as unknown as { __game: Game }).__game.renderer.meshes.assetStates[id]
                  ?.state,
              BOAT_MESH.assetId,
            ),
        )
        .toBe("ready");
    const initial = (await read(page)).boat;
    if (!initial) throw Error("Missing boat");
    await page.keyboard.down("ArrowDown");
    await expect
      .poll(async () => {
        const b = (await read(page)).boat;
        return b ? Math.hypot(b.x - initial.x, b.y - initial.y) : 0;
      })
      .toBeGreaterThan(25);
    await page.keyboard.up("ArrowDown");
    await expect
      .poll(() =>
        page.locator("#game").evaluate((c) => {
          const g = (c as unknown as { __game: Game }).__game;
          const b = g.remoteView.serverEntities.find((e) => e.type === "vehicle-v1:explorer-boat");
          return Math.hypot(b?.velocity?.vx ?? 0, b?.velocity?.vy ?? 0);
        }),
      )
      .toBeLessThan(0.1);
    await page.screenshot({ path: `data/boat-152/game-${renderer.replaceAll("&", "-")}.png` });
    // A real production reload must restore the occupied boat, not re-seed its mooring.
    const saved = (await read(page)).boat;
    await stopLocalWorld(page);
    await page.goto(`/tilefun/?nogamepad&renderer=${renderer}`);
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    const resume = page.getByRole("button", { name: "Resume", exact: true });
    if (await resume.isVisible()) await resume.click();
    await expect.poll(async () => (await read(page)).parent).not.toBe(-1);
    const restored = (await read(page)).boat;
    expect(restored?.x).toBeCloseTo(saved?.x ?? NaN, 2);
    expect(restored?.y).toBeCloseTo(saved?.y ?? NaN, 2);
    expect((await read(page)).z).toBe(8);
    expect(errors).toEqual([]);
  });
}
for (const renderer of ["canvas", "gpu", "gpu-mesh"]) {
  test(`lake playground uses the shared boat and varied real water wildlife (${renderer})`, async ({
    page,
  }) => {
    await page.goto(
      `/tilefun/workshop.html?geometry=nature-lake&landscape=thicket&renderer=${renderer}#/tool/world-geometry`,
    );
    const canvas = page.getByLabel("Natural landscape playground");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(page.getByRole("button", { name: /^Drive boat/ })).toBeVisible();
    const boat = async () =>
      JSON.parse((await canvas.getAttribute("data-boat-poses")) ?? "[]") as {
        id: number;
        x: number;
        y: number;
      }[];
    await expect.poll(async () => (await boat()).length).toBe(1);
    await page.getByRole("button", { name: /^Drive boat/ }).click();
    await expect(canvas).toHaveAttribute("data-player-z", "8");
    const before = (await boat())[0];
    if (!before) throw Error("Missing boat");
    await canvas.click();
    await page.keyboard.down("ArrowDown");
    await expect
      .poll(async () =>
        Math.hypot(
          ((await boat())[0]?.x ?? before.x) - before.x,
          ((await boat())[0]?.y ?? before.y) - before.y,
        ),
      )
      .toBeGreaterThan(20);
    await page.keyboard.up("ArrowDown");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-authority-running", "false");
    const saved = await boat();
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-reload-count", "1");
    const after = await boat();
    expect(after[0]?.x).toBeCloseTo(saved[0]?.x ?? NaN, 3);
    expect(after[0]?.y).toBeCloseTo(saved[0]?.y ?? NaN, 3);
  });
}
