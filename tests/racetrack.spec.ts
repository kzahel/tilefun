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
      .toBeGreaterThanOrEqual(24);
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

test("fresh ordinary game generates a populated track at the same seed and location", async ({
  page,
}) => {
  const generation = createDescriptor("regional", 2026);
  const params = new URLSearchParams({
    new: "1",
    generation: JSON.stringify(generation),
    arrival: JSON.stringify({ x: 462, y: 492, generation }),
  });
  await page.goto(`/tilefun/?${params}`);
  await page.getByRole("button", { name: "New World", exact: true }).click();
  const canvas = page.locator("#game");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await expect
    .poll(() =>
      canvas.evaluate((c) => {
        const game = (c as unknown as { __game: import("../src/client/GameClient.js").GameClient })
          .__game;
        const view = game.stateView;
        return {
          racers: view.entities.filter((e) => /^vehicle-v1:car-2[1-6]$/.test(e.type)).length,
          benches: view.props.filter((p) => p.proceduralId?.includes(":racetrack:bench:")).length,
        };
      }),
    )
    .toMatchObject({ benches: 24 });
  await expect
    .poll(() =>
      canvas.evaluate((c) => {
        const game = (c as unknown as { __game: import("../src/client/GameClient.js").GameClient })
          .__game;
        return game.stateView.entities.filter(
          (e) =>
            /^vehicle-v1:car-2[1-6]$/.test(e.type) &&
            Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) > 10,
        ).length;
      }),
    )
    .toBeGreaterThan(0);
});
