import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

// Actual WebGL output needs full bundled Chromium, not headless-shell.
test.use({ channel: "chromium" });

test("car proxy preserves source pixels, orbits, recovers and releases its GPU context", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html#/tool/car-projection");
  const canvas = page.getByLabel("Orbitable textured car");
  const comparison = page.getByTestId("source-comparison");
  await expect(comparison).toHaveAttribute("data-source", "1809");
  await expect(comparison).toHaveAttribute("data-covered", "1809");
  await expect(comparison).toHaveAttribute("data-matching", "1809");
  await expect(comparison).toHaveAttribute("data-extra", "182");
  const geometry = page.getByTestId("geometry-check");
  await expect(geometry).toHaveAttribute("data-side-top", "0");
  await expect(geometry).toHaveAttribute("data-top-covered", "1152");
  await expect(geometry).toHaveAttribute("data-top-expected", "1152");
  await expect(geometry).toHaveAttribute("data-front-contact", /^[1-9]\d*$/);
  await expect(geometry).toHaveAttribute("data-rear-contact", /^[1-9]\d*$/);
  await expect(geometry).toHaveAttribute("data-below-ground", "0");
  const pixels = async () =>
    createHash("sha256")
      .update(await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL()))
      .digest("hex");
  const orbit = await pixels();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw Error("Missing canvas bounds");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.6, {
    steps: 8,
  });
  await page.mouse.up();
  expect(await pixels()).not.toBe(orbit);
  await page.getByRole("button", { name: "Orbit view", exact: true }).click();
  expect(await pixels()).toBe(orbit);
  await page.getByLabel("Approved collision", { exact: true }).check();
  const collision = await pixels();
  expect(collision).not.toBe(orbit);
  await page.getByLabel("Visual mesh edges").check();
  expect(await pixels()).not.toBe(collision);
  await page.getByLabel("Approved collision", { exact: true }).uncheck();
  await page.getByLabel("Visual mesh edges").uncheck();
  await page.getByRole("button", { name: "Far side", exact: true }).click();
  const back = await pixels();
  expect(back).not.toBe(orbit);
  await page.getByLabel("Show unseen surfaces").uncheck();
  expect(await pixels()).not.toBe(back);
  await page.getByLabel("Show unseen surfaces").check();
  await page.getByRole("button", { name: "Source view", exact: true }).click();
  const source = await pixels();
  expect(source).not.toBe(orbit);
  await page.getByRole("button", { name: "Low view", exact: true }).click();
  expect(await pixels()).not.toBe(source);
  await page.getByRole("button", { name: "Orbit view", exact: true }).click();
  await canvas.screenshot({ path: "/tmp/tilefun-car-projection-orbit.png" });
  for (const [view, label] of [
    ["side", "Side · ortho"],
    ["top", "Top · ortho"],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(canvas).toHaveAttribute("data-view", view);
    const preset = await pixels();
    expect(preset).not.toBe(orbit);
    await canvas.screenshot({ path: `/tmp/tilefun-car-projection-${view}.png` });
    const box = await canvas.boundingBox();
    if (!box) throw Error("Missing inspection canvas");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -250);
    await expect.poll(pixels).not.toBe(preset);
    await page.getByRole("button", { name: label, exact: true }).click();
    expect(await pixels()).toBe(preset);
  }
  await page.getByRole("button", { name: "Orbit view", exact: true }).click();

  const beforeLoss = await pixels();
  const context = await canvas.evaluateHandle((c: HTMLCanvasElement) => {
    const extension = c.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!extension) throw Error("Context-loss extension unavailable");
    return extension;
  });
  await context.evaluate((extension) => extension.loseContext());
  await expect(canvas).toHaveAttribute("data-device", "lost");
  await context.evaluate((extension) => extension.restoreContext());
  await expect(canvas).toHaveAttribute("data-device", "ready");
  await expect(canvas).toHaveAttribute("data-recoveries", "1");
  expect(await pixels()).toBe(beforeLoss);
  await context.dispose();

  const retained = await canvas.elementHandle();
  if (!retained) throw Error("Missing canvas handle");
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Find your tool." })).toBeVisible();
  expect(await retained.getAttribute("data-ready")).toBe("false");
  await expect
    .poll(() =>
      retained.evaluate((c: HTMLCanvasElement) => c.getContext("webgl2")?.isContextLost()),
    )
    .toBe(true);
  await retained.dispose();
  await page
    .locator(".tool-card")
    .filter({ has: page.getByRole("heading", { name: "Car projection" }) })
    .getByRole("link", { name: "Open tool →" })
    .click();
  await expect(page.getByTestId("source-comparison")).toHaveAttribute("data-matching", "1809");
  await expect(page.getByLabel("Orbitable textured car")).toHaveAttribute("data-recoveries", "0");
  expect(errors).toEqual([]);
});

test("car experiment is discoverable without approvals and works in a touch viewport", async ({
  browser,
  request,
}) => {
  const response = await request.get("/tilefun/data/workshop-manifest.json");
  const manifest = await response.json();
  const candidate = manifest.candidates.find(
    (c: { id: string }) => c.id === "projection:compact-car-v1",
  );
  expect(candidate.excluded).toContain("not an immutable approval snapshot");
  expect(manifest.batches.some((b: { id: string }) => b.id === "car-projection")).toBe(true);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    storageState: "test-results/workshop-session.json",
  });
  try {
    const page = await context.newPage();
    await page.goto(
      "http://localhost:4174/tilefun/workshop.html#/review/projection%3Acompact-car-v1",
    );
    // Candidate URLs route to an exploratory tool, not the approval surface.
    await expect(page.getByRole("heading", { name: "Car projection lab" })).toBeVisible();
    const canvas = page.getByLabel("Orbitable textured car");
    await expect(page.getByTestId("source-comparison")).toHaveAttribute("data-matching", "1809");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await canvas.scrollIntoViewIfNeeded();
    const before = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const box = await canvas.boundingBox();
    if (!box) throw Error("Missing touch canvas");
    const cdp = await context.newCDPSession(page);
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 60, y: y + 25 }],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(before);
    await page.getByRole("button", { name: "Top · ortho", exact: true }).click();
    await canvas.scrollIntoViewIfNeeded();
    const topBefore = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const topBox = await canvas.boundingBox();
    if (!topBox) throw Error("Missing top canvas");
    const tx = topBox.x + topBox.width / 2,
      ty = topBox.y + topBox.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: tx - 30, y: ty },
        { x: tx + 30, y: ty },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: tx - 50, y: ty },
        { x: tx + 50, y: ty },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(topBefore);
    await page.getByRole("button", { name: "Top · ortho", exact: true }).click();
    await cdp.detach();
    await page.screenshot({ path: "/tmp/tilefun-car-projection-phone.png", fullPage: true });
  } finally {
    await context.close();
  }
});
