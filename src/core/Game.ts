import { loadImage } from "../assets/AssetLoader.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { CAMERA_LERP, PLAYER_SPRITE_SIZE, TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer, updatePlayerFromInput } from "../entities/Player.js";
import { InputManager } from "../input/InputManager.js";
import { Camera } from "../rendering/Camera.js";
import { drawEntities } from "../rendering/EntityRenderer.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { World } from "../world/World.js";
import { GameLoop } from "./GameLoop.js";

export class Game {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private camera: Camera;
	private loop: GameLoop;
	private sheets = new Map<string, Spritesheet>();
	private world: World;
	private tileRenderer: TileRenderer;
	private input: InputManager;
	private entityManager: EntityManager;
	private player: Entity;

	constructor(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Failed to get 2D context");
		this.canvas = canvas;
		this.ctx = ctx;
		this.camera = new Camera();
		this.world = new World();
		this.tileRenderer = new TileRenderer();
		this.input = new InputManager();
		this.entityManager = new EntityManager();
		this.player = createPlayer(0, 0);
		this.entityManager.spawn(this.player);
		this.loop = new GameLoop({
			update: (dt) => this.update(dt),
			render: (alpha) => this.render(alpha),
		});
	}

	async init(): Promise<void> {
		this.resize();
		window.addEventListener("resize", () => this.resize());
		this.input.attach();

		const [grassImg, dirtImg, waterImg, objectsImg, playerImg] = await Promise.all([
			loadImage("assets/tilesets/grass.png"),
			loadImage("assets/tilesets/dirt.png"),
			loadImage("assets/tilesets/water.png"),
			loadImage("assets/tilesets/objects.png"),
			loadImage("assets/sprites/player.png"),
		]);

		this.sheets.set("grass", new Spritesheet(grassImg, TILE_SIZE, TILE_SIZE));
		this.sheets.set("dirt", new Spritesheet(dirtImg, TILE_SIZE, TILE_SIZE));
		this.sheets.set("water", new Spritesheet(waterImg, TILE_SIZE, TILE_SIZE));
		this.sheets.set("objects", new Spritesheet(objectsImg, TILE_SIZE, TILE_SIZE));
		this.sheets.set("player", new Spritesheet(playerImg, PLAYER_SPRITE_SIZE, PLAYER_SPRITE_SIZE));

		// Pre-load chunks around origin and compute initial autotile
		this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
		this.world.computeAutotile();

		this.loop.start();
		this.canvas.dataset.ready = "true";
	}

	private resize(): void {
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		this.camera.setViewport(this.canvas.width, this.canvas.height);
	}

	private update(dt: number): void {
		// Player input → velocity + animation state
		const movement = this.input.getMovement();
		updatePlayerFromInput(this.player, movement, dt);

		// Update all entities (velocity → position, animation timers)
		this.entityManager.update(dt);

		// Camera follows player
		this.camera.follow(this.player.position.wx, this.player.position.wy, CAMERA_LERP);

		// Update chunk loading based on camera position
		this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
		// Compute autotile for newly loaded chunks
		this.world.computeAutotile();
	}

	private render(_alpha: number): void {
		this.ctx.imageSmoothingEnabled = false;

		// Clear
		this.ctx.fillStyle = "#1a1a2e";
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		if (this.sheets.size === 0) return;

		const visible = this.camera.getVisibleChunkRange();
		// Terrain, autotile, and details are all baked into the chunk cache
		this.tileRenderer.drawTerrain(this.ctx, this.camera, this.world, this.sheets, visible);

		// Draw entities Y-sorted on top of terrain
		drawEntities(this.ctx, this.camera, this.entityManager.getYSorted(), this.sheets);
	}
}
