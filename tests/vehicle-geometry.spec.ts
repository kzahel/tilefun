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
  await page.keyboard.down("ArrowUp");
  try {
    await expect.poll(async () => Number(await c.getAttribute("data-car-z"))).toBeLessThan(-12);
  } finally {
    await page.keyboard.up("ArrowUp");
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

test("3D vehicle course preserves ramp rotation on reload and recovers cars and trucks through shared controls", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "/tilefun/workshop.html?geometry=car-dynamics&renderer=gpu&meshes#/tool/world-geometry",
  );
  const canvas = page.getByLabel("World geometry scene");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: /^Drive car/ }).click();
  await canvas.focus();
  await page.keyboard.down("ArrowUp");
  try {
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-car-z")))
      .toBeGreaterThan(24);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-car-up")))
      .toBeLessThan(0.995);
  } finally {
    await page.keyboard.up("ArrowUp");
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  let previous = "",
    stable = 0;
  await expect
    .poll(
      async () => {
        const pose = await canvas.getAttribute("data-car-rotation");
        stable = pose === previous ? stable + 1 : 0;
        previous = pose ?? "";
        return stable;
      },
      { intervals: [100] },
    )
    .toBeGreaterThanOrEqual(3);
  const rotation = JSON.parse(previous) as number[];
  await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-reload-count", "1");
  const restored = JSON.parse(
    (await canvas.getAttribute("data-car-rotation")) ?? "null",
  ) as number[];
  expect(
    Math.abs(rotation.reduce((sum, value, index) => sum + value * (restored[index] ?? 0), 0)),
  ).toBeCloseTo(1, 3);
  await page.getByRole("button", { name: "recover", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-course-route", "recover");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-car-up")))
    .toBeLessThan(-0.9);
  await expect(page.getByRole("button", { name: /^Right car/ })).toBeVisible();
  await page.waitForTimeout(600);
  await canvas.focus();
  await page.keyboard.press("f");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-car-up")))
    .toBeGreaterThan(0.99);
  await expect(page.getByRole("button", { name: /^Right car/ })).toBeHidden();
  await page.getByLabel("Vehicle model").selectOption("dump-truck");
  await expect(canvas).toHaveAttribute("data-car-model", "dump-truck");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-car-up")))
    .toBeLessThan(-0.9);
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Right car/ }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-car-up")))
    .toBeGreaterThan(0.99);
  await page.screenshot({
    path: test.info().outputPath("dynamic-vehicle-course.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
});

test("ordinary ramp and mesh-roof landings share projected contact effects", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    "/tilefun/workshop.html?geometry=car-dynamics&route=ramp&renderer=gpu&meshes#/tool/world-geometry",
  );
  const canvas = page.getByLabel("World geometry scene");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect(canvas).toHaveAttribute("data-course-route", "ramp");
  const diagnostics = () => canvas.evaluate((c: GeometryCanvas) => c.__presentationDiagnostics?.());
  const jump = async () => {
    await expect.poll(async () => (await diagnostics())?.playerGrounded).toBe(true);
    // A newly spawned roof rider may make its initial contact before this test
    // starts. Wait for that cosmetic burst to expire, then observe a new jump.
    await expect
      .poll(async () => {
        const e = (await diagnostics())?.effects;
        return (e?.particles ?? 0) + (e?.marks ?? 0) + (e?.pending ?? 0);
      })
      .toBe(0);
    const z = Number(await canvas.getAttribute("data-player-z"));
    // Each projected dust burst replaces lastContact and adds a 0.24 s mark. The
    // mark can expire between slow round trips; the contact identity persists.
    await canvas.evaluate((c: GeometryCanvas) =>
      Reflect.set(c, "contactBeforeJump", c.__presentationDiagnostics?.().effects.lastContact),
    );
    await canvas.focus();
    await page.keyboard.down("Space");
    try {
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-player-z")), { intervals: [30] })
        .toBeGreaterThan(z + 5);
    } finally {
      await page.keyboard.up("Space");
    }
    await expect
      .poll(() =>
        canvas.evaluate(
          (c: GeometryCanvas) =>
            c.__presentationDiagnostics?.().effects.lastContact !==
            Reflect.get(c, "contactBeforeJump"),
        ),
      )
      .toBe(true);
  };
  await jump();
  const ramp = (await diagnostics())?.effects.lastContact;
  expect(ramp?.receiverId).toBe("ascent");
  // Elevated on the ascent ramp; the exact landing point varies with frame timing.
  expect(ramp?.point[2]).toBeGreaterThan(20);
  expect(ramp?.normal[0]).toBeLessThan(-0.1);
  await page.getByRole("button", { name: "roof", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-course-route", "roof");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect
    .poll(async () => (await diagnostics())?.receivers.meshTriangles ?? 0)
    .toBeGreaterThan(0);
  await jump();
  const roof = (await diagnostics())?.effects.lastContact;
  expect(roof?.receiverId).toMatch(/^body:/);
  expect(roof?.point[2]).toBeGreaterThan(18);
  expect(roof?.point[2]).toBeLessThan(24);
  await page.screenshot({
    path: test.info().outputPath("surface-contact-effects.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
});
