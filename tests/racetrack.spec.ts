import { expect, test } from "@playwright/test";
// @ts-expect-error pngjs has no bundled declarations
import pngjs from "pngjs";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

test.use({ channel: "chromium", viewport: { width: 1440, height: 1100 } });
for (const renderer of ["canvas", "gpu"]) {
  test(`generated speedway has racing cars, spectators and saved motion (${renderer})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=nature-racetrack&landscape=thicket&renderer=${renderer}#/tool/world-geometry`,
    );
    const canvas = page.getByLabel("Natural landscape playground");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    type Pose = { key: string; x: number; y: number; vx: number; vy: number };
    const poses = async () =>
      JSON.parse((await canvas.getAttribute("data-racer-poses")) ?? "[]") as Pose[];
    await expect.poll(async () => (await poses()).length).toBe(8);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-spectator-count")))
      .toBe(48);
    await expect
      .poll(async () => (await poses()).filter((p) => Math.hypot(p.vx, p.vy) > 50).length, {
        timeout: 15000,
      })
      .toBe(8);
    const before = await poses();
    await expect
      .poll(async () => {
        const after = await poses();
        return before.every((p) =>
          after.some((q) => p.key === q.key && Math.hypot(q.x - p.x, q.y - p.y) > 30),
        );
      })
      .toBe(true);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-authority-running", "false");
    const frozen = await poses();
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-reload-count", "1");
    await expect(canvas).toHaveAttribute("data-terrain-pending", "0");
    const restored = await poses();
    expect(restored).toHaveLength(frozen.length);
    for (const p of frozen)
      expect(restored.some((q) => q.key === p.key && Math.hypot(q.x - p.x, q.y - p.y) < 0.01)).toBe(
        true,
      );
    await page.evaluate(() => scrollTo(0, 0));
    const pixels = pngjs.PNG.sync.read(
      await canvas.screenshot({ path: `/tmp/tilefun-racetrack-${renderer}.png` }),
    );
    let redKerb = 0,
      checkers = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (pixels.data[i] === 207 && pixels.data[i + 1] === 69 && pixels.data[i + 2] === 69)
        redKerb++;
      if (pixels.data[i] === 38 && pixels.data[i + 1] === 42 && pixels.data[i + 2] === 48)
        checkers++;
    }
    expect(redKerb).toBeGreaterThan(1000);
    expect(checkers).toBeGreaterThan(100);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(async () => (await poses()).some((p) => Math.hypot(p.vx, p.vy) > 50))
      .toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const [name, x, y, spectators] of [
  ["south entrance", 462, 492, 24],
  ["north start line", 462, 412, 12],
  ["east bend", 525, 455, 6],
] as const)
  test(`ordinary game shows spectators at the ${name}`, async ({ page }) => {
    const generation = createDescriptor("regional", 2026);
    const params = new URLSearchParams({
      new: "1",
      generation: JSON.stringify(generation),
      arrival: JSON.stringify({ x, y, generation }),
    });
    await page.goto(`/tilefun/?${params}`);
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.getByTestId("world-menu")).toBeHidden();
    const canvas = page.locator("#game");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        canvas.evaluate(
          (c, at) => {
            const game = (
              c as unknown as { __game: import("../src/client/GameClient.js").GameClient }
            ).__game;
            return game.stateView.entities.filter(
              (e) =>
                e.type.startsWith("person") &&
                Math.abs(e.position.wx / 16 - at.x) < 28 &&
                Math.abs(e.position.wy / 16 - at.y) < 28,
            ).length;
          },
          { x, y },
        ),
      )
      .toBeGreaterThanOrEqual(spectators);
    await canvas.screenshot({
      path: `/tmp/tilefun-racetrack-crowd-${name.replaceAll(" ", "-")}.png`,
    });
    await expect
      .poll(() =>
        canvas.evaluate((c) => {
          const game = (
            c as unknown as { __game: import("../src/client/GameClient.js").GameClient }
          ).__game;
          return game.stateView.entities.filter(
            (e) =>
              /^vehicle-v1:car-2[1-6]$/.test(e.type) &&
              Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) > 10,
          ).length;
        }),
      )
      .toBeGreaterThan(0);
  });

for (const phone of [false, true])
  test(`world map draws and names the speedway (${phone ? "phone" : "desktop"})`, async ({
    page,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const generation = createDescriptor("regional", 2026);
    const params = new URLSearchParams({
      new: "1",
      generation: JSON.stringify(generation),
      arrival: JSON.stringify({ x: 300, y: 519, generation }),
    });
    await page.goto(`/tilefun/?${params}`);
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Create a world" })).toBeHidden();
    await page.getByRole("button", { name: "Open world map" }).click();
    const map = page.getByTestId("world-map");
    await expect(map).toHaveAttribute("data-settled", "true");
    await expect(map).toHaveAttribute("data-racetracks", "1");
    await map.getByTestId("world-map-racetrack").click();
    await expect(map).toHaveAttribute("data-x", "462");
    await expect(map).toHaveAttribute("data-y", "455");
    await expect(map).toHaveAttribute("data-settled", "true");
    await expect(map.getByTestId("world-map-racetrack")).toHaveText(/Speedway$/);
    expect(
      await map.getByTestId("world-map-canvas").evaluate((node) => {
        const canvas = node as HTMLCanvasElement,
          ctx = canvas.getContext("2d");
        if (!ctx) throw Error("Missing map context");
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let oval = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i] === 184 && data[i + 1] === 76 && data[i + 2] === 53) oval++;
        return oval;
      }),
    ).toBeGreaterThan(1000);
    if (phone)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    await page.screenshot({
      path: `/tmp/tilefun-racetrack-map-${phone ? "phone" : "desktop"}.png`,
    });
  });
