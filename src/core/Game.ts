import { loadGameAssets } from "../assets/GameAssets.js";
import type { Spritesheet } from "../assets/Spritesheet.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { CAMERA_LERP, ENTITY_ACTIVATION_DISTANCE, TILE_SIZE } from "../config/constants.js";
import { EditorMode } from "../editor/EditorMode.js";
import { EditorPanel } from "../editor/EditorPanel.js";
import { drawEditorOverlay } from "../editor/EditorRenderer.js";
import { TerrainEditor } from "../editor/TerrainEditor.js";
import type { ColliderComponent, Entity } from "../entities/Entity.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { EntityManager } from "../entities/EntityManager.js";
import { findWalkableSpawn, spawnInitialChickens } from "../entities/EntitySpawner.js";
import { createPlayer, updatePlayerFromInput } from "../entities/Player.js";
import { updateWanderAI } from "../entities/wanderAI.js";
import { InputManager } from "../input/InputManager.js";
import { TouchJoystick } from "../input/TouchJoystick.js";
import type { SavedMeta } from "../persistence/SaveManager.js";
import { SaveManager } from "../persistence/SaveManager.js";
import { dbNameForWorld, WorldRegistry } from "../persistence/WorldRegistry.js";
import { Camera } from "../rendering/Camera.js";
import { DebugPanel } from "../rendering/DebugPanel.js";
import { drawDebugOverlay } from "../rendering/DebugRenderer.js";
import { drawEntities } from "../rendering/EntityRenderer.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { MainMenu } from "../ui/MainMenu.js";
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
  private terrainEditor: TerrainEditor;
  private saveManager: SaveManager | null = null;
  private registry: WorldRegistry;
  private mainMenu: MainMenu;
  private currentWorldId: string | null = null;
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
    this.terrainEditor = new TerrainEditor(this.world, new SaveManager("_unused"), this.adjacency);
    this.debugPanel = new DebugPanel();
    this.editorMode = new EditorMode(canvas, this.camera);
    this.editorPanel = new EditorPanel();
    this.registry = new WorldRegistry();
    this.mainMenu = new MainMenu();
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
    });
  }

  async init(): Promise<void> {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.toggleMenu();
        return;
      }
      if (this.mainMenu.visible) return;
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

    // Load all assets
    const assets = await loadGameAssets(this.blendGraph);
    this.sheets = assets.sheets;
    this.tileRenderer.setBlendSheets(assets.blendSheets, this.blendGraph);
    this.tileRenderer.setRoadSheets(this.sheets);
    this.tileRenderer.setVariants(assets.variants);
    this.editorPanel.setAssets(assets.sheets, assets.blendSheets, this.blendGraph);

    // Open registry and migrate legacy data if needed
    await this.registry.open();
    await this.migrateIfNeeded();

    // Load most recent world, or create a default one
    const worlds = await this.registry.listWorlds();
    const firstWorld = worlds[0];
    if (firstWorld) {
      await this.loadWorld(firstWorld.id);
    } else {
      const meta = await this.registry.createWorld("My World");
      await this.loadWorld(meta.id);
    }

    // Set up menu callbacks
    this.mainMenu.onSelect = (id) => {
      this.loadWorld(id).then(() => this.mainMenu.hide());
    };
    this.mainMenu.onCreate = (name) => {
      this.registry.createWorld(name).then((meta) => {
        this.loadWorld(meta.id).then(() => this.mainMenu.hide());
      });
    };
    this.mainMenu.onDelete = async (id) => {
      await this.registry.deleteWorld(id);
      if (id === this.currentWorldId) {
        const remaining = await this.registry.listWorlds();
        const next = remaining[0];
        if (next) {
          await this.loadWorld(next.id);
        } else {
          const meta = await this.registry.createWorld("My World");
          await this.loadWorld(meta.id);
        }
      }
      // Refresh the menu
      const worlds = await this.registry.listWorlds();
      this.mainMenu.show(worlds);
    };
    this.mainMenu.onRename = (id, name) => {
      this.registry.renameWorld(id, name);
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.saveManager?.flush();
      }
    });
    window.addEventListener("beforeunload", () => {
      this.saveManager?.flush();
    });

    this.loop.start();
    this.canvas.dataset.ready = "true";
  }

  private async loadWorld(worldId: string): Promise<void> {
    // Close previous save manager
    if (this.saveManager) {
      this.saveManager.flush();
      this.saveManager.close();
    }

    // Create fresh world state
    this.world = new World();
    this.entityManager = new EntityManager();
    this.player = createPlayer(0, 0);
    this.entityManager.spawn(this.player);

    // Open persistence for this world
    const dbName = dbNameForWorld(worldId);
    this.saveManager = new SaveManager(dbName);
    this.terrainEditor = new TerrainEditor(this.world, this.saveManager, this.adjacency);

    await this.saveManager.open();
    const savedMeta = await this.saveManager.loadMeta();
    const savedChunks = await this.saveManager.loadChunks();

    if (savedMeta && savedChunks.size > 0) {
      this.world.chunks.setSavedData(savedChunks);
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
      this.camera.x = 0;
      this.camera.y = 0;
      this.camera.zoom = 1;
      this.world.updateLoadedChunks(this.camera.getVisibleChunkRange());
      this.world.computeAutotile(this.blendGraph);
      findWalkableSpawn(this.player, this.world);
      spawnInitialChickens(5, this.world, this.entityManager);
    }

    // Bind save accessors
    this.saveManager.bind(
      (key) => this.world.chunks.getChunkDataByKey(key),
      () => this.buildSaveMeta(),
    );
    this.saveManager.onChunksSaved = (keys, getChunk) => {
      for (const key of keys) {
        const data = getChunk(key);
        if (data)
          this.world.chunks.updateSavedChunk(key, data.subgrid, data.roadGrid, data.heightGrid);
      }
    };

    this.currentWorldId = worldId;
    await this.registry.updateLastPlayed(worldId);
  }

  private async migrateIfNeeded(): Promise<void> {
    // Check if the legacy "tilefun" database exists with data
    let legacyDb: IDBDatabase;
    try {
      legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("tilefun", 1);
        req.onupgradeneeded = () => {
          // DB didn't exist — abort so we don't create an empty one
          req.transaction?.abort();
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return; // No legacy DB
    }

    // Check if it has actual data
    if (!legacyDb.objectStoreNames.contains("chunks")) {
      legacyDb.close();
      return;
    }

    const hasData = await new Promise<boolean>((resolve) => {
      try {
        const tx = legacyDb.transaction("chunks", "readonly");
        const req = tx.objectStore("chunks").count();
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });

    if (!hasData) {
      legacyDb.close();
      // Clean up the empty legacy DB
      indexedDB.deleteDatabase("tilefun");
      return;
    }

    // Read all legacy data
    const legacySave = new SaveManager("tilefun");
    await legacySave.open();
    const chunks = await legacySave.loadChunks();
    const meta = await legacySave.loadMeta();
    legacySave.close();
    legacyDb.close();

    // Create a new world entry and copy data
    const worldMeta = await this.registry.createWorld("My World");
    const newSave = new SaveManager(dbNameForWorld(worldMeta.id));
    await newSave.open();
    await newSave.importData(chunks, meta);
    newSave.close();

    // Delete legacy database
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("tilefun");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve(); // best effort
    });
  }

  private async toggleMenu(): Promise<void> {
    if (this.mainMenu.visible) {
      this.mainMenu.hide();
    } else {
      this.saveManager?.flush();
      const worlds = await this.registry.listWorlds();
      this.mainMenu.show(worlds);
    }
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

    const menuBtn = document.createElement("button");
    menuBtn.textContent = "Menu";
    menuBtn.style.cssText = BTN_STYLE;
    menuBtn.addEventListener("click", () => this.toggleMenu());

    const debugBtn = document.createElement("button");
    debugBtn.textContent = "Debug";
    debugBtn.style.cssText = BTN_STYLE;
    debugBtn.addEventListener("click", () => {
      this.debugEnabled = !this.debugEnabled;
      this.debugPanel.visible = this.debugEnabled;
    });
    wrap.append(editBtn, menuBtn, debugBtn);
    document.body.appendChild(wrap);
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.camera.setViewport(this.canvas.width, this.canvas.height);
  }

  private update(dt: number): void {
    // Skip game updates while menu is open
    if (this.mainMenu.visible) return;

    // Apply debug panel state
    if (!this.editorEnabled) {
      this.camera.zoom = this.debugPanel.zoom;
    }
    if (this.debugPanel.consumeBaseModeChange() || this.debugPanel.consumeConvexChange()) {
      this.terrainEditor.invalidateAllChunks();
    }

    // Editor mode: paint terrain or place entities
    if (this.editorEnabled) {
      this.editorPanel.setTemporaryUnpaint(this.editorMode.rightClickUnpaint);
      this.editorMode.selectedTerrain = this.editorPanel.selectedTerrain;
      this.editorMode.selectedRoadType = this.editorPanel.selectedRoadType;
      this.editorMode.brushMode = this.editorPanel.brushMode;
      this.editorMode.paintMode = this.editorPanel.effectivePaintMode;
      this.editorMode.editorTab = this.editorPanel.editorTab;
      this.editorMode.selectedEntityType = this.editorPanel.selectedEntityType;
      this.editorMode.selectedElevation = this.editorPanel.selectedElevation;
      this.editorMode.elevationGridSize = this.editorPanel.elevationGridSize;
      this.editorMode.entities = this.entityManager.entities;
      this.editorMode.update(dt);

      const paintMode = this.editorPanel.effectivePaintMode;
      const bridgeDepth = this.editorPanel.bridgeDepth;

      // Apply terrain edits (tile mode → set all 9 subgrid points of the tile)
      for (const edit of this.editorMode.consumePendingEdits()) {
        this.terrainEditor.applyTileEdit(edit.tx, edit.ty, edit.terrainId, paintMode, bridgeDepth);
      }

      // Apply subgrid edits (subgrid mode)
      for (const edit of this.editorMode.consumePendingSubgridEdits()) {
        this.terrainEditor.applySubgridEdit(
          edit.gsx,
          edit.gsy,
          edit.terrainId,
          paintMode,
          bridgeDepth,
          this.editorPanel.subgridShape,
        );
      }

      // Apply corner edits (corner mode → 3x3 subgrid centered on tile vertex)
      for (const edit of this.editorMode.consumePendingCornerEdits()) {
        this.terrainEditor.applyCornerEdit(
          edit.gsx,
          edit.gsy,
          edit.terrainId,
          paintMode,
          bridgeDepth,
        );
      }

      // Apply road edits
      for (const edit of this.editorMode.consumePendingRoadEdits()) {
        this.terrainEditor.applyRoadEdit(edit.tx, edit.ty, edit.roadType, paintMode);
      }

      // Apply elevation edits
      for (const edit of this.editorMode.consumePendingElevationEdits()) {
        this.terrainEditor.applyElevationEdit(edit.tx, edit.ty, edit.height, edit.gridSize);
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
      if (entitiesChanged) this.saveManager?.markMetaDirty();

      // Handle clear canvas
      const clearId = this.editorPanel.consumeClearRequest();
      if (clearId !== null) {
        this.terrainEditor.clearAllTerrain(clearId);
      }
      if (this.editorPanel.consumeRoadClearRequest()) {
        this.terrainEditor.clearAllRoads();
      }
    }

    // Player input → velocity + animation state (skip in editor — camera pans via drag)
    if (!this.editorEnabled) {
      const movement = this.input.getMovement();
      updatePlayerFromInput(this.player, movement, dt);
    }

    // Entity simulation (NPC AI + physics), unless paused via debug panel
    if (!this.debugPanel.paused) {
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
    }

    // Camera follows player (only in play mode)
    if (!this.editorEnabled) {
      this.camera.follow(this.player.position.wx, this.player.position.wy, CAMERA_LERP);
    }

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

    // Elevation pass: cliff faces + Y-offset for elevated tiles
    this.tileRenderer.drawElevation(this.ctx, this.camera, this.world, visible);

    // Editor overlays (grid + cursor highlight + elevation tint)
    if (this.editorEnabled) {
      drawEditorOverlay(
        this.ctx,
        this.camera,
        this.editorMode,
        {
          brushMode: this.editorPanel.brushMode,
          effectivePaintMode: this.editorPanel.effectivePaintMode,
          subgridShape: this.editorPanel.subgridShape,
          brushSize: this.editorPanel.brushSize,
          editorTab: this.editorPanel.editorTab,
          elevationGridSize: this.editorPanel.elevationGridSize,
        },
        visible,
        this.world,
      );
    }

    // Draw entities Y-sorted on top of terrain (with elevation offset)
    drawEntities(this.ctx, this.camera, this.entityManager.getYSorted(), this.sheets, this.world);

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
}
