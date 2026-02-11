import { expect, test } from "@playwright/test";

test("water tiles animate over time", async ({ page }) => {
	await page.goto("/tilefun/");
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });

	// Move toward water (down and right hits lower-elevation biomes)
	await page.keyboard.down("ArrowDown");
	await page.waitForTimeout(800);
	await page.keyboard.up("ArrowDown");
	await page.waitForTimeout(100);

	// Sample all pixels from the canvas at two moments separated by >250ms
	// (one water animation frame = 250ms). If water is visible and animating,
	// the pixel data will differ between snapshots.
	const snap1 = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return null;
		const data = ctx.getImageData(0, 0, c.width, c.height).data;
		let sum = 0;
		for (let i = 0; i < data.length; i += 4) {
			sum += (data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0);
		}
		return sum;
	});

	// Wait longer than one animation frame (250ms) to guarantee a frame change
	await page.waitForTimeout(400);

	const snap2 = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return null;
		const data = ctx.getImageData(0, 0, c.width, c.height).data;
		let sum = 0;
		for (let i = 0; i < data.length; i += 4) {
			sum += (data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0);
		}
		return sum;
	});

	expect(snap1).not.toBeNull();
	expect(snap2).not.toBeNull();
	// Water animation changes pixel content between frames
	expect(snap2).not.toBe(snap1);
});
