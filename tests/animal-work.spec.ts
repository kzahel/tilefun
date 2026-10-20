import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

test.use({ channel: "chromium" });
type Pose = {
  id: number;
  type: string;
  x: number;
  y: number;
  z: number;
  parent: number;
  clip: number;
};
for (const renderer of ["canvas", "gpu"]) {
  for (const animal of ["dog", "crow", "squirrel"]) {
    test(`${animal} real work, carried object and reload (${renderer})`, async ({ page }) => {
      test.setTimeout(150_000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-behavior-${animal}&renderer=${renderer}#/tool/world-geometry`,
      );
      const canvas = page.getByLabel("Natural landscape playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      const actors = async (): Promise<Pose[]> =>
        JSON.parse((await canvas.getAttribute("data-work-actors")) ?? "[]");
      if (animal === "dog")
        await page.getByRole("button", { name: "Throw ball for dog", exact: true }).click();
      let carried: Pose | undefined;
      await expect
        .poll(
          async () => {
            carried = (await actors()).find((p) => p.parent >= 0);
            return !!carried;
          },
          { timeout: 45_000, intervals: [50] },
        )
        .toBe(true);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-authority-running", "false");
      const before = await actors(),
        held = before.find((p) => p.parent >= 0);
      expect(held).toBeDefined();
      await canvas.screenshot({ path: `data/wildlife-155-${animal}-carry-${renderer}.png` });
      await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-reload-count", "1");
      expect((await actors()).filter((p) => p.parent >= 0)).toHaveLength(1);
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await expect
        .poll(
          async () => {
            const poses = await actors();
            if (animal === "dog")
              return poses.some(
                (p) => p.type === "ball" && p.parent < 0 && Math.hypot(p.x - 64, p.y - 128) < 45,
              );
            if (animal === "crow")
              return poses.some((p) => p.type.includes("resource-nest") && p.clip === 4 && p.z > 0);
            return poses.some((p) => p.type.includes("red-squirrel") && p.clip === 6);
          },
          { timeout: 100_000, intervals: [50] },
        )
        .toBe(true);
      await canvas.screenshot({ path: `data/wildlife-155-${animal}-complete-${renderer}.png` });
      expect(errors).toEqual([]);
    });
  }
  test(`ordinary game dog fetches a player-thrown ball (${renderer})`, async ({ page }) => {
    test.setTimeout(90_000);
    const generation = createDescriptor("flat", 1),
      arrival = { x: 4, y: 4, generation };
    await page.goto(
      `/tilefun/?nogamepad&renderer=${renderer}&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.getByTestId("main-menu-toggle").click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game,
        p = g.stateView.playerEntity.position;
      g.transport.send({
        type: "edit-spawn",
        entityType: "wildlife-dog-provisional-v1",
        wx: p.wx + 64,
        wy: p.wy + 28,
      });
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            document.querySelector("#game") as unknown as { __game: GameClient }
          ).__game.stateView.entities.some((e) => e.type === "wildlife-dog-provisional-v1"),
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Exit editor", exact: true }).click();
    await page.evaluate(() =>
      (document.querySelector("#game") as unknown as { __game: GameClient }).__game.transport.send({
        type: "throw-ball",
        dirX: 1,
        dirY: 0,
        force: 0,
      }),
    );
    const ball = () =>
      page.evaluate(() => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        const b = g.stateView.entities.find((e) => e.type === "ball"),
          p = g.stateView.playerEntity.position;
        return b
          ? {
              id: b.id,
              parent: b.parentId ?? -1,
              distance: Math.hypot(b.position.wx - p.wx, b.position.wy - p.wy),
            }
          : undefined;
      });
    await expect
      .poll(async () => (await ball())?.parent ?? -1, { timeout: 45_000, intervals: [50] })
      .toBeGreaterThan(0);
    const id = (await ball())?.id;
    await expect
      .poll(
        async () => {
          const b = await ball();
          return b?.id === id && b.parent < 0 && b.distance < 45;
        },
        { timeout: 30_000, intervals: [50] },
      )
      .toBe(true);
    await page
      .locator("#game")
      .screenshot({ path: `data/wildlife-155-game-fetch-${renderer}.png` });
  });
}

test("Animal Browser filters behavior demonstrations and opens the selected activity", async ({
  page,
}) => {
  await page.goto("/tilefun/workshop.html?geometry=nature-behavior-dog#/tool/world-geometry");
  await page.getByLabel("Behavior progress", { exact: true }).selectOption("demonstrations");
  const results = page.getByRole("region", { name: "Animal results" });
  await expect(results.locator("article")).toHaveCount(3);
  await page.getByLabel("Find animal", { exact: true }).fill("crow");
  await results.getByRole("button", { name: "Demonstrate behavior", exact: true }).click();
  await expect(page.getByLabel("Landscape scene", { exact: true })).toHaveValue("behavior-crow");
  await expect(page.getByLabel("Natural landscape playground")).toHaveAttribute(
    "data-ready",
    "true",
  );
});
