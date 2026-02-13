import { loadGameAssets } from "../assets/GameAssets.js";
import { generateGemSprite } from "../assets/GemSpriteGenerator.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { CAMERA_LERP, TILE_SIZE } from "../config/constants.js";
import { GameLoop } from "../core/GameLoop.js";
import { EditorMode } from "../editor/EditorMode.js";
import { EditorPanel } from "../editor/EditorPanel.js";
import { drawEditorOverlay } from "../editor/EditorRenderer.js";
import { InputManager } from "../input/InputManager.js";
import { TouchJoystick } from "../input/TouchJoystick.js";
import { Camera } from "../rendering/Camera.js";
import { DebugPanel } from "../rendering/DebugPanel.js";
import { drawDebugOverlay } from "../rendering/DebugRenderer.js";
import { drawEntities } from "../rendering/EntityRenderer.js";
import type { Renderable } from "../rendering/Renderable.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import type { GameServer } from "../server/GameServer.js";
import type { IClientTransport } from "../transport/Transport.js";
import { MainMenu } from "../ui/MainMenu.js";
import { CollisionFlag, TileId } from "../world/TileRegistry.js";
import { type ClientStateView, LocalStateView } from "./ClientStateView.js";

export class GameClient {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private loop: GameLoop;
  private sheets = new Map<string, Spritesheet>();
  private tileRenderer: TileRenderer;
  private input: InputManager;
  private touchJoystick: TouchJoystick;
  private debugEnabled = false;
  private debugPanel: DebugPanel;
  private editorMode: EditorMode;
  private editorPanel: EditorPanel;
  private mainMenu: MainMenu;
  private editorButton: HTMLButtonElement | null = null;
  private gemSpriteCanvas: HTMLCanvasElement | null = null;
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFps = 0;
  private stateView: ClientStateView;
  private transport: IClientTransport;
  private server: GameServer;

  constructor(canvas: HTMLCanvasElement, transport: IClientTransport, server: GameServer) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    this.canvas = canvas;
    this.ctx = ctx;
    this.transport = transport;
    this.server = server;
    this.camera = new Camera();
    this.tileRenderer = new TileRenderer();
    this.input = new InputManager();
    this.touchJoystick = new TouchJoystick(canvas);
    this.input.setTouchJoystick(this.touchJoystick);
    this.debugPanel = new DebugPanel();
    this.editorMode = new EditorMode(canvas, this.camera);
    this.editorPanel = new EditorPanel();
    this.editorPanel.onCollapse = () => this.toggleEditor();
    this.mainMenu = new MainMenu();
    this.stateView = new LocalStateView(server);
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
    });
  }

  async init(): Promise<void> {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("keydown", (e) => this.onKeyDown(e));
    this.createEditorButton();
    this.canvas.addEventListener("click", (e) => this.onPlayClick(e));
    this.touchJoystick.onTap = (clientX, clientY) => this.onPlayTap(clientX, clientY);
    this.input.attach();
    // Start in editor mode — attach editor, not joystick
    this.editorMode.attach();
    this.editorPanel.visible = true;

    // Load all assets
    const { blendGraph } = this.server;
    const assets = await loadGameAssets(blendGraph);
    this.sheets = assets.sheets;
    this.tileRenderer.setBlendSheets(assets.blendSheets, blendGraph);
    this.tileRenderer.setRoadSheets(this.sheets);
    this.tileRenderer.setVariants(assets.variants);
    this.editorPanel.setAssets(assets.sheets, assets.blendSheets, blendGraph);

    // Generate procedural gem sprite and add to sheets
    this.gemSpriteCanvas = generateGemSprite();
    this.sheets.set(
      "gem",
      new Spritesheet(this.gemSpriteCanvas as unknown as HTMLImageElement, 16, 16),
    );

    // Apply loaded world camera position
    const session = this.server.getLocalSession();
    this.camera.x = session.cameraX;
    this.camera.y = session.cameraY;
    this.camera.zoom = session.cameraZoom;

    // Initial chunk loading
    this.server.updateVisibleChunks(this.camera.getVisibleChunkRange());

    // Set up menu callbacks
    this.mainMenu.onSelect = (id) => {
      this.server.loadWorld(id).then((cam) => {
        this.camera.x = cam.cameraX;
        this.camera.y = cam.cameraY;
        this.camera.zoom = cam.cameraZoom;
        this.server.updateVisibleChunks(this.camera.getVisibleChunkRange());
        this.mainMenu.hide();
      });
    };
    this.mainMenu.onCreate = (name, worldType, seed) => {
      this.server.createWorld(name, worldType, seed).then((meta) => {
        this.server.loadWorld(meta.id).then((cam) => {
          this.camera.x = cam.cameraX;
          this.camera.y = cam.cameraY;
          this.camera.zoom = cam.cameraZoom;
          this.server.updateVisibleChunks(this.camera.getVisibleChunkRange());
          this.mainMenu.hide();
        });
      });
    };
    this.mainMenu.onDelete = async (id) => {
      await this.server.deleteWorld(id);
      // Camera may have changed if current world was deleted
      const session = this.server.getLocalSession();
      this.camera.x = session.cameraX;
      this.camera.y = session.cameraY;
      this.camera.zoom = session.cameraZoom;
      this.server.updateVisibleChunks(this.camera.getVisibleChunkRange());
      // Refresh the menu
      const worlds = await this.server.listWorlds();
      this.mainMenu.show(worlds);
    };
    this.mainMenu.onRename = (id, name) => {
      this.server.renameWorld(id, name);
    };
    this.mainMenu.onClose = () => {
      this.mainMenu.hide();
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.server.flush();
      }
    });
    window.addEventListener("beforeunload", () => {
      this.server.flush();
    });

    this.loop.start();
    this.canvas.dataset.ready = "true";
  }

  destroy(): void {
    this.loop.stop();
    this.server.flush();
    this.editorMode.detach();
    this.touchJoystick.detach();
    this.input.detach();
  }

  // ---- Update ----

  private update(dt: number): void {
    // Skip game updates while menu is open
    if (this.mainMenu.visible) return;

    const session = this.server.getLocalSession();

    // Apply debug panel state
    if (!this.stateView.editorEnabled) {
      this.camera.zoom = this.debugPanel.zoom;
    }
    if (this.debugPanel.consumeBaseModeChange() || this.debugPanel.consumeConvexChange()) {
      this.server.invalidateAllChunks();
    }

    // Sync debug state to server
    session.debugPaused = this.debugPanel.paused;
    session.debugNoclip = this.debugPanel.noclip;

    // Editor mode: paint terrain or place entities
    if (this.stateView.editorEnabled) {
      this.editorPanel.setTemporaryUnpaint(this.editorMode.rightClickUnpaint);
      this.editorMode.selectedTerrain = this.editorPanel.selectedTerrain;
      this.editorMode.selectedRoadType = this.editorPanel.selectedRoadType;
      this.editorMode.brushMode = this.editorPanel.brushMode;
      this.editorMode.paintMode = this.editorPanel.effectivePaintMode;
      this.editorMode.editorTab = this.editorPanel.editorTab;
      this.editorMode.selectedEntityType = this.editorPanel.selectedEntityType;
      this.editorMode.selectedPropType = this.editorPanel.selectedPropType;
      this.editorMode.deleteMode = this.editorPanel.deleteMode;
      this.editorMode.selectedElevation = this.editorPanel.selectedElevation;
      this.editorMode.elevationGridSize = this.editorPanel.elevationGridSize;
      this.editorMode.entities = this.stateView
        .entities as import("../entities/Entity.js").Entity[];
      this.editorMode.props = this.stateView.props as import("../entities/Prop.js").Prop[];
      this.editorMode.update(dt);

      const paintMode = this.editorPanel.effectivePaintMode;
      const bridgeDepth = this.editorPanel.bridgeDepth;

      // Apply terrain edits (tile mode)
      for (const edit of this.editorMode.consumePendingEdits()) {
        this.transport.send({
          type: "edit-terrain-tile",
          tx: edit.tx,
          ty: edit.ty,
          terrainId: edit.terrainId,
          paintMode,
          bridgeDepth,
        });
      }

      // Apply subgrid edits
      const subgridShape =
        this.editorPanel.brushMode === "cross"
          ? ("cross" as const)
          : this.editorPanel.brushMode === "x"
            ? ("x" as const)
            : this.editorPanel.subgridShape;
      for (const edit of this.editorMode.consumePendingSubgridEdits()) {
        this.transport.send({
          type: "edit-terrain-subgrid",
          gsx: edit.gsx,
          gsy: edit.gsy,
          terrainId: edit.terrainId,
          paintMode,
          bridgeDepth,
          shape: subgridShape,
        });
      }

      // Apply corner edits
      for (const edit of this.editorMode.consumePendingCornerEdits()) {
        this.transport.send({
          type: "edit-terrain-corner",
          gsx: edit.gsx,
          gsy: edit.gsy,
          terrainId: edit.terrainId,
          paintMode,
          bridgeDepth,
        });
      }

      // Apply road edits
      for (const edit of this.editorMode.consumePendingRoadEdits()) {
        this.transport.send({
          type: "edit-road",
          tx: edit.tx,
          ty: edit.ty,
          roadType: edit.roadType,
          paintMode,
        });
      }

      // Apply elevation edits
      for (const edit of this.editorMode.consumePendingElevationEdits()) {
        this.transport.send({
          type: "edit-elevation",
          tx: edit.tx,
          ty: edit.ty,
          height: edit.height,
          gridSize: edit.gridSize,
        });
      }

      // Apply entity/prop spawns
      for (const spawn of this.editorMode.consumePendingEntitySpawns()) {
        this.transport.send({
          type: "edit-spawn",
          wx: spawn.wx,
          wy: spawn.wy,
          entityType: spawn.entityType,
        });
      }

      // Apply entity deletions
      for (const id of this.editorMode.consumePendingEntityDeletions()) {
        this.transport.send({ type: "edit-delete-entity", entityId: id });
      }

      // Apply prop deletions
      for (const id of this.editorMode.consumePendingPropDeletions()) {
        this.transport.send({ type: "edit-delete-prop", propId: id });
      }

      // Handle clear canvas
      const clearId = this.editorPanel.consumeClearRequest();
      if (clearId !== null) {
        this.transport.send({ type: "edit-clear-terrain", terrainId: clearId });
      }
      if (this.editorPanel.consumeRoadClearRequest()) {
        this.transport.send({ type: "edit-clear-roads" });
      }
    }

    // Player input → velocity (skip in editor — camera pans via drag)
    if (!this.stateView.editorEnabled) {
      const movement = this.input.getMovement();
      this.transport.send({
        type: "player-input",
        dx: movement.dx,
        dy: movement.dy,
        sprinting: movement.sprinting,
      });
    }

    // Set visible range for spawners (OLD range, before camera follow)
    session.visibleRange = this.camera.getVisibleChunkRange();

    // Drive the server tick synchronously
    this.server.tick(dt);

    // Camera follows player (only in play mode)
    if (!this.stateView.editorEnabled) {
      this.camera.follow(
        this.stateView.playerEntity.position.wx,
        this.stateView.playerEntity.position.wy,
        CAMERA_LERP,
      );
    }

    // Update camera position on server session (for save meta)
    session.cameraX = this.camera.x;
    session.cameraY = this.camera.y;
    session.cameraZoom = this.camera.zoom;

    // Update chunk loading based on camera position (NEW range, after follow)
    // Observer mode: load chunks as if zoom=1
    if (this.debugPanel.observer && this.camera.zoom !== 1) {
      const savedZoom = this.camera.zoom;
      this.camera.zoom = 1;
      this.server.updateVisibleChunks(this.camera.getVisibleChunkRange());
      this.camera.zoom = savedZoom;
    } else {
      this.server.updateVisibleChunks(this.camera.getVisibleChunkRange());
    }
  }

  // ---- Render ----

  private render(_alpha: number): void {
    this.ctx.imageSmoothingEnabled = false;

    // Clear
    this.ctx.fillStyle = "#1a1a2e";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.sheets.size === 0) return;

    const visible = this.camera.getVisibleChunkRange();
    // Terrain, autotile, and details are all baked into the chunk cache
    this.tileRenderer.drawTerrain(
      this.ctx,
      this.camera,
      this.stateView.world,
      this.sheets,
      visible,
    );

    // Elevation pass: cliff faces + Y-offset for elevated tiles
    this.tileRenderer.drawElevation(this.ctx, this.camera, this.stateView.world, visible);

    // Editor overlays (grid + cursor highlight + elevation tint)
    if (this.stateView.editorEnabled) {
      drawEditorOverlay(
        this.ctx,
        this.camera,
        this.editorMode,
        {
          brushMode: this.editorPanel.brushMode,
          effectivePaintMode: this.editorPanel.effectivePaintMode,
          subgridShape:
            this.editorPanel.brushMode === "cross"
              ? "cross"
              : this.editorPanel.brushMode === "x"
                ? "x"
                : this.editorPanel.subgridShape,
          brushSize: this.editorPanel.brushSize,
          editorTab: this.editorPanel.editorTab,
          elevationGridSize: this.editorPanel.elevationGridSize,
          bridgeDepth: this.editorPanel.bridgeDepth,
        },
        visible,
        this.stateView.world,
      );
    }

    // Draw entities + props Y-sorted on top of terrain (with elevation offset)
    const renderables: Renderable[] = [
      ...(this.stateView.entities.filter((e) => e.sprite) as Renderable[]),
      ...this.stateView.props,
    ];
    renderables.sort(
      (a, b) => a.position.wy + (a.sortOffsetY ?? 0) - (b.position.wy + (b.sortOffsetY ?? 0)),
    );
    drawEntities(this.ctx, this.camera, renderables, this.sheets, this.stateView.world);

    // Gem counter HUD (play mode only)
    if (!this.stateView.editorEnabled) {
      this.drawGemHUD();
    }

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
      const px = this.stateView.playerEntity.position.wx;
      const py = this.stateView.playerEntity.position.wy;
      const ptx = Math.floor(px / TILE_SIZE);
      const pty = Math.floor(py / TILE_SIZE);
      const terrain = this.stateView.world.getTerrainIfLoaded(ptx, pty);
      const collision = this.stateView.world.getCollision(ptx, pty);
      const collisionParts: string[] = [];
      if (collision === 0) collisionParts.push("None");
      if (collision & CollisionFlag.Solid) collisionParts.push("Solid");
      if (collision & CollisionFlag.Water) collisionParts.push("Water");
      if (collision & CollisionFlag.SlowWalk) collisionParts.push("SlowWalk");

      drawDebugOverlay(
        this.ctx,
        this.camera,
        this.stateView.entities as import("../entities/Entity.js").Entity[],
        this.stateView.props as import("../entities/Prop.js").Prop[],
        {
          fps: this.currentFps,
          entityCount: this.stateView.entities.length,
          chunkCount: this.stateView.world.chunks.loadedCount,
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
    if (!this.stateView.editorEnabled) {
      this.touchJoystick.draw(this.ctx);
    }
  }

  // ---- UI ----

  private onKeyDown(e: KeyboardEvent): void {
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
    if ((e.key === "m" || e.key === "M") && this.stateView.editorEnabled) {
      e.preventDefault();
      this.editorPanel.toggleMode();
    }
    if ((e.key === "b" || e.key === "B") && this.stateView.editorEnabled) {
      e.preventDefault();
      this.editorPanel.cycleBridgeDepth();
    }
    if ((e.key === "s" || e.key === "S") && this.stateView.editorEnabled) {
      e.preventDefault();
      this.editorPanel.cycleBrushShape();
    }
    if (e.key === "z" && this.stateView.editorEnabled) {
      e.preventDefault();
      this.editorPanel.setPaintMode("positive");
    }
    if (e.key === "c" && this.stateView.editorEnabled) {
      e.preventDefault();
      this.editorPanel.setPaintMode("unpaint");
    }
    if ((e.key === "t" || e.key === "T") && this.stateView.editorEnabled) {
      e.preventDefault();
      this.editorPanel.toggleTab();
    }
    if ((e.key === "d" || e.key === "D") && this.debugEnabled) {
      e.preventDefault();
      this.debugPanel.toggleBaseMode();
    }
  }

  private toggleEditor(): void {
    const session = this.server.getLocalSession();
    session.editorEnabled = !session.editorEnabled;
    this.editorPanel.visible = session.editorEnabled;
    this.transport.send({
      type: "set-editor-mode",
      enabled: session.editorEnabled,
    });
    if (this.editorButton) {
      this.editorButton.textContent = session.editorEnabled ? "Play" : "Edit";
    }
    if (session.editorEnabled) {
      this.touchJoystick.detach();
      this.editorMode.attach();
    } else {
      this.editorMode.detach();
      this.touchJoystick.attach();
    }
  }

  private async toggleMenu(): Promise<void> {
    if (this.mainMenu.visible) {
      this.mainMenu.hide();
    } else {
      this.server.flush();
      const worlds = await this.server.listWorlds();
      this.mainMenu.show(worlds);
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

  /** Handle click in play mode (desktop). */
  private onPlayClick(e: MouseEvent): void {
    if (this.stateView.editorEnabled || this.mainMenu.visible) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    const world = this.camera.screenToWorld(sx, sy);
    this.transport.send({
      type: "player-interact",
      wx: world.wx,
      wy: world.wy,
    });
  }

  /** Handle tap in play mode (mobile). */
  private onPlayTap(clientX: number, clientY: number): void {
    if (this.stateView.editorEnabled || this.mainMenu.visible) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = (clientX - rect.left) * (this.canvas.width / rect.width);
    const sy = (clientY - rect.top) * (this.canvas.height / rect.height);
    const world = this.camera.screenToWorld(sx, sy);
    this.transport.send({
      type: "player-interact",
      wx: world.wx,
      wy: world.wy,
    });
  }

  private drawGemHUD(): void {
    if (!this.gemSpriteCanvas) return;
    const ctx = this.ctx;
    const ICON_SIZE = 24;
    const PADDING = 12;
    const x = this.canvas.width - PADDING - ICON_SIZE - 48;
    const y = PADDING;

    // Gem icon (first frame)
    ctx.drawImage(this.gemSpriteCanvas, 0, 0, 16, 16, x, y, ICON_SIZE, ICON_SIZE);

    // Count text
    ctx.save();
    ctx.font = "bold 20px monospace";
    ctx.textBaseline = "top";
    const text = `${this.stateView.gemsCollected}`;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeText(text, x + ICON_SIZE + 6, y + 2);
    ctx.fillStyle = "#FFD700";
    ctx.fillText(text, x + ICON_SIZE + 6, y + 2);

    // Buddy count
    let buddyCount = 0;
    for (const e of this.stateView.entities) {
      if (e.wanderAI?.following) buddyCount++;
    }
    if (buddyCount > 0) {
      const bx = x - 60;
      ctx.strokeStyle = "#000";
      ctx.strokeText(`\u2764 ${buddyCount}`, bx, y + 2);
      ctx.fillStyle = "#ff88aa";
      ctx.fillText(`\u2764 ${buddyCount}`, bx, y + 2);
    }
    ctx.restore();
  }
}
