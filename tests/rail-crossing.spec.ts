import { expect, test } from "@playwright/test";

test.use({ channel: "chromium" });

test("crossing controls fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/workshop.html?geometry=crossing#/tool/world-geometry");
  await expect(page.getByLabel("World geometry scene")).toHaveAttribute("data-ready", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-crossing-phone.png", fullPage: true });
});
