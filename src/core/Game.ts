import { loadImage } from "../assets/AssetLoader.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { TILE_SIZE } from "../config/constants.js";
import { Camera } from "../rendering/Camera.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { World } from "../world/World.js";
import { GameLoop } from "./GameLoop.js";

/** Camera pan speed in world pixels per second. */
const CAMERA_SPEED = 120;

export class Game {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private camera: Camera;
	private loop: GameLoop;
	private grassSheet: Spritesheet | null = null;
	private world: World;
	private tileRenderer: TileRenderer;
	private keysDown = new Set<string>();

	constructor(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Failed to get 2D context");
		this.canvas = canvas;
		this.ctx = ctx;
		this.camera = new Camera();
		this.world = new World();
		this.tileRenderer = new TileRenderer();
		this.loop = new GameLoop({
			update: (dt) => this.update(dt),
			render: (alpha) => this.render(alpha),
		});
	}

	async init(): Promise<void> {
		this.resize();
		window.addEventListener("resize", () => this.resize());
		window.addEventListener("keydown", (e) => this.keysDown.add(e.key));
		window.addEventListener("keyup", (e) => this.keysDown.delete(e.key));

		const grassImg = await loadImage("assets/tilesets/grass.png");
		this.grassSheet = new Spritesheet(grassImg, TILE_SIZE, TILE_SIZE);

		// Pre-load chunks around origin
		this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());

		this.loop.start();
		this.canvas.dataset.ready = "true";
	}

	private resize(): void {
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		this.camera.setViewport(this.canvas.width, this.canvas.height);
	}

	private update(dt: number): void {
		// Arrow key camera panning
		let dx = 0;
		let dy = 0;
		if (this.keysDown.has("ArrowLeft")) dx -= 1;
		if (this.keysDown.has("ArrowRight")) dx += 1;
		if (this.keysDown.has("ArrowUp")) dy -= 1;
		if (this.keysDown.has("ArrowDown")) dy += 1;

		if (dx !== 0 || dy !== 0) {
			this.camera.x += dx * CAMERA_SPEED * dt;
			this.camera.y += dy * CAMERA_SPEED * dt;
		}

		// Update chunk loading based on camera position
		this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
	}

	private render(_alpha: number): void {
		this.ctx.imageSmoothingEnabled = false;

		// Clear
		this.ctx.fillStyle = "#1a1a2e";
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		if (!this.grassSheet) return;

		const visible = this.camera.getVisibleChunkRange();
		this.tileRenderer.drawTerrain(this.ctx, this.camera, this.world, this.grassSheet, visible);
	}
}
