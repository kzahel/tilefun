import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { faunaType } from "../src/wildlife/Fauna.js";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"]) {
  test(`default keyboard jump mounts a fast horse and Jump gets off (${renderer})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const generation = createDescriptor("flat", 1);
    await page.goto(
      `/tilefun/?nogamepad&renderer=${renderer}&generation=${encodeURIComponent(JSON.stringify(generation))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    const canvas = page.locator("#game");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (document.querySelector("#game") as unknown as { __game: GameClient }).__game.stateView
              .playerEntity.id,
        ),
      )
      .not.toBe(-1);
    const editing = () =>
      page.evaluate(
        () =>
          (document.querySelector("#game") as unknown as { __game: GameClient }).__game.stateView
            .editorEnabled,
      );
    if (!(await editing())) {
      await page.getByTestId("main-menu-toggle").click();
      await page.getByRole("button", { name: "Edit", exact: true }).click();
    }
    await expect.poll(editing).toBe(true);
    await page.evaluate((type) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      if (!g.stateView.editorEnabled) throw new Error("Editor not active");
      const p = g.stateView.playerEntity.position;
      g.transport.send({ type: "edit-spawn", entityType: type, wx: p.wx + 28, wy: p.wy });
    }, faunaType("horse"));
    await expect
      .poll(() =>
        page.evaluate((type) => {
          const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
          return g.stateView.entities.some((e) => e.type === type);
        }, faunaType("horse")),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Exit editor", exact: true }).click();
    await expect.poll(editing).toBe(false);
    const read = () =>
      page.evaluate((type) => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        const p = g.stateView.playerEntity;
        const horse = g.stateView.entities.find((e) => e.type === type);
        return {
          parent: p.parentId ?? null,
          horse: horse?.id,
          state: horse?.wanderAI?.state,
          speed: Math.hypot(horse?.velocity?.vx ?? 0, horse?.velocity?.vy ?? 0),
          x: horse?.position.wx ?? 0,
        };
      }, faunaType("horse"));
    await page.keyboard.down("ArrowRight");
    await page.keyboard.down("Space");
    await expect
      .poll(async () => (await read()).state, { timeout: 4000, intervals: [30] })
      .toBe("ridden");
    await page.keyboard.up("Space");
    await expect.poll(async () => (await read()).speed).toBeCloseTo(160, 0);
    const mounted = await read();
    expect(mounted.parent).toBe(mounted.horse);
    await expect.poll(async () => (await read()).x).toBeGreaterThan(mounted.x + 30);
    await page.screenshot({ path: `/tmp/tilefun-horse-riding-game-${renderer}.png` });
    await page.keyboard.up("ArrowRight");
    await expect.poll(async () => (await read()).speed).toBe(0);
    await page.keyboard.down("ArrowLeft");
    await page.keyboard.press("Space");
    await expect.poll(async () => (await read()).parent).toBeNull();
    await page.keyboard.up("ArrowLeft");
    expect(errors).toEqual([]);
  });
}
