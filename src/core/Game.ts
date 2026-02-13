import { loadImage } from "../assets/AssetLoader.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { TileVariants } from "../assets/TileVariants.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { TerrainId } from "../autotile/TerrainId.js";
import {
  CAMERA_LERP,
  CHICKEN_SPRITE_SIZE,
  CHUNK_SIZE,
  ENTITY_ACTIVATION_DISTANCE,
  PLAYER_SPRITE_SIZE,
  TILE_SIZE,
} from "../config/constants.js";
import { EditorMode } from "../editor/EditorMode.js";
import { EditorPanel } from "../editor/EditorPanel.js";
import { createCampfire } from "../entities/Campfire.js";
import { createChicken } from "../entities/Chicken.js";
import { createCow } from "../entities/Cow.js";
import { createCrow } from "../entities/Crow.js";
import { aabbOverlapsSolid, getEntityAABB } from "../entities/collision.js";
import { createEggNest } from "../entities/EggNest.js";
import type { ColliderComponent, Entity } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createFish1, createFish2, createFish3 } from "../entities/Fish.js";
import { createPigeon } from "../entities/Pigeon.js";
import { createPigeon2 } from "../entities/Pigeon2.js";
import { createPlayer, updatePlayerFromInput } from "../entities/Player.js";
import { createSeagull } from "../entities/Seagull.js";
import { createWorm1, createWorm2, createWorm3, createWorm4 } from "../entities/Worm.js";
import { updateWanderAI } from "../entities/wanderAI.js";
import { InputManager } from "../input/InputManager.js";
import { TouchJoystick } from "../input/TouchJoystick.js";
import type { SavedMeta } from "../persistence/SaveManager.js";
import { SaveManager } from "../persistence/SaveManager.js";
import { Camera } from "../rendering/Camera.js";
import { DebugPanel } from "../rendering/DebugPanel.js";
import { drawDebugOverlay } from "../rendering/DebugRenderer.js";
import { drawEntities } from "../rendering/EntityRenderer.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import {
  CollisionFlag,
  getCollisionForTerrain,
  TileId,
  terrainIdToTileId,
} from "../world/TileRegistry.js";
import { chunkKey, tileToChunk, tileToLocal } from "../world/types.js";
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
  private touchJoystick: TouchJoystick;
  private entityManager: EntityManager;
  private player: Entity;
  private debugEnabled = false;
  private debugPanel: DebugPanel;
  private editorEnabled = true;
  private editorMode: EditorMode;
  private editorPanel: EditorPanel;
  private blendGraph: BlendGraph;
  private adjacency: TerrainAdjacency;
  private saveManager: SaveManager;
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
    this.touchJoystick = new TouchJoystick(canvas);
    this.input.setTouchJoystick(this.touchJoystick);
    this.entityManager = new EntityManager();
    this.player = createPlayer(0, 0);
    this.entityManager.spawn(this.player);
    this.blendGraph = new BlendGraph();
    this.adjacency = new TerrainAdjacency(this.blendGraph);
    this.saveManager = new SaveManager();
    this.debugPanel = new DebugPanel();
    this.editorMode = new EditorMode(canvas, this.camera);
    this.editorPanel = new EditorPanel();
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
        this.debugPanel.visible = this.debugEnabled;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        this.toggleEditor();
      }
      if ((e.key === "m" || e.key === "M") && this.editorEnabled) {
        e.preventDefault();
        this.editorPanel.toggleMode();
      }
      if ((e.key === "b" || e.key === "B") && this.editorEnabled) {
        e.preventDefault();
        this.editorPanel.cycleBridgeDepth();
      }
      if ((e.key === "s" || e.key === "S") && this.editorEnabled) {
        e.preventDefault();
        this.editorPanel.cycleBrushShape();
      }
      if (e.key === "z" && this.editorEnabled) {
        e.preventDefault();
        this.editorPanel.setPaintMode("positive");
      }
      // "x" for negative mode — disabled (not yet implemented)
      if (e.key === "c" && this.editorEnabled) {
        e.preventDefault();
        this.editorPanel.setPaintMode("unpaint");
      }
      if ((e.key === "t" || e.key === "T") && this.editorEnabled) {
        e.preventDefault();
        this.editorPanel.toggleTab();
      }
      if ((e.key === "d" || e.key === "D") && this.debugEnabled) {
        e.preventDefault();
        this.debugPanel.toggleBaseMode();
      }
    });
    this.createEditorButton();
    this.input.attach();
    // Start in editor mode — attach editor, not joystick
    this.editorMode.attach();
    this.editorPanel.visible = true;

    // Load blend graph sheets (11 ME autotile sheets) + entity sheets + complete tileset
    const blendDescs = this.blendGraph.allSheets;
    const [
      blendImages,
      objectsImg,
      playerImg,
      chickenImg,
      cowImg,
      pigeonImg,
      pigeon2Img,
      fish1Img,
      fish2Img,
      fish3Img,
      campfireImg,
      eggNestImg,
      crowImg,
      seagullImg,
      worm1Img,
      worm2Img,
      worm3Img,
      worm4Img,
      completeImg,
    ] = await Promise.all([
      Promise.all(blendDescs.map((desc) => loadImage(desc.assetPath))),
      loadImage("assets/tilesets/objects.png"),
      loadImage("assets/sprites/player.png"),
      loadImage("assets/sprites/chicken.png"),
      loadImage("assets/sprites/cow.png"),
      loadImage("assets/sprites/pigeon.png"),
      loadImage("assets/sprites/pigeon2.png"),
      loadImage("assets/sprites/fish1.png"),
      loadImage("assets/sprites/fish2.png"),
      loadImage("assets/sprites/fish3.png"),
      loadImage("assets/sprites/campfire.png"),
      loadImage("assets/sprites/egg-nest.png"),
      loadImage("assets/sprites/crow.png"),
      loadImage("assets/sprites/seagull.png"),
      loadImage("assets/sprites/worm1.png"),
      loadImage("assets/sprites/worm2.png"),
      loadImage("assets/sprites/worm3.png"),
      loadImage("assets/sprites/worm4.png"),
      loadImage("assets/tilesets/me-complete.png"),
    ]);

    // Build indexed blend sheet array for the graph renderer
    const blendSheets: Spritesheet[] = [];
    for (const [i, desc] of blendDescs.entries()) {
      const img = blendImages[i];
      if (img) {
        const sheet = new Spritesheet(img, TILE_SIZE, TILE_SIZE);
        blendSheets.push(sheet);
        this.sheets.set(desc.sheetKey, sheet);
      }
    }
    // "shallowwater" alias — uses me03 (water_shallow/grass) fill at (1,0)
    const me03Sheet = this.sheets.get("me03");
    if (me03Sheet) {
      this.sheets.set("shallowwater", me03Sheet);
    }
    this.tileRenderer.setBlendSheets(blendSheets, this.blendGraph);

    // Set up tile variants from the complete ME tileset
    const variants = new TileVariants(new Spritesheet(completeImg, TILE_SIZE, TILE_SIZE));
    registerTileVariants(variants);
    this.tileRenderer.setVariants(variants);

    this.sheets.set("objects", new Spritesheet(objectsImg, TILE_SIZE, TILE_SIZE));
    this.sheets.set("player", new Spritesheet(playerImg, PLAYER_SPRITE_SIZE, PLAYER_SPRITE_SIZE));
    this.sheets.set(
      "chicken",
      new Spritesheet(chickenImg, CHICKEN_SPRITE_SIZE, CHICKEN_SPRITE_SIZE),
    );
    this.sheets.set("cow", new Spritesheet(cowImg, 32, 32));
    this.sheets.set("pigeon", new Spritesheet(pigeonImg, 16, 16));
    this.sheets.set("pigeon2", new Spritesheet(pigeon2Img, 16, 16));
    this.sheets.set("fish1", new Spritesheet(fish1Img, 16, 16));
    this.sheets.set("fish2", new Spritesheet(fish2Img, 16, 16));
    this.sheets.set("fish3", new Spritesheet(fish3Img, 16, 16));
    this.sheets.set("campfire", new Spritesheet(campfireImg, 16, 32));
    this.sheets.set("egg-nest", new Spritesheet(eggNestImg, 16, 16));
    this.sheets.set("crow", new Spritesheet(crowImg, 32, 32));
    this.sheets.set("seagull", new Spritesheet(seagullImg, 32, 32));
    this.sheets.set("worm1", new Spritesheet(worm1Img, 16, 16));
    this.sheets.set("worm2", new Spritesheet(worm2Img, 16, 16));
    this.sheets.set("worm3", new Spritesheet(worm3Img, 16, 16));
    this.sheets.set("worm4", new Spritesheet(worm4Img, 16, 16));

    // Open persistence and load saved state
    await this.saveManager.open();
    const savedMeta = await this.saveManager.loadMeta();
    const savedChunks = await this.saveManager.loadChunks();

    if (savedMeta && savedChunks.size > 0) {
      // Restore from save
      this.world.chunks.setSavedSubgrids(savedChunks);
      this.camera.x = savedMeta.cameraX;
      this.camera.y = savedMeta.cameraY;
      this.camera.zoom = savedMeta.cameraZoom;
      this.player.position.wx = savedMeta.playerX;
      this.player.position.wy = savedMeta.playerY;
      for (const se of savedMeta.entities) {
        if (se.type === "player") continue;
        const factory = ENTITY_FACTORIES[se.type];
        if (factory) {
          this.entityManager.spawn(factory(se.wx, se.wy));
        }
      }
      this.entityManager.setNextId(savedMeta.nextEntityId);
      this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
      this.world.computeAutotile(this.blendGraph);
    } else {
      // First run
      this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
      this.world.computeAutotile(this.blendGraph);
      this.findWalkableSpawn(this.player);
      this.spawnChickens(5);
    }

    // Bind save accessors and set up auto-flush on tab hide
    this.saveManager.bind(
      (key) => this.world.chunks.getSubgridByKey(key),
      () => this.buildSaveMeta(),
    );
    this.saveManager.onChunksSaved = (keys, getChunk) => {
      for (const key of keys) {
        const subgrid = getChunk(key);
        if (subgrid) this.world.chunks.updateSavedSubgrid(key, subgrid);
      }
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.saveManager.flush();
      }
    });

    this.loop.start();
    this.canvas.dataset.ready = "true";
  }

  private editorButton: HTMLButtonElement | null = null;

  private toggleEditor(): void {
    this.editorEnabled = !this.editorEnabled;
    this.editorPanel.visible = this.editorEnabled;
    if (this.editorButton) {
      this.editorButton.textContent = this.editorEnabled ? "Play" : "Edit";
    }
    if (this.editorEnabled) {
      this.touchJoystick.detach();
      this.editorMode.attach();
    } else {
      this.editorMode.detach();
      this.touchJoystick.attach();
    }
  }

  private createEditorButton(): void {
    const BTN_STYLE = `
      font: bold 14px monospace; padding: 8px 16px;
      background: rgba(0,0,0,0.6); color: #fff;
      border: 1px solid #888; border-radius: 4px;
      cursor: pointer; user-select: none;
    `;

    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position: fixed; top: 8px; left: 8px; z-index: 100; display: flex; gap: 6px;";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Play";
    editBtn.style.cssText = BTN_STYLE;
    editBtn.addEventListener("click", () => this.toggleEditor());
    this.editorButton = editBtn;

    const debugBtn = document.createElement("button");
    debugBtn.textContent = "Debug";
    debugBtn.style.cssText = BTN_STYLE;
    debugBtn.addEventListener("click", () => {
      this.debugEnabled = !this.debugEnabled;
      this.debugPanel.visible = this.debugEnabled;
    });
    wrap.append(editBtn, debugBtn);
    document.body.appendChild(wrap);
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.camera.setViewport(this.canvas.width, this.canvas.height);
  }

  private update(dt: number): void {
    // Apply debug panel state
    if (!this.editorEnabled) {
      this.camera.zoom = this.debugPanel.zoom;
    }
    if (this.debugPanel.consumeBaseModeChange() || this.debugPanel.consumeConvexChange()) {
      this.invalidateAllChunks();
    }

    // Editor mode: paint terrain or place entities, skip gameplay
    if (this.editorEnabled) {
      this.editorPanel.setTemporaryUnpaint(this.editorMode.rightClickUnpaint);
      this.editorMode.selectedTerrain = this.editorPanel.selectedTerrain;
      this.editorMode.brushMode = this.editorPanel.brushMode;
      this.editorMode.paintMode = this.editorPanel.effectivePaintMode;
      this.editorMode.editorTab = this.editorPanel.editorTab;
      this.editorMode.selectedEntityType = this.editorPanel.selectedEntityType;
      this.editorMode.entities = this.entityManager.entities;
      this.editorMode.update(dt);

      // Apply terrain edits (tile mode → set all 9 subgrid points of the tile)
      for (const edit of this.editorMode.consumePendingEdits()) {
        this.applyTileEdit(edit.tx, edit.ty, edit.terrainId);
      }

      // Apply subgrid edits (subgrid mode)
      for (const edit of this.editorMode.consumePendingSubgridEdits()) {
        this.applySubgridEdit(edit.gsx, edit.gsy, edit.terrainId);
      }

      // Apply corner edits (corner mode → 3×3 subgrid centered on tile vertex)
      for (const edit of this.editorMode.consumePendingCornerEdits()) {
        this.applyCornerEdit(edit.gsx, edit.gsy, edit.terrainId);
      }

      // Apply entity spawns
      let entitiesChanged = false;
      for (const spawn of this.editorMode.consumePendingEntitySpawns()) {
        const factory = ENTITY_FACTORIES[spawn.entityType];
        if (factory) {
          this.entityManager.spawn(factory(spawn.wx, spawn.wy));
          entitiesChanged = true;
        }
      }

      // Apply entity deletions (skip player)
      for (const id of this.editorMode.consumePendingEntityDeletions()) {
        if (id !== this.player.id) {
          this.entityManager.remove(id);
          entitiesChanged = true;
        }
      }
      if (entitiesChanged) this.saveManager.markMetaDirty();

      // Handle clear canvas
      const clearId = this.editorPanel.consumeClearRequest();
      if (clearId !== null) {
        this.clearAllTerrain(clearId);
      }

      // Still load chunks (camera may have panned)
      this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
      this.world.computeAutotile(this.blendGraph);
      return;
    }

    // Player input → velocity + animation state
    const movement = this.input.getMovement();
    updatePlayerFromInput(this.player, movement, dt);

    // NPC AI → velocity + animation state (freeze entities far from player)
    const px = this.player.position.wx;
    const py = this.player.position.wy;
    for (const entity of this.entityManager.entities) {
      if (entity.wanderAI) {
        const dx = Math.abs(entity.position.wx - px);
        const dy = Math.abs(entity.position.wy - py);
        if (dx > ENTITY_ACTIVATION_DISTANCE || dy > ENTITY_ACTIVATION_DISTANCE) {
          if (entity.velocity) {
            entity.velocity.vx = 0;
            entity.velocity.vy = 0;
          }
          continue;
        }
        updateWanderAI(entity, dt, Math.random);
      }
    }

    // Update all entities (velocity → collision-resolved position, animation timers)
    // Noclip: temporarily remove player collider so collision is skipped
    let savedCollider: ColliderComponent | null = null;
    if (this.debugPanel.noclip && this.player.collider) {
      savedCollider = this.player.collider;
      this.player.collider = null;
    }
    this.entityManager.update(dt, (tx, ty) => this.world.getCollisionIfLoaded(tx, ty));
    if (savedCollider) {
      this.player.collider = savedCollider;
    }

    // Camera follows player
    this.camera.follow(this.player.position.wx, this.player.position.wy, CAMERA_LERP);

    // Update chunk loading based on camera position
    // Observer mode: load chunks as if zoom=1 so you can see load/unload boundaries
    if (this.debugPanel.observer && this.camera.zoom !== 1) {
      const savedZoom = this.camera.zoom;
      this.camera.zoom = 1;
      this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
      this.camera.zoom = savedZoom;
    } else {
      this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
    }
    // Compute autotile for newly loaded chunks
    this.world.computeAutotile(this.blendGraph);
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

    // Editor overlays (grid + cursor highlight)
    if (this.editorEnabled) {
      this.drawEditorGrid(visible);
      this.drawCursorHighlight();
    }

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

    // Touch joystick overlay (not in editor mode)
    if (!this.editorEnabled) {
      this.touchJoystick.draw(this.ctx);
    }
  }

  /** Tile brush: set all 9 subgrid points of tile (tx,ty) to the same terrain. */
  private applyTileEdit(tx: number, ty: number, terrainId: TerrainId): void {
    // Tile (tx,ty) covers subgrid (2*tx, 2*ty) to (2*tx+2, 2*ty+2)
    const gsx0 = 2 * tx;
    const gsy0 = 2 * ty;
    const unpaint = this.editorPanel.effectivePaintMode === "unpaint";
    for (let dy = 0; dy <= 2; dy++) {
      for (let dx = 0; dx <= 2; dx++) {
        const gx = gsx0 + dx;
        const gy = gsy0 + dy;
        if (unpaint) {
          if (this.getGlobalSubgrid(gx, gy) === terrainId) {
            this.applySubgridWithBridges(gx, gy, this.findUnpaintReplacement(gx, gy, terrainId), 0);
          }
        } else {
          this.applySubgridWithBridges(gx, gy, terrainId, 0);
        }
      }
    }
  }

  /** Corner brush: 3×3 subgrid stamp centered on a tile vertex (even subgrid coord). */
  private applyCornerEdit(gsx: number, gsy: number, terrainId: TerrainId): void {
    const unpaint = this.editorPanel.effectivePaintMode === "unpaint";
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = gsx + dx;
        const gy = gsy + dy;
        if (unpaint) {
          if (this.getGlobalSubgrid(gx, gy) === terrainId) {
            this.applySubgridWithBridges(gx, gy, this.findUnpaintReplacement(gx, gy, terrainId), 0);
          }
        } else {
          this.applySubgridWithBridges(gx, gy, terrainId, 0);
        }
      }
    }
    // Re-derive terrain for the 4 tiles sharing this corner
    const tx = gsx / 2;
    const ty = gsy / 2;
    for (let dy = -1; dy <= 0; dy++) {
      for (let dx = -1; dx <= 0; dx++) {
        this.rederiveTerrainAt(tx + dx, ty + dy);
      }
    }
  }

  /** Subgrid brush: paint with configurable brush shape. */
  private applySubgridEdit(gsx: number, gsy: number, terrainId: TerrainId): void {
    const shape = this.editorPanel.subgridShape;
    const points = this.getSubgridBrushPoints(gsx, gsy, shape);

    if (this.editorPanel.effectivePaintMode === "unpaint") {
      for (const [px, py] of points) {
        if (this.getGlobalSubgrid(px, py) === terrainId) {
          const replacement = this.findUnpaintReplacement(px, py, terrainId);
          this.applySubgridWithBridges(px, py, replacement, 0);
        }
      }
    } else {
      for (const [px, py] of points) {
        this.applySubgridWithBridges(px, py, terrainId, 0);
      }
    }
  }

  private getSubgridBrushPoints(
    gsx: number,
    gsy: number,
    shape: 1 | 2 | 3 | "cross",
  ): [number, number][] {
    if (shape === "cross") {
      return [
        [gsx, gsy],
        [gsx - 1, gsy],
        [gsx + 1, gsy],
        [gsx, gsy - 1],
        [gsx, gsy + 1],
      ];
    }
    const size = shape;
    const half = Math.floor(size / 2);
    const pts: [number, number][] = [];
    for (let dy = -half; dy < size - half; dy++) {
      for (let dx = -half; dx < size - half; dx++) {
        pts.push([gsx + dx, gsy + dy]);
      }
    }
    return pts;
  }

  /**
   * For unpaint mode: find the most common neighboring terrain that isn't
   * the one being unpainted, so we can replace it with something sensible.
   */
  private findUnpaintReplacement(gsx: number, gsy: number, unpaintTerrain: TerrainId): TerrainId {
    const counts = new Map<TerrainId, number>();
    const dirs: [number, number][] = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];
    for (const [dx, dy] of dirs) {
      const t = this.getGlobalSubgrid(gsx + dx, gsy + dy);
      if (t !== unpaintTerrain) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    if (counts.size === 0) return TerrainId.Grass;
    let best: TerrainId = TerrainId.Grass;
    let bestCount = 0;
    for (const [t, c] of counts) {
      if (c > bestCount) {
        best = t;
        bestCount = c;
      }
    }
    return best;
  }

  /**
   * Set a subgrid point and recursively insert bridge points for invalid adjacencies.
   * Bridge insertion uses Tier 1 edges only; alpha-only (Tier 2) pairs are left alone.
   */
  private applySubgridWithBridges(
    gsx: number,
    gsy: number,
    terrainId: TerrainId,
    depth: number,
  ): void {
    this.setGlobalSubgrid(gsx, gsy, terrainId);

    // Bridge insertion: check 4 cardinal neighbor subgrid points
    const maxBridge = this.editorPanel.bridgeDepth;
    if (maxBridge > 0 && depth < maxBridge) {
      const cardinals: [number, number][] = [
        [gsx - 1, gsy],
        [gsx + 1, gsy],
        [gsx, gsy - 1],
        [gsx, gsy + 1],
      ];
      for (const [nx, ny] of cardinals) {
        const neighbor = this.getGlobalSubgrid(nx, ny);
        if (neighbor === terrainId) continue;
        if (this.adjacency.isValidAdjacency(terrainId, neighbor)) continue;
        const step = this.adjacency.getBridgeStep(terrainId, neighbor);
        if (step !== undefined) {
          this.applySubgridWithBridges(nx, ny, step, depth + 1);
        }
      }
    }

    // Re-derive terrain for tiles whose subgrid region includes this point
    const txMin = Math.ceil((gsx - 2) / 2);
    const txMax = Math.floor(gsx / 2);
    const tyMin = Math.ceil((gsy - 2) / 2);
    const tyMax = Math.floor(gsy / 2);
    for (let ty = tyMin; ty <= tyMax; ty++) {
      for (let tx = txMin; tx <= txMax; tx++) {
        this.rederiveTerrainAt(tx, ty);
      }
    }
  }

  private static readonly SUBGRID_STRIDE = CHUNK_SIZE * 2;

  private setGlobalSubgrid(gsx: number, gsy: number, terrainId: TerrainId): void {
    const S = Game.SUBGRID_STRIDE;
    const cx = Math.floor(gsx / S);
    const cy = Math.floor(gsy / S);
    const lsx = gsx - cx * S;
    const lsy = gsy - cy * S;

    this.setSubgridInChunk(cx, cy, lsx, lsy, terrainId);
    // Shared with left neighbor chunk
    if (lsx === 0) this.setSubgridInChunk(cx - 1, cy, S, lsy, terrainId);
    // Shared with top neighbor chunk
    if (lsy === 0) this.setSubgridInChunk(cx, cy - 1, lsx, S, terrainId);
    // Shared with diagonal neighbor chunk
    if (lsx === 0 && lsy === 0) this.setSubgridInChunk(cx - 1, cy - 1, S, S, terrainId);
  }

  private setSubgridInChunk(
    cx: number,
    cy: number,
    lsx: number,
    lsy: number,
    terrainId: TerrainId,
  ): void {
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (chunk) {
      chunk.setSubgrid(lsx, lsy, terrainId);
      this.saveManager.markChunkDirty(chunkKey(cx, cy));
    }
  }

  private getGlobalSubgrid(gsx: number, gsy: number): TerrainId {
    const S = Game.SUBGRID_STRIDE;
    const cx = Math.floor(gsx / S);
    const cy = Math.floor(gsy / S);
    const lsx = gsx - cx * S;
    const lsy = gsy - cy * S;
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (!chunk) return TerrainId.Grass;
    return chunk.getSubgrid(lsx, lsy) as TerrainId;
  }

  private rederiveTerrainAt(tx: number, ty: number): void {
    const { cx, cy } = tileToChunk(tx, ty);
    const { lx, ly } = tileToLocal(tx, ty);
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (!chunk) return;

    // Read center subgrid point: tile (tx,ty) has center at subgrid (2*tx+1, 2*ty+1)
    const terrain = this.getGlobalSubgrid(2 * tx + 1, 2 * ty + 1);
    const tileId = terrainIdToTileId(terrain);

    chunk.setTerrain(lx, ly, tileId);
    chunk.setCollision(lx, ly, getCollisionForTerrain(tileId));
    chunk.setDetail(lx, ly, TileId.Empty);
    chunk.dirty = true;
    chunk.autotileComputed = false;

    // Invalidate neighbor chunks if tile is on a chunk edge
    if (lx === 0) this.invalidateChunk(cx - 1, cy);
    if (lx === CHUNK_SIZE - 1) this.invalidateChunk(cx + 1, cy);
    if (ly === 0) this.invalidateChunk(cx, cy - 1);
    if (ly === CHUNK_SIZE - 1) this.invalidateChunk(cx, cy + 1);
  }

  private invalidateAllChunks(): void {
    for (const [, chunk] of this.world.chunks.entries()) {
      chunk.autotileComputed = false;
      chunk.dirty = true;
    }
  }

  private invalidateChunk(cx: number, cy: number): void {
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (chunk) {
      chunk.autotileComputed = false;
      chunk.dirty = true;
    }
  }

  private clearAllTerrain(terrainId: TerrainId): void {
    const tileId = terrainIdToTileId(terrainId);
    const collision = getCollisionForTerrain(tileId);
    for (const [key, chunk] of this.world.chunks.entries()) {
      chunk.subgrid.fill(terrainId);
      chunk.fillTerrain(tileId);
      chunk.fillCollision(collision);
      chunk.detail.fill(TileId.Empty);
      chunk.dirty = true;
      chunk.autotileComputed = false;
      this.saveManager.markChunkDirty(key);
    }
  }

  private drawEditorGrid(visible: {
    minCx: number;
    minCy: number;
    maxCx: number;
    maxCy: number;
  }): void {
    if (this.camera.zoom < 0.3) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;

    const minTx = visible.minCx * CHUNK_SIZE;
    const maxTx = (visible.maxCx + 1) * CHUNK_SIZE;
    const minTy = visible.minCy * CHUNK_SIZE;
    const maxTy = (visible.maxCy + 1) * CHUNK_SIZE;

    // Horizontal lines
    for (let ty = minTy; ty <= maxTy; ty++) {
      const left = this.camera.worldToScreen(minTx * TILE_SIZE, ty * TILE_SIZE);
      const right = this.camera.worldToScreen(maxTx * TILE_SIZE, ty * TILE_SIZE);
      ctx.beginPath();
      ctx.moveTo(left.sx, left.sy);
      ctx.lineTo(right.sx, right.sy);
      ctx.stroke();
    }

    // Vertical lines
    for (let tx = minTx; tx <= maxTx; tx++) {
      const top = this.camera.worldToScreen(tx * TILE_SIZE, minTy * TILE_SIZE);
      const bottom = this.camera.worldToScreen(tx * TILE_SIZE, maxTy * TILE_SIZE);
      ctx.beginPath();
      ctx.moveTo(top.sx, top.sy);
      ctx.lineTo(bottom.sx, bottom.sy);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawCursorHighlight(): void {
    if (this.editorPanel.brushMode === "subgrid") {
      this.drawSubgridCursorHighlight();
    } else if (this.editorPanel.brushMode === "corner") {
      this.drawCornerCursorHighlight();
    } else {
      this.drawTileCursorHighlight();
    }
  }

  private getCursorColor(): { fill: string; stroke: string } {
    const mode = this.editorPanel.effectivePaintMode;
    if (mode === "unpaint") {
      return { fill: "rgba(255, 80, 80, 0.25)", stroke: "rgba(255, 80, 80, 0.6)" };
    }
    if (mode === "negative") {
      return { fill: "rgba(200, 160, 60, 0.25)", stroke: "rgba(200, 160, 60, 0.6)" };
    }
    return { fill: "rgba(255, 255, 255, 0.25)", stroke: "rgba(255, 255, 255, 0.6)" };
  }

  private drawTileCursorHighlight(): void {
    const tx = this.editorMode.cursorTileX;
    const ty = this.editorMode.cursorTileY;
    if (!Number.isFinite(tx)) return;

    const tileScreen = this.camera.worldToScreen(tx * TILE_SIZE, ty * TILE_SIZE);
    const tileScreenSize = TILE_SIZE * this.camera.scale;
    const color = this.getCursorColor();

    this.ctx.save();
    this.ctx.fillStyle = color.fill;
    this.ctx.strokeStyle = color.stroke;
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(tileScreen.sx, tileScreen.sy, tileScreenSize, tileScreenSize);
    this.ctx.strokeRect(tileScreen.sx, tileScreen.sy, tileScreenSize, tileScreenSize);
    this.ctx.restore();
  }

  private drawSubgridCursorHighlight(): void {
    const gsx = this.editorMode.cursorSubgridX;
    const gsy = this.editorMode.cursorSubgridY;
    if (!Number.isFinite(gsx)) return;

    const halfTile = TILE_SIZE / 2;
    const halfTileScreen = halfTile * this.camera.scale;
    const shape = this.editorPanel.subgridShape;
    const paintMode = this.editorPanel.effectivePaintMode;

    // Choose color based on paint mode
    const baseColor =
      paintMode === "unpaint"
        ? "255, 80, 80"
        : paintMode === "negative"
          ? "200, 160, 60"
          : "240, 160, 48";

    this.ctx.save();

    if (shape === "cross") {
      // Draw 5-point cross preview
      const points = this.getSubgridBrushPoints(gsx, gsy, "cross");
      this.ctx.fillStyle = `rgba(${baseColor}, 0.25)`;
      this.ctx.strokeStyle = `rgba(${baseColor}, 0.8)`;
      this.ctx.lineWidth = 1;
      for (const [px, py] of points) {
        const screen = this.camera.worldToScreen(px * halfTile, py * halfTile);
        const x = screen.sx - halfTileScreen / 2;
        const y = screen.sy - halfTileScreen / 2;
        this.ctx.fillRect(x, y, halfTileScreen, halfTileScreen);
        this.ctx.strokeRect(x, y, halfTileScreen, halfTileScreen);
      }
    } else {
      const brushSize = this.editorPanel.brushSize;
      const half = Math.floor(brushSize / 2);

      // World coords of the brush rectangle
      const wx0 = (gsx - half) * halfTile;
      const wy0 = (gsy - half) * halfTile;
      const wx1 = (gsx - half + brushSize) * halfTile;
      const wy1 = (gsy - half + brushSize) * halfTile;

      const topLeft = this.camera.worldToScreen(wx0, wy0);
      const botRight = this.camera.worldToScreen(wx1, wy1);
      const w = botRight.sx - topLeft.sx;
      const h = botRight.sy - topLeft.sy;

      this.ctx.fillStyle = `rgba(${baseColor}, 0.25)`;
      this.ctx.strokeStyle = `rgba(${baseColor}, 0.8)`;
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(topLeft.sx, topLeft.sy, w, h);
      this.ctx.strokeRect(topLeft.sx, topLeft.sy, w, h);
    }

    // Draw center dot
    const center = this.camera.worldToScreen(gsx * halfTile, gsy * halfTile);
    const radius = Math.max(3, 2 * this.camera.scale);
    this.ctx.beginPath();
    this.ctx.arc(center.sx, center.sy, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(${baseColor}, 0.8)`;
    this.ctx.fill();

    this.ctx.restore();
  }

  private drawCornerCursorHighlight(): void {
    const gsx = this.editorMode.cursorCornerX;
    const gsy = this.editorMode.cursorCornerY;
    if (!Number.isFinite(gsx)) return;

    const halfTile = TILE_SIZE / 2;
    const paintMode = this.editorPanel.effectivePaintMode;
    const baseColor =
      paintMode === "unpaint"
        ? "255, 80, 80"
        : paintMode === "negative"
          ? "200, 160, 60"
          : "80, 200, 255";

    // 3×3 subgrid area centered on corner
    const wx0 = (gsx - 1) * halfTile;
    const wy0 = (gsy - 1) * halfTile;
    const wx1 = (gsx + 2) * halfTile;
    const wy1 = (gsy + 2) * halfTile;

    const topLeft = this.camera.worldToScreen(wx0, wy0);
    const botRight = this.camera.worldToScreen(wx1, wy1);
    const w = botRight.sx - topLeft.sx;
    const h = botRight.sy - topLeft.sy;

    this.ctx.save();
    this.ctx.fillStyle = `rgba(${baseColor}, 0.2)`;
    this.ctx.strokeStyle = `rgba(${baseColor}, 0.7)`;
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(topLeft.sx, topLeft.sy, w, h);
    this.ctx.strokeRect(topLeft.sx, topLeft.sy, w, h);

    // Draw center crosshair at the corner point
    const center = this.camera.worldToScreen(gsx * halfTile, gsy * halfTile);
    const r = Math.max(4, 3 * this.camera.scale);
    this.ctx.strokeStyle = `rgba(${baseColor}, 0.9)`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(center.sx - r, center.sy);
    this.ctx.lineTo(center.sx + r, center.sy);
    this.ctx.moveTo(center.sx, center.sy - r);
    this.ctx.lineTo(center.sx, center.sy + r);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private findWalkableSpawn(entity: Entity): void {
    const blockMask = CollisionFlag.Solid | CollisionFlag.Water;
    const getCollision = (tx: number, ty: number) => this.world.getCollision(tx, ty);

    // Check if current position is already clear (using actual AABB, not just foot tile)
    if (
      entity.collider &&
      !aabbOverlapsSolid(getEntityAABB(entity.position, entity.collider), getCollision, blockMask)
    ) {
      return;
    }

    const tx0 = Math.floor(entity.position.wx / TILE_SIZE);
    const ty0 = Math.floor(entity.position.wy / TILE_SIZE);
    for (let radius = 1; radius <= CHUNK_SIZE * 2; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const tx = tx0 + dx;
          const ty = ty0 + dy;
          const candidatePos = {
            wx: tx * TILE_SIZE + TILE_SIZE / 2,
            wy: ty * TILE_SIZE + TILE_SIZE / 2,
          };
          if (
            entity.collider &&
            !aabbOverlapsSolid(
              getEntityAABB(candidatePos, entity.collider),
              getCollision,
              blockMask,
            )
          ) {
            entity.position.wx = candidatePos.wx;
            entity.position.wy = candidatePos.wy;
            return;
          }
        }
      }
    }
  }

  private buildSaveMeta(): SavedMeta {
    return {
      playerX: this.player.position.wx,
      playerY: this.player.position.wy,
      cameraX: this.camera.x,
      cameraY: this.camera.y,
      cameraZoom: this.camera.zoom,
      entities: this.entityManager.entities.map((e) => ({
        type: e.type,
        wx: e.position.wx,
        wy: e.position.wy,
      })),
      nextEntityId: this.entityManager.getNextId(),
    };
  }

  private spawnChickens(count: number): void {
    let spawned = 0;
    let attempts = 0;
    const range = CHUNK_SIZE * TILE_SIZE; // 1 chunk radius — keep chickens near player
    while (spawned < count && attempts < 200) {
      attempts++;
      const wx = (Math.random() - 0.5) * range * 2;
      const wy = (Math.random() - 0.5) * range * 2;
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

const ENTITY_FACTORIES: Record<string, (wx: number, wy: number) => Entity> = {
  chicken: createChicken,
  cow: createCow,
  pigeon: createPigeon,
  pigeon2: createPigeon2,
  fish1: createFish1,
  fish2: createFish2,
  fish3: createFish3,
  campfire: createCampfire,
  "egg-nest": createEggNest,
  crow: createCrow,
  seagull: createSeagull,
  worm1: createWorm1,
  worm2: createWorm2,
  worm3: createWorm3,
  worm4: createWorm4,
};

/**
 * Register base fill variant tiles from the ME Complete Tileset.
 * Group names match TerrainId enum keys (e.g. "Grass", "DirtWarm").
 *
 * Tile coordinates are (col, row) in the 176×514 complete tileset grid.
 * Grass variants: two regions of textured grass matching autotile color (71, 151, 87).
 * GrassLight: brighter green tiles for manicured/lawn areas.
 */
function registerTileVariants(variants: TileVariants): void {
  // --- Grass: tiles matching ME autotile grass color (71, 151, 87) ---
  // Region A (cols 51-63, rows 1-7): terrain section grass variants
  variants.addTiles("Grass", [
    { col: 52, row: 2 }, // solid (var=0, 100% match)
    { col: 53, row: 2 }, // subtle texture (var=37)
    { col: 55, row: 1 }, // grass blades (var=129)
    { col: 58, row: 1 },
    { col: 59, row: 1 },
    { col: 61, row: 1 },
    { col: 63, row: 1 },
    { col: 63, row: 3 }, // moderate texture (var=66)
    { col: 55, row: 4 },
    { col: 58, row: 4 },
    { col: 59, row: 4 },
    { col: 61, row: 4 }, // (var=66)
    { col: 62, row: 4 },
    { col: 62, row: 6 },
  ]);
  // Region B (cols 129-145, rows 1-5): alternate terrain grass variants
  variants.addTiles("Grass", [
    { col: 130, row: 2 }, // solid (var=0, 100% match)
    { col: 131, row: 2 }, // subtle texture (var=37)
    { col: 133, row: 1 }, // (var=71)
    { col: 137, row: 1 },
    { col: 136, row: 1 }, // (var=102)
    { col: 140, row: 1 },
    { col: 141, row: 1 }, // near-solid (var=18)
    { col: 145, row: 1 },
    { col: 133, row: 4 }, // (var=96)
    { col: 136, row: 4 },
    { col: 141, row: 5 }, // near-solid (var=18)
    { col: 145, row: 5 },
  ]);

  // --- GrassLight: brighter green tiles (cols 7-11, rows 1-5) ---
  // Color ~(103, 168, 80) — a separate, lighter grass style
  variants.addRect("GrassLight", 7, 1, 5, 5);
}
