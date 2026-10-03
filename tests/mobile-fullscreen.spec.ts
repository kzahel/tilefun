import { expect, test } from "@playwright/test";

test.describe("first mobile tap fullscreen", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("first tap opens fullscreen and its menu; later taps respect fullscreen exit", async ({
    page,
  }) => {
    await page.goto("/tilefun/");
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true);

    // A mouse click on a touch-capable device must not consume the first touch.
    await page.getByRole("button", { name: "Open world map" }).click();
    expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await page.getByRole("button", { name: "Close map" }).click();

    await page.getByRole("button", { name: "Open world map" }).tap();
    await expect(page.getByTestId("world-map")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement))
      .toBe(true);

    await page.evaluate(() => document.exitFullscreen());
    await page.getByRole("button", { name: "Close map" }).tap();
    await expect(page.getByTestId("world-map")).toBeHidden();
    expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  });

  for (const unavailable of ["unsupported", "denied"] as const) {
    test(`${unavailable} fullscreen leaves touch controls usable without repeated requests`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript((mode) => {
        Object.defineProperty(Element.prototype, "requestFullscreen", {
          value:
            mode === "unsupported"
              ? undefined
              : () => {
                  const root = document.documentElement;
                  root.dataset.fullscreenAttempts = String(
                    Number(root.dataset.fullscreenAttempts ?? 0) + 1,
                  );
                  return Promise.reject(new TypeError("Fullscreen denied"));
                },
        });
      }, unavailable);
      await page.goto("/tilefun/");
      await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
      await page.getByRole("button", { name: "Open world map" }).tap();
      await expect(page.getByTestId("world-map")).toBeVisible();
      await page.getByRole("button", { name: "Close map" }).tap();
      await expect(page.getByTestId("world-map")).toBeHidden();
      expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true);
      expect(
        await page.evaluate(() => Number(document.documentElement.dataset.fullscreenAttempts ?? 0)),
      ).toBe(unavailable === "denied" ? 1 : 0);
      await expect(page.locator("#tilefun-error-overlay")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
});

test("desktop clicks leave fullscreen off", async ({ page }) => {
  await page.goto("/tilefun/");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Open world map" }).click();
  await expect(page.getByTestId("world-map")).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true);
});
