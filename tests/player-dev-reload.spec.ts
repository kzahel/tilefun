import { expect, test } from "@playwright/test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { CURRENT_REGIONAL_VERSION } from "../src/generation/GenerationDescriptor.js";
import { DenseDistrictSource } from "../src/generation/regional/DenseDistrictPlanner.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";
import { buildingDoors } from "../src/interiors/BuildingDoors.js";

// Exercise the actual Vite event (including its awaited lifecycle hook), without editing source.
test("dev full reload restores the indoor player and scopes the editor camera to its realm", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const server = await createServer({
    configFile: false,
    base: "/tilefun/",
    plugins: [react()],
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "error",
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Missing test server port");
    const origin = `http://127.0.0.1:${address.port}/tilefun/`;
    const lot = new DenseDistrictSource(regionalWorld(2026), true)
      .owner(0, 0)
      ?.blocks.flatMap((b) => b.lots)
      .find((l) => l.buildingType.includes("condo"));
    if (!lot) throw new Error("Missing apartment");
    const generation = {
      type: "regional",
      version: CURRENT_REGIONAL_VERSION,
      seed: 2026,
      preset: "temperate-v1",
    };
    const arrival = { x: lot.entrance.x, y: lot.entrance.y, generation };
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `${origin}?generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await page.getByRole("button", { name: /Enter apartment/ }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    const state = () =>
      page.evaluate(() => {
        const game = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        return {
          player: (game.stateView as import("../src/client/ClientStateView.js").RemoteStateView)
            .serverPlayerEntity.position,
          editor: game.stateView.editorEnabled,
          camera: { x: game.camera.x, y: game.camera.y },
          interior: game.stateView.interior,
        };
      });
    const identity = (await state()).interior;
    if (!identity) throw new Error("Missing interior identity");
    const street = buildingDoors(identity).find((door) => door.id === "street");
    if (!street) throw new Error("Missing street entrance");
    await expect.poll(async () => (await state()).player.wy).toBeCloseTo(street.arrival.wy, 0);
    const entryY = street.arrival.wy;
    await page.keyboard.down("ArrowUp");
    await expect.poll(async () => (await state()).player.wy).toBeLessThan(entryY - 40);
    await page.keyboard.up("ArrowUp");
    await page.keyboard.press("Tab");
    await page.evaluate(() => {
      history.replaceState(null, "", "/tilefun/");
      const game = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game;
      game.camera.snapTo(112, 96);
    });
    await expect.poll(async () => (await state()).editor).toBe(true);
    const before = await state();
    const reload = async () => {
      const navigation = page.waitForEvent("framenavigated", {
        predicate: (frame) => frame === page.mainFrame(),
      });
      server.ws.send({ type: "full-reload", path: "*" });
      await navigation;
      await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
      await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    };
    await reload();
    await expect.poll(async () => (await state()).interior).toEqual(before.interior);
    await expect.poll(async () => (await state()).player.wy).toBeCloseTo(before.player.wy, 0);
    expect((await state()).camera).toEqual(before.camera);
    // Inject camera state from a different realm before startup, as with an old/outdoor save.
    await page.addInitScript(() => {
      const state = JSON.parse(sessionStorage.getItem("tilefun-hmr-ui") ?? "{}");
      sessionStorage.setItem(
        "tilefun-hmr-ui",
        JSON.stringify({ ...state, realmId: "another-world", cameraX: 9000, cameraY: 9000 }),
      );
    });
    await reload();
    await expect
      .poll(async () => {
        const s = await state();
        return Math.hypot(s.camera.x - s.player.wx, s.camera.y - s.player.wy);
      })
      .toBeLessThan(2);
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank");
    await server.close();
  }
});

test("dev reload during the guided doorway walk settles into the saved destination", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const server = await createServer({
    configFile: false,
    base: "/tilefun/",
    plugins: [react()],
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "error",
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Missing port");
    const { DenseDistrictSource } = await import(
      "../src/generation/regional/DenseDistrictPlanner.js"
    );
    const lot = new DenseDistrictSource(regionalWorld(2026), true)
      .owner(0, 0)
      ?.blocks.flatMap((b) => b.lots)
      .find((l) => l.buildingType.includes("butcher"));
    if (!lot) throw new Error("Missing butcher");
    const generation = {
      type: "regional",
      version: CURRENT_REGIONAL_VERSION,
      seed: 2026,
      preset: "temperate-v1",
    };
    const arrival = { x: lot.entrance.x, y: lot.entrance.y + 3, generation };
    await page.goto(
      `http://127.0.0.1:${address.port}/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect(page.getByRole("button", { name: "New World", exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await page.waitForFunction(() => {
      const game = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game;
      const p = game.stateView.playerEntity.position;
      return (
        !game.stateView.editorEnabled &&
        game.renderer.isTerrainReady(
          game.stateView.world.chunks.get(Math.floor(p.wx / 256), Math.floor(p.wy / 256)),
        )
      );
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.keyboard.down("ArrowDown");
    await page.waitForFunction(
      (y) =>
        (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game.stateView.playerEntity.position.wy > y,
      lot.entrance.y * 16 + 96,
    );
    await page.keyboard.up("ArrowDown");
    await page.keyboard.down("ArrowUp");
    await expect(page.locator('[data-door-fade="true"]')).toHaveAttribute("data-stage", "depart");
    await page.keyboard.up("ArrowUp");
    await page.evaluate(() => history.replaceState(null, "", "/tilefun/"));
    const navigation = page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
    });
    server.ws.send({ type: "full-reload", path: "*" });
    await navigation;
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    await expect(page.locator('[data-door-fade="true"]')).toHaveAttribute("data-stage", "idle");
    // Loop startup precedes the first entity frame; do not inspect its placeholder.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const game = (
            document.querySelector("#game") as unknown as {
              __game: import("../src/client/GameClient.js").GameClient;
            }
          ).__game;
          return (game.stateView as import("../src/client/ClientStateView.js").RemoteStateView)
            .serverPlayerEntity.id;
        }),
      )
      .toBeGreaterThanOrEqual(0);
    const result = await page.evaluate(() => {
      const game = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game;
      return {
        position: (game.stateView as import("../src/client/ClientStateView.js").RemoteStateView)
          .serverPlayerEntity.position,
        door: game.stateView.interior?.doors?.find((d) => d.id === "street"),
      };
    });
    expect(result.position).toEqual(result.door?.arrival);
  } finally {
    await page.goto("about:blank");
    await server.close();
  }
});
