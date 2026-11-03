import { expect, test } from "@playwright/test";
import type { GeometryCanvas } from "../src/workshop/WorldGeometryPage.js";

test.use({ channel: "chromium" });
test("ordinary Worker car controls traverse a rendered ramp and retain the saved seat", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    "/tilefun/workshop.html?geometry=car-garage&renderer=gpu&meshes#/tool/world-geometry",
  );
  const c = page.getByLabel("World geometry scene");
  await expect(c).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: /^Drive car/ }).click();
  await expect(page.getByRole("button", { name: /^Get out/ })).toBeVisible();
  await c.focus();
  await page.keyboard.down("ArrowRight");
  try {
    await expect.poll(async () => Number(await c.getAttribute("data-car-z"))).toBeLessThan(-12);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  let last = "",
    stable = 0;
  await expect
    .poll(
      async () => {
        const value = (await c.getAttribute("data-car-z")) ?? "";
        stable = value === last ? stable + 1 : 0;
        last = value;
        return stable;
      },
      { intervals: [100] },
    )
    .toBeGreaterThanOrEqual(3);
  await expect
    .poll(() =>
      c.evaluate((canvas: GeometryCanvas) => canvas.__presentationDiagnostics?.().meshDraws ?? 0),
    )
    .toBeGreaterThan(0);
  const height = Number(last);
  await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
  await expect(c).toHaveAttribute("data-reload-count", "1");
  expect(Math.abs(Number(await c.getAttribute("data-car-z")) - height)).toBeLessThan(0.5);
  await expect(page.getByRole("button", { name: /^Get out/ })).toBeVisible();
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
});

test("ordinary road traffic moves through Worker frames, pauses and survives save/reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  const canvas = page.getByLabel("World geometry scene");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-traffic-count")))
    .toBeGreaterThan(1);
  const position = async () => ({
    x: Number(await canvas.getAttribute("data-traffic-x")),
    y: Number(await canvas.getAttribute("data-traffic-y")),
  });
  const start = await position();
  await expect
    .poll(async () => {
      const p = await position();
      return Math.hypot(p.x - start.x, p.y - start.y);
    })
    .toBeGreaterThan(20);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  let previous = "",
    stable = 0;
  await expect
    .poll(
      async () => {
        const p = await position();
        const key = JSON.stringify(p);
        stable = key === previous ? stable + 1 : 0;
        previous = key;
        return stable;
      },
      { intervals: [100] },
    )
    .toBeGreaterThanOrEqual(3);
  const count = Number(await canvas.getAttribute("data-traffic-count"));
  await page.screenshot({ path: test.info().outputPath("rolling-traffic.png"), fullPage: true });
  await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-reload-count", "1");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-traffic-count")))
    .toBe(count);
  const restored = await position();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(async () => {
      const p = await position();
      return Math.hypot(p.x - restored.x, p.y - restored.y);
    })
    .toBeGreaterThan(8);
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
});
