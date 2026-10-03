import { expect, test } from "@playwright/test";
import type { ClientStateView } from "../src/client/ClientStateView.js";
import { CURRENT_REGIONAL_VERSION } from "../src/generation/GenerationDescriptor.js";

test.use({ channel: "chromium" });
test("generated traffic stops, supports a real jump onto its roof, and continues driving", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/workshop.html#/tool/traffic");
  const c = page.getByLabel("Generated traffic playground");
  await expect(c).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => Number(await c.getAttribute("data-speed"))).toBe(0);
  await expect(c).toHaveAttribute("data-waiting", "crossing");
  const stopped = Number(await c.getAttribute("data-car-x"));
  await c.focus();
  await page.keyboard.down("ArrowLeft");
  await page.keyboard.down("Space");
  await page.waitForTimeout(630);
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.up("Space");
  await expect(c).toHaveAttribute("data-player-z", "24");
  await expect
    .poll(async () => Number(await c.getAttribute("data-car-x")))
    .toBeGreaterThan(stopped + 15);
  await expect(c).toHaveAttribute("data-player-z", "24");
  await page.screenshot({ path: "/tmp/tilefun-traffic-roof.png", fullPage: true });
  await page.keyboard.down("Space");
  await page.waitForTimeout(120);
  await page.keyboard.up("Space");
  expect(Number(await c.getAttribute("data-player-z"))).toBeGreaterThan(24);
  expect(errors).toEqual([]);
});
test("traffic playground fits phones and touch directions release on cancellation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/workshop.html#/tool/traffic");
  const c = page.getByLabel("Generated traffic playground");
  await expect(c).toHaveAttribute("data-ready", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Start on roof", exact: true }).click();
  await expect(c).toHaveAttribute("data-player-z", "24");
  const jump = page.getByRole("button", { name: "Jump", exact: true });
  await jump.dispatchEvent("pointerdown", { pointerId: 1 });
  await jump.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.screenshot({ path: "/tmp/tilefun-traffic-phone.png", fullPage: true });
});
test("traffic revision creates a real Worker world and survives reload", async ({ page }) => {
  const generation = {
    type: "regional",
    version: CURRENT_REGIONAL_VERSION,
    seed: 2026,
    preset: "temperate-v1",
  };
  await page.goto(`/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}`);
  const c = page.locator("#game");
  await expect(c).toHaveAttribute("data-ready", "true");
  await page.getByPlaceholder("World name...").fill("Traffic test");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(c).toHaveAttribute("data-generation", JSON.stringify(generation));
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const canvas = document.querySelector("#game") as HTMLCanvasElement & {
            __game: { stateView: ClientStateView };
          };
          return canvas.__game.stateView.entities.filter((e) => e.type.startsWith("vehicle-v1:"))
            .length;
        }),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  const before = await page.evaluate(() => {
    const canvas = document.querySelector("#game") as HTMLCanvasElement & {
      __game: { stateView: ClientStateView };
    };
    return canvas.__game.stateView.entities
      .filter((e) => e.type.startsWith("vehicle-v1:"))
      .map((e) => ({ id: e.id, position: e.position }));
  });
  expect(before.length).toBeGreaterThan(0);
  await page.reload();
  await expect(c).toHaveAttribute("data-ready", "true");
  await expect(c).toHaveAttribute("data-generation", JSON.stringify(generation));
});
