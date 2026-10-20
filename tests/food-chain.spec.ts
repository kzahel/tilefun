import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
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
