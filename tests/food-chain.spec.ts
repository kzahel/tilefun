import { expect, test } from "@playwright/test";
import { predatorType } from "../src/wildlife/Predator.js";

test.use({ channel: "chromium" });
for (const id of ["food-web-natural", "food-web-placed"])
  for (const renderer of ["canvas", "gpu"]) {
    test(`${id} runs cross-predator meals and preserves its origin policy on reload (${renderer})`, async ({
      page,
    }) => {
      await page.goto(
        `/tilefun/workshop.html?geometry=nature-${id}&renderer=${renderer}#/tool/world-geometry`,
      );
      const canvas = page.getByLabel("Natural landscape playground");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      const animals = async () =>
        JSON.parse((await canvas.getAttribute("data-food-web-actors")) ?? "[]") as {
          id: number;
          type: string;
        }[];
      await expect.poll(async () => (await animals()).length).toBe(4);
      const wolf = (await animals()).find((e) => e.type === predatorType("dire-wolf"));
      expect(wolf).toBeDefined();
      await expect
        .poll(async () => (await animals()).some((e) => e.id === wolf?.id), { timeout: 25000 })
        .toBe(false);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      const types = (await animals()).map((e) => e.type).sort();
      if (id === "food-web-natural") {
        expect(types).toHaveLength(4);
        expect(types).toContain(predatorType("dire-wolf"));
      } else {
        expect(types.length).toBeLessThan(4);
        expect(types).not.toContain(predatorType("dire-wolf"));
      }
      await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
      await expect(canvas).toHaveAttribute("data-reload-count", "1");
      expect((await animals()).map((e) => e.type).sort()).toEqual(types);
    });
  }
test("a live wolf pack howls, hunts together and reloads three pack members", async ({ page }) => {
  await page.goto(
    "/tilefun/workshop.html?geometry=nature-wolf-pack&renderer=gpu#/tool/world-geometry",
  );
  const canvas = page.getByLabel("Natural landscape playground");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Enable creature sounds", exact: true }).click();
  // The pack's first howl starts immediately. Restart after opting into sound;
  // missed/late display onsets intentionally never replay themselves.
  const originalCanvas = await canvas.elementHandle();
  await page.getByRole("button", { name: "Reset scene", exact: true }).click();
  await page.waitForFunction((old) => !old?.isConnected, originalCanvas);
  await expect(canvas).toHaveAttribute("data-ready", "true");
  const wolves = async () =>
    JSON.parse((await canvas.getAttribute("data-predator-poses")) ?? "[]") as { clip: number }[];
  await expect.poll(async () => (await wolves()).length).toBe(3);
  await expect
    .poll(async () => (await wolves()).some((e) => e.clip === 2), { timeout: 20000 })
    .toBe(true);
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-creature-calls")))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-reload-count", "1");
  expect(await wolves()).toHaveLength(3);
});
