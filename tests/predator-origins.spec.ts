import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { DEER_TYPE } from "../src/wildlife/Deer.js";
import { predatorType } from "../src/wildlife/Predator.js";

test.use({ channel: "chromium" });

test("a player-placed deer is eaten without replacement in the real Worker world and stays gone on reload", async ({
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
    ({ deer, tiger }) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const p = g.stateView.playerEntity.position;
      g.transport.send({ type: "set-debug", paused: true, noclip: false });
      g.transport.send({ type: "edit-spawn", entityType: tiger, wx: p.wx + 48, wy: p.wy });
      g.transport.send({ type: "edit-spawn", entityType: deer, wx: p.wx + 72, wy: p.wy });
    },
    { deer: DEER_TYPE, tiger: predatorType("tiger") },
  );
  const population = () =>
    page.evaluate(
      ({ deer, tiger }) => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        return {
          deer: g.stateView.entities.filter((e) => e.type === deer).length,
          tiger: g.stateView.entities.filter((e) => e.type === tiger).length,
        };
      },
      { deer: DEER_TYPE, tiger: predatorType("tiger") },
    );
  await expect.poll(population).toEqual({ deer: 1, tiger: 1 });
  await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    g.transport.send({ type: "set-debug", paused: false, noclip: false });
  });
  await expect.poll(population, { timeout: 20000 }).toEqual({ deer: 0, tiger: 1 });
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
  await expect.poll(population).toEqual({ deer: 0, tiger: 1 });
});
