import { expect, test } from "@playwright/test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { DistrictSource } from "../src/generation/regional/DistrictStrategy.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";

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
    const lot = new DistrictSource(regionalWorld(2026))
      .owner(0, 0)
      ?.blocks.flatMap((b) => b.lots)
      .find((l) => l.buildingType.startsWith("prop-regional-apartment-"));
    if (!lot) throw new Error("Missing apartment");
    const generation = {
      type: "regional",
      version: "regional-v3",
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
    await page.keyboard.down("ArrowUp");
    await expect.poll(async () => (await state()).player.wy).toBeLessThan(112);
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
