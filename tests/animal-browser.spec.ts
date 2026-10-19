import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });
test("browses animated animals by name, family and dates, then runs their real AI scene", async ({
  page,
}) => {
  await page.goto(
    "/tilefun/workshop.html?geometry=nature-tiger&landscape=balanced#/tool/world-geometry",
  );
  const browser = page.locator(".animal-browser"),
    results = page.getByRole("region", { name: "Animal results" });
  await expect(browser).toBeVisible();
  await expect(results.locator("article")).toHaveCount(132);
  const added = await results
    .locator("time")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("datetime") ?? ""));
  expect(added).toEqual([...added].sort().reverse());
  await page.getByLabel("Sort animals", { exact: true }).selectOption("name");
  const names = await results.locator("h3").allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  await page.getByLabel("Find animal", { exact: true }).fill("tiger");
  await expect(results.locator("article")).toHaveCount(1);
  const preview = results.locator("canvas");
  await expect(preview).toHaveAttribute("data-ready", "true");
  const frame = await preview.getAttribute("data-frame");
  await expect.poll(() => preview.getAttribute("data-frame")).not.toBe(frame);
  await page.getByLabel("Animate previews", { exact: true }).uncheck();
  await expect(preview).toHaveAttribute("data-frame", "0");
  await page.getByLabel("Preview animation", { exact: true }).selectOption("action");
  await page.getByLabel("Preview facing", { exact: true }).selectOption("3");
  await expect(preview).toHaveAttribute("data-ready", "true");
  await page.getByLabel("Find animal", { exact: true }).fill("");
  await page.getByLabel("Animal family", { exact: true }).selectOption("Primates");
  await expect(results.locator("article")).toHaveCount(1);
  await expect(results.locator("h3")).toHaveText("Silverback gorilla");
  await results.getByRole("button", { name: "Watch AI", exact: true }).click();
  await expect(page.getByLabel("Landscape scene", { exact: true })).toHaveValue("gorilla");
  await expect(page.getByLabel("Natural landscape playground")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page).toHaveURL(/geometry=nature-gorilla/);
  await expect(page.getByLabel("Follow selected animal", { exact: true })).toBeChecked();
  await expect
    .poll(async () =>
      JSON.parse(
        (await page.getByLabel("Natural landscape playground").getAttribute("data-fauna-poses")) ??
          "[]",
      ).some((e: { species: string; visible: boolean }) => e.species === "gorilla" && e.visible),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
  await expect(page.getByLabel("Natural landscape playground")).toHaveAttribute(
    "data-reload-count",
    "1",
  );
  await page.screenshot({ path: "data/animal-browser-lab.png", fullPage: true });
});

test("mobile animal search fits the viewport and opens a hunting scene", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/workshop.html?geometry=nature-forest#/tool/world-geometry");
  await page.getByLabel("Find animal", { exact: true }).fill("t. rex");
  const results = page.getByRole("region", { name: "Animal results" });
  await expect(results.locator("article")).toHaveCount(1);
  await expect(results.locator("canvas")).toHaveAttribute("data-ready", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await results.getByRole("button", { name: "Watch AI", exact: true }).click();
  await expect(page.getByLabel("Landscape scene", { exact: true })).toHaveValue("t-rex");
  await expect(page.getByLabel("Natural landscape playground")).toHaveAttribute(
    "data-ready",
    "true",
  );
});
