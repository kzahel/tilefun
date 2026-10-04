// @ts-expect-error pngjs has no bundled declarations

import { expect, test } from "@playwright/test";
import pngjs from "pngjs";

test.use({ channel: "chromium" });
for (const backend of ["canvas", "gpu"]) {
  test(`geometry lab uses real Worker movement, cutaways and reload (${backend})`, async ({
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
    await expect(c).toHaveAttribute("data-player-z", "48");
    await expect(c).toHaveAttribute("data-server-z", "48");
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-player-z", "48");
    await page.getByRole("button", { name: "Start at passage", exact: true }).click();
    await expect(c).toHaveAttribute("data-player-z", "0");
    await c.focus();
    await page.keyboard.down("Space");
    await expect
      .poll(async () => Number(await c.getAttribute("data-player-z")))
      .toBeGreaterThan(15);
    expect(Number(await c.getAttribute("data-player-z"))).toBeLessThanOrEqual(28.001);
    await page.keyboard.up("Space");
    await expect(c).toHaveAttribute("data-player-z", "0");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByLabel("Visible surfaces").selectOption("lower");
    await expect(c).toHaveAttribute("data-visibility", "lower");
    expect(await c.getAttribute("data-player-z")).toBe("0");
    await page.screenshot({ path: `/tmp/tilefun-geometry-${backend}-cutaway.png`, fullPage: true });
    await page.getByLabel("Visible surfaces").selectOption("all");
    await expect(c).toHaveAttribute("data-visibility", "all");
    expect(await c.getAttribute("data-player-z")).toBe("0");
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

  test("geometry controls suppress long-press defaults and release touch input", async ({
    page,
  }) => {
    await page.goto("/tilefun/workshop.html#/tool/world-geometry");
    const c = page.getByLabel("World geometry scene");
    await expect(c).toHaveAttribute("data-ready", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const right = page.getByRole("button", { name: "→", exact: true });
    await right.scrollIntoViewIfNeeded();
    const buttons = page.locator(".geometry-controls button");
    for (const button of await buttons.all()) {
      await expect(button).toHaveCSS("user-select", "none");
      await expect(button).toHaveCSS("touch-action", "none");
      // Check the cancelable browser event, including non-movement controls.
      expect(
        await button.evaluate((el) =>
          el.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
            }),
          ),
        ),
      ).toBe(false);
    }
    const cdp = await page.context().newCDPSession(page);
    for (const end of ["touchEnd", "touchCancel"] as const) {
      await page.getByRole("button", { name: "Start at ramp", exact: true }).tap();
      await expect(c).toHaveAttribute("data-player-x", "-216");
      await right.scrollIntoViewIfNeeded();
      const box = await right.boundingBox();
      if (!box) throw new Error("Movement button is not visible");
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
      // Deliberately hold beyond the browser's long-press threshold.
      await page.waitForTimeout(900);
      const heldX = Number(await c.getAttribute("data-player-x"));
      expect(heldX).toBeGreaterThan(-210);
      await page.waitForTimeout(200);
      expect(Number(await c.getAttribute("data-player-x"))).toBeGreaterThan(heldX);
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
      await cdp.send("Input.dispatchTouchEvent", { type: end, touchPoints: [] });
      // Allow ordinary deceleration, then check that input is no longer held.
      await page.waitForTimeout(500);
      const stoppedX = Number(await c.getAttribute("data-player-x"));
      await page.waitForTimeout(250);
      expect(Number(await c.getAttribute("data-player-x"))).toBeCloseTo(stoppedX, 1);
    }
    await cdp.detach();
    await page.getByRole("button", { name: "Start at deck", exact: true }).tap();
    await expect(c).toHaveAttribute("data-player-z", "48");
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
    for (const direction of ["north", "south"]) {
      await page.getByRole("button", { name: "Start at passage", exact: true }).click();
      const resume = page.getByRole("button", { name: "Resume", exact: true });
      if (await resume.isVisible()) await resume.click();
      await c.focus();
      const key = direction === "north" ? "ArrowUp" : "ArrowDown";
      await page.keyboard.down(key);
      if (direction === "north") {
        await expect
          .poll(async () => Number(await c.getAttribute("data-player-y")), { intervals: [25] })
          .toBeLessThan(-80);
      } else {
        await expect
          .poll(async () => Number(await c.getAttribute("data-player-y")), { intervals: [25] })
          .toBeGreaterThan(52);
      }
      await page.keyboard.up(key);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(c).toHaveAttribute("data-player-z", "0");
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
        expect(body(automatic).equals(body(lower))).toBe(true);
        expect(body(all).equals(body(lower))).toBe(false);
        await select.selectOption("auto");
        await expect(c).toHaveAttribute("data-visibility", "auto");
      }
      await c.screenshot({ path: `/tmp/tilefun-geometry-${backend}-${direction}-occlusion.png` });
    }
  });
}
