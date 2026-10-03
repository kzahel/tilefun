import { loadAtlasIndex } from "../assets/AtlasIndex.js";
import { loadGameAssets } from "../assets/GameAssets.js";
import { generateGemSprite } from "../assets/GemSpriteGenerator.js";
import {
  loadModernInteriorsAtlasIndex,
  MODERN_INTERIORS_SHEET_KEY,
} from "../assets/ModernInteriorsAtlasIndex.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { AudioManager } from "../audio/AudioManager.js";
import { buildFootstepManifest } from "../audio/SurfaceType.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { applyPlayerModel, normalizePlayerModel } from "../characters/PlayerModels.js";
import { ConsoleEngine } from "../console/ConsoleEngine.js";
import { ConsoleUI } from "../console/ConsoleUI.js";
import { registerClientCommands } from "../console/clientCommands.js";
import { registerClientCVars } from "../console/clientCVars.js";
import { registerServerCommandStubs } from "../console/serverCommandStubs.js";
import { GameLoop } from "../core/GameLoop.js";
import type { GameContext } from "../core/GameScene.js";
import { SceneManager } from "../core/SceneManager.js";
import { Time } from "../core/Time.js";
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import { EditorMode } from "../editor/EditorMode.js";
import { EditorModel } from "../editor/EditorModel.js";
import { EditorPanel } from "../editor/EditorPanel.js";
import { captureIdea, type IdeaSnapshot } from "../ideas/captureIdea.js";
import { ideaToast, startIdeaDelivery } from "../ideas/IdeaDialog.js";
import { IdeaScene } from "../scenes/IdeaScene.js";
import { type ReloadCamera, readReloadCamera } from "./ReloadCamera.js";
import "../editor/EditorPanel.css";
import { InteriorCatalog, type InteriorCatalogRouteState } from "../editor/InteriorCatalog.js";
import { PropCatalog } from "../editor/PropCatalog.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import {
  descriptorChoice,
  descriptorFromMetadata,
  type GenerationDescriptor,
} from "../generation/GenerationDescriptor.js";
import { ActionManager } from "../input/ActionManager.js";
import { TouchButtons } from "../input/TouchButtons.js";
import { TouchJoystick } from "../input/TouchJoystick.js";
import { interiorRealmId } from "../interiors/GameplayInterior.js";
import type { WorldMeta } from "../persistence/WorldRegistry.js";
import { Camera } from "../rendering/Camera.js";
import { DebugPanel } from "../rendering/DebugPanel.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { CatalogScene } from "../scenes/CatalogScene.js";
import { EditScene } from "../scenes/EditScene.js";
import { InteriorCatalogScene } from "../scenes/InteriorCatalogScene.js";
import { MenuScene } from "../scenes/MenuScene.js";
import { PlayScene } from "../scenes/PlayScene.js";
import { PropEditorScene } from "../scenes/PropEditorScene.js";
import { WorldMapScene } from "../scenes/WorldMapScene.js";
import type { GameServer } from "../server/GameServer.js";
import type { ClientMessage, RealmInfo, ServerMessage } from "../shared/protocol.js";
import type { RequestMessage, RequestResponse } from "../shared/requests.js";
import {
  ACTIVE_PROFILE_KEY,
  HMR_KEY,
  LAST_WORLD_KEY,
  TAB_SESSION_KEY,
} from "../shared/storageKeys.js";
import { NetEmulatedClientTransport } from "../transport/NetEmulatedClientTransport.js";
import type { IClientTransport } from "../transport/Transport.js";
import { ChatHUD } from "../ui/ChatHUD.js";
import { DoorControl } from "../ui/DoorControl.js";
import { MainMenu } from "../ui/MainMenu.js";
import { ProfilePicker } from "../ui/ProfilePicker.js";
import { WorldMap } from "../ui/WorldMap.js";
import { World } from "../world/World.js";
import { XRSessionManager } from "../xr/XRSessionManager.js";
import { takeAdminToken } from "./adminToken.js";
import { type ClientStateView, LocalStateView, RemoteStateView } from "./ClientStateView.js";
import { RequestBroker } from "./RequestBroker.js";

export interface GameClientOptions {
  mode?: "local" | "serialized";
  profile?: { id: string; name: string; playerModel?: string };
  profileStore?: {
    listProfiles(): Promise<{ id: string; name: string; pin: string | null; createdAt: number }[]>;
    createProfile(name: string): Promise<{ id: string; name: string }>;
    updateProfile?(id: string, updates: { playerModel: string }): Promise<void>;
  };
  roomDirectory?: import("../rooms/RoomDirectory.js").RoomDirectory;
  /** When true, auto-join the first active realm instead of showing the realm list. */
  autoJoinRealm?: boolean;
  /** The client ID used for the server connection (for debug display). */
  clientId?: string;
}

export class GameClient {
  private storagePaused = false;
  private storageNotice: HTMLDivElement | undefined;
  private storageNoticeTimer: ReturnType<typeof setTimeout> | undefined;
  private showStorageStatus(message: string, paused: boolean): void {
    this.storagePaused = paused;
    clearTimeout(this.storageNoticeTimer);
    if (!message) {
      this.storageNotice?.remove();
      this.storageNotice = undefined;
      return;
    }
    const notice = this.storageNotice ?? document.createElement("div");
    notice.dataset.testid = "storage-status";
    notice.setAttribute("role", "status");
    notice.style.cssText =
      "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:10000;background:#312619;color:#fff;padding:12px 20px;border:1px solid #edbd73;border-radius:8px;max-width:85vw;text-align:center;font:16px sans-serif;pointer-events:none";
    notice.textContent = message;
    document.body.append(notice);
    this.storageNotice = notice;
    if (!paused)
      this.storageNoticeTimer = setTimeout(() => this.showStorageStatus("", false), 6000);
  }

  readonly performanceMetrics = performanceMetrics;
  private canvas: HTMLCanvasElement;
  private stopIdeaDelivery: (() => void) | undefined;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private loop: GameLoop;
  private sheets = new Map<string, Spritesheet>();
  private tileRenderer: TileRenderer;
  private readonly sceneFrame = new SceneFrame();
  private actions: ActionManager;
  private touchJoystick: TouchJoystick;
  private touchButtons: TouchButtons;
  private debugPanel: DebugPanel;
  private editorMode: EditorMode;
  private editorModel: EditorModel;
  private editorPanel: EditorPanel;
  private mainMenu: MainMenu;
  private worldMap: WorldMap;
  private mapButton: HTMLButtonElement | null = null;
  private propCatalog: PropCatalog;
  private interiorCatalog: InteriorCatalog;
  private stateView: ClientStateView;
  private remoteView: RemoteStateView | null = null;
  private transport: IClientTransport;
  private netEmulatedTransport: NetEmulatedClientTransport;
  private server: GameServer | null;
  private serialized: boolean;
  private autoJoinRealm: boolean;
  private reloadCamera: ReloadCamera | null;
  private scenes: SceneManager;
  private time: Time;
  private consoleEngine: ConsoleEngine;
  private consoleUI: ConsoleUI;
  private chatHUD: ChatHUD;
  private audioManager: AudioManager;

  private xrManager = new XRSessionManager();

  // Mutable state exposed via GameContext
  private editorButton: HTMLButtonElement | null = null;
  private gemSpriteCanvas: HTMLCanvasElement | null = null;
  private debugEnabled = false;

  /** Guard to prevent concurrent toggleMenu() calls from pushing duplicate MenuScenes. */
  private menuOpening = false;
  /** Last applied tick rate from server (for change detection). */
  private _lastTickRate = 0;

  /** Request/response correlation for serialized mode. */
  private nextRequestId = 1;
  private readonly requests: RequestBroker;

  private lastVisibleRangeKey: string | null = null;
  /** Last debug flag key sent to server (serialized mode). */
  private lastDebugStateKey: string | null = null;

  /** Realm list received while in lobby (multiplayer connect flow). */
  private lobbyRealmList: RealmInfo[] | null = null;
  private doorControl: DoorControl;
  /** True once init() has completed and we're ready to show UI. */
  private initDone = false;
  /** Player profile (display name, id). */
  private profile: { id: string; name: string; playerModel?: string } | null = null;
  /** Profile store for listing/creating profiles (Switch Player). */
  private profileStore: GameClientOptions["profileStore"];
  /** The client ID used for the server connection (for debug display). */
  private clientId: string;
  private readonly adminToken: string | undefined;

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
    const admin = takeAdminToken(new URL(window.location.href));
    this.adminToken = admin.token;
    if (admin.token !== undefined) window.history.replaceState(window.history.state, "", admin.url);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    this.canvas = canvas;
    this.ctx = ctx;
    this.netEmulatedTransport = new NetEmulatedClientTransport(transport);
    this.transport = this.netEmulatedTransport;
    this.requests = new RequestBroker((message) => this.transport.send(message));
    this.transport.onDisconnect?.(() => this.requests.disconnect());
    this.server = server;
    this.serialized = options?.mode === "serialized";
    this.autoJoinRealm = options?.autoJoinRealm ?? false;
    this.profile = options?.profile ?? null;
    this.reloadCamera = readReloadCamera(sessionStorage.getItem(HMR_KEY), this.profile?.id ?? null);
    this.profileStore = options?.profileStore;
    this.clientId = options?.clientId ?? "local";
    this.camera = new Camera();
    this.tileRenderer = new TileRenderer();
    this.actions = new ActionManager();
    if (new URLSearchParams(window.location.search).has("nogamepad")) {
      this.actions.disableGamepad();
    }
    this.touchJoystick = new TouchJoystick(canvas);
    this.touchButtons = new TouchButtons(canvas);
    // Let joystick skip touches claimed by on-screen buttons
    this.touchJoystick.claimedTouches = this.touchButtons.claimedTouches;
    this.actions.setTouchJoystick(this.touchJoystick);
    this.actions.setTouchButtons(this.touchButtons);
    this.actions.setXRManager(this.xrManager);
    this.debugPanel = new DebugPanel();
    this.editorModel = new EditorModel();
    this.editorMode = new EditorMode(canvas, this.camera, this.actions, this.editorModel);
    this.editorPanel = new EditorPanel(this.editorModel);
    this.editorModel.onExitEditor = () => this.toggleEditor();
    this.mainMenu = new MainMenu();
    this.worldMap = new WorldMap({
      snapshot: () =>
        this.gcSendRequest({ type: "get-world-map", requestId: this.nextRequestId++ }),
      travel: (map, point) =>
        this.gcSendRequest({
          type: "join-realm",
          requestId: this.nextRequestId++,
          worldId: map.worldId,
          arrival: { ...point, generation: map.generation },
        }),
      close: () => {
        if (this.scenes.current instanceof WorldMapScene) this.scenes.pop();
      },
    });
    this.mainMenu.roomDirectory = options?.roomDirectory ?? null;
    this.propCatalog = new PropCatalog();
    this.propCatalog.onClose = () => {
      if (this.scenes.current instanceof CatalogScene) this.scenes.pop();
    };
    this.interiorCatalog = new InteriorCatalog();
    this.interiorCatalog.onClose = () => {
      if (this.scenes.has(InteriorCatalogScene)) this.scenes.pop();
    };
    this.editorModel.onOpenCatalog = () => this.scenes.push(new CatalogScene());
    this.propCatalog.onSelect = (propType: string) => {
      this.editorModel.selectedPropType = propType;
      this.editorModel.setTab("props");
      if (this.scenes.has(CatalogScene)) this.scenes.pop();
    };

    this.scenes = new SceneManager();
    this.time = new Time();
    this.consoleEngine = new ConsoleEngine();
    this.consoleEngine.rconSend = async (command: string) => {
      const resp = await this.gcSendRequest({
        type: "rcon",
        requestId: this.nextRequestId++,
        command,
      });
      return resp.output;
    };
    this.consoleUI = new ConsoleUI(this.consoleEngine);
    this.chatHUD = new ChatHUD();
    this.audioManager = new AudioManager();

    this.editorModel.onPatternHistory = (direction) => {
      const room = this.stateView.roomState;
      const identity = this.stateView.interior;
      this.transport.send(
        room && identity
          ? {
              type: "edit-room-history",
              roomId: interiorRealmId(identity.parentWorldId, identity.featureId),
              expectedRevision: room.revision,
              direction,
            }
          : { type: "edit-pattern-history", direction },
      );
    };
    const routePatternStatus = (msg: ServerMessage) => {
      if (msg.type === "storage-status") this.showStorageStatus(msg.message, msg.paused);
      if (msg.type === "pattern-edit-status" || msg.type === "room-edit-status")
        this.editorModel.setPatternStatus(msg);
      else if (msg.type === "world-loaded" || msg.type === "realm-joined")
        this.editorModel.setPatternStatus({ error: "", canUndo: false, canRedo: false });
    };
    if (this.serialized) {
      // Client-side world with no generator (chunks populated from server messages)
      const clientWorld = new World(new FlatStrategy());
      const remoteView = new RemoteStateView(clientWorld);
      this.stateView = remoteView;
      this.remoteView = remoteView;

      // Send profile identity to server (profileId for persistence, displayName for labels)
      if (this.profile) {
        this.transport.send({
          type: "identify",
          displayName: this.profile.name,
          profileId: this.profile.id,
          playerModel: normalizePlayerModel(this.profile.playerModel),
        });
      }

      // Route server messages to RemoteStateView
      this.transport.onMessage((msg: ServerMessage) => {
        routePatternStatus(msg);
        // Domain-specific handlers first — buffer frame/sync messages for deferred
        // application during client update tick (prevents async entity
        // position changes that desync camera and entity interpolation)
        if (
          msg.type === "frame" ||
          msg.type === "sync-room" ||
          msg.type === "sync-session" ||
          msg.type === "sync-invincibility" ||
          msg.type === "sync-chunks" ||
          msg.type === "sync-props" ||
          msg.type === "sync-cvars" ||
          msg.type === "sync-player-names" ||
          msg.type === "sync-editor-cursors"
        ) {
          remoteView.bufferMessage(msg);
        } else if (msg.type === "world-loaded" || msg.type === "realm-joined") {
          this.autoJoinRealm = false;
          if (msg.generation) this.showWorldIdentity(msg.generation);
          remoteView.interior = msg.interior ?? null;
          this.canvas.dataset.interior = msg.interior ? JSON.stringify(msg.interior) : "";
          console.log(
            `[tilefun:client] ${msg.type} — camera=(${msg.cameraX.toFixed(1)}, ${msg.cameraY.toFixed(1)}), predictor=${remoteView.hasPredictedPlayer}, editorEnabled=${remoteView.editorEnabled}`,
          );
          if (msg.worldId) {
            this.mainMenu.currentWorldId = msg.worldId;
            sessionStorage.setItem(LAST_WORLD_KEY, msg.interior?.parentWorldId ?? msg.worldId);
          }
          remoteView.clear();
          this.tileRenderer.clear();
          this.sceneFrame.clear();
          if (this.reloadCamera && this.reloadCamera.realmId === msg.worldId) {
            this.camera.snapTo(this.reloadCamera.cameraX, this.reloadCamera.cameraY);
            this.camera.zoom = this.reloadCamera.zoom;
          } else {
            this.camera.snapTo(msg.cameraX, msg.cameraY);
            this.camera.zoom = msg.cameraZoom;
            // Snap to player position on next follow() — avoids lerp when
            // switching worlds where the player position differs from saved camera.
            this.camera.requestSnap();
          }
          this.reloadCamera = null;
          this.gcSendVisibleRange(true);
          this.gcSendDebugState(this.debugPanel.paused, this.debugPanel.noclip, true);
          this.lobbyRealmList = null;
        } else if (msg.type === "realm-list") {
          // Skip unsolicited-broadcast handling when this is a response to
          // a gcSendRequest (e.g. from toggleMenu) — the requestId resolver
          // below will deliver it to the caller, which pushes MenuScene itself.
          const isRequestResponse = "requestId" in msg && msg.requestId !== undefined;
          if (this.autoJoinRealm && msg.realms.length > 0) {
            // Auto-join: prefer the last world this tab was in (survives HMR /
            // server restart), falling back to the most active realm.
            const lastWorldId = sessionStorage.getItem(LAST_WORLD_KEY);
            const target =
              (lastWorldId && msg.realms.find((r) => r.id === lastWorldId)) ||
              msg.realms.find((r) => r.playerCount > 0) ||
              msg.realms[0]!;
            this.autoJoinRealm = false; // only auto-join once
            void this.gcSendRequest({
              type: "join-realm",
              requestId: this.nextRequestId++,
              worldId: target.id,
              resume: true,
            }).catch((error) => this.mainMenu.showCreationError(String(error)));
          } else if (!isRequestResponse && this.initDone) {
            // Unsolicited broadcast — show realm browser immediately
            if (!this.scenes.has(MenuScene)) {
              this.scenes.push(new MenuScene(msg.realms));
            } else {
              this.mainMenu.show(msg.realms);
            }
          } else if (!isRequestResponse) {
            // Buffer for after init completes
            this.lobbyRealmList = msg.realms;
          }
        } else if (msg.type === "realm-left") {
          remoteView.interior = null;
          this.canvas.dataset.interior = "";
          remoteView.clear();
          this.tileRenderer.clear();
          this.sceneFrame.clear();
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
        } else if (msg.type === "chat") {
          this.consoleEngine.output.printInfo(`[${msg.sender}] ${msg.text}`);
          this.chatHUD.addMessage(`[${msg.sender}] ${msg.text}`);
        }

        this.requests.receive(msg);
      });
    } else {
      if (!server) throw new Error("Local mode requires a GameServer instance");
      this.stateView = new LocalStateView(server);
      this.transport.onMessage((message) => {
        routePatternStatus(message);
        this.requests.receive(message);
      });
    }

    this.doorControl = new DoorControl(async (request) => {
      await this.gcSendRequest({ ...request, requestId: this.nextRequestId++ });
      if (!this.serialized) {
        const session = this.localServer.getLocalSession();
        this.camera.snapTo(session.cameraX, session.cameraY);
        this.camera.requestSnap();
        this.mainMenu.currentWorldId = session.realmId;
        this.showWorldIdentity(this.localServer.worldGeneration);
        this.canvas.dataset.interior = this.localServer.worldInterior
          ? JSON.stringify(this.localServer.worldInterior)
          : "";
      }
    });
    this.actions.on("enter_place", () => this.doorControl.activate());
    this.loop = new GameLoop({
      update: (dt) => {
        this.time.elapsed += dt;
        // Apply buffered server state at the start of each client tick so
        // entity position changes are synchronized with camera.savePrev/follow.
        if (!this.remoteView?.pendingMessageCount) this.transport.pump?.();
        this.remoteView?.applyPending();
        this.editorModel.setIndoorContext(!!this.stateView.interior);
        // Sync tick rate from server — must happen after applyPending so the
        // new CVar value is available, but before scene update so prediction
        // runs at the correct rate next frame.
        if (this.remoteView && this.remoteView.tickRate !== this._lastTickRate) {
          this._lastTickRate = this.remoteView.tickRate;
          this.loop.setTickRate(this._lastTickRate);
        }
        // Tick client-side sprite animations (animTimer/frameCol not serialized).
        this.remoteView?.tickAnimations(dt);
        this.scenes.update(dt);
        this.doorControl.update(
          this.stateView,
          this.initDone &&
            !this.scenes.has(WorldMapScene) &&
            !this.scenes.has(IdeaScene) &&
            !this.scenes.has(MenuScene) &&
            !this.scenes.has(CatalogScene) &&
            !this.scenes.has(InteriorCatalogScene),
        );
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
    // Prevent buttons from stealing keyboard focus — keeps all keys routed to the game.
    // Text inputs (e.g. MainMenu world name/seed) are excluded so they remain typeable.
    // SELECT elements are NOT prevented — preventDefault on mousedown blocks native dropdowns.
    document.addEventListener("mousedown", (e) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "BUTTON") {
        e.preventDefault();
      }
    });
    this.createEditorButton();
    this.stopIdeaDelivery = startIdeaDelivery();
    this.canvas.addEventListener("click", (e) => this.onPlayClick(e));
    this.touchJoystick.onTap = (clientX, clientY) => this.onPlayTap(clientX, clientY);
    this.actions.attach();
    this.bindActions();

    // Unlock Web Audio on first user gesture (autoplay policy)
    const unlockAudio = () => {
      this.audioManager.tryResume();
      if (this.audioManager.ready) {
        document.removeEventListener("click", unlockAudio);
        document.removeEventListener("keydown", unlockAudio);
        document.removeEventListener("touchstart", unlockAudio);
      }
    };
    document.addEventListener("click", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    document.addEventListener("touchstart", unlockAudio);

    // Build GameContext and wire it into the scene manager
    const gc = this.buildGameContext();
    this.scenes.setContext(gc);

    // Register console cvars and commands
    const clientCVars = registerClientCVars(this.consoleEngine);
    registerClientCommands(this.consoleEngine, gc);
    registerServerCommandStubs(this.consoleEngine);

    const applyNetEmulationConfig = () => {
      this.netEmulatedTransport.setConfig({
        enabled: clientCVars.cl_netem.get(),
        txLossPct: clientCVars.cl_netem_tx_loss_pct.get(),
        rxLossPct: clientCVars.cl_netem_rx_loss_pct.get(),
        txLatencyMs: clientCVars.cl_netem_tx_latency_ms.get(),
        rxLatencyMs: clientCVars.cl_netem_rx_latency_ms.get(),
        txJitterMs: clientCVars.cl_netem_tx_jitter_ms.get(),
        rxJitterMs: clientCVars.cl_netem_rx_jitter_ms.get(),
      });
    };
    applyNetEmulationConfig();
    clientCVars.cl_netem.onChange(applyNetEmulationConfig);
    clientCVars.cl_netem_tx_loss_pct.onChange(applyNetEmulationConfig);
    clientCVars.cl_netem_rx_loss_pct.onChange(applyNetEmulationConfig);
    clientCVars.cl_netem_tx_latency_ms.onChange(applyNetEmulationConfig);
    clientCVars.cl_netem_rx_latency_ms.onChange(applyNetEmulationConfig);
    clientCVars.cl_netem_tx_jitter_ms.onChange(applyNetEmulationConfig);
    clientCVars.cl_netem_rx_jitter_ms.onChange(applyNetEmulationConfig);

    // Wire r_pixelscale cvar to camera zoom
    clientCVars.r_pixelscale.onChange((val) => {
      this.camera.zoom = val;
    });

    // Wire cl_timescale to game loop
    clientCVars.cl_timescale.onChange((val) => {
      this.loop.timeScale = val;
    });

    // Wire r_show3d to debug panel checkbox (bidirectional)
    clientCVars.r_show3d.onChange((val) => {
      this.debugPanel.show3d = val;
    });
    this.debugPanel.onShow3dChange((checked) => {
      clientCVars.r_show3d.set(checked);
    });

    // Start in play mode (or restore edit mode from HMR state)
    const hmrJson = sessionStorage.getItem(HMR_KEY);
    if (hmrJson) {
      sessionStorage.removeItem(HMR_KEY);
      try {
        const hmr = JSON.parse(hmrJson);
        this.scenes.push(hmr.isEditMode ? new EditScene() : new PlayScene());
        if (hmr.debugEnabled) {
          this.debugEnabled = true;
          this.debugPanel.visible = true;
        }
        if (typeof hmr.zoom === "number") {
          this.debugPanel.setZoom(hmr.zoom);
        }
        if (
          !this.serialized &&
          this.reloadCamera?.realmId === this.localServer.getLocalSession().realmId
        ) {
          this.camera.snapTo(this.reloadCamera.cameraX, this.reloadCamera.cameraY);
          this.reloadCamera = null;
        }
      } catch {
        this.scenes.push(new PlayScene());
      }
    } else {
      this.scenes.push(new PlayScene());
    }

    // Load all assets — BlendGraph is deterministic, construct locally
    const blendGraph = this.serialized ? new BlendGraph() : this.localServer.blendGraph;
    const [assets] = await Promise.all([
      loadGameAssets(blendGraph),
      loadAtlasIndex(),
      loadModernInteriorsAtlasIndex(),
      this.audioManager.preload(buildFootstepManifest()),
    ]);
    this.sheets = assets.sheets;
    this.mainMenu.characterPicker.setAssets(this.sheets, this.profile?.playerModel);
    this.mainMenu.characterPicker.onSelect = async (model) => {
      const previous = normalizePlayerModel(this.profile?.playerModel);
      // Persist before acknowledging the UI; restore the preference if authority rejects it.
      if (this.profile && this.profileStore?.updateProfile)
        await this.profileStore.updateProfile(this.profile.id, { playerModel: model });
      try {
        await this.gcSendRequest({
          type: "set-player-model",
          requestId: this.nextRequestId++,
          model,
        });
      } catch (error) {
        if (this.profile && this.profileStore?.updateProfile)
          await this.profileStore.updateProfile(this.profile.id, { playerModel: previous });
        throw error;
      }
      if (this.profile) this.profile.playerModel = model;
      // The menu pauses replica application; reflect the accepted appearance immediately.
      applyPlayerModel(this.stateView.playerEntity, model);
    };
    this.tileRenderer.setBlendSheets(assets.blendSheets, blendGraph);
    this.tileRenderer.setRoadSheets(this.sheets);
    this.tileRenderer.setVariants(assets.variants);
    this.editorPanel.setAssets(assets.sheets, assets.blendSheets, blendGraph);
    const meComplete = assets.sheets.get("me-complete");
    if (meComplete) this.propCatalog.setImage(meComplete.image);
    this.propCatalog.populateAtlas();
    const modernInteriors = assets.sheets.get(MODERN_INTERIORS_SHEET_KEY);
    if (modernInteriors) this.interiorCatalog.setImage(modernInteriors.image);
    this.interiorCatalog.populateAtlas();

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

    const handoffParams = new URL(location.href).searchParams;
    const handoffWorldId = handoffParams.get("worldId");
    let handoffArrival: import("../server/SafeArrival.js").Arrival | undefined;
    try {
      const raw = handoffParams.get("arrival");
      if (raw) handoffArrival = JSON.parse(raw);
    } catch {
      this.mainMenu.showCreationError("Invalid explorer arrival.");
    }

    // Set up menu callbacks
    this.mainMenu.onSelect = (id) => {
      // Already on this world — just close the menu
      if (this.mainMenu.currentWorldId === id && !handoffArrival) {
        if (this.scenes.has(MenuScene)) this.scenes.pop();
        return;
      }
      if (this.serialized) {
        // realm-joined handler applies camera + clears state + sends visible range
        this.gcSendRequest({
          type: "join-realm",
          requestId: this.nextRequestId++,
          worldId: id,
          ...(handoffWorldId === id && handoffArrival ? { arrival: handoffArrival } : {}),
        })
          .then(() => {
            if (this.scenes.has(MenuScene)) this.scenes.pop();
          })
          .catch((error) => this.mainMenu.showCreationError(String(error)));
      } else {
        this.localServer
          .loadWorld(id, handoffWorldId === id ? handoffArrival : undefined)
          .then((cam) => {
            this.mainMenu.currentWorldId = id;
            this.showWorldIdentity(this.localServer.worldGeneration);
            this.camera.snapTo(cam.cameraX, cam.cameraY);
            this.camera.zoom = cam.cameraZoom;
            this.camera.requestSnap();
            this.localServer.updateVisibleChunks(this.camera.getVisibleChunkRange());
            if (this.scenes.has(MenuScene)) this.scenes.pop();
          })
          .catch((error) => this.mainMenu.showCreationError(String(error)));
      }
    };
    this.mainMenu.onCreate = (name, worldType, seed, generation) => {
      if (this.serialized) {
        const msg: ClientMessage & { requestId: number } = {
          type: "create-world",
          requestId: this.nextRequestId++,
          name,
        };
        if (worldType !== undefined) msg.worldType = worldType;
        if (seed !== undefined) msg.seed = seed;
        if (generation !== undefined) msg.generation = generation;
        this.gcSendRequest(msg)
          .then((resp) => {
            return this.gcSendRequest({
              type: "join-realm",
              requestId: this.nextRequestId++,
              worldId: resp.meta.id,
              ...(!handoffWorldId && handoffArrival ? { arrival: handoffArrival } : {}),
            });
          })
          .then(() => {
            if (this.scenes.has(MenuScene)) this.scenes.pop();
          })
          .catch((error) => this.mainMenu.showCreationError(String(error)));
      } else {
        this.localServer
          .createWorld(name, worldType, seed, generation)
          .then((meta) => {
            return this.localServer
              .loadWorld(meta.id, !handoffWorldId ? handoffArrival : undefined)
              .then((cam) => {
                this.mainMenu.currentWorldId = meta.id;
                this.showWorldIdentity(this.localServer.worldGeneration);
                this.camera.snapTo(cam.cameraX, cam.cameraY);
                this.camera.zoom = cam.cameraZoom;
                this.camera.requestSnap();
                this.localServer.updateVisibleChunks(this.camera.getVisibleChunkRange());
                if (this.scenes.has(MenuScene)) this.scenes.pop();
              });
          })
          .catch((error) => this.mainMenu.showCreationError(String(error)));
      }
    };
    this.mainMenu.onDelete = async (id) => {
      try {
        if (this.serialized) {
          await this.gcSendRequest({
            type: "delete-world",
            requestId: this.nextRequestId++,
            worldId: id,
          });
          const resp = await this.gcSendRequest({
            type: "list-realms",
            requestId: this.nextRequestId++,
          });
          this.mainMenu.show(resp.realms);
        } else {
          await this.localServer.deleteWorld(id);
          const worlds = await this.localServer.listWorlds();
          this.mainMenu.show(GameClient.toRealmInfoList(worlds));
        }
      } catch (error) {
        this.mainMenu.showCreationError(String(error));
      }
    };
    this.mainMenu.onRename = (id, name) => {
      if (this.serialized) {
        void this.gcSendRequest({
          type: "rename-world",
          requestId: this.nextRequestId++,
          worldId: id,
          name,
        }).catch((error) => this.mainMenu.showCreationError(String(error)));
      } else {
        this.localServer.renameWorld(id, name);
      }
    };
    this.mainMenu.onClose = () => {
      if (this.scenes.has(MenuScene)) this.scenes.pop();
    };
    this.mainMenu.onSwitchProfile = () => {
      if (!this.profileStore) return;
      const picker = new ProfilePicker();
      const store = this.profileStore;

      const showList = () => {
        store.listProfiles().then((profiles) => picker.show(profiles));
      };

      picker.onSelect = (profile) => {
        if (!profile) {
          // "Back" pressed from PIN/create screen — re-show list
          showList();
          return;
        }
        // Save selected profile, clear tab session, reload with new identity
        localStorage.setItem(ACTIVE_PROFILE_KEY, profile.id);
        sessionStorage.removeItem(TAB_SESSION_KEY);
        window.location.reload();
      };

      picker.onCreate = (name) => {
        store.createProfile(name).then((newProfile) => {
          localStorage.setItem(ACTIVE_PROFILE_KEY, newProfile.id);
          sessionStorage.removeItem(TAB_SESSION_KEY);
          window.location.reload();
        });
      };

      showList();
    };

    this.applyStartupRoute();

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
    if (!this.serialized) this.showWorldIdentity(this.localServer.worldGeneration);
    if (
      (new URL(location.href).searchParams.has("generation") || handoffWorldId) &&
      !this.scenes.has(MenuScene)
    )
      await this.toggleMenu();
  }

  /** Set hosting info to display in the main menu (when this client is hosting P2P). */
  setHostingInfo(info: import("../ui/HostingBanner.js").HostingInfo): void {
    this.mainMenu.hostingInfo = info;
  }

  /** Save UI state to sessionStorage so it survives Vite HMR reloads. */
  saveHMRState(): void {
    const state = {
      realmId: this.mainMenu.currentWorldId,
      profileId: this.profile?.id ?? null,
      isEditMode: this.scenes.current instanceof EditScene,
      debugEnabled: this.debugEnabled,
      zoom: this.debugPanel.zoom,
      cameraX: this.camera.x,
      cameraY: this.camera.y,
    };
    sessionStorage.setItem(HMR_KEY, JSON.stringify(state));
  }

  destroy(): void {
    this.showStorageStatus("", false);
    this.stopIdeaDelivery?.();
    this.tileRenderer.clear();
    this.sceneFrame.clear();
    this.doorControl.destroy();
    this.loop.stop();
    this.gcFlushServer();
    this.requests.dispose();
    this.transport.close();
    this.scenes.clear();
    this.worldMap.destroy();
    this.mapButton?.remove();
    this.actions.detach();
    this.consoleUI.destroy();
    this.mainMenu.characterPicker.destroy();
  }

  // ---- Actions ----

  private bindActions(): void {
    this.actions.on("toggle_world_map", () => this.toggleWorldMap());
    this.actions.on("toggle_menu", () => {
      if (this.scenes.current instanceof WorldMapScene) {
        this.scenes.pop();
        return;
      }
      if (this.scenes.has(CatalogScene)) {
        this.scenes.pop();
        return;
      }
      if (this.scenes.has(InteriorCatalogScene)) {
        this.scenes.pop();
        return;
      }
      if (this.scenes.has(MenuScene)) {
        this.scenes.pop();
      } else {
        void this.toggleMenu().catch((error) =>
          this.consoleEngine.output.printError(String(error)),
        );
      }
    });
    this.actions.on("toggle_debug", () => {
      if (
        this.scenes.has(WorldMapScene) ||
        this.scenes.has(MenuScene) ||
        this.scenes.has(CatalogScene) ||
        this.scenes.has(InteriorCatalogScene)
      ) {
        return;
      }
      this.debugEnabled = !this.debugEnabled;
      this.debugPanel.visible = this.debugEnabled;
    });
    this.actions.on("toggle_editor", () => {
      if (
        this.scenes.has(WorldMapScene) ||
        this.scenes.has(MenuScene) ||
        this.scenes.has(CatalogScene) ||
        this.scenes.has(InteriorCatalogScene)
      ) {
        return;
      }
      this.toggleEditor();
    });
    this.actions.on("toggle_console", () => {
      this.consoleUI.toggle();
    });
    this.actions.on("toggle_base_mode", () => {
      if (
        this.scenes.has(WorldMapScene) ||
        this.scenes.has(MenuScene) ||
        this.scenes.has(CatalogScene) ||
        this.scenes.has(InteriorCatalogScene)
      ) {
        return;
      }
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

  private toggleWorldMap(): void {
    if (this.scenes.current instanceof WorldMapScene) {
      this.scenes.pop();
      return;
    }
    if (!(this.scenes.current instanceof PlayScene || this.scenes.current instanceof EditScene))
      return;
    this.scenes.push(new WorldMapScene(this.worldMap));
  }

  private async toggleMenu(): Promise<void> {
    if (this.menuOpening) return;
    this.menuOpening = true;
    try {
      this.gcFlushServer();
      if (this.serialized) {
        const resp = await this.gcSendRequest({
          type: "list-realms",
          requestId: this.nextRequestId++,
        });
        this.scenes.push(new MenuScene(resp.realms));
      } else {
        const worlds = await this.localServer.listWorlds();
        this.scenes.push(new MenuScene(GameClient.toRealmInfoList(worlds)));
      }
    } finally {
      this.menuOpening = false;
    }
  }

  private applyStartupRoute(): void {
    const params = new URLSearchParams(window.location.search);
    this.interiorCatalog.setRouteState(this.readInteriorRouteState(params));

    const debug = params.get("debug");
    if (debug === "1" || debug === "true") {
      this.debugEnabled = true;
      this.debugPanel.visible = true;
    }

    const panel = params.get("panel") ?? params.get("open");
    if (panel === "interiors") {
      if (!this.scenes.has(InteriorCatalogScene)) this.scenes.push(new InteriorCatalogScene());
    } else if (panel === "props" || panel === "catalog") {
      if (!this.scenes.has(CatalogScene)) this.scenes.push(new CatalogScene());
    }
  }

  private readInteriorRouteState(params: URLSearchParams): InteriorCatalogRouteState {
    const state: InteriorCatalogRouteState = {};
    const search = params.get("interiorSearch") ?? params.get("search");
    if (search !== null) state.search = search;

    const sourceKind = params.get("interiorSource");
    if (
      sourceKind === "" ||
      sourceKind === "home_design_layer" ||
      sourceKind === "room_builder_tile" ||
      sourceKind === "room_builder_sheet" ||
      sourceKind === "single"
    ) {
      state.sourceKind = sourceKind;
    }

    const category = params.get("interiorCategory");
    if (category !== null) state.category = category;

    const variant = params.get("interiorVariant");
    if (
      variant === "" ||
      variant === "normal" ||
      variant === "shadowless" ||
      variant === "black-shadow"
    ) {
      state.variant = variant;
    }

    const design = params.get("interiorDesign");
    if (design !== null) state.design = design;
    return state;
  }

  // ---- Helpers (also exposed via GameContext) ----

  /** Send a request and return a promise resolved when the server responds with matching requestId. */
  private gcSendRequest<R extends RequestMessage>(msg: R): Promise<RequestResponse<R>> {
    if (
      this.adminToken &&
      ["create-world", "delete-world", "rename-world", "rcon"].includes(msg.type)
    )
      return this.requests.send({ ...msg, adminToken: this.adminToken });
    return this.requests.send(msg);
  }

  private showWorldIdentity(generation: GenerationDescriptor): void {
    this.canvas.dataset.generator = descriptorChoice(generation);
    this.canvas.dataset.seed = String(generation.seed);
    this.canvas.dataset.generation = JSON.stringify(generation);
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
      info.generation = descriptorFromMetadata(w);
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

  /** Send current visible chunk range to server when changed (serialized mode). */
  private gcSendVisibleRange(force = false): void {
    const range = this.camera.getVisibleChunkRange();
    const key = `${range.minCx},${range.minCy},${range.maxCx},${range.maxCy}`;
    if (!force && key === this.lastVisibleRangeKey) return;
    this.lastVisibleRangeKey = key;
    this.transport.send({
      type: "visible-range",
      minCx: range.minCx,
      minCy: range.minCy,
      maxCx: range.maxCx,
      maxCy: range.maxCy,
    });
  }

  /** Send debug flags to server when changed (serialized mode). */
  private gcSendDebugState(paused: boolean, noclip: boolean, force = false): void {
    const key = `${paused ? 1 : 0}${noclip ? 1 : 0}`;
    if (!force && key === this.lastDebugStateKey) return;
    this.lastDebugStateKey = key;
    this.transport.send({ type: "set-debug", paused, noclip });
  }

  // ---- GameContext construction ----

  private buildGameContext(): GameContext {
    // Use a proxy-like object so mutable fields (debugEnabled, gemSpriteCanvas, editorButton)
    // always reflect the latest value from GameClient.
    const client = this;
    return {
      get storagePaused() {
        return client.storagePaused;
      },
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
      sceneFrame: this.sceneFrame,
      audioManager: this.audioManager,
      editorMode: this.editorMode,
      editorModel: this.editorModel,
      editorPanel: this.editorPanel,
      mainMenu: this.mainMenu,
      propCatalog: this.propCatalog,
      interiorCatalog: this.interiorCatalog,
      debugPanel: this.debugPanel,
      touchJoystick: this.touchJoystick,
      touchButtons: this.touchButtons,
      console: this.consoleEngine,
      consoleUI: this.consoleUI,
      chatHUD: this.chatHUD,
      server: this.server,
      serialized: this.serialized,
      scenes: this.scenes,
      time: this.time,
      clientId: this.clientId,
      profile: this.profile,
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
      get xrActive() {
        return client.xrManager.active;
      },
      flushServer: () => this.gcFlushServer(),
      sendRequest: <R extends RequestMessage>(msg: R) => this.gcSendRequest(msg),
      sendVisibleRange: (force?: boolean) => this.gcSendVisibleRange(force),
      sendDebugState: (paused: boolean, noclip: boolean, force?: boolean) =>
        this.gcSendDebugState(paused, noclip, force),
    };
  }

  // ---- UI ----

  private createEditorButton(): void {
    const MENU_BTN_STYLE = `
      font: bold 14px monospace; padding: 10px 16px;
      background: none; color: #fff; border: none;
      cursor: pointer; user-select: none; text-align: left;
      width: 100%;
    `;

    // Backdrop overlay (click to close)
    const backdrop = document.createElement("div");
    backdrop.style.cssText =
      "position: fixed; inset: 0; z-index: 180; background: rgba(0,0,0,0.3); display: none;";
    backdrop.addEventListener("click", () => closePanel());

    // Slide-in panel
    const panel = document.createElement("div");
    panel.style.cssText = `
      position: fixed; top: 0; left: 0; bottom: 0; width: 200px;
      background: rgba(0,0,0,0.85); z-index: 190;
      display: flex; flex-direction: column; padding: 60px 8px 8px;
      transform: translateX(-100%); transition: transform 0.2s ease-out;
    `;

    // Hamburger button
    const hamburger = document.createElement("button");
    hamburger.textContent = "\u2630";
    hamburger.setAttribute("data-testid", "main-menu-toggle");
    hamburger.style.cssText = `
      position: fixed; top: 8px; left: 8px; z-index: 200;
      width: 44px; height: 44px; font-size: 24px;
      background: rgba(0,0,0,0.6); color: #fff;
      border: 1px solid #888; border-radius: 4px;
      cursor: pointer; user-select: none; line-height: 1;
    `;

    let panelOpen = false;
    let ideaSnapshot: IdeaSnapshot | undefined;
    const openPanel = () => {
      try {
        const position = this.stateView.playerEntity.position;
        ideaSnapshot = captureIdea(
          this.canvas,
          this.mainMenu.currentWorldId ?? "",
          position.wx,
          position.wy,
        );
      } catch {
        ideaSnapshot = undefined;
      }
      panelOpen = true;
      backdrop.style.display = "";
      panel.style.transform = "translateX(0)";
    };
    const closePanel = () => {
      panelOpen = false;
      backdrop.style.display = "none";
      panel.style.transform = "translateX(-100%)";
    };
    hamburger.addEventListener("click", () => {
      if (panelOpen) closePanel();
      else openPanel();
    });

    const mapBtn = document.createElement("button");
    mapBtn.textContent = "Map · G";
    mapBtn.setAttribute("aria-label", "Open world map");
    mapBtn.setAttribute("data-testid", "open-world-map");
    mapBtn.style.cssText =
      "position:fixed;top:8px;right:8px;z-index:90;min-height:44px;padding:8px 14px;color:#fff;background:#243a32;border:1px solid #9ab59c;border-radius:6px;font:14px system-ui;cursor:pointer;";
    mapBtn.onclick = () => {
      closePanel();
      this.toggleWorldMap();
    };
    document.body.append(mapBtn);
    this.mapButton = mapBtn;

    // Menu items
    const ideaBtn = document.createElement("button");
    ideaBtn.textContent = "💡 Idea";
    ideaBtn.style.cssText = MENU_BTN_STYLE;
    ideaBtn.onclick = () => {
      closePanel();
      if (!ideaSnapshot) {
        ideaToast("Couldn't take a game picture. Open the menu and try again.");
        return;
      }
      this.scenes.push(new IdeaScene(ideaSnapshot));
    };
    const editBtn = document.createElement("button");
    editBtn.textContent = "Play";
    editBtn.style.cssText = MENU_BTN_STYLE;
    editBtn.addEventListener("click", () => {
      closePanel();
      this.toggleEditor();
    });
    this.editorButton = editBtn;

    const menuBtn = document.createElement("button");
    menuBtn.textContent = "Menu";
    menuBtn.style.cssText = MENU_BTN_STYLE;
    menuBtn.addEventListener("click", () => {
      closePanel();
      this.toggleMenu();
    });

    const debugBtn = document.createElement("button");
    debugBtn.textContent = "Debug";
    debugBtn.style.cssText = MENU_BTN_STYLE;
    debugBtn.addEventListener("click", () => {
      closePanel();
      this.debugEnabled = !this.debugEnabled;
      this.debugPanel.visible = this.debugEnabled;
    });

    const propEditorBtn = document.createElement("button");
    propEditorBtn.textContent = "Prop Editor";
    propEditorBtn.style.cssText = MENU_BTN_STYLE;
    propEditorBtn.addEventListener("click", () => {
      closePanel();
      if (this.scenes.has(PropEditorScene)) {
        this.scenes.pop();
      } else {
        this.scenes.push(new PropEditorScene());
      }
    });

    const interiorsBtn = document.createElement("button");
    interiorsBtn.textContent = "Interiors";
    interiorsBtn.style.cssText = MENU_BTN_STYLE;
    interiorsBtn.setAttribute("data-testid", "open-interiors-catalog");
    interiorsBtn.addEventListener("click", () => {
      closePanel();
      if (this.scenes.has(InteriorCatalogScene)) {
        this.scenes.pop();
      } else {
        this.scenes.push(new InteriorCatalogScene());
      }
    });

    const workbenchBtn = document.createElement("button");
    workbenchBtn.textContent = "Indoor Workbench";
    workbenchBtn.style.cssText = MENU_BTN_STYLE;
    workbenchBtn.setAttribute("data-testid", "open-indoor-workbench");
    workbenchBtn.addEventListener("click", () => {
      window.location.href = "interior-workbench.html";
    });

    const toolsLink = document.createElement("a");
    toolsLink.href = `${import.meta.env.BASE_URL}workshop.html`;
    toolsLink.textContent = "Tilefun Workshop";
    toolsLink.setAttribute("data-testid", "open-tools-index");
    toolsLink.style.cssText = `${MENU_BTN_STYLE} display: block; text-decoration: none;`;
    panel.append(
      ideaBtn,
      editBtn,
      menuBtn,
      toolsLink,
      debugBtn,
      propEditorBtn,
      interiorsBtn,
      workbenchBtn,
    );

    // Add "Enter VR" button if WebXR immersive-vr is supported (Quest, etc.)
    const vrBtn = document.createElement("button");
    vrBtn.textContent = "VR (checking...)";
    vrBtn.style.cssText = `${MENU_BTN_STYLE} color: #666;`;
    vrBtn.disabled = true;
    // Always show on Quest UA even if feature detection hasn't resolved yet
    const isQuestUA = /Quest/i.test(navigator.userAgent);
    if (isQuestUA) {
      panel.appendChild(vrBtn);
    }
    XRSessionManager.isSupported().then(
      (supported) => {
        if (!supported) {
          if (isQuestUA) {
            vrBtn.textContent = "VR (not supported)";
            console.warn(
              "[tilefun:xr] Quest UA detected but immersive-vr not supported. navigator.xr =",
              navigator.xr,
            );
          }
          return;
        }
        vrBtn.textContent = "Enter VR";
        vrBtn.style.color = "#4fc3f7";
        vrBtn.disabled = false;
        if (!isQuestUA) panel.appendChild(vrBtn);
      },
      (err) => {
        console.error("[tilefun:xr] isSupported check failed:", err);
        if (isQuestUA) vrBtn.textContent = "VR (error)";
      },
    );
    vrBtn.addEventListener("click", () => {
      closePanel();
      if (this.xrManager.active) {
        this.xrManager.exitVR();
      } else {
        this.xrManager.enterVR(this.canvas, this.loop).catch((err) => {
          console.error("[tilefun:xr] Failed to enter VR:", err);
          vrBtn.textContent = "VR (failed)";
          vrBtn.style.color = "#f66";
        });
      }
    });
    this.xrManager.onSessionEnd = () => {
      vrBtn.textContent = "Enter VR";
      vrBtn.style.color = "#4fc3f7";
    };

    document.body.append(backdrop, panel, hamburger);
  }

  private resize(): void {
    // Use the canvas's actual displayed size (respects split-screen CSS when 3D view is active)
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width);
    this.canvas.height = Math.round(rect.height);
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
