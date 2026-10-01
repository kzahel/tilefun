import { expect, test } from "@playwright/test";

test("game sidebar opens the central index and each listed destination is served", async ({
  page,
}) => {
  await page.goto("/tilefun/");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("main-menu-toggle").click();
  await page.getByTestId("open-tools-index").click();
  await expect(page).toHaveURL(/\/tilefun\/tools.html$/);
  await expect(page.getByRole("heading", { name: "Indexes, atlases & labs." })).toBeVisible();
  await expect(page.locator(".cards article")).toHaveCount(10);
  const destinations = await page
    .locator("main a[href]")
    .evaluateAll((links) => [
      ...new Set(
        links.map((link) => (link as HTMLAnchorElement).href).filter((url) => !url.includes("#")),
      ),
    ]);
  for (const url of destinations) {
    const response = await page.request.get(url);
    expect(response.ok(), url).toBe(true);
    expect(response.headers()["content-type"], url).toContain("text/html");
  }
  await page.screenshot({ path: "/tmp/tilefun-tools-index-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-tools-index-phone.png", fullPage: true });
});

test("the full sheet resets old selections and filtered art shortcuts survive reload and sharing", async ({
  page,
}) => {
  await page.route("**/api/art-notes", (route) => route.fulfill({ json: [] }));
  await page.goto("/tilefun/art-workbench.html?sheet=me-complete&rect=1104,1808,1136,864");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#coordinates")).toContainText("1104");
  await page.getByRole("link", { name: "Indexes & atlases", exact: true }).click();
  await page.locator("#open-complete-exteriors").click();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#sheet")).toHaveValue("me-complete");
  await expect(page.locator("#coordinates")).toContainText("Tap a tile");
  await page.getByRole("link", { name: "Indexes & atlases", exact: true }).click();
  await page.locator("#city-art").click();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#search")).toHaveValue("Condo");
  await expect(page.locator("#filter")).toHaveValue("indexed");
  await expect(page.locator("#coordinates")).toContainText("1104");
  await expect(page.locator("#results")).toContainText("Condo_1");
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#search")).toHaveValue("Condo");
  await expect(page.locator("#filter")).toHaveValue("indexed");
  await page.locator("#results button").first().click();
  const bookmark = page.url();
  expect(bookmark).toContain("q=Condo");
  expect(bookmark).toContain("filter=indexed");
  await page.goto(bookmark);
  await expect(page.locator("#search")).toHaveValue("Condo");
  await expect(page.locator("#filter")).toHaveValue("indexed");
});

test("tools and both in-game catalogs provide a return path to the index", async ({ page }) => {
  await page.route("**/api/art-notes", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/interior-review", (route) => route.fulfill({ json: [] }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of [
    "art-workbench.html?sheet=modern-interiors&view=sheet",
    "building-lab.html",
    "interior-workbench.html",
    "interior-review.html?stage=0&unchecked=1",
    "furniture-playtest.html",
    "world-explorer.html",
    "assets/tilesets/me-autotile-viewer.html",
    "?panel=props",
    "?panel=interiors&interiorSource=room_builder_tile",
  ]) {
    await page.goto(`/tilefun/${path}`);
    const back = page.getByRole("link", { name: /Indexes & atlases/ }).first();
    await expect(back, path).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/tilefun\/tools.html$/);
  }
  expect(errors).toEqual([]);
});
