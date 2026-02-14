import { loadGameAssets } from "../assets/GameAssets.js";
import { generateGemSprite } from "../assets/GemSpriteGenerator.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { CAMERA_LERP, TILE_SIZE } from "../config/constants.js";
import { GameLoop } from "../core/GameLoop.js";
import { EditorMode } from "../editor/EditorMode.js";
import { EditorPanel } from "../editor/EditorPanel.js";
import { drawEditorOverlay } from "../editor/EditorRenderer.js";
import { PropCatalog } from "../editor/PropCatalog.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { ActionManager } from "../input/ActionManager.js";
import { TouchJoystick } from "../input/TouchJoystick.js";
import type { WorldMeta } from "../persistence/WorldRegistry.js";
import { Camera } from "../rendering/Camera.js";
import { DebugPanel } from "../rendering/DebugPanel.js";
import { drawDebugOverlay } from "../rendering/DebugRenderer.js";
import { drawEntities } from "../rendering/EntityRenderer.js";
import type { Renderable } from "../rendering/Renderable.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import type { GameServer } from "../server/GameServer.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IClientTransport } from "../transport/Transport.js";
import { MainMenu } from "../ui/MainMenu.js";
import { CollisionFlag, TileId } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import { type ClientStateView, LocalStateView, RemoteStateView } from "./ClientStateView.js";

export interface GameClientOptions {
  mode?: "local" | "serialized";
}

export class GameClient {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private loop: GameLoop;
  private sheets = new Map<string, Spritesheet>();
  private tileRenderer: TileRenderer;
  private actions: ActionManager;
  private touchJoystick: TouchJoystick;
  private debugEnabled = false;
  private debugPanel: DebugPanel;
  private editorMode: EditorMode;
  private editorPanel: EditorPanel;
  private mainMenu: MainMenu;
  private propCatalog: PropCatalog;
  private editorButton: HTMLButtonElement | null = null;
  private gemSpriteCanvas: HTMLCanvasElement | null = null;
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFps = 0;
  private stateView: ClientStateView;
  private transport: IClientTransport;
  private server: GameServer | null;
  private serialized: boolean;
  /** Client-side editor enabled tracking for serialized mode. */
  private clientEditorEnabled = true;
  /** Request/response correlation for serialized mode. */
  private nextRequestId = 1;
  // biome-ignore lint/suspicious/noExplicitAny: generic request/response map
  private pendingRequests = new Map<number, { resolve: (value: any) => void }>();

  /** Access the server instance (local mode only). Throws if null (serialized mode). */
  private get localServer(): GameServer {
    if (!this.server) throw new Error("No direct server in serialized mode");
    return this.server;
  }

  constructor(
    canvas: HTMLCanvasElement,
    transport: IClientTransport,
    server: GameServer | null,
    options?: GameClientOptions,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    this.canvas = canvas;
    this.ctx = ctx;
    this.transport = transport;
    this.server = server;
    this.serialized = options?.mode === "serialized";
    this.camera = new Camera();
    this.tileRenderer = new TileRenderer();
    this.actions = new ActionManager();
    this.touchJoystick = new TouchJoystick(canvas);
    this.actions.setTouchJoystick(this.touchJoystick);
    this.debugPanel = new DebugPanel();
    this.editorMode = new EditorMode(canvas, this.camera, this.actions);
    this.editorPanel = new EditorPanel();
    this.editorPanel.onCollapse = () => this.toggleEditor();
    this.mainMenu = new MainMenu();
    this.propCatalog = new PropCatalog();
    this.editorPanel.onOpenCatalog = () => this.propCatalog.show();
    this.propCatalog.onSelect = (propType: string) => {
      this.editorPanel.selectedPropType = propType;
      this.editorPanel.setTab("props");
    };

    if (this.serialized) {
      // Client-side world with no generator (chunks populated from server messages)
      const clientWorld = new World(new FlatStrategy());
      const remoteView = new RemoteStateView(clientWorld);
      this.stateView = remoteView;

      // Route server messages to RemoteStateView
      this.transport.onMessage((msg: ServerMessage) => {
        // Domain-specific handlers first
        if (msg.type === "game-state") {
          remoteView.applyGameState(msg);
        } else if (msg.type === "world-loaded") {
          remoteView.clear();
          this.camera.x = msg.cameraX;
          this.camera.y = msg.cameraY;
          this.camera.zoom = msg.cameraZoom;
          this.sendVisibleRange();
        }

        // Resolve pending request/response promises
        if ("requestId" in msg && msg.requestId !== undefined) {
          const pending = this.pendingRequests.get(msg.requestId);
          if (pending) {
            this.pendingRequests.delete(msg.requestId);
            pending.resolve(msg);
          }
        }
      });
    } else {
      if (!server) throw new Error("Local mode requires a GameServer instance");
      this.stateView = new LocalStateView(server);
    }

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
    });
  }

  async init(): Promise<void> {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    // Prevent buttons/selects from stealing keyboard focus — keeps all keys routed to the game.
    // Text inputs (e.g. MainMenu world name/seed) are excluded so they remain typeable.
    document.addEventListener("mousedown", (e) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "BUTTON" || tag === "SELECT") {
        e.preventDefault();
      }
    });
    this.createEditorButton();
    this.canvas.addEventListener("click", (e) => this.onPlayClick(e));
    this.touchJoystick.onTap = (clientX, clientY) => this.onPlayTap(clientX, clientY);
    this.actions.attach();
    this.bindActions();
    // Start in editor mode — attach editor, not joystick
    this.editorMode.attach();
    this.editorPanel.visible = true;

    // Load all assets — BlendGraph is deterministic, construct locally
    const blendGraph = this.serialized ? new BlendGraph() : this.localServer.blendGraph;
    const assets = await loadGameAssets(blendGraph);
    this.sheets = assets.sheets;
    this.tileRenderer.setBlendSheets(assets.blendSheets, blendGraph);
    this.tileRenderer.setRoadSheets(this.sheets);
    this.tileRenderer.setVariants(assets.variants);
    this.editorPanel.setAssets(assets.sheets, assets.blendSheets, blendGraph);
    const meComplete = assets.sheets.get("me-complete");
    if (meComplete) this.propCatalog.setImage(meComplete.image);

    // Generate procedural gem sprite and add to sheets
    this.gemSpriteCanvas = generateGemSprite();
    this.sheets.set(
      "gem",
      new Spritesheet(this.gemSpriteCanvas as unknown as HTMLImageElement, 16, 16),
    );

    if (!this.serialized) {
      // Apply loaded world camera position (local mode — direct access)
      const session = this.localServer.getLocalSession();
      this.camera.x = session.cameraX;
      this.camera.y = session.cameraY;
      this.camera.zoom = session.cameraZoom;

      // Initial chunk loading
      this.localServer.updateVisibleChunks(this.camera.getVisibleChunkRange());
    }
    // Serialized mode: camera was already set by "world-loaded" message
    // sent during onConnect (fires before init() runs)

    // Set up menu callbacks
    this.mainMenu.onSelect = (id) => {
      if (this.serialized) {
        // world-loaded handler applies camera + clears state + sends visible range
        this.sendRequest({ type: "load-world", requestId: this.nextRequestId++, worldId: id }).then(
          () => this.mainMenu.hide(),
        );
      } else {
        this.localServer.loadWorld(id).then((cam) => {
          this.camera.x = cam.cameraX;
          this.camera.y = cam.cameraY;
          this.camera.zoom = cam.cameraZoom;
          this.localServer.updateVisibleChunks(this.camera.getVisibleChunkRange());
          this.mainMenu.hide();
        });
      }
    };
    this.mainMenu.onCreate = (name, worldType, seed) => {
      if (this.serialized) {
        const msg: ClientMessage & { requestId: number } = {
          type: "create-world",
          requestId: this.nextRequestId++,
          name,
        };
        if (worldType !== undefined) msg.worldType = worldType;
        if (seed !== undefined) msg.seed = seed;
        this.sendRequest<{ meta: { id: string } }>(msg)
          .then((resp) => {
            return this.sendRequest({
              type: "load-world",
              requestId: this.nextRequestId++,
              worldId: resp.meta.id,
            });
          })
          .then(() => this.mainMenu.hide());
      } else {
        this.localServer.createWorld(name, worldType, seed).then((meta) => {
          this.localServer.loadWorld(meta.id).then((cam) => {
            this.camera.x = cam.cameraX;
            this.camera.y = cam.cameraY;
            this.camera.zoom = cam.cameraZoom;
            this.localServer.updateVisibleChunks(this.camera.getVisibleChunkRange());
            this.mainMenu.hide();
          });
        });
      }
    };
    this.mainMenu.onDelete = async (id) => {
      if (this.serialized) {
        await this.sendRequest({
          type: "delete-world",
          requestId: this.nextRequestId++,
          worldId: id,
        });
        const resp = await this.sendRequest<{ worlds: WorldMeta[] }>({
          type: "list-worlds",
          requestId: this.nextRequestId++,
        });
        this.mainMenu.show(resp.worlds);
      } else {
        await this.localServer.deleteWorld(id);
        const worlds = await this.localServer.listWorlds();
        this.mainMenu.show(worlds);
      }
    };
    this.mainMenu.onRename = (id, name) => {
      if (this.serialized) {
        this.transport.send({
          type: "rename-world",
          requestId: this.nextRequestId++,
          worldId: id,
          name,
        });
      } else {
        this.localServer.renameWorld(id, name);
      }
    };
    this.mainMenu.onClose = () => {
      this.mainMenu.hide();
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.flushServer();
      }
    });
    window.addEventListener("beforeunload", () => {
      this.flushServer();
    });

    this.loop.start();
    this.canvas.dataset.ready = "true";
  }

  destroy(): void {
    this.loop.stop();
    this.flushServer();
    this.editorMode.detach();
    this.touchJoystick.detach();
    this.actions.detach();
  }

  // ---- Update ----

  private update(dt: number): void {
    // Skip game updates while menu or catalog is open
    if (this.mainMenu.visible || this.propCatalog.visible) return;

    const editorEnabled = this.serialized ? this.clientEditorEnabled : this.stateView.editorEnabled;

    // Apply debug panel state
    if (!editorEnabled) {
      this.camera.zoom = this.debugPanel.zoom;
    }
    if (this.debugPanel.consumeBaseModeChange() || this.debugPanel.consumeConvexChange()) {
      if (this.serialized) {
        this.transport.send({ type: "invalidate-all-chunks" });
      } else {
        this.localServer.invalidateAllChunks();
      }
    }

    if (this.serialized) {
      // Send debug state via transport
      this.transport.send({
        type: "set-debug",
        paused: this.debugPanel.paused,
        noclip: this.debugPanel.noclip,
      });
    } else {
      // Sync debug state directly to session
      const session = this.localServer.getLocalSession();
      session.debugPaused = this.debugPanel.paused;
      session.debugNoclip = this.debugPanel.noclip;
    }

    // Editor mode: paint terrain or place entities
    if (editorEnabled) {
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
    if (!editorEnabled) {
      const movement = this.actions.getMovement();
      this.transport.send({
        type: "player-input",
        dx: movement.dx,
        dy: movement.dy,
        sprinting: movement.sprinting,
      });
    }

    if (this.serialized) {
      // Serialized mode: server ticks independently, just send visible range
      // Camera follows player (only in play mode)
      if (!editorEnabled) {
        this.camera.follow(
          this.stateView.playerEntity.position.wx,
          this.stateView.playerEntity.position.wy,
          CAMERA_LERP,
        );
      }
      // Observer mode: only load chunks at 1x zoom even when zoomed out
      if (this.debugPanel.observer && this.camera.zoom !== 1) {
        const savedZoom = this.camera.zoom;
        this.camera.zoom = 1;
        this.sendVisibleRange();
        this.camera.zoom = savedZoom;
      } else {
        this.sendVisibleRange();
      }
    } else {
      // Local mode: drive the server tick synchronously
      const session = this.localServer.getLocalSession();
      session.visibleRange = this.camera.getVisibleChunkRange();
      this.localServer.tick(dt);

      // Camera follows player (only in play mode)
      if (!editorEnabled) {
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
      if (this.debugPanel.observer && this.camera.zoom !== 1) {
        const savedZoom = this.camera.zoom;
        this.camera.zoom = 1;
        this.localServer.updateVisibleChunks(this.camera.getVisibleChunkRange());
        this.camera.zoom = savedZoom;
      } else {
        this.localServer.updateVisibleChunks(this.camera.getVisibleChunkRange());
      }
    }
  }

  // ---- Render ----

  private render(_alpha: number): void {
    this.ctx.imageSmoothingEnabled = false;

    // Clear
    this.ctx.fillStyle = "#1a1a2e";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.sheets.size === 0) return;

    const editorEnabled = this.serialized ? this.clientEditorEnabled : this.stateView.editorEnabled;

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
    if (editorEnabled) {
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
    if (!editorEnabled) {
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
    if (!editorEnabled) {
      this.touchJoystick.draw(this.ctx);
    }
  }

  // ---- UI ----

  private isEditorActive(): boolean {
    return this.serialized ? this.clientEditorEnabled : this.stateView.editorEnabled;
  }

  private bindActions(): void {
    this.actions.on("toggle_menu", () => {
      if (this.propCatalog.visible) {
        this.propCatalog.hide();
        return;
      }
      this.toggleMenu();
    });
    this.actions.on("toggle_debug", () => {
      if (this.mainMenu.visible || this.propCatalog.visible) return;
      this.debugEnabled = !this.debugEnabled;
      this.debugPanel.visible = this.debugEnabled;
    });
    this.actions.on("toggle_editor", () => {
      if (this.mainMenu.visible || this.propCatalog.visible) return;
      this.toggleEditor();
    });
    this.actions.on("toggle_paint_mode", () => {
      if (this.mainMenu.visible || this.propCatalog.visible) return;
      if (this.isEditorActive()) this.editorPanel.toggleMode();
    });
    this.actions.on("cycle_bridge_depth", () => {
      if (this.mainMenu.visible || this.propCatalog.visible) return;
      if (this.isEditorActive()) this.editorPanel.cycleBridgeDepth();
    });
    this.actions.on("cycle_brush_shape", () => {
      if (this.mainMenu.visible || this.propCatalog.visible) return;
      if (this.isEditorActive()) this.editorPanel.cycleBrushShape();
    });
    this.actions.on("paint_positive", () => {
      if (this.mainMenu.visible || this.propCatalog.visible) return;
      if (this.isEditorActive()) this.editorPanel.setPaintMode("positive");
    });
    this.actions.on("paint_unpaint", () => {
      if (this.mainMenu.visible || this.propCatalog.visible) return;
      if (this.isEditorActive()) this.editorPanel.setPaintMode("unpaint");
    });
    this.actions.on("toggle_tab", () => {
      if (this.mainMenu.visible || this.propCatalog.visible) return;
      if (this.isEditorActive()) this.editorPanel.toggleTab();
    });
    this.actions.on("toggle_base_mode", () => {
      if (this.mainMenu.visible || this.propCatalog.visible) return;
      if (this.debugEnabled) this.debugPanel.toggleBaseMode();
    });
  }

  private toggleEditor(): void {
    if (this.serialized) {
      // Track editor state locally for immediate UI response
      this.clientEditorEnabled = !this.clientEditorEnabled;
      this.editorPanel.visible = this.clientEditorEnabled;
      this.transport.send({
        type: "set-editor-mode",
        enabled: this.clientEditorEnabled,
      });
      if (this.editorButton) {
        this.editorButton.textContent = this.clientEditorEnabled ? "Play" : "Edit";
      }
      if (this.clientEditorEnabled) {
        this.touchJoystick.detach();
        this.editorMode.attach();
      } else {
        this.editorMode.detach();
        this.touchJoystick.attach();
      }
    } else {
      const session = this.localServer.getLocalSession();
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
  }

  private async toggleMenu(): Promise<void> {
    if (this.mainMenu.visible) {
      this.mainMenu.hide();
    } else {
      this.flushServer();
      if (this.serialized) {
        const resp = await this.sendRequest<{ worlds: WorldMeta[] }>({
          type: "list-worlds",
          requestId: this.nextRequestId++,
        });
        this.mainMenu.show(resp.worlds);
      } else {
        const worlds = await this.localServer.listWorlds();
        this.mainMenu.show(worlds);
      }
    }
  }

  /** Send a request and return a promise resolved when the server responds with matching requestId. */
  private sendRequest<T>(msg: ClientMessage & { requestId: number }): Promise<T> {
    return new Promise((resolve) => {
      this.pendingRequests.set(msg.requestId, { resolve });
      this.transport.send(msg);
    });
  }

  private flushServer(): void {
    if (this.serialized) {
      this.transport.send({ type: "flush" });
    } else {
      this.localServer.flush();
    }
  }

  /** Send current visible chunk range to server (serialized mode). */
  private sendVisibleRange(): void {
    const range = this.camera.getVisibleChunkRange();
    this.transport.send({
      type: "visible-range",
      minCx: range.minCx,
      minCy: range.minCy,
      maxCx: range.maxCx,
      maxCy: range.maxCy,
    });
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
