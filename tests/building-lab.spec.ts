import { expect, test } from "@playwright/test";
import { CITY_BUILDING_PREFABS } from "../src/generation/regional/CityBuildingPrefabs.js";

const URL = "/tilefun/building-lab.html";
test("composes every candidate through shared gameplay recipes and renderer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  for (const prefab of CITY_BUILDING_PREFABS) {
    await page.locator("#prefab").selectOption(prefab.type);
    await expect(page.locator("#recipe-id")).toHaveText(prefab.type);
    await expect(page.locator("#building")).toHaveAttribute(
      "data-parts",
      String(prefab.parts.length),
    );
    const alpha = await page.locator("#building").evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("No canvas");
      const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] !== 32 || pixels[i + 1] !== 48 || pixels[i + 2] !== 42) count++;
      return count;
    });
    expect(alpha).toBeGreaterThan(1000);
    if (
      ["prop-city-v1-condo-bay-3", "prop-city-v1-bakery-3", "prop-city-v1-hotel-3"].includes(
        prefab.type,
      )
    )
      await page.screenshot({ path: `/tmp/tilefun-${prefab.type}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
for (const scene of ["residential", "mixed", "hotel"]) {
  test(`shared ${scene} frontage and recipe navigation`, async ({ page }) => {
    await page.goto(`${URL}?scene=${scene}`);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    expect(Number(await page.locator("#building").getAttribute("data-prefabs"))).toBeGreaterThan(1);
    await page.locator("#geometry").check();
    await page.screenshot({ path: `/tmp/tilefun-city-block-${scene}.png`, fullPage: true });
    const label = await page.locator("#block-buildings button").nth(1).textContent();
    await page.locator("#block-buildings button").nth(1).click();
    await expect(page.locator("#scene")).toHaveValue("single");
    await expect(page.locator("#name")).toHaveText(label ?? "");
    const url = page.url();
    await page.reload();
    expect(page.url()).toBe(url);
    await expect(page.locator("#source-link")).toHaveAttribute(
      "href",
      /art-workbench.html\?sheet=me-complete&rect=/,
    );
  });
}
test("phone building showcase and workbench links fit without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL}?scene=mixed`);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-city-block-phone.png", fullPage: true });
});

test("leaves block and building feedback directly, shares it with the workbench, and reads replies", async ({
  page,
  browser,
}) => {
  const note = `Roof joins ${crypto.randomUUID()}`;
  await page.goto(`${URL}?scene=residential`);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#feedback-target")).toHaveValue("block");
  await page.locator("#building-note").fill(note);
  await page.getByRole("button", { name: "Save feedback", exact: true }).click();
  await expect(page.locator("#feedback-sync")).toHaveText("Server inbox up to date.");
  const article = page.locator("#building-notes article").filter({ hasText: note });
  await expect(article).toBeVisible();
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#building-note")).toHaveValue("");
  await page.locator("#building-feedback-history").evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  const rows = await (await page.request.get("/tilefun/api/art-notes")).json();
  const row = rows.find((r: { note: string }) => r.note === note);
  expect(row.buildingReview).toMatchObject({
    scene: "residential",
    prefabIds: expect.arrayContaining(["prop-city-v1-condo-bay-3", "prop-city-v1-condo-narrow-5"]),
  });
  expect(row.buildingReview.revision).toMatch(/^[a-f0-9]{64}$/);
  expect(row.rect).toHaveLength(4);
  const second = await browser.newContext();
  try {
    const other = await second.newPage();
    await other.goto("/tilefun/art-workbench.html");
    const shared = other.locator("#notes article").filter({ hasText: note });
    await expect(shared).toBeVisible();
    await expect(shared.getByRole("link")).toHaveAttribute(
      "href",
      /building-lab.html\?scene=residential/,
    );
    const response = await other.request.post("/tilefun/api/art-notes", {
      data: {
        ...row,
        id: crypto.randomUUID(),
        status: "in-progress",
        reply: "I will adjust the roof join.",
        createdAt: new Date().toISOString(),
      },
    });
    expect(response.ok()).toBe(true);
    await page.getByRole("button", { name: "Refresh feedback", exact: true }).click();
    await expect(article).toContainText("Reply: I will adjust the roof join.");
    await page.locator("#feedback-target").selectOption("prop-city-v1-condo-narrow-5");
    await page.locator("#geometry").check();
    await expect(page.locator("#feedback-target")).toHaveValue("prop-city-v1-condo-narrow-5");
    await page.locator("#building-note").fill(`Door ${note}`);
    await page.getByRole("button", { name: "Save feedback", exact: true }).click();
    await expect(page.locator("#feedback-sync")).toHaveText("Server inbox up to date.");
    const latest = await (await page.request.get("/tilefun/api/art-notes")).json();
    expect(
      latest.find((r: { note: string }) => r.note === `Door ${note}`).buildingReview,
    ).toMatchObject({ scene: "single", prefabIds: ["prop-city-v1-condo-narrow-5"] });
  } finally {
    await second.close();
  }
});

test("keeps offline feedback tied to its original block across reload and scene changes", async ({
  page,
}) => {
  let available = false;
  const saved: Record<string, unknown>[] = [];
  await page.route("**/tilefun/api/art-notes", async (route) => {
    if (!available) return route.abort();
    if (route.request().method() === "POST") {
      saved.push(route.request().postDataJSON());
      return route.fulfill({ json: { saved: true } });
    }
    return route.fulfill({ json: saved });
  });
  await page.goto(`${URL}?scene=mixed`);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator("#building-note").fill("The bakery sign needs a different join");
  await page.locator("#scene").selectOption("hotel");
  await expect(page.locator("#building-note")).toHaveValue("");
  await page.locator("#scene").selectOption("mixed");
  await expect(page.locator("#building-note")).toHaveValue(
    "The bakery sign needs a different join",
  );
  await page.getByRole("button", { name: "Save feedback", exact: true }).click();
  await expect(page.locator("#feedback-sync")).toContainText("pending server save");
  await page.locator("#scene").selectOption("hotel");
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator("#building-feedback-history").evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await expect(page.locator("#building-notes")).toContainText("bakery sign");
  available = true;
  await page.getByRole("button", { name: "Refresh feedback", exact: true }).click();
  await expect(page.locator("#feedback-sync")).toHaveText("Server inbox up to date.");
  await page.getByRole("button", { name: "Refresh feedback", exact: true }).click();
  expect(saved).toHaveLength(1);
  expect(saved[0]?.buildingReview).toMatchObject({
    scene: "mixed",
    prefabIds: expect.arrayContaining(["prop-city-v1-bakery-3"]),
  });
});

test("refuses feedback when prefab source bytes differ from the pinned revision", async ({
  page,
}) => {
  await page.route("**/tilefun/assets/tilesets/me-complete.png", (route) =>
    route.fulfill({ body: "changed PNG", contentType: "image/png" }),
  );
  await page.goto(`${URL}?scene=mixed`);
  await expect(page.locator("#loading")).toContainText("Source image changed");
  await expect(page.getByRole("button", { name: "Save feedback", exact: true })).toBeDisabled();
});
