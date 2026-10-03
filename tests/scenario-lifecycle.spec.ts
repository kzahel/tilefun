import { expect, test } from "@playwright/test";

test("lab navigation and tuning dispose Worker sessions without creating saved worlds", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html");
  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((db) => db.name).sort(),
  );
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      location.hash = "#/tool/character-lab";
    });
    await expect(page.getByLabel("Character movement test")).toHaveAttribute("data-ready", "true");
    await expect.poll(() => page.workers().length).toBe(1);
    await page.getByLabel("Ground width", { exact: true }).fill(String(10 + i));
    await expect.poll(() => page.workers().length).toBe(1);
    await page.evaluate(() => {
      location.hash = "#/";
    });
    await expect.poll(() => page.workers().length).toBe(0);
    await page.evaluate(() => {
      location.hash = "#/tool/traffic";
    });
    await expect(page.getByLabel("Generated traffic playground")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect.poll(() => page.workers().length).toBe(1);
    await page.getByRole("button", { name: "Reset scene", exact: true }).click();
    await expect.poll(() => page.workers().length).toBe(1);
    await page.evaluate(() => {
      location.hash = "#/";
    });
    await expect.poll(() => page.workers().length).toBe(0);
  }
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name).sort()),
  ).toEqual(databases);
  expect(errors).toEqual([]);
});
