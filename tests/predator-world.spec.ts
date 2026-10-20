import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { PREDATOR_PROFILES, predatorType } from "../src/wildlife/Predator.js";

import { predatorHomes } from "../tests-support/PredatorHomes.fixture.js";

test.use({ channel: "chromium" });

// Ground/fierce and deep-water editor/storage paths; all 48 command/identity
// combinations are exercised in PredatorPlacement.test without Chromium.
for (const p of PREDATOR_PROFILES.filter((p) =>
  ["tiger", "giant-spider", "shark"].includes(p.species),
)) {
  test(`${p.species} naturally spawns, supports editor placement and retains deletion on reopening`, async ({
    page,
  }) => {
    const type = predatorType(p.species),
      spawn = predatorHomes.get(type);
    if (!spawn) throw Error(`No natural ${p.species} found in the bounded query`);
    const generation = createDescriptor("regional", 2026);
    const arrival = { x: (spawn.wx - 64) / 16, y: spawn.wy / 16, generation };
    await page.goto(
      `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByPlaceholder("World name...").fill(`Natural ${p.species}`);
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.getByTestId("world-menu")).toBeHidden();
    const game = page.locator("#game");
    await expect(game).toHaveAttribute("data-ready", "true", { timeout: 15000 });
    const animals = () =>
      page.evaluate((type) => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        return g.stateView.entities
          .filter((e) => e.type === type)
          .map((e) => ({ id: e.id, x: e.position.wx, y: e.position.wy }));
      }, type);
    await expect.poll(async () => (await animals()).length).toBeGreaterThan(0);
    // This case checks editing and durable deletion. Keep food-web hunts from
    // eating/replacing the exact actor while the placement UI is being exercised.
    await page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      g.debugPanel.paused = true;
      g.transport.send({ type: "set-debug", paused: true, noclip: false });
    });
    if (p.expansion?.habitat === "deep")
      await page.evaluate(async () => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        // A dry-bank arrival places lagoon homes farther away than a land clearing.
        g.debugPanel.setZoom(0.3);
        await new Promise(requestAnimationFrame);
      });
    const original = await animals(),
      removed = original[0];
    if (!removed) throw Error("Missing generated predator");
    await page.getByTestId("main-menu-toggle").click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.locator('[data-editor-tab="entities"]').click();
    await page.getByRole("button", { name: `Place ${p.label} (click map)`, exact: true }).click();
    // Northern fierce habitats can put the home point behind the expanded picker.
    await page.getByRole("button", { name: "Minimize editor tools", exact: true }).click();
    const point = await page.evaluate((home) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const camera = Reflect.get(g, "camera") as {
        worldToScreen(x: number, y: number): { sx: number; sy: number };
      };
      return camera.worldToScreen(home.wx, home.wy - 32);
    }, spawn.home);
    await game.click({ position: { x: point.sx, y: point.sy } });
    await expect.poll(async () => (await animals()).length).toBe(original.length + 1);
    await page.evaluate((id) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      g.transport.send({ type: "edit-delete-entity", entityId: id });
    }, removed.id);
    await expect.poll(async () => (await animals()).length).toBe(original.length);
    await page.getByRole("button", { name: "Exit editor", exact: true }).click();
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
    await page.goto("/tilefun/?nogamepad");
    await expect(game).toHaveAttribute("data-ready", "true", { timeout: 15000 });
    await page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      g.debugPanel.paused = true;
      g.transport.send({ type: "set-debug", paused: true, noclip: false });
    });
    await expect.poll(async () => (await animals()).length).toBe(original.length);
  });
}
