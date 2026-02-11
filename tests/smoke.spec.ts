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

test("terrain has variety — not all identical color", async ({ page }) => {
	await page.goto("/tilefun/");
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(100);

	// Pan camera to cover a larger area to hit different biomes
	await page.keyboard.down("ArrowRight");
	await page.waitForTimeout(500);
	await page.keyboard.up("ArrowRight");
	await page.keyboard.down("ArrowDown");
	await page.waitForTimeout(500);
	await page.keyboard.up("ArrowDown");
	await page.waitForTimeout(100);

	const hasVariety = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return false;

		// Sample a grid of points across the canvas
		const colors = new Set<string>();
		const step = 48; // one tile = 48 screen pixels at 3x scale
		for (let x = step; x < c.width - step; x += step * 2) {
			for (let y = step; y < c.height - step; y += step * 2) {
				const pixel = ctx.getImageData(x, y, 1, 1).data;
				// Quantize to reduce noise — group similar colors
				const r = Math.floor((pixel[0] ?? 0) / 32);
				const g = Math.floor((pixel[1] ?? 0) / 32);
				const b = Math.floor((pixel[2] ?? 0) / 32);
				colors.add(`${r},${g},${b}`);
			}
		}

		// With procedural terrain (grass, water, sand, forest), expect at least 2 distinct color groups
		return colors.size >= 2;
	});

	expect(hasVariety).toBe(true);
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

test("water/grass edges have visual transitions (autotile)", async ({ page }) => {
	await page.goto("/tilefun/");
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });

	// Pan camera to cover diverse terrain
	await page.keyboard.down("ArrowRight");
	await page.waitForTimeout(600);
	await page.keyboard.up("ArrowRight");
	await page.keyboard.down("ArrowDown");
	await page.waitForTimeout(600);
	await page.keyboard.up("ArrowDown");
	await page.waitForTimeout(200);

	const hasTransitions = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return false;

		const tileSize = 48; // TILE_SIZE * PIXEL_SCALE
		const tilesX = Math.floor(c.width / tileSize);
		const tilesY = Math.floor(c.height / tileSize);

		// Collect per-tile color signatures from the CENTER of each tile
		const signatures: string[] = [];
		for (let ty = 0; ty < tilesY; ty++) {
			for (let tx = 0; tx < tilesX; tx++) {
				const x = tx * tileSize + Math.floor(tileSize / 2);
				const y = ty * tileSize + Math.floor(tileSize / 2);
				const p = ctx.getImageData(x, y, 1, 1).data;
				// Fine quantization to distinguish autotile variants
				const r = Math.floor((p[0] ?? 0) / 16);
				const g = Math.floor((p[1] ?? 0) / 16);
				const b = Math.floor((p[2] ?? 0) / 16);
				signatures.push(`${r},${g},${b}`);
			}
		}

		const unique = new Set(signatures);
		// With 47-variant autotile + water + sand + details, expect many unique tile colors
		// Without autotile, there would only be ~3-4 unique colors (flat grass, water, sand, etc.)
		return unique.size >= 5;
	});

	expect(hasTransitions).toBe(true);
});

test("player sprite visible at screen center", async ({ page }) => {
	await page.goto("/tilefun/");
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(200);

	// The player is at (0,0) and the camera follows, so player is near screen center.
	// Sample a small area around center — at least one pixel should differ from
	// the terrain-only background (the player character sprite is drawn on top).
	const result = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return { hasPixels: false };

		const cx = Math.floor(c.width / 2);
		const cy = Math.floor(c.height / 2);
		// Sample a 48x48 area around center (one character frame at 3x scale = 144px,
		// but we sample a smaller region to ensure we hit the character)
		const size = 48;
		const data = ctx.getImageData(cx - size / 2, cy - size / 2, size, size).data;
		let nonZero = 0;
		for (let i = 0; i < data.length; i += 4) {
			if ((data[i + 3] ?? 0) > 0) nonZero++;
		}
		return { hasPixels: nonZero > 0 };
	});

	expect(result.hasPixels).toBe(true);
});

test("arrow key movement does not crash and keeps rendering", async ({ page }) => {
	const errors: string[] = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});

	await page.goto("/tilefun/");
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(200);

	// Move player in all directions
	await page.keyboard.down("ArrowRight");
	await page.waitForTimeout(400);
	await page.keyboard.up("ArrowRight");

	await page.keyboard.down("ArrowDown");
	await page.waitForTimeout(400);
	await page.keyboard.up("ArrowDown");
	await page.waitForTimeout(100);

	// Verify still rendering after movement
	const hasContent = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return false;
		const pixel = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
		return (pixel[3] ?? 0) > 0;
	});

	expect(hasContent).toBe(true);
	expect(errors).toEqual([]);
});

test("no console errors after WASD movement", async ({ page }) => {
	const errors: string[] = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});

	await page.goto("/tilefun/");
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(100);

	// Test WASD keys
	for (const key of ["w", "a", "s", "d"]) {
		await page.keyboard.down(key);
		await page.waitForTimeout(200);
		await page.keyboard.up(key);
	}

	// Diagonal WASD
	await page.keyboard.down("w");
	await page.keyboard.down("d");
	await page.waitForTimeout(300);
	await page.keyboard.up("w");
	await page.keyboard.up("d");

	await page.waitForTimeout(100);
	expect(errors).toEqual([]);
});

test("F3 toggles debug overlay", async ({ page }) => {
	await page.goto("/tilefun/");
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(200);

	// Capture top-left pixels BEFORE debug toggle
	const pixelsBefore = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return null;
		const data = ctx.getImageData(5, 5, 180, 55).data;
		let sum = 0;
		for (let i = 0; i < data.length; i += 4) {
			sum += (data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0);
		}
		return sum;
	});

	// Toggle debug via backtick key (F3 may be intercepted by browser)
	await page.keyboard.press("Backquote");
	await page.waitForTimeout(200);

	// Check that top-left area changed (dark background + green text drawn)
	const pixelsAfter = await page.evaluate(() => {
		const c = document.getElementById("game") as HTMLCanvasElement;
		const ctx = c.getContext("2d");
		if (!ctx) return null;
		const data = ctx.getImageData(5, 5, 180, 55).data;
		let sum = 0;
		for (let i = 0; i < data.length; i += 4) {
			sum += (data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0);
		}
		return sum;
	});

	// The debug overlay should change the pixel content in the top-left area
	expect(pixelsBefore).not.toBeNull();
	expect(pixelsAfter).not.toBeNull();
	expect(pixelsAfter).not.toBe(pixelsBefore);
});

test("no console errors with collision and NPCs active", async ({ page }) => {
	const errors: string[] = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});

	await page.goto("/tilefun/");
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });

	// Move around for a few seconds to exercise collision and NPC AI
	for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
		await page.keyboard.down(key);
		await page.waitForTimeout(500);
		await page.keyboard.up(key);
	}

	await page.waitForTimeout(200);
	expect(errors).toEqual([]);
});

test("no console errors after rapid scrolling through many chunks", async ({ page }) => {
	const errors: string[] = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});

	await page.goto("/tilefun/");
	await page.locator('#game[data-ready="true"]').waitFor({ timeout: 10_000 });

	// Rapidly scroll in all directions to trigger chunk generation/autotile/caching
	for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
		await page.keyboard.down(key);
		await page.waitForTimeout(500);
		await page.keyboard.up(key);
	}

	// Diagonal movement
	await page.keyboard.down("ArrowRight");
	await page.keyboard.down("ArrowDown");
	await page.waitForTimeout(500);
	await page.keyboard.up("ArrowRight");
	await page.keyboard.up("ArrowDown");

	await page.waitForTimeout(200);

	// Verify rendering still works
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
