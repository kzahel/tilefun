import { expect, test } from "@playwright/test";

test("shared movement stops at furniture, supports precise placement, and saves a reproducible report", async ({
  page,
}) => {
  const posts: Record<string, unknown>[] = [];
  let offline = true;
  await page.route("**/api/interior-review", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: [] });
      return;
    }
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

test("jumps onto tall furniture, records good verdicts, and reopens changed physics", async ({
  page,
}) => {
  const posts: Record<string, unknown>[] = [];
  await page.route("**/api/interior-review", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: posts });
      return;
    }
    posts.push(route.request().postDataJSON());
    await route.fulfill({ json: { saved: true } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/furniture-playtest.html?scene=wardrobe");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const canvas = page.locator("#room");
  await page.locator("#gravity").selectOption("0.25");
  await canvas.focus();
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.down("Space");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-player-z")))
    .toBeGreaterThan(34);
  await page.keyboard.down("ArrowUp");
  await page.waitForFunction(() => Number(document.getElementById("room")?.dataset.playerY) < 86);
  await page.keyboard.up("ArrowUp");
  await expect(canvas).toHaveAttribute("data-airborne", "false");
  await page.keyboard.up("Space");
  await expect(canvas).toHaveAttribute("data-player-z", "32");
  await expect(page.locator("#position")).toContainText("On object");
  await page.locator("#good").click();
  await expect(page.locator("#grade")).toContainText("✓ Looks good");
  expect(posts[0]?.verdict).toBe("good");
  expect(posts[0]?.playtest).toMatchObject({
    playerZ: 32,
    groundZ: 32,
    gravityScale: 0.25,
    bodies: { wardrobe: { height: 32, walkableTop: true } },
  });
  await page.reload();
  await expect(page.locator("#grade")).toContainText("✓ Looks good");
  await expect(page.locator("#gravity")).toHaveValue("0.25");
  await page.locator("#physics-controls summary").click();
  await page.locator("#height").fill("40");
  await page.locator("#apply-height").click();
  await expect(page.locator("#status")).toHaveText("Collision height updated.");
  await expect(page.locator("#grade")).toContainText("Unchecked");
  await page.locator("#good").click();
  await expect(page.locator("#grade")).toContainText("✓ Looks good");
  expect(posts.at(-1)?.playtest).toMatchObject({
    bodies: { wardrobe: { height: 40, walkableTop: true } },
  });
  await page.locator("#gravity").selectOption("1");
  await expect(page.locator("#grade")).toContainText("Unchecked");
  await page.locator("#depth").check();
  await expect(page.locator("#depth-help")).toContainText("not object height");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("phone jump control releases on cancellation and high jumps stay in view", async ({
  page,
}) => {
  await page.goto("/tilefun/furniture-playtest.html?scene=wardrobe");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator("#gravity").selectOption("0.1");
  const jump = page.locator("#jump");
  await jump.scrollIntoViewIfNeeded();
  const b = await jump.boundingBox();
  if (!b) throw new Error("Missing jump control");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect
    .poll(async () => Number(await page.locator("#room").getAttribute("data-view-offset-y")))
    .toBeGreaterThan(0);
  await jump.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect(page.locator("#room")).toHaveAttribute("data-airborne", "false", { timeout: 8000 });
  await expect(page.locator("#room")).toHaveAttribute("data-player-z", "0");
  await expect(page.locator("#room")).toHaveAttribute("data-view-offset-y", "0");
});
