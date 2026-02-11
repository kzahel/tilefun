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

test("multiple chunks are rendered across the viewport", async ({ page }) => {
	await page.goto("/tilefun/");
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(100);

	// Sample several points across the canvas — all should have grass pixel content
	const allHaveContent = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return false;

		const points = [
			[50, 50],
			[c.width - 50, 50],
			[50, c.height - 50],
			[c.width - 50, c.height - 50],
			[Math.floor(c.width / 2), Math.floor(c.height / 2)],
		];

		for (const [x, y] of points) {
			if (x === undefined || y === undefined) return false;
			const pixel = ctx.getImageData(x, y, 1, 1).data;
			const a = pixel[3] ?? 0;
			const rgb = (pixel[0] ?? 0) + (pixel[1] ?? 0) + (pixel[2] ?? 0);
			if (a === 0 || rgb === 0) return false;
		}
		return true;
	});

	expect(allHaveContent).toBe(true);
});

test("camera movement via arrow keys does not crash", async ({ page }) => {
	const errors: string[] = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});

	await page.goto("/tilefun/");
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(100);

	// Press arrow keys to move camera
	await page.keyboard.down("ArrowRight");
	await page.waitForTimeout(300);
	await page.keyboard.up("ArrowRight");

	await page.keyboard.down("ArrowDown");
	await page.waitForTimeout(300);
	await page.keyboard.up("ArrowDown");

	// Verify still rendering after movement
	const hasContent = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return false;
		const pixel = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
		const a = pixel[3] ?? 0;
		const rgb = (pixel[0] ?? 0) + (pixel[1] ?? 0) + (pixel[2] ?? 0);
		return a > 0 && rgb > 0;
	});

	expect(hasContent).toBe(true);
	expect(errors).toEqual([]);
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
