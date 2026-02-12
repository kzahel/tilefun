import alea from "alea";
import { loadImage } from "../assets/AssetLoader.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { deriveTerrainIdFromCorners } from "../autotile/TerrainGraph.js";
import type { TerrainId } from "../autotile/TerrainId.js";
import { terrainIdToTileId } from "../autotile/terrainMapping.js";
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
import { createChicken } from "../entities/Chicken.js";
import { aabbOverlapsSolid, getEntityAABB } from "../entities/collision.js";
import type { ColliderComponent, Entity } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer, updatePlayerFromInput } from "../entities/Player.js";
import { updateWanderAI } from "../entities/wanderAI.js";
import { OnionStrategy } from "../generation/OnionStrategy.js";
import { InputManager } from "../input/InputManager.js";
import { TouchJoystick } from "../input/TouchJoystick.js";
import { Camera } from "../rendering/Camera.js";
import { DebugPanel } from "../rendering/DebugPanel.js";
import { drawDebugOverlay } from "../rendering/DebugRenderer.js";
import { drawEntities } from "../rendering/EntityRenderer.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { CollisionFlag, getCollisionForTerrain, TileId } from "../world/TileRegistry.js";
import { tileToChunk, tileToLocal } from "../world/types.js";
import { World } from "../world/World.js";
import { GameLoop } from "./GameLoop.js";

const DEFAULT_SEED = "tilefun-default";

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
  private editorEnabled = false;
  private editorMode: EditorMode;
  private editorPanel: EditorPanel;
  private currentSeed: string;
  private blendGraph: BlendGraph;
  private adjacency: TerrainAdjacency;
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFps = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    this.canvas = canvas;
    this.ctx = ctx;
    this.camera = new Camera();
    this.currentSeed = DEFAULT_SEED;
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
    this.debugPanel = new DebugPanel(DEFAULT_SEED);
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
    });
    this.createEditorButton();
    this.input.attach();
    this.touchJoystick.attach();

    // Load blend graph sheets (11 ME autotile sheets) + entity sheets
    const blendDescs = this.blendGraph.allSheets;
    const [blendImages, objectsImg, playerImg, chickenImg] = await Promise.all([
      Promise.all(blendDescs.map((desc) => loadImage(desc.assetPath))),
      loadImage("assets/tilesets/objects.png"),
      loadImage("assets/sprites/player.png"),
      loadImage("assets/sprites/chicken.png"),
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
    this.tileRenderer.useGraphRenderer = true;

    // Legacy layer sheet aliases (same PNGs already loaded via blend graph)
    const legacyAliases: [string, string][] = [
      ["deepwater", "me16"],
      ["sand", "me08"],
      ["grassalpha", "me13"],
      ["dirt", "me02"],
    ];
    for (const [legacyKey, blendKey] of legacyAliases) {
      const sheet = this.sheets.get(blendKey);
      if (sheet) this.sheets.set(legacyKey, sheet);
    }

    this.sheets.set("objects", new Spritesheet(objectsImg, TILE_SIZE, TILE_SIZE));
    this.sheets.set("player", new Spritesheet(playerImg, PLAYER_SPRITE_SIZE, PLAYER_SPRITE_SIZE));
    this.sheets.set(
      "chicken",
      new Spritesheet(chickenImg, CHICKEN_SPRITE_SIZE, CHICKEN_SPRITE_SIZE),
    );

    // Pre-load chunks around origin and compute initial autotile
    this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
    this.world.computeAutotile(this.blendGraph);

    // Move player to a walkable tile near origin
    this.findWalkableSpawn(this.player);

    // Spawn chickens on walkable tiles near origin
    this.spawnChickens(5);

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
    const btn = document.createElement("button");
    btn.textContent = "Edit";
    btn.style.cssText = `
      position: fixed; top: 8px; left: 8px; z-index: 100;
      font: bold 14px monospace; padding: 8px 16px;
      background: rgba(0,0,0,0.6); color: #fff;
      border: 1px solid #888; border-radius: 4px;
      cursor: pointer; user-select: none;
    `;
    btn.addEventListener("click", () => this.toggleEditor());
    document.body.appendChild(btn);
    this.editorButton = btn;
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
    const newSeed = this.debugPanel.consumeSeedChange();
    const newStrategy = this.debugPanel.consumeStrategyChange();
    if (newSeed !== null || newStrategy !== null) {
      this.regenerateWorld(newSeed ?? this.currentSeed);
    }

    // Editor mode: paint terrain, skip gameplay
    if (this.editorEnabled) {
      this.editorMode.selectedTerrain = this.editorPanel.selectedTerrain;
      this.editorMode.brushMode = this.editorPanel.brushMode;

      // Apply terrain edits (tile mode → set all 4 corners of the tile)
      for (const edit of this.editorMode.consumePendingEdits()) {
        this.applyTileEdit(edit.tx, edit.ty, edit.terrainId);
      }

      // Apply corner edits (corner mode)
      for (const edit of this.editorMode.consumePendingCornerEdits()) {
        this.applyCornerEdit(edit.gx, edit.gy, edit.terrainId);
      }

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

  /** Tile brush: set all 4 corners of tile (tx,ty) to the same terrain. */
  private applyTileEdit(tx: number, ty: number, terrainId: TerrainId): void {
    // Tile corners: NW=(tx,ty), NE=(tx+1,ty), SW=(tx,ty+1), SE=(tx+1,ty+1)
    this.applyCornerEdit(tx, ty, terrainId);
    this.applyCornerEdit(tx + 1, ty, terrainId);
    this.applyCornerEdit(tx, ty + 1, terrainId);
    this.applyCornerEdit(tx + 1, ty + 1, terrainId);
  }

  private applyCornerEdit(gx: number, gy: number, terrainId: TerrainId): void {
    this.applyCornerWithBridges(gx, gy, terrainId, 0);
  }

  /**
   * Set a corner and recursively insert bridge corners for invalid adjacencies.
   * Bridge insertion uses Tier 1 edges only; alpha-only (Tier 2) pairs are left alone.
   */
  private applyCornerWithBridges(
    gx: number,
    gy: number,
    terrainId: TerrainId,
    depth: number,
  ): void {
    this.setGlobalCorner(gx, gy, terrainId);

    // Bridge insertion: check 4 cardinal neighbor corners
    const maxBridge = this.editorPanel.bridgeDepth;
    if (maxBridge > 0 && depth < maxBridge) {
      const cardinals: [number, number][] = [
        [gx - 1, gy],
        [gx + 1, gy],
        [gx, gy - 1],
        [gx, gy + 1],
      ];
      for (const [nx, ny] of cardinals) {
        const neighbor = this.getGlobalCorner(nx, ny);
        if (neighbor === terrainId) continue;
        if (this.adjacency.isValidAdjacency(terrainId, neighbor)) continue;
        const step = this.adjacency.getBridgeStep(terrainId, neighbor);
        if (step !== undefined) {
          this.applyCornerWithBridges(nx, ny, step, depth + 1);
        }
      }
    }

    // Re-derive terrain for the 4 tiles that share this corner
    for (let dy = -1; dy <= 0; dy++) {
      for (let dx = -1; dx <= 0; dx++) {
        this.rederiveTerrainAt(gx + dx, gy + dy);
      }
    }
  }

  private setGlobalCorner(gx: number, gy: number, terrainId: TerrainId): void {
    const cx = Math.floor(gx / CHUNK_SIZE);
    const cy = Math.floor(gy / CHUNK_SIZE);
    const lcx = gx - cx * CHUNK_SIZE;
    const lcy = gy - cy * CHUNK_SIZE;

    this.setCornerInChunk(cx, cy, lcx, lcy, terrainId);
    // Shared with left neighbor chunk
    if (lcx === 0) this.setCornerInChunk(cx - 1, cy, CHUNK_SIZE, lcy, terrainId);
    // Shared with top neighbor chunk
    if (lcy === 0) this.setCornerInChunk(cx, cy - 1, lcx, CHUNK_SIZE, terrainId);
    // Shared with diagonal neighbor chunk
    if (lcx === 0 && lcy === 0)
      this.setCornerInChunk(cx - 1, cy - 1, CHUNK_SIZE, CHUNK_SIZE, terrainId);
  }

  private setCornerInChunk(
    cx: number,
    cy: number,
    lcx: number,
    lcy: number,
    terrainId: TerrainId,
  ): void {
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (chunk) {
      chunk.setCorner(lcx, lcy, terrainId);
    }
  }

  private getGlobalCorner(gx: number, gy: number): TerrainId {
    const cx = Math.floor(gx / CHUNK_SIZE);
    const cy = Math.floor(gy / CHUNK_SIZE);
    const lcx = gx - cx * CHUNK_SIZE;
    const lcy = gy - cy * CHUNK_SIZE;
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (!chunk) return 4 as TerrainId; // TerrainId.Grass
    return chunk.getCorner(lcx, lcy) as TerrainId;
  }

  private rederiveTerrainAt(tx: number, ty: number): void {
    const { cx, cy } = tileToChunk(tx, ty);
    const { lx, ly } = tileToLocal(tx, ty);
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    if (!chunk) return;

    // Tile (tx,ty) has corners: NW=(tx,ty), NE=(tx+1,ty), SW=(tx,ty+1), SE=(tx+1,ty+1)
    const nw = this.getGlobalCorner(tx, ty);
    const ne = this.getGlobalCorner(tx + 1, ty);
    const sw = this.getGlobalCorner(tx, ty + 1);
    const se = this.getGlobalCorner(tx + 1, ty + 1);

    const terrain = deriveTerrainIdFromCorners(nw, ne, sw, se);
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
    for (const [, chunk] of this.world.chunks.entries()) {
      chunk.corners.fill(terrainId);
      chunk.fillTerrain(tileId);
      chunk.fillCollision(collision);
      chunk.detail.fill(TileId.Empty);
      chunk.dirty = true;
      chunk.autotileComputed = false;
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
    if (this.editorPanel.brushMode === "corner") {
      this.drawCornerCursorHighlight();
    } else {
      this.drawTileCursorHighlight();
    }
  }

  private drawTileCursorHighlight(): void {
    const tx = this.editorMode.cursorTileX;
    const ty = this.editorMode.cursorTileY;
    if (!Number.isFinite(tx)) return;

    const tileScreen = this.camera.worldToScreen(tx * TILE_SIZE, ty * TILE_SIZE);
    const tileScreenSize = TILE_SIZE * this.camera.scale;

    this.ctx.save();
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(tileScreen.sx, tileScreen.sy, tileScreenSize, tileScreenSize);
    this.ctx.strokeRect(tileScreen.sx, tileScreen.sy, tileScreenSize, tileScreenSize);
    this.ctx.restore();
  }

  private drawCornerCursorHighlight(): void {
    const gx = this.editorMode.cursorCornerX;
    const gy = this.editorMode.cursorCornerY;
    if (!Number.isFinite(gx)) return;

    // Corner vertex is at the intersection of tiles
    const cornerScreen = this.camera.worldToScreen(gx * TILE_SIZE, gy * TILE_SIZE);
    const radius = Math.max(4, 3 * this.camera.scale);

    this.ctx.save();

    // Draw a filled circle at the corner vertex
    this.ctx.beginPath();
    this.ctx.arc(cornerScreen.sx, cornerScreen.sy, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = "rgba(240, 160, 48, 0.6)";
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Lightly highlight the 4 tiles that share this corner
    const halfTile = TILE_SIZE * this.camera.scale;
    this.ctx.fillStyle = "rgba(240, 160, 48, 0.1)";
    this.ctx.fillRect(cornerScreen.sx - halfTile, cornerScreen.sy - halfTile, halfTile, halfTile);
    this.ctx.fillRect(cornerScreen.sx, cornerScreen.sy - halfTile, halfTile, halfTile);
    this.ctx.fillRect(cornerScreen.sx - halfTile, cornerScreen.sy, halfTile, halfTile);
    this.ctx.fillRect(cornerScreen.sx, cornerScreen.sy, halfTile, halfTile);

    this.ctx.restore();
  }

  private regenerateWorld(seed: string): void {
    this.currentSeed = seed;
    this.world = new World(new OnionStrategy(seed));
    this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
    this.world.computeAutotile(this.blendGraph);
    // Remove all NPCs, re-spawn
    this.entityManager.entities.length = 0;
    this.entityManager.spawn(this.player);
    this.findWalkableSpawn(this.player);
    this.spawnChickens(5);
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
