import alea from "alea";
import { loadImage } from "../assets/AssetLoader.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import {
	CAMERA_LERP,
	CHICKEN_SPRITE_SIZE,
	CHUNK_SIZE,
	PLAYER_SPRITE_SIZE,
	TILE_SIZE,
} from "../config/constants.js";
import { createChicken } from "../entities/Chicken.js";
import type { Entity } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer, updatePlayerFromInput } from "../entities/Player.js";
import { updateWanderAI } from "../entities/wanderAI.js";
import { InputManager } from "../input/InputManager.js";
import { Camera } from "../rendering/Camera.js";
import { drawDebugOverlay } from "../rendering/DebugRenderer.js";
import { drawEntities } from "../rendering/EntityRenderer.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { CollisionFlag, TileId } from "../world/TileRegistry.js";
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
	private debugEnabled = false;
	private frameCount = 0;
	private fpsTimer = 0;
	private currentFps = 0;

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
		document.addEventListener("keydown", (e) => {
			if (e.key === "F3" || e.key === "`") {
				e.preventDefault();
				this.debugEnabled = !this.debugEnabled;
			}
		});
		this.input.attach();

		const [grassImg, dirtImg, waterImg, objectsImg, playerImg, chickenImg] = await Promise.all([
			loadImage("assets/tilesets/me-autotile-15.png"),
			loadImage("assets/tilesets/me-autotile-02.png"),
			loadImage("assets/tilesets/water.png"),
			loadImage("assets/tilesets/objects.png"),
			loadImage("assets/sprites/player.png"),
			loadImage("assets/sprites/chicken.png"),
		]);

		this.sheets.set("grass", new Spritesheet(grassImg, TILE_SIZE, TILE_SIZE));
		this.sheets.set("dirt", new Spritesheet(dirtImg, TILE_SIZE, TILE_SIZE));
		this.sheets.set("water", new Spritesheet(waterImg, TILE_SIZE, TILE_SIZE));
		this.sheets.set("objects", new Spritesheet(objectsImg, TILE_SIZE, TILE_SIZE));
		this.sheets.set("player", new Spritesheet(playerImg, PLAYER_SPRITE_SIZE, PLAYER_SPRITE_SIZE));
		this.sheets.set(
			"chicken",
			new Spritesheet(chickenImg, CHICKEN_SPRITE_SIZE, CHICKEN_SPRITE_SIZE),
		);

		// Pre-load chunks around origin and compute initial autotile
		this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
		this.world.computeAutotile();

		// Spawn chickens on walkable tiles near origin
		this.spawnChickens(5);

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

		// NPC AI → velocity + animation state
		for (const entity of this.entityManager.entities) {
			if (entity.wanderAI) {
				updateWanderAI(entity, dt, Math.random);
			}
		}

		// Update all entities (velocity → collision-resolved position, animation timers)
		this.entityManager.update(dt, (tx, ty) => this.world.getCollision(tx, ty));

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

		// FPS tracking
		this.frameCount++;
		const now = performance.now() / 1000;
		if (now - this.fpsTimer >= 1) {
			this.currentFps = this.frameCount;
			this.frameCount = 0;
			this.fpsTimer = now;
		}

		// Debug overlay
		if (this.debugEnabled) {
			const px = this.player.position.wx;
			const py = this.player.position.wy;
			const ptx = Math.floor(px / TILE_SIZE);
			const pty = Math.floor(py / TILE_SIZE);
			const terrain = this.world.getTerrainIfLoaded(ptx, pty);
			const collision = this.world.getCollision(ptx, pty);
			const collisionParts: string[] = [];
			if (collision === 0) collisionParts.push("None");
			if (collision & CollisionFlag.Solid) collisionParts.push("Solid");
			if (collision & CollisionFlag.Water) collisionParts.push("Water");
			if (collision & CollisionFlag.SlowWalk) collisionParts.push("SlowWalk");

			drawDebugOverlay(
				this.ctx,
				this.camera,
				this.entityManager.entities,
				{
					fps: this.currentFps,
					entityCount: this.entityManager.entities.length,
					chunkCount: this.world.chunks.loadedCount,
					playerWx: px,
					playerWy: py,
					playerTx: ptx,
					playerTy: pty,
					terrainName: TileId[terrain] ?? `Unknown(${terrain})`,
					collisionFlags: collisionParts.join("|"),
					speedMultiplier: collision & CollisionFlag.SlowWalk ? 0.5 : 1.0,
				},
				visible,
			);
		}
	}

	private spawnChickens(count: number): void {
		const rng = alea("chicken-spawn");
		let spawned = 0;
		let attempts = 0;
		const range = CHUNK_SIZE * TILE_SIZE; // 1 chunk radius — keep chickens near player
		while (spawned < count && attempts < 200) {
			attempts++;
			const wx = (rng() - 0.5) * range * 2;
			const wy = (rng() - 0.5) * range * 2;
			const tx = Math.floor(wx / TILE_SIZE);
			const ty = Math.floor(wy / TILE_SIZE);
			const collision = this.world.getCollision(tx, ty);
			if (collision === CollisionFlag.None) {
				this.entityManager.spawn(createChicken(wx, wy));
				spawned++;
			}
		}
	}
}
