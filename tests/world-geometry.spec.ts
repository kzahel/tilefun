import { expect, type Locator, test } from "@playwright/test";
import pngjs from "pngjs";
import type { GeometryCanvas } from "../src/workshop/WorldGeometryPage.js";

test.use({ channel: "chromium" });

// Rapier rests bodies within its allowed contact error, so a supported height
// differs from the surface by a small fraction of a pixel.
const expectHeight = (c: Locator, z: number, attribute = "data-player-z") =>
  expect.poll(async () => Number(await c.getAttribute(attribute))).toBeCloseTo(z, 2);

for (const backend of ["canvas", "gpu"]) {
  // The Canvas case is in smoke while 226 moves lab input onto the game.
  const tag = backend === "canvas" ? ["@smoke"] : [];
  test(`geometry lab uses real Worker movement, cutaways and reload (${backend})`, { tag }, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/tilefun/workshop.html?renderer=${backend}#/tool/world-geometry`);
    const c = page.getByLabel("World geometry scene");
    await expect(c).toHaveAttribute("data-ready", "true");
    await c.focus();
    await page.keyboard.down("ArrowRight");
    await expect(c).toHaveAttribute("data-support", "deck", { timeout: 8000 });
    await page.keyboard.up("ArrowRight");
    await expectHeight(c, 48);
    await expectHeight(c, 48, "data-server-z");
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expectHeight(c, 48);
    await page.getByRole("button", { name: "passage", exact: true }).click();
    await expectHeight(c, 0);
    await c.focus();
    await page.keyboard.down("Space");
    await expect
      .poll(async () => Number(await c.getAttribute("data-player-z")))
      .toBeGreaterThan(15);
    expect(Number(await c.getAttribute("data-player-z"))).toBeLessThanOrEqual(28.001);
    await page.keyboard.up("Space");
    await expectHeight(c, 0);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByLabel("Visible surfaces").selectOption("lower");
    await expect(c).toHaveAttribute("data-visibility", "lower");
    expect(Number(await c.getAttribute("data-player-z"))).toBeCloseTo(0, 2);
    await page.screenshot({ path: `/tmp/tilefun-geometry-${backend}-cutaway.png`, fullPage: true });
    await page.getByLabel("Visible surfaces").selectOption("all");
    await expect(c).toHaveAttribute("data-visibility", "all");
    expect(Number(await c.getAttribute("data-player-z"))).toBeCloseTo(0, 2);
    await page.screenshot({ path: `/tmp/tilefun-geometry-${backend}-all.png`, fullPage: true });
    await page.getByRole("button", { name: "Reset scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect(c).toHaveAttribute("data-player-x", "-216");
    await page.getByRole("link", { name: "All tools", exact: true }).click();
    await expect.poll(() => page.workers().length).toBe(0);
    expect(errors).toEqual([]);
  });
}

test.describe("phone controls", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("the game's touch joystick on the lab canvas suppresses long-press defaults and releases", async ({
    page,
  }) => {
    await page.goto("/tilefun/workshop.html?renderer=legacy-canvas#/tool/world-geometry");
    const c = page.getByLabel("World geometry scene");
    await expect(c).toHaveAttribute("data-ready", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // The lab's own arrow buttons are gone (226 slice 2); the canvas is the control surface.
    await expect(page.locator(".geometry-controls")).toHaveCount(0);
    await expect(c).toHaveCSS("touch-action", "none");
    const cdp = await page.context().newCDPSession(page);
    for (const end of ["touchEnd", "touchCancel"] as const) {
      await page.getByRole("button", { name: "ramp", exact: true }).tap();
      await expect(c).toHaveAttribute("data-player-x", "-216");
      await c.scrollIntoViewIfNeeded();
      const box = await c.boundingBox();
      if (!box) throw new Error("Lab canvas is not visible");
      // Drag the joystick right from the canvas's left third, then hold there.
      const start = { x: box.x + box.width / 3, y: box.y + box.height / 2 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: start.x + 60, y: start.y }],
      });
      // Deliberately hold beyond the browser's long-press threshold.
      await page.waitForTimeout(900);
      const heldX = Number(await c.getAttribute("data-player-x"));
      expect(heldX).toBeGreaterThan(-210);
      await page.waitForTimeout(200);
      expect(Number(await c.getAttribute("data-player-x"))).toBeGreaterThan(heldX);
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
      await cdp.send("Input.dispatchTouchEvent", { type: end, touchPoints: [] });
      // Allow ordinary deceleration, then check that input is no longer held.
      // An idle body creeps down this ramp at about 1px/s in shared physics;
      // a held control walks tens of pixels per second.
      let stoppedX = Number.NaN;
      await expect
        .poll(
          async () => {
            const previous = stoppedX;
            stoppedX = Number(await c.getAttribute("data-player-x"));
            return Math.abs(stoppedX - previous) < 0.5;
          },
          { intervals: [100] },
        )
        .toBe(true);
      await page.waitForTimeout(250);
      expect(Math.abs(Number(await c.getAttribute("data-player-x")) - stoppedX)).toBeLessThan(1);
    }
    await cdp.detach();
    await page.getByRole("button", { name: "deck", exact: true }).tap();
    await expectHeight(c, 48);
    await page.getByRole("button", { name: "Pause", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
    await page.screenshot({ path: "/tmp/tilefun-geometry-phone.png", fullPage: true });
  });
});

for (const backend of ["canvas", "gpu"]) {
  test(`automatic cutaway follows rendered occlusion north and south of the deck (${backend})`, async ({
    page,
  }) => {
    await page.goto(`/tilefun/workshop.html?renderer=${backend}#/tool/world-geometry`);
    const c = page.getByLabel("World geometry scene");
    await expect(c).toHaveAttribute("data-ready", "true");
    const select = page.getByLabel("Visible surfaces");
    const capture = async (mode: string) => {
      await select.selectOption(mode);
      await expect(c).toHaveAttribute("data-visibility", mode);
      return c.screenshot();
    };
    // The south case needs the 12 px band where the body is beneath the deck yet
    // drawn clear of it; key-hold walking overshoots it on hosted software GPU
    // (released at y 59, stopped at 76), so place the player exactly.
    for (const [direction, wy] of [
      ["north", -88],
      ["south", 58],
    ] as const) {
      const resume = page.getByRole("button", { name: "Resume", exact: true });
      if (await resume.isVisible()) await resume.click();
      await c.evaluate(
        (canvas: GeometryCanvas, wy) =>
          canvas.__command?.({ kind: "teleport", position: { wx: 80, wy }, z: 0 }),
        wy,
      );
      await expect
        .poll(async () => Number(await c.getAttribute("data-player-y")))
        .toBeCloseTo(wy, 1);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expectHeight(c, 0);
      const y = Number(await c.getAttribute("data-player-y"));
      const all = await capture("all");
      const automatic = await capture("auto");
      if (direction === "south") {
        expect(y).toBeLessThan(64); // Still physically beneath the deck.
        expect(automatic.equals(all)).toBe(true);
      } else {
        expect(y).toBeLessThan(-64); // Outside its footprint, yet occluded.
        const lower = await capture("lower");
        const body = (bytes: Buffer) => {
          const image = pngjs.PNG.sync.read(bytes);
          const ratio = image.width / 960;
          const scale = 3 * 0.625;
          const left = Math.floor(((80 - 8 + 16) * scale + 480) * ratio);
          const right = Math.ceil(((80 + 8 + 16) * scale + 480) * ratio);
          const top = Math.floor(((y - 16 + 16) * scale + 320) * ratio);
          const bottom = Math.ceil(((y + 16) * scale + 320) * ratio);
          const rows: Buffer[] = [];
          for (let row = top; row < bottom; row++)
            rows.push(
              image.data.subarray((row * image.width + left) * 4, (row * image.width + right) * 4),
            );
          return Buffer.concat(rows);
        };
        expect(body(all).equals(body(lower))).toBe(false);
        // The revealed deck stays drawn over the player as one translucent group
        // (REVEAL_OPACITY = 0.45): every pixel is the blend of the opaque deck and
        // the uncovered player. Per-strip alpha would leave visible seams instead.
        const hidden = body(lower),
          opaque = body(all);
        await select.selectOption("auto");
        await expect(c).toHaveAttribute("data-visibility", "auto");
        await expect
          .poll(async () => {
            const revealed = body(await c.screenshot());
            let worst = 0;
            for (let i = 0; i < revealed.length; i++) {
              if (i % 4 === 3) continue;
              const expected = (hidden[i] ?? 0) * 0.55 + (opaque[i] ?? 0) * 0.45;
              worst = Math.max(worst, Math.abs((revealed[i] ?? 0) - expected));
            }
            return worst;
          })
          .toBeLessThanOrEqual(3);
        expect(body(automatic).equals(body(lower))).toBe(false);
      }
      await c.screenshot({ path: `/tmp/tilefun-geometry-${backend}-${direction}-occlusion.png` });
    }
  });
}
