import { expect, test } from "@playwright/test";
import study from "../public/demos/original-vehicles/paint-study-v1/study.json" with {
  type: "json",
};

test.use({ channel: "chromium" });

for (const viewport of [
  { width: 1200, height: 1050 },
  { width: 390, height: 844 },
]) {
  test(`vehicle paint comparison preserves native sizes and selection at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/tilefun/demos/original-vehicles/paint-study-v1/index.html");
    await page.waitForFunction(() => Reflect.get(window, "paintStudyReady") === true);
    await expect(page.locator(".paint-card")).toHaveCount(14);
    for (const row of study.candidates) {
      await page.locator("#paint").selectOption(row.id);
      await expect(page.locator("#selected-name")).toHaveText(row.name);
      for (const camera of ["study", "engine"]) {
        await page.locator("#camera").selectOption(camera);
        await page.locator("#heading").fill("7");
        await expect(page.locator("#selected-frame")).toHaveAttribute(
          "src",
          `${row.id}/captures/${camera}-7.png`,
        );
      }
      for (const zoom of [1, 2, 3]) {
        await page.locator("#scale").selectOption(String(zoom));
        await expect(page.locator("#selected-frame")).toHaveJSProperty(
          "width",
          row.nativeSize * zoom,
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
    }
    await page.locator('.paint-card[data-id="paint-pickup-forest-cream-v1"]').click();
    await expect(page.locator("#paint")).toHaveValue("paint-pickup-forest-cream-v1");
    await page.getByRole("link", { name: "Explore the 3D model" }).click();
    await page.waitForFunction(() => Reflect.get(window, "familyReviewReady") === true);
    await expect(page.locator("#name")).toHaveText("Pickup · Forest / cream roof");
  });
}
