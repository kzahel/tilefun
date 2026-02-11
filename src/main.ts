import { PIXEL_SCALE } from "./config/constants.js";

function getCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
	const canvas = document.getElementById("game") as HTMLCanvasElement | null;
	if (!canvas) {
		throw new Error("Canvas element #game not found");
	}
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Failed to get 2D rendering context");
	}
	return { canvas, ctx };
}

function init(): void {
	const { canvas, ctx } = getCanvas();

	const resize = (): void => {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	};

	window.addEventListener("resize", resize);
	resize();

	// Proof of life: fill with a dark blue-green and draw a test rectangle
	ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = "#1a1a2e";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const tileScreenSize = 16 * PIXEL_SCALE;
	ctx.fillStyle = "#4a7c59";
	ctx.fillRect(
		Math.floor(canvas.width / 2 - tileScreenSize / 2),
		Math.floor(canvas.height / 2 - tileScreenSize / 2),
		tileScreenSize,
		tileScreenSize,
	);
}

init();
