import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { WorkshopManifest } from "../src/workshop/WorkshopTypes.js";

const manifest = JSON.parse(
  readFileSync("public/data/workshop-manifest.json", "utf8"),
) as WorkshopManifest;

test("district camera zooms at the cursor, pans without scrolling or changing pixels, and resets between candidates", async ({
  page,
}) => {
  await page.goto("/tilefun/workshop.html#/review/district%3Adistrict-v1-neighborhood?show=all");
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  const frame = page.getByRole("application", { name: "Preview viewport" });
  const canvas = page.getByLabel("Candidate preview", { exact: true });
  await frame.scrollIntoViewIfNeeded();
  const original = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  const initialZoom = Number(await frame.getAttribute("data-preview-zoom"));
  const box = await frame.boundingBox();
  if (!box) throw Error("No frame");
  const point = {
    x: Math.round(box.x + box.width * 0.4),
    y: Math.round(box.y + box.height * 0.45),
  };
  const position = () =>
    canvas.evaluate((node, point) => {
      const c = node as HTMLCanvasElement,
        rect = c.getBoundingClientRect();
      return {
        x: ((point.x - rect.left) * c.width) / rect.width,
        y: ((point.y - rect.top) * c.height) / rect.height,
      };
    }, point);
  const before = await position();
  const scroll = await page.evaluate(() => scrollY);
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, -180);
  await expect
    .poll(async () => Number(await frame.getAttribute("data-preview-zoom")))
    .toBeGreaterThan(initialZoom);
  const after = await position();
  expect(after.x).toBeCloseTo(before.x, 3);
  expect(after.y).toBeCloseTo(before.y, 3);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await expect(page.getByLabel("Scale", { exact: true })).toHaveValue("custom");
  const x = Number(await frame.getAttribute("data-preview-x")),
    y = Number(await frame.getAttribute("data-preview-y"));
  await page.mouse.down();
  await page.mouse.move(point.x + 70, point.y + 45, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await frame.getAttribute("data-preview-x")))
    .toBeCloseTo(x + 70, 3);
  await expect
    .poll(async () => Number(await frame.getAttribute("data-preview-y")))
    .toBeCloseTo(y + 45, 3);
  await page.mouse.move(point.x, point.y);
  // Real touchpads include deltaX jitter, and Shift can convert scrolling to
  // horizontal-only events. Every variant must zoom around the same tile.
  for (const gesture of [
    { dx: 4, dy: 30, shift: false },
    { dx: 40, dy: 30, shift: false },
    { dx: 0, dy: 80, shift: true },
    { dx: 45, dy: 0, shift: true },
  ]) {
    const anchor = await position();
    const zoom = Number(await frame.getAttribute("data-preview-zoom"));
    if (gesture.shift) await page.keyboard.down("Shift");
    await page.mouse.wheel(gesture.dx, gesture.dy);
    if (gesture.shift) await page.keyboard.up("Shift");
    await expect
      .poll(async () => Number(await frame.getAttribute("data-preview-zoom")))
      .toBeLessThan(zoom);
    const next = await position();
    expect(next.x).toBeCloseTo(anchor.x, 3);
    expect(next.y).toBeCloseTo(anchor.y, 3);
    expect(await page.evaluate(() => scrollY)).toBe(scroll);
  }
  const middleX = Number(await frame.getAttribute("data-preview-x")),
    middleY = Number(await frame.getAttribute("data-preview-y")),
    middleZoom = Number(await frame.getAttribute("data-preview-zoom"));
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(point.x + 50, point.y + 25, { steps: 5 });
  await page.mouse.up({ button: "middle" });
  await expect
    .poll(async () => Number(await frame.getAttribute("data-preview-x")))
    .toBeCloseTo(middleX + 50, 3);
  await expect
    .poll(async () => Number(await frame.getAttribute("data-preview-y")))
    .toBeCloseTo(middleY + 25, 3);
  expect(Number(await frame.getAttribute("data-preview-zoom"))).toBe(middleZoom);
  await page.mouse.move(point.x + 80, point.y + 55);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  const candidate = await page.locator(".review-page").getAttribute("data-candidate");
  await frame.focus();
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(async () => Number(await frame.getAttribute("data-preview-x")))
    .toBeCloseTo(middleX + 130, 3);
  await expect(page.locator(".review-page")).toHaveAttribute("data-candidate", candidate ?? "");
  expect(await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL())).toBe(original);
  await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
  await page.screenshot({ path: "/tmp/tilefun-workshop-district-zoom-pan.png", fullPage: true });
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await expect(page.getByLabel("Scale", { exact: true })).toHaveValue("fit");
  await expect
    .poll(async () => Number(await frame.getAttribute("data-preview-zoom")))
    .toBeCloseTo(initialZoom, 3);
  await page.getByRole("button", { name: "Zoom preview in", exact: true }).click();
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  await expect(page.getByLabel("Scale", { exact: true })).toHaveValue("fit");
});

test("panning a room never adds pins and a zoomed tap maps to the original tile on desktop and phone", async ({
  page,
}) => {
  const room = manifest.candidates.find(
    (c) =>
      c.kind === "interior" && !c.excluded && (c.interior?.sketch.split("\n").length ?? 0) >= 5,
  );
  if (!room) throw Error("No room");
  await page.goto(`/tilefun/workshop.html#/review/${encodeURIComponent(room.id)}?show=all`);
  await expect(page.locator('[data-review-ready="true"]')).toBeVisible();
  const frame = page.getByRole("application", { name: "Preview viewport" });
  const canvas = page.getByLabel("Candidate preview", { exact: true });
  await page.getByLabel("Scale", { exact: true }).selectOption("large");
  await frame.scrollIntoViewIfNeeded();
  const box = await frame.boundingBox();
  if (!box) throw Error("No frame");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 25, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".pin-overlay rect")).toHaveCount(0);
  const target = await canvas.evaluate((node) => {
    const c = node as HTMLCanvasElement,
      rect = c.getBoundingClientRect();
    const x = Math.floor(c.width / 2 / 16) * 16,
      y = Math.floor(c.height / 2 / 16) * 16;
    return {
      x,
      y,
      clientX: rect.left + ((x + 4) * rect.width) / c.width,
      clientY: rect.top + ((y + 4) * rect.height) / c.height,
    };
  });
  await page.mouse.click(target.clientX, target.clientY);
  await expect(page.locator(".pin-overlay rect")).toHaveCount(1);
  await expect(page.locator(".pin-overlay rect")).toHaveAttribute("x", String(target.x));
  await expect(page.locator(".pin-overlay rect")).toHaveAttribute("y", String(target.y));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page.getByRole("button", { name: "Zoom preview in", exact: true }).click();
  await expect(page.getByLabel("Scale", { exact: true })).toHaveValue("custom");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".pin-overlay rect")).toHaveCount(1);
});
