import { loadAtlasIndex } from "../assets/AtlasIndex.js";
import { loadGameAssets } from "../assets/GameAssets.js";
import { generateGemSprite } from "../assets/GemSpriteGenerator.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { ConsoleEngine } from "../console/ConsoleEngine.js";
import { ConsoleUI } from "../console/ConsoleUI.js";
import { registerClientCommands } from "../console/clientCommands.js";
import { registerClientCVars } from "../console/clientCVars.js";
import { registerServerCommandStubs } from "../console/serverCommandStubs.js";
import { GameLoop } from "../core/GameLoop.js";
import type { GameContext } from "../core/GameScene.js";
import { SceneManager } from "../core/SceneManager.js";
import { Time } from "../core/Time.js";
import { EditorMode } from "../editor/EditorMode.js";
import { EditorPanel } from "../editor/EditorPanel.js";
import { PropCatalog } from "../editor/PropCatalog.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { ActionManager } from "../input/ActionManager.js";
import { TouchJoystick } from "../input/TouchJoystick.js";
import type { WorldMeta } from "../persistence/WorldRegistry.js";
import { Camera } from "../rendering/Camera.js";
import { DebugPanel } from "../rendering/DebugPanel.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { CatalogScene } from "../scenes/CatalogScene.js";
import { EditScene } from "../scenes/EditScene.js";
import { MenuScene } from "../scenes/MenuScene.js";
import { PlayScene } from "../scenes/PlayScene.js";
import type { GameServer } from "../server/GameServer.js";
import type { ClientMessage, RealmInfo, ServerMessage } from "../shared/protocol.js";
import type { IClientTransport } from "../transport/Transport.js";
import { MainMenu } from "../ui/MainMenu.js";
import { World } from "../world/World.js";
import { type ClientStateView, LocalStateView, RemoteStateView } from "./ClientStateView.js";

export interface GameClientOptions {
  mode?: "local" | "serialized";
  profile?: { id: string; name: string };
  profileStore?: {
    listProfiles(): Promise<{ id: string; name: string; pin: string | null; createdAt: number }[]>;
  };
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
  private debugPanel: DebugPanel;
  private editorMode: EditorMode;
  private editorPanel: EditorPanel;
  private mainMenu: MainMenu;
  private propCatalog: PropCatalog;
  private stateView: ClientStateView;
  private remoteView: RemoteStateView | null = null;
  private transport: IClientTransport;
  private server: GameServer | null;
  private serialized: boolean;
  private scenes: SceneManager;
  private time: Time;
  private consoleEngine: ConsoleEngine;
  private consoleUI: ConsoleUI;

  // Mutable state exposed via GameContext
  private editorButton: HTMLButtonElement | null = null;
  private gemSpriteCanvas: HTMLCanvasElement | null = null;
  private debugEnabled = false;

  /** Request/response correlation for serialized mode. */
  private nextRequestId = 1;
  // biome-ignore lint/suspicious/noExplicitAny: generic request/response map
  private pendingRequests = new Map<number, { resolve: (value: any) => void }>();

  /** Realm list received while in lobby (multiplayer connect flow). */
  private lobbyRealmList: RealmInfo[] | null = null;
  /** True once init() has completed and we're ready to show UI. */
  private initDone = false;
  /** Player profile (display name, id). */
  private profile: { id: string; name: string } | null = null;

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
    this.profile = options?.profile ?? null;
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
    this.editorPanel.onOpenCatalog = () => this.scenes.push(new CatalogScene());
    this.propCatalog.onSelect = (propType: string) => {
      this.editorPanel.selectedPropType = propType;
      this.editorPanel.setTab("props");
      if (this.scenes.has(CatalogScene)) this.scenes.pop();
    };

    this.scenes = new SceneManager();
    this.time = new Time();
    this.consoleEngine = new ConsoleEngine();
    this.consoleEngine.rconSend = async (command: string) => {
      const resp = await this.gcSendRequest<{ output: string[]; error?: boolean }>({
        type: "rcon",
        requestId: this.nextRequestId++,
        command,
      });
      return resp.output;
    };
    this.consoleUI = new ConsoleUI(this.consoleEngine);

    if (this.serialized) {
      // Client-side world with no generator (chunks populated from server messages)
      const clientWorld = new World(new FlatStrategy());
      const remoteView = new RemoteStateView(clientWorld);
      this.stateView = remoteView;
      this.remoteView = remoteView;

      // Route server messages to RemoteStateView
      this.transport.onMessage((msg: ServerMessage) => {
        // Domain-specific handlers first — buffer game-state for deferred
        // application during client update tick (prevents async entity
        // position changes that desync camera and entity interpolation)
        if (msg.type === "game-state") {
          remoteView.bufferGameState(msg);
        } else if (msg.type === "world-loaded" || msg.type === "realm-joined") {
          console.log(
            `[tilefun:client] ${msg.type} — camera=(${msg.cameraX.toFixed(1)}, ${msg.cameraY.toFixed(1)}), predictor=${!!remoteView["_predictor"]?.player}, editorEnabled=${remoteView.editorEnabled}`,
          );
          remoteView.clear();
          this.camera.x = msg.cameraX;
          this.camera.y = msg.cameraY;
          this.camera.zoom = msg.cameraZoom;
          this.gcSendVisibleRange();
          this.lobbyRealmList = null;
        } else if (msg.type === "realm-list") {
          if (this.initDone) {
            // Show realm browser immediately
            if (!this.scenes.has(MenuScene)) {
              this.scenes.push(new MenuScene(msg.realms));
            } else {
              this.mainMenu.show(msg.realms);
            }
          } else {
            // Buffer for after init completes
            this.lobbyRealmList = msg.realms;
          }
        } else if (msg.type === "realm-left") {
          remoteView.clear();
        } else if (msg.type === "realm-player-count") {
          this.mainMenu.updatePlayerCount(msg.worldId, msg.count);
        } else if (msg.type === "kicked") {
          console.warn(`[tilefun] Kicked: ${msg.reason}`);
          this.destroy();
          const overlay = document.createElement("div");
          overlay.style.cssText =
            "position:fixed;inset:0;background:rgba(0,0,0,0.85);color:#fff;display:flex;align-items:center;justify-content:center;font:bold 24px sans-serif;z-index:9999;text-align:center;padding:2em;";
          overlay.textContent = `Disconnected: ${msg.reason}`;
          document.body.appendChild(overlay);
          return;
        } else if (msg.type === "player-assigned") {
          console.log(`[tilefun] Player entity assigned: ${msg.entityId}`);
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

      // Send profile identity to server
      if (this.profile) {
        this.transport.send({ type: "identify", displayName: this.profile.name });
      }
    } else {
      if (!server) throw new Error("Local mode requires a GameServer instance");
      this.stateView = new LocalStateView(server);
    }

    this.loop = new GameLoop({
      update: (dt) => {
        this.time.elapsed += dt;
        // Apply buffered server state at the start of each client tick so
        // entity position changes are synchronized with camera.savePrev/follow.
        this.remoteView?.applyPending();
        this.scenes.update(dt);
      },
      render: (alpha) => {
        this.time.alpha = alpha;
        this.scenes.render(alpha);
      },
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

    // Build GameContext and wire it into the scene manager
    const gc = this.buildGameContext();
    this.scenes.setContext(gc);

    // Register console cvars and commands
    const clientCVars = registerClientCVars(this.consoleEngine);
    registerClientCommands(this.consoleEngine, gc);
    registerServerCommandStubs(this.consoleEngine);

    // Wire r_pixelscale cvar to camera zoom
    clientCVars.r_pixelscale.onChange((val) => {
      this.camera.zoom = val;
    });

    // Start in play mode
    this.scenes.push(new PlayScene());

    // Load all assets — BlendGraph is deterministic, construct locally
    const blendGraph = this.serialized ? new BlendGraph() : this.localServer.blendGraph;
    const [assets] = await Promise.all([loadGameAssets(blendGraph), loadAtlasIndex()]);
    this.sheets = assets.sheets;
    this.tileRenderer.setBlendSheets(assets.blendSheets, blendGraph);
    this.tileRenderer.setRoadSheets(this.sheets);
    this.tileRenderer.setVariants(assets.variants);
    this.editorPanel.setAssets(assets.sheets, assets.blendSheets, blendGraph);
    const meComplete = assets.sheets.get("me-complete");
    if (meComplete) this.propCatalog.setImage(meComplete.image);
    this.propCatalog.populateAtlas();

    // Generate procedural gem sprite and add to sheets
    this.gemSpriteCanvas = generateGemSprite();
    this.sheets.set("gem", new Spritesheet(this.gemSpriteCanvas, 16, 16));

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
        // realm-joined handler applies camera + clears state + sends visible range
        this.gcSendRequest({
          type: "join-realm",
          requestId: this.nextRequestId++,
          worldId: id,
        }).then(() => {
          if (this.scenes.has(MenuScene)) this.scenes.pop();
        });
      } else {
        this.localServer.loadWorld(id).then((cam) => {
          this.camera.x = cam.cameraX;
          this.camera.y = cam.cameraY;
          this.camera.zoom = cam.cameraZoom;
          this.localServer.updateVisibleChunks(this.camera.getVisibleChunkRange());
          if (this.scenes.has(MenuScene)) this.scenes.pop();
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
        this.gcSendRequest<{ meta: { id: string } }>(msg)
          .then((resp) => {
            return this.gcSendRequest({
              type: "join-realm",
              requestId: this.nextRequestId++,
              worldId: resp.meta.id,
            });
          })
          .then(() => {
            if (this.scenes.has(MenuScene)) this.scenes.pop();
          });
      } else {
        this.localServer.createWorld(name, worldType, seed).then((meta) => {
          this.localServer.loadWorld(meta.id).then((cam) => {
            this.camera.x = cam.cameraX;
            this.camera.y = cam.cameraY;
            this.camera.zoom = cam.cameraZoom;
            this.localServer.updateVisibleChunks(this.camera.getVisibleChunkRange());
            if (this.scenes.has(MenuScene)) this.scenes.pop();
          });
        });
      }
    };
    this.mainMenu.onDelete = async (id) => {
      if (this.serialized) {
        await this.gcSendRequest({
          type: "delete-world",
          requestId: this.nextRequestId++,
          worldId: id,
        });
        const resp = await this.gcSendRequest<{ realms: RealmInfo[] }>({
          type: "list-realms",
          requestId: this.nextRequestId++,
        });
        this.mainMenu.show(resp.realms);
      } else {
        await this.localServer.deleteWorld(id);
        const worlds = await this.localServer.listWorlds();
        this.mainMenu.show(GameClient.toRealmInfoList(worlds));
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
      if (this.scenes.has(MenuScene)) this.scenes.pop();
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.gcFlushServer();
      }
    });
    window.addEventListener("beforeunload", () => {
      this.gcFlushServer();
    });

    this.initDone = true;

    // If we received a realm-list while connecting (multiplayer lobby), show it now
    if (this.lobbyRealmList) {
      this.scenes.push(new MenuScene(this.lobbyRealmList));
      this.lobbyRealmList = null;
    }

    this.loop.start();
    this.canvas.dataset.ready = "true";
  }

  destroy(): void {
    this.loop.stop();
    this.gcFlushServer();
    this.scenes.clear();
    this.actions.detach();
    this.consoleUI.destroy();
  }

  // ---- Actions ----

  private bindActions(): void {
    this.actions.on("toggle_menu", () => {
      if (this.scenes.has(CatalogScene)) {
        this.scenes.pop();
        return;
      }
      if (this.scenes.has(MenuScene)) {
        this.scenes.pop();
      } else {
        this.toggleMenu();
      }
    });
    this.actions.on("toggle_debug", () => {
      if (this.scenes.has(MenuScene) || this.scenes.has(CatalogScene)) return;
      this.debugEnabled = !this.debugEnabled;
      this.debugPanel.visible = this.debugEnabled;
    });
    this.actions.on("toggle_editor", () => {
      if (this.scenes.has(MenuScene) || this.scenes.has(CatalogScene)) return;
      this.toggleEditor();
    });
    this.actions.on("toggle_console", () => {
      this.consoleUI.toggle();
    });
    this.actions.on("toggle_base_mode", () => {
      if (this.scenes.has(MenuScene) || this.scenes.has(CatalogScene)) return;
      if (this.debugEnabled) this.debugPanel.toggleBaseMode();
    });
  }

  private toggleEditor(): void {
    if (this.scenes.current instanceof EditScene) {
      this.scenes.replace(new PlayScene());
    } else {
      this.scenes.replace(new EditScene());
    }
  }

  private async toggleMenu(): Promise<void> {
    this.gcFlushServer();
    if (this.serialized) {
      const resp = await this.gcSendRequest<{ realms: RealmInfo[] }>({
        type: "list-realms",
        requestId: this.nextRequestId++,
      });
      this.scenes.push(new MenuScene(resp.realms));
    } else {
      const worlds = await this.localServer.listWorlds();
      this.scenes.push(new MenuScene(GameClient.toRealmInfoList(worlds)));
    }
  }

  // ---- Helpers (also exposed via GameContext) ----

  /** Send a request and return a promise resolved when the server responds with matching requestId. */
  private gcSendRequest<T>(msg: ClientMessage & { requestId: number }): Promise<T> {
    return new Promise((resolve) => {
      this.pendingRequests.set(msg.requestId, { resolve });
      this.transport.send(msg);
    });
  }

  /** Convert WorldMeta[] to RealmInfo[] (local mode — no player counts). */
  private static toRealmInfoList(worlds: WorldMeta[]): RealmInfo[] {
    return worlds.map((w): RealmInfo => {
      const info: RealmInfo = {
        id: w.id,
        name: w.name,
        playerCount: 0,
        createdAt: w.createdAt,
        lastPlayedAt: w.lastPlayedAt,
      };
      if (w.worldType) info.worldType = w.worldType;
      return info;
    });
  }

  private gcFlushServer(): void {
    if (this.serialized) {
      this.transport.send({ type: "flush" });
    } else {
      this.localServer.flush();
    }
  }

  /** Send current visible chunk range to server (serialized mode). */
  private gcSendVisibleRange(): void {
    const range = this.camera.getVisibleChunkRange();
    this.transport.send({
      type: "visible-range",
      minCx: range.minCx,
      minCy: range.minCy,
      maxCx: range.maxCx,
      maxCy: range.maxCy,
    });
  }

  // ---- GameContext construction ----

  private buildGameContext(): GameContext {
    // Use a proxy-like object so mutable fields (debugEnabled, gemSpriteCanvas, editorButton)
    // always reflect the latest value from GameClient.
    const client = this;
    return {
      canvas: this.canvas,
      ctx: this.ctx,
      camera: this.camera,
      actions: this.actions,
      stateView: this.stateView,
      transport: this.transport,
      get sheets() {
        return client.sheets;
      },
      tileRenderer: this.tileRenderer,
      editorMode: this.editorMode,
      editorPanel: this.editorPanel,
      mainMenu: this.mainMenu,
      propCatalog: this.propCatalog,
      debugPanel: this.debugPanel,
      touchJoystick: this.touchJoystick,
      console: this.consoleEngine,
      consoleUI: this.consoleUI,
      server: this.server,
      serialized: this.serialized,
      scenes: this.scenes,
      time: this.time,
      get gemSpriteCanvas() {
        return client.gemSpriteCanvas;
      },
      set gemSpriteCanvas(v) {
        client.gemSpriteCanvas = v;
      },
      get debugEnabled() {
        return client.debugEnabled;
      },
      set debugEnabled(v) {
        client.debugEnabled = v;
      },
      get editorButton() {
        return client.editorButton;
      },
      set editorButton(v) {
        client.editorButton = v;
      },
      flushServer: () => this.gcFlushServer(),
      sendRequest: <T>(msg: ClientMessage & { requestId: number }) => this.gcSendRequest<T>(msg),
      sendVisibleRange: () => this.gcSendVisibleRange(),
    };
  }

  // ---- UI ----

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
    if (!(this.scenes.current instanceof PlayScene)) return;
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
    if (!(this.scenes.current instanceof PlayScene)) return;
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
}
