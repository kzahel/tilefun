import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { DEER_TYPE } from "../src/wildlife/Deer.js";
import { predatorType } from "../src/wildlife/Predator.js";

test.use({ channel: "chromium" });

for (const pair of [
  { name: "deer", prey: DEER_TYPE, hunter: predatorType("tiger") },
  { name: "brown bear", prey: predatorType("brown-bear"), hunter: predatorType("t-rex") },
])
  test(`a player-placed ${pair.name} is eaten without replacement in the real Worker world and stays gone on reload`, async ({
    page,
  }) => {
    const generation = { type: "flat", version: "flat-v1", seed: 1737, preset: "grass" };
    const arrival = { x: 4, y: 4, generation };
    await page.goto(
      `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByPlaceholder("World name...").fill("Manual prey origin");
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("main-menu-toggle").click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.evaluate(
      ({ prey, hunter }) => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        const p = g.stateView.playerEntity.position;
        g.debugPanel.paused = true;
        g.transport.send({ type: "set-debug", paused: true, noclip: false });
        // Isolate meal provenance from unrelated starter-world prey. Brown bear
        // is slower than the T. rex; a wolf can legitimately escape its charge.
        for (const e of g.stateView.entities)
          if (e.id !== g.stateView.playerEntity.id)
            g.transport.send({ type: "edit-delete-entity", entityId: e.id });
        g.transport.send({ type: "edit-spawn", entityType: hunter, wx: p.wx + 48, wy: p.wy });
        g.transport.send({ type: "edit-spawn", entityType: prey, wx: p.wx + 96, wy: p.wy });
      },
      { prey: pair.prey, hunter: pair.hunter },
    );
    const population = () =>
      page.evaluate(
        ({ prey, hunter }) => {
          const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
          return {
            prey: g.stateView.entities.filter((e) => e.type === prey).length,
            hunter: g.stateView.entities.filter((e) => e.type === hunter).length,
          };
        },
        { prey: pair.prey, hunter: pair.hunter },
      );
    await expect.poll(population).toEqual({ prey: 1, hunter: 1 });
    await page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      g.debugPanel.paused = false;
      g.transport.send({ type: "set-debug", paused: false, noclip: false });
    });
    await expect.poll(population, { timeout: 20000 }).toEqual({ prey: 0, hunter: 1 });
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
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect.poll(population).toEqual({ prey: 0, hunter: 1 });
  });
