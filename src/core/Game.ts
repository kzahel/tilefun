import { loadImage } from "../assets/AssetLoader.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { PIXEL_SCALE, TILE_SIZE } from "../config/constants.js";
import { Camera } from "../rendering/Camera.js";
import { GameLoop } from "./GameLoop.js";

/** Full interior grass tile position in the Grass.png spritesheet. */
const GRASS_COL = 2;
const GRASS_ROW = 4;

export class Game {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private camera: Camera;
	private loop: GameLoop;
	private grassSheet: Spritesheet | null = null;

	constructor(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Failed to get 2D context");
		this.canvas = canvas;
		this.ctx = ctx;
		this.camera = new Camera();
		this.loop = new GameLoop({
			update: (dt) => this.update(dt),
			render: (alpha) => this.render(alpha),
		});
	}

	async init(): Promise<void> {
		this.resize();
		window.addEventListener("resize", () => this.resize());

		const grassImg = await loadImage("assets/tilesets/grass.png");
		this.grassSheet = new Spritesheet(grassImg, TILE_SIZE, TILE_SIZE);

		this.loop.start();
		this.canvas.dataset.ready = "true";
	}

	private resize(): void {
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		this.camera.setViewport(this.canvas.width, this.canvas.height);
	}

	private update(_dt: number): void {
		// No game logic yet — camera stays at origin
	}

	private render(_alpha: number): void {
		this.ctx.imageSmoothingEnabled = false;

		// Clear
		this.ctx.fillStyle = "#1a1a2e";
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		if (!this.grassSheet) return;

		// Draw a small grid of grass tiles centered at the world origin
		const tileScreen = TILE_SIZE * PIXEL_SCALE;
		const gridSize = 5;
		const half = Math.floor(gridSize / 2);

		for (let row = -half; row <= half; row++) {
			for (let col = -half; col <= half; col++) {
				const worldX = col * TILE_SIZE;
				const worldY = row * TILE_SIZE;
				const screen = this.camera.worldToScreen(worldX, worldY);
				this.grassSheet.drawTile(
					this.ctx,
					GRASS_COL,
					GRASS_ROW,
					Math.floor(screen.sx),
					Math.floor(screen.sy),
					PIXEL_SCALE,
				);
			}
		}

		// Draw one highlighted tile at origin for visual proof
		const origin = this.camera.worldToScreen(0, 0);
		this.ctx.strokeStyle = "#ffffff44";
		this.ctx.strokeRect(Math.floor(origin.sx), Math.floor(origin.sy), tileScreen, tileScreen);
	}
}
