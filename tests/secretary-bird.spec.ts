import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"])
  test(`secretary-bird catches a cobra and reloads its natural meal (${renderer})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=nature-secretary-bird&renderer=${renderer}#/tool/world-geometry`,
    );
    const stage = page.getByLabel("Natural landscape playground");
    await expect(stage).toHaveAttribute("data-ready", "true");
    const poses = async () =>
      JSON.parse((await stage.getAttribute("data-predator-poses")) ?? "[]") as {
        clip: number;
        x: number;
        y: number;
      }[];
    const snakes = async () =>
      (
        JSON.parse((await stage.getAttribute("data-fauna-poses")) ?? "[]") as { species: string }[]
      ).filter((p) => p.species === "king-cobra");
    await expect
      .poll(async () => (await poses())[0]?.clip, { timeout: 20000, intervals: [30] })
      .toBe(2);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(stage).toHaveAttribute("data-authority-running", "false");
    expect(await snakes()).toHaveLength(0);
    await expect(stage).toHaveAttribute("data-deer-count", "1");
    const before = await poses();
    await stage.screenshot({ path: `data/wildlife-147-secretary-bird-${renderer}.png` });
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(stage).toHaveAttribute("data-reload-count", "1");
    expect((await poses())[0]?.clip).toBe(2);
    expect((await poses())[0]?.x).toBeCloseTo(before[0]?.x ?? NaN, 3);
    expect(await snakes()).toHaveLength(0);
    expect(errors).toEqual([]);
  });

test("secretary-bird browser action opens its real hunting scene", async ({ page }) => {
  await page.goto("/tilefun/workshop.html?geometry=nature-tiger#/tool/world-geometry");
  await page.getByLabel("Find animal", { exact: true }).fill("Secretary bird");
  const card = page.locator('[data-animal="secretary-bird"]'),
    preview = card.locator("canvas");
  await page.getByLabel("Preview animation", { exact: true }).selectOption("action");
  await expect(preview).toHaveAttribute("data-clip", "display");
  const frame = await preview.getAttribute("data-frame");
  await expect.poll(() => preview.getAttribute("data-frame")).not.toBe(frame);
  await card.getByRole("button", { name: "Watch AI", exact: true }).click();
  await expect(page.getByLabel("Landscape scene", { exact: true })).toHaveValue("secretary-bird");
  await expect(page.getByLabel("Natural landscape playground")).toHaveAttribute(
    "data-ready",
    "true",
  );
});
