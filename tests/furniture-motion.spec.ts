import { expect, test } from "@playwright/test";

test("shared movement stops at furniture, supports precise placement, and saves a reproducible report", async ({
  page,
}) => {
  const posts: Record<string, unknown>[] = [];
  let offline = true;
  await page.route("**/api/interior-review", async (route) => {
    posts.push(route.request().postDataJSON());
    await route.fulfill({ status: offline ? 503 : 200, json: { saved: !offline } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/furniture-playtest.html?scene=wardrobe");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const canvas = page.locator("#room");
  await canvas.focus();
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowUp");
  const y = Number(await canvas.getAttribute("data-player-y"));
  expect(y).toBeGreaterThanOrEqual(94);
  expect(y).toBeLessThan(95);
  await page.locator("#mode").selectOption("place");
  await page.getByRole("button", { name: "Move object right one pixel", exact: true }).click();
  await expect(page.locator("#x")).toHaveValue("81");
  await page.locator("#x").fill("22");
  await page.locator("#apply").click();
  await expect(page.locator("#status")).toHaveText("Placement updated.");
  await page.locator("#bounds").check();
  await page.locator("#depth").check();
  await page.locator("#note").fill("Testing collision context");
  await page.locator("#report").click();
  await expect(page.locator("#sync")).toContainText("pending");
  expect(posts[0]?.caseId).toBe("furniture-motion-wardrobe");
  expect(posts[0]?.playtest).toMatchObject({ selected: "wardrobe", mode: "place" });
  expect(posts[0]?.furniture).toEqual([{ id: "wardrobe", asset: "wardrobe", x: 22, y: 88 }]);
  expect(posts[0]?.screenshot).toMatch(/^data:image\/png;base64,/);
  offline = false;
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#sync")).toHaveText("Reports saved");
  await expect(page.locator("#x")).toHaveValue("22");
  expect(posts.at(-1)?.id).toBe(posts[0]?.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("automatic walks finish in all three scenes without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/interior-review", (r) => r.fulfill({ json: { saved: true } }));
  await page.goto("/tilefun/furniture-playtest.html");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  for (const scene of ["bunk", "wardrobe", "worktable"]) {
    await page.locator("#scene").selectOption(scene);
    await page.locator("#circle").click();
    await expect(page.locator("#status")).toContainText("Walk complete", { timeout: 20000 });
  }
  expect(errors).toEqual([]);
});

test("direction controls release and dragging selects actual sprite pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/furniture-playtest.html?scene=worktable");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const right = page.getByRole("button", { name: "Walk right", exact: true });
  const b = await right.boundingBox();
  if (!b) throw new Error("Missing control");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const x = await page.locator("#room").getAttribute("data-player-x");
  expect(Number(x)).toBeGreaterThan(85);
  await page.waitForTimeout(100);
  expect(await page.locator("#room").getAttribute("data-player-x")).toBe(x);
  await page.locator("#mode").selectOption("place");
  const canvas = page.locator("#room"),
    box = await canvas.boundingBox();
  if (!box) throw new Error("Missing canvas");
  const scale = box.width / 160;
  // Table's opaque top, at native (80,57), not its transparent padded image edge.
  await page.mouse.move(box.x + 80 * scale, box.y + 57 * scale);
  await page.mouse.down();
  await page.mouse.move(box.x + 82 * scale, box.y + 57 * scale);
  await page.mouse.up();
  await expect(page.locator("#x")).toHaveValue("82");
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#x")).toHaveValue("82");
});
