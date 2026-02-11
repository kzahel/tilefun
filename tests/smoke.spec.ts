import { expect, test } from "@playwright/test";

test("canvas renders with non-zero dimensions", async ({ page }) => {
	await page.goto("/");
	const canvas = page.locator("#game");
	await expect(canvas).toBeVisible();

	const box = await canvas.boundingBox();
	expect(box).not.toBeNull();
	expect(box!.width).toBeGreaterThan(0);
	expect(box!.height).toBeGreaterThan(0);
});

test("canvas has pixel content (not blank)", async ({ page }) => {
	await page.goto("/");
	const canvas = page.locator("#game");
	await expect(canvas).toBeVisible();

	// Check that the canvas has been drawn to by sampling a pixel
	const hasContent = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return false;
		// Sample center pixel — should be the green test rectangle
		const pixel = ctx.getImageData(
			Math.floor(c.width / 2),
			Math.floor(c.height / 2),
			1,
			1,
		).data;
		// Check it's not black/transparent (alpha > 0 and not all zeros)
		return pixel[3]! > 0 && (pixel[0]! + pixel[1]! + pixel[2]!) > 0;
	});

	expect(hasContent).toBe(true);
});

test("no console errors on load", async ({ page }) => {
	const errors: string[] = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") {
			errors.push(msg.text());
		}
	});

	await page.goto("/");
	// Wait a moment for any deferred errors
	await page.waitForTimeout(500);

	expect(errors).toEqual([]);
});
