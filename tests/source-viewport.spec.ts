import { expect, type Locator, test } from "@playwright/test";

const workbench = "/tilefun/workshop.html#/tool/art?sheet=me-complete";
const view = (canvas: Locator) =>
  canvas.evaluate((node) => ({
    x: Number(node.dataset.centerX),
    y: Number(node.dataset.centerY),
    zoom: Number(node.dataset.zoom),
  }));

test("atlas buttons and wheel preserve the same center through bursty trackpad input", async ({
  page,
}) => {
  await page.goto(`${workbench}&rect=2160%2C1872%2C16%2C16&coverage=gaps`);
  const canvas = page.getByLabel("Source spritesheet", { exact: true });
  await expect(canvas).toHaveAttribute("data-source-ready", "true");
  const initial = await view(canvas);
  expect(initial).toEqual({ x: 2168, y: 1880, zoom: 4 });
  await page.getByRole("button", { name: "Zoom +", exact: true }).click();
  expect(await view(canvas)).toEqual({ ...initial, zoom: 6 });
  await page.getByRole("button", { name: "Zoom −", exact: true }).click();
  expect(await view(canvas)).toEqual(initial);
  await canvas.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  const canceled = await canvas.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return Array.from(
      { length: 30 },
      (_, i) =>
        !node.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: box.left + 10,
            clientY: box.top + 15,
            deltaX: i % 2 ? 3 : -3,
            deltaY: 1,
          }),
        ),
    );
  });
  expect(canceled.every(Boolean)).toBe(true);
  await expect
    .poll(async () => (await view(canvas)).zoom)
    .toBeCloseTo(4 * Math.exp(-30 * 0.003), 8);
  expect(await view(canvas)).toMatchObject({ x: initial.x, y: initial.y });
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  // Real wheel input far from the center must have the same stable anchor.
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Missing atlas viewport");
  await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
  const before = await view(canvas);
  await page.mouse.wheel(12, -80);
  await expect.poll(async () => (await view(canvas)).zoom).toBeGreaterThan(before.zoom);
  expect(await view(canvas)).toMatchObject({ x: initial.x, y: initial.y });
  await canvas.dispatchEvent("wheel", { deltaY: 2, deltaMode: 1, ctrlKey: true });
  await expect
    .poll(async () => (await view(canvas)).zoom)
    .toBeLessThan(before.zoom * Math.exp(0.24));
  expect(await view(canvas)).toMatchObject({ x: initial.x, y: initial.y });
});

test("atlas can pan past every edge, zoom there, and select without snapping the view", async ({
  page,
}) => {
  await page.goto(`${workbench}&rect=0,0,16,16`);
  const canvas = page.getByLabel("Source spritesheet", { exact: true });
  await expect(canvas).toHaveAttribute("data-source-ready", "true");
  await canvas.scrollIntoViewIfNeeded();
  let box = await canvas.boundingBox();
  if (!box) throw new Error("Missing atlas viewport");
  const middleX = box.x + box.width / 2,
    middleY = box.y + box.height / 2;
  await page.mouse.move(middleX, middleY);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(middleX + 160, middleY + 160);
  await page.mouse.up({ button: "middle" });
  const outside = await view(canvas);
  expect(outside.x).toBeLessThan(0);
  expect(outside.y).toBeLessThan(0);
  await page.getByRole("button", { name: "Zoom −", exact: true }).click();
  expect(await view(canvas)).toMatchObject({ x: outside.x, y: outside.y });
  const current = await view(canvas);
  await canvas.scrollIntoViewIfNeeded();
  box = await canvas.boundingBox();
  if (!box) throw new Error("Missing atlas viewport");
  // Click source pixel (24,24), accounting for the out-of-sheet camera.
  await page.mouse.click(
    box.x + box.width / 2 + (24 - current.x) * current.zoom,
    box.y + box.height / 2 + (24 - current.y) * current.zoom,
  );
  await expect(page).toHaveURL(/rect=16%2C16%2C16%2C16/);
  expect(await view(canvas)).toEqual(current);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => canvas.evaluate((node) => node.width)).toBeLessThan(390);
  expect(await view(canvas)).toEqual(current);
  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  expect(await view(canvas)).toEqual(current);
  await page.goto(`${workbench}&rect=2800,8208,16,16`);
  await expect(canvas).toHaveAttribute("data-source-ready", "true");
  await page.getByLabel("Tool", { exact: true }).selectOption("pan");
  await canvas.scrollIntoViewIfNeeded();
  box = await canvas.boundingBox();
  if (!box) throw new Error("Missing atlas viewport");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2 - 100);
  await page.mouse.up();
  expect((await view(canvas)).x).toBeGreaterThan(2816);
  expect((await view(canvas)).y).toBeGreaterThan(8224);
  await page.getByRole("button", { name: "Fit width", exact: true }).click();
  expect((await view(canvas)).x).toBe(1408);
  await page.screenshot({ path: "/tmp/tilefun-source-viewport-phone.png" });
});
