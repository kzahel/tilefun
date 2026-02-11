import { expect, test } from "@playwright/test";

test("canvas renders with non-zero dimensions", async ({ page }) => {
	await page.goto("/tilefun/");
	const canvas = page.locator("#game");
	await expect(canvas).toBeVisible();

	const box = await canvas.boundingBox();
	expect(box).not.toBeNull();
	expect(box?.width).toBeGreaterThan(0);
	expect(box?.height).toBeGreaterThan(0);
});

test("canvas has pixel content from spritesheet", async ({ page }) => {
	await page.goto("/tilefun/");

	// Wait for the game to finish loading assets and start rendering
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });

	// Give one frame for render
	await page.waitForTimeout(100);

	const hasContent = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return false;
		// Sample center pixel — should have grass tile content
		const pixel = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
		const a = pixel[3] ?? 0;
		const rgb = (pixel[0] ?? 0) + (pixel[1] ?? 0) + (pixel[2] ?? 0);
		return a > 0 && rgb > 0;
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

	await page.goto("/tilefun/");
	// Wait for game to initialize
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(500);

	expect(errors).toEqual([]);
});
