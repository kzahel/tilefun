import { expect, test } from "@playwright/test";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

test.use({ channel: "chromium" });
for (const phone of [false, true]) {
  test(`map shows production railways and named stops (${phone ? "phone" : "desktop"})`, async ({
    page,
  }) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(createDescriptor("regional", 2026)))}`,
    );
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(page.locator("#game")).toHaveAttribute(
      "data-generation",
      JSON.stringify(createDescriptor("regional", 2026)),
    );
    await page.getByRole("button", { name: "Open world map" }).click();
    const map = page.getByTestId("world-map");
    await expect(map).toHaveAttribute("data-settled", "true");
    await expect(map).toHaveAttribute("data-rail-lines", "1");
    const stops = map.getByRole("group", { name: "Train stops" });
    await expect(
      stops.getByRole("button", { name: "Willowhaven station", exact: true }),
    ).toBeVisible();
    await expect(
      stops.getByRole("button", { name: "Willowbridge station", exact: true }),
    ).toBeVisible();
    await expect(
      map.getByText("Purple dashed lines: railways · ◇: train stops", { exact: true }),
    ).toBeVisible();
    await stops.getByRole("button", { name: "Willowbridge station", exact: true }).click();
    await expect(map).toHaveAttribute("data-x", "3422");
    await expect(map).toHaveAttribute("data-y", "-2658");
    await expect(map).toHaveAttribute("data-settled", "true");
    expect(
      await map.getByTestId("world-map-canvas").evaluate((node) => {
        const canvas = node as HTMLCanvasElement,
          ctx = canvas.getContext("2d");
        if (!ctx) throw Error("Missing map context");
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let purple = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] === 104 && pixels[i + 1] === 69 && pixels[i + 2] === 147) purple++;
        return purple;
      }),
    ).toBeGreaterThan(80);
    if (phone)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    await page.screenshot({ path: `/tmp/tilefun-rail-map-${phone ? "phone" : "desktop"}.png` });
    await page.keyboard.press("Escape");
    await expect(map).toBeHidden();
    await page.getByRole("button", { name: "Open world map" }).click();
    await expect(
      stops.getByRole("button", { name: "Willowbridge station", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
