import { expect, test } from "@playwright/test";
import pngjs from "pngjs";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

test.use({ channel: "chromium", viewport: { width: 1440, height: 1100 } });
for (const renderer of ["canvas", "gpu"]) {
  // Racing cars are deferred since 8f405aaf retired their motion service; the
  // speedway keeps its spectators, kerbs and start line.
  test(`generated speedway has spectators and reloads (${renderer})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      // Exact kerb/checker colors need the grid-locked comparison projection;
      // continuous projection filters the world frame's fractional remainder (b4144ded).
      `/tilefun/workshop.html?geometry=nature-racetrack&landscape=thicket&pixelsnap=1&renderer=${renderer}#/tool/world-geometry`,
    );
    const canvas = page.getByLabel("Natural landscape playground");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-spectator-count")))
      .toBe(48);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-authority-running", "false");
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-reload-count", "1");
    await expect(canvas).toHaveAttribute("data-terrain-pending", "0");
    await expect(canvas).toHaveAttribute("data-spectator-count", "48");
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
              c as unknown as { __game: import("../src/client/GameTestHooks.js").GameTestHooks }
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
