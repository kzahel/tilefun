import { loadAtlasIndex } from "../assets/AtlasIndex.js";
import { type GameAssets, loadGameAssets } from "../assets/GameAssets.js";
import { generateGemSprite } from "../assets/GemSpriteGenerator.js";
import {
  loadModernInteriorsAtlasIndex,
  MODERN_INTERIORS_SHEET_KEY,
} from "../assets/ModernInteriorsAtlasIndex.js";
import { Spritesheet } from "../assets/Spritesheet.js";
import { AudioManager } from "../audio/AudioManager.js";
import { buildAudioManifest } from "../audio/SurfaceType.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { normalizePlayerModel } from "../characters/PlayerModels.js";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import { ConsoleEngine } from "../console/ConsoleEngine.js";
import { ConsoleUI } from "../console/ConsoleUI.js";
import { GameLoop } from "../core/GameLoop.js";
import type { GameContext } from "../core/GameScene.js";
import { SceneManager } from "../core/SceneManager.js";
import { Time } from "../core/Time.js";
import type { FaultReport } from "../diagnostics/FaultReport.js";
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import { EditorMode } from "../editor/EditorMode.js";
import { EditorModel } from "../editor/EditorModel.js";
import { EditorPanel } from "../editor/EditorPanel.js";
import { startIdeaDelivery } from "../ideas/IdeaDialog.js";
import { createCanvasRenderHost } from "../rendering/CanvasRenderHost.js";
import type { RenderBackend } from "../rendering/RenderFrame.js";
import type { RenderHost, RenderHostFactory } from "../rendering/RenderHost.js";
import { IdeaScene } from "../scenes/IdeaScene.js";
import { type CarDrivingStyle, carDrivingStyle } from "../traffic/CarControls.js";
import { finishStartup, showStartupAssets, showStartupStage } from "../ui/StartupProgress.js";
import { DoorPresentation } from "./DoorPresentation.js";
import type { GameTestHooks } from "./GameTestHooks.js";
import { readReloadCamera } from "./ReloadCamera.js";
import "../editor/EditorPanel.css";
import { InteriorCatalog, type InteriorCatalogRouteState } from "../editor/InteriorCatalog.js";
import { PropCatalog } from "../editor/PropCatalog.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { descriptorChoice, type GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import { ActionManager } from "../input/ActionManager.js";
import type { TapMovement, TouchMovementMode } from "../input/TapMovement.js";
import { touchMovementMode } from "../input/TapMovement.js";
import type { TouchButtons } from "../input/TouchButtons.js";
import type { TouchJoystick } from "../input/TouchJoystick.js";
import { interiorRealmId } from "../interiors/GameplayInterior.js";
import { Camera } from "../rendering/Camera.js";
import { DebugPanel } from "../rendering/DebugPanel.js";
import { cameraPixelSnap } from "../rendering/PresentationSettings.js";
import { SceneFrame } from "../rendering/SceneFrame.js";
import { CatalogScene } from "../scenes/CatalogScene.js";
import { EditScene } from "../scenes/EditScene.js";
import { InteriorCatalogScene } from "../scenes/InteriorCatalogScene.js";
import { MenuScene } from "../scenes/MenuScene.js";
import { PlayScene } from "../scenes/PlayScene.js";
import { WorldMapScene } from "../scenes/WorldMapScene.js";
import type { RequestMessage, RequestResponse } from "../shared/requests.js";
import { HMR_KEY } from "../shared/storageKeys.js";
import { NetEmulatedClientTransport } from "../transport/NetEmulatedClientTransport.js";
import type { IClientTransport } from "../transport/Transport.js";
import { ChatHUD } from "../ui/ChatHUD.js";
import { DoorControl } from "../ui/DoorControl.js";
import { GemHUD } from "../ui/GemHUD.js";
import { MainMenu } from "../ui/MainMenu.js";
import { VehicleControl } from "../ui/VehicleControl.js";
import { WorldMap } from "../ui/WorldMap.js";
import { World } from "../world/World.js";
import { XRSessionManager } from "../xr/XRSessionManager.js";
import { takeAdminToken } from "./adminToken.js";
import { registerClientConsole } from "./ClientConsoleBindings.js";
import { RemoteStateView } from "./ClientStateView.js";
import { GameMenuChrome, type MenuChromeHost } from "./GameMenuChrome.js";
import { PlayInputController, type PlayInputHost } from "./PlayInputController.js";
import { RequestBroker } from "./RequestBroker.js";
import { type ServerMessageHost, ServerMessageRouter } from "./ServerMessageRouter.js";
import { WorldSessionActions, type WorldSessionHost } from "./WorldSessionActions.js";

export interface GameClientOptions {
  /** Platform renderer selection; simulation and presentation stay shared. */
  renderHostFactory?: RenderHostFactory;
  profile?: {
    id: string;
    name: string;
    playerModel?: string;
    touchMovement?: TouchMovementMode;
    pinchZoom?: boolean;
    carDriving?: CarDrivingStyle;
  };
  profileStore?: {
    listProfiles(): Promise<{ id: string; name: string; pin: string | null; createdAt: number }[]>;
    createProfile(name: string): Promise<{ id: string; name: string }>;
    updateProfile?(
      id: string,
      updates: {
        playerModel?: string;
        touchMovement?: TouchMovementMode;
        pinchZoom?: boolean;
        carDriving?: CarDrivingStyle;
      },
    ): Promise<void>;
  };
  roomDirectory?: import("../rooms/RoomDirectory.js").RoomDirectory;
  /** When true, auto-join the first active realm instead of showing the realm list. */
  autoJoinRealm?: boolean;
  /** The client ID used for the server connection (for debug display). */
  clientId?: string;
}

/**
 * Browser client composition: owns the render host, transport, scenes and UI
 * components, and wires play input ({@link PlayInputController}), server
 * message routing ({@link ServerMessageRouter}), world/session operations
 * ({@link WorldSessionActions}) and menu chrome ({@link GameMenuChrome}).
 */
export class GameClient implements GameTestHooks {
  readonly performanceMetrics = performanceMetrics;
  readonly canvas: HTMLCanvasElement;
  private stopIdeaDelivery: (() => void) | undefined;
  private ctx: CanvasRenderingContext2D;
  readonly camera: Camera;
  readonly loop: GameLoop;
  private sheets = new Map<string, Spritesheet>();
  readonly renderHost: RenderHost;
  get renderer(): RenderBackend {
    return this.renderHost.renderer;
  }
  private readonly sceneFrame = new SceneFrame({
    allCars3d: new URLSearchParams(location.search).has("allcars3d"),
  });
  private actions: ActionManager;
  private readonly playInput: PlayInputController;
  readonly touchJoystick: TouchJoystick;
  readonly touchButtons: TouchButtons;
  readonly tapMovement: TapMovement;
  private readonly chrome: GameMenuChrome;
  private readonly session: WorldSessionActions;
  private readonly router: ServerMessageRouter;
  readonly debugPanel: DebugPanel;
  readonly editorMode: EditorMode;
  readonly editorModel: EditorModel;
  readonly editorPanel: EditorPanel;
  readonly mainMenu: MainMenu;
  private worldMap: WorldMap;
  private propCatalog: PropCatalog;
  private interiorCatalog: InteriorCatalog;
  readonly stateView: RemoteStateView;
  readonly transport: IClientTransport;
  readonly netEmulatedTransport: NetEmulatedClientTransport;
  private scenes: SceneManager;
  readonly time: Time;
  readonly consoleEngine: ConsoleEngine;
  private consoleUI: ConsoleUI;
  private chatHUD: ChatHUD;
  readonly audioManager: AudioManager;

  private xrManager = new XRSessionManager();

  // Mutable state exposed via GameContext
  private gemSpriteCanvas: HTMLCanvasElement | null = null;
  readonly gemHUD = new GemHUD();
  private debugEnabled = false;

  /** Request/response correlation. */
  nextRequestId = 1;
  private readonly requests: RequestBroker;

  private doorControl: DoorControl;
  private vehicleControl: VehicleControl;
  private doorPresentation = new DoorPresentation();
  /** True once init() has completed and we're ready to show UI. */
  initDone = false;
  private startupWorldReady = false;
  /** Player profile (display name, id). */
  readonly profile: NonNullable<GameClientOptions["profile"]> | null = null;
  /** Profile store for listing/creating profiles (Switch Player). */
  readonly profileStore: GameClientOptions["profileStore"];
  /** The client ID used for the server connection (for debug display). */
  private clientId: string;
  private readonly adminToken: string | undefined;

  constructor(canvas: HTMLCanvasElement, transport: IClientTransport, options?: GameClientOptions) {
    const admin = takeAdminToken(new URL(window.location.href));
    this.adminToken = admin.token;
    if (admin.token !== undefined) window.history.replaceState(window.history.state, "", admin.url);
    this.renderHost = (options?.renderHostFactory ?? createCanvasRenderHost)(canvas);
    this.canvas = canvas;
    this.ctx = this.renderHost.uiContext;
    this.netEmulatedTransport = new NetEmulatedClientTransport(transport);
    this.transport = this.netEmulatedTransport;
    this.requests = new RequestBroker((message) => this.transport.send(message));
    this.transport.onDisconnect?.(() => {
      this.requests.disconnect();
      this.doorPresentation.cancel();
      this.playInput.clearPlayInput();
    });
    const autoJoinRealm = options?.autoJoinRealm ?? false;
    this.profile = options?.profile ?? null;
    const inputSettings = {
      movementMode: touchMovementMode(this.profile?.touchMovement),
      pinchZoom: this.profile?.pinchZoom === true,
      carDriving: carDrivingStyle(this.profile?.carDriving),
    };
    const reloadCamera = readReloadCamera(
      sessionStorage.getItem(HMR_KEY),
      this.profile?.id ?? null,
    );
    this.profileStore = options?.profileStore;
    this.clientId = options?.clientId ?? "local";
    this.camera = new Camera();
    this.camera.pixelSnap = cameraPixelSnap(new URLSearchParams(window.location.search));
    this.actions = new ActionManager();
    if (new URLSearchParams(window.location.search).has("nogamepad")) {
      this.actions.disableGamepad();
    }
    this.playInput = new PlayInputController(
      canvas,
      this.actions,
      this.playInputHost(),
      inputSettings,
    );
    this.touchJoystick = this.playInput.touchJoystick;
    this.touchButtons = this.playInput.touchButtons;
    this.tapMovement = this.playInput.tapMovement;
    this.actions.setXRManager(this.xrManager);
    this.debugPanel = new DebugPanel();
    if (this.renderHost.rendererControl)
      this.debugPanel.setRendererControl(this.renderHost.rendererControl);
    this.editorModel = new EditorModel();
    this.editorMode = new EditorMode(canvas, this.camera, this.actions, this.editorModel);
    this.editorPanel = new EditorPanel(this.editorModel);
    this.editorModel.onExitEditor = () => this.toggleEditor();
    this.mainMenu = new MainMenu();
    this.chrome = new GameMenuChrome(this.chromeHost(), this.playInput);
    this.mainMenu.onOptions = (opener) => this.chrome.openOptions(opener);
    this.mainMenu.onBuild = () => this.toggleEditor();
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
    // Client-side world with no generator (chunks populated from server messages)
    const clientWorld = new World(new FlatStrategy());
    this.stateView = new RemoteStateView(clientWorld);

    // Send profile identity to server (profileId for persistence, displayName for labels)
    if (this.profile) {
      this.transport.send({
        type: "identify",
        displayName: this.profile.name,
        profileId: this.profile.id,
        playerModel: normalizePlayerModel(this.profile.playerModel),
      });
    }

    this.session = new WorldSessionActions(this.sessionHost());
    // Route server messages to RemoteStateView and the client UI
    const router = new ServerMessageRouter(this.messageHost(), { autoJoinRealm, reloadCamera });
    this.router = router;
    this.transport.onMessage((msg) => router.route(msg));

    this.doorControl = new DoorControl(async (request) => {
      if (this.doorPresentation.busy) return;
      // Authority validates a walking approach against the last directional input.
      // Queue that request before neutral input; the busy presentation locks the next tick.
      this.playInput.clearPlayInput(!request.walkThrough);
      if (request.walkThrough) this.doorPresentation.begin();
      try {
        await this.gcSendRequest({ ...request, requestId: this.nextRequestId++ });
      } catch (error) {
        this.doorPresentation.cancel();
        throw error;
      }
    });
    this.vehicleControl = new VehicleControl(async (request) => {
      this.playInput.clearPlayInput();
      return this.gcSendRequest({ ...request, requestId: this.nextRequestId++ });
    });
    this.actions.on("vehicle_recover", () => {
      if (this.scenes.current instanceof PlayScene && !this.playInput.inputBlocked)
        this.vehicleControl.activateEquipment();
    });
    this.actions.on("enter_place", () => {
      if (!(this.scenes.current instanceof PlayScene) || this.playInput.inputBlocked) return;
      if (!this.vehicleControl.activate()) this.doorControl.activate();
    });
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (alpha, presentationSeconds) => this.render(alpha, presentationSeconds),
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
      if (tag === "BUTTON" && !(e.target as HTMLElement).closest(".options-dialog")) {
        e.preventDefault();
      }
    });
    this.chrome.mount();
    this.playInput.attachFocusListeners();
    this.stopIdeaDelivery = startIdeaDelivery();
    this.playInput.attachPlayClicks();
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
    registerClientConsole(gc, this.netEmulatedTransport);
    this.pushStartScene();

    showStartupStage(
      "assets",
      "Loading artwork and sounds…",
      "Preparing images, sounds and tile data.",
    );
    // Load all assets — BlendGraph is deterministic, construct locally
    const blendGraph = new BlendGraph();
    const [assets] = await Promise.all([
      loadGameAssets(blendGraph, showStartupAssets),
      loadAtlasIndex(),
      loadModernInteriorsAtlasIndex(),
      this.audioManager.preload(buildAudioManifest()),
    ]);
    showStartupStage(
      "world",
      "Preparing your world…",
      "Loading nearby scenery and placing your player.",
    );
    this.applyAssets(assets, blendGraph);

    // The camera was already set by the "world-loaded" message sent during
    // onConnect (fires before init() runs).

    // Set up menu callbacks
    this.session.bindMainMenu();

    this.applyStartupRoute();

    document.addEventListener("visibilitychange", () => {
      this.stateView.resetPresentationClock();
      this.camera.requestSnap();
      if (document.visibilityState === "hidden") {
        this.session.flushServer();
      }
    });
    window.addEventListener("beforeunload", () => {
      this.session.flushServer();
    });

    this.initDone = true;

    // If we received a realm-list while connecting (multiplayer lobby), show it now
    const lobbyRealmList = this.router.takeLobbyRealmList();
    if (lobbyRealmList) this.scenes.push(new MenuScene(lobbyRealmList));

    this.loop.start();
    if (this.session.startupMenuRequested && !this.scenes.has(MenuScene))
      await this.session.toggleMenu();
    this.canvas.dataset.ready = "true";
  }

  /** Start in play mode (or restore edit mode from HMR state). */
  private pushStartScene(): void {
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
      } catch {
        this.scenes.push(new PlayScene());
      }
    } else {
      this.scenes.push(new PlayScene());
    }
  }

  /** Hand loaded sheets to the menus, editor, catalogs and render host. */
  private applyAssets(assets: GameAssets, blendGraph: BlendGraph): void {
    this.sheets = assets.sheets;
    this.mainMenu.characterPicker.setAssets(this.sheets, this.profile?.playerModel);
    this.session.bindCharacterPicker();
    this.editorPanel.setAssets(assets.sheets, assets.blendSheets, blendGraph);
    const meComplete = assets.sheets.get("me-complete");
    if (meComplete) this.propCatalog.setImage(meComplete.image);
    this.propCatalog.populateAtlas();
    const modernInteriors = assets.sheets.get(MODERN_INTERIORS_SHEET_KEY);
    if (modernInteriors) this.interiorCatalog.setImage(modernInteriors.image);
    this.interiorCatalog.populateAtlas();

    // Generate procedural gem sprite and add to sheets
    this.gemSpriteCanvas = generateGemSprite();
    this.gemHUD.setIcon(this.gemSpriteCanvas);
    this.sheets.set("gem", new Spritesheet(this.gemSpriteCanvas, 16, 16));
    this.renderHost.setAssets(assets, blendGraph);
  }

  private update(dt: number): void {
    this.time.elapsed += dt;
    // Apply buffered server state at the start of each client tick so
    // entity position changes are synchronized with camera.savePrev/follow.
    if (!this.stateView.pendingMessageCount) this.transport.pump?.();
    this.stateView.applyPending();
    this.editorModel.setIndoorContext(!!this.stateView.interior);
    // Tick client-side sprite animations (animTimer/frameCol not serialized).
    this.stateView.tickAnimations(dt);
    this.scenes.update(dt);
    const ready = this.playerWorldReady();
    if (this.initDone && ready) this.startupWorldReady = true;
    this.doorPresentation.update(this.mainMenu.currentWorldId, ready);
    this.chrome.updateMapHint();
    this.updatePlaceControls(dt, ready);
  }

  /** The player exists and its room or terrain chunk is presentable. */
  private playerWorldReady(): boolean {
    const p = this.stateView.serverPlayerEntity;
    return (
      p.id !== -1 &&
      (this.stateView.interior
        ? !!this.stateView.roomState
        : this.renderer.isTerrainReady(
            this.stateView.world.chunks.get(
              Math.floor(p.position.wx / CHUNK_SIZE_PX),
              Math.floor(p.position.wy / CHUNK_SIZE_PX),
            ),
          ))
    );
  }

  /** Vehicle prompts take precedence over door prompts. */
  private updatePlaceControls(dt: number, ready: boolean): void {
    const vehiclePrompt = this.vehicleControl.update(
      this.stateView,
      this.initDone && ready && this.scenes.current instanceof PlayScene,
      this.doorPresentation.busy || this.playInput.uiBlocked || this.chrome.storagePaused,
      this.playInput.movementMode,
      this.playInput.carDriving,
    );
    this.doorControl.update(
      this.stateView,
      !vehiclePrompt &&
        this.initDone &&
        ready &&
        !this.scenes.has(IdeaScene) &&
        !this.overlayOpen(),
      this.scenes.current instanceof PlayScene
        ? this.scenes.current.lastMovement
        : this.actions.getMovement(),
      dt,
      this.doorPresentation.busy || this.playInput.inputBlocked,
    );
  }

  private render(alpha: number, presentationSeconds: number): void {
    this.time.alpha = alpha;
    this.time.presentationSeconds = presentationSeconds;
    this.renderHost.beginFrame();
    try {
      this.scenes.render(alpha);
    } finally {
      this.renderHost.endWorld();
    }
    if (this.initDone && (this.startupWorldReady || this.scenes.has(MenuScene))) finishStartup();
    if (this.initDone) {
      let buddies = 0;
      for (const entity of this.stateView.entities) if (entity.wanderAI?.following) buddies++;
      this.gemHUD.update(this.stateView.gemsCollected, buddies);
    }
  }

  /** Update the passive development action without changing menu focus. */
  setDevelopmentUpdate(label: string | null, reload: () => void): void {
    this.mainMenu.setDevelopmentUpdate(label, reload);
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
    this.playInput.clearPlayInput();
    this.chrome.optionsDialog.destroy();
    this.gemHUD.destroy();
    this.chrome.optionsButton?.remove();
    this.playInput.detachFocusListeners();
    this.chrome.showStorageStatus("", false);
    this.stopIdeaDelivery?.();
    this.renderHost.dispose();
    this.debugPanel.destroy();
    this.sceneFrame.clear();
    this.doorControl.destroy();
    this.vehicleControl.destroy();
    this.doorPresentation.destroy();
    this.loop.stop();
    this.session.flushServer();
    this.stateView.setPredictor(null);
    this.scenes.clear();
    this.requests.dispose();
    this.transport.close();
    this.worldMap.destroy();
    this.chrome.mapButton?.remove();
    this.actions.detach();
    this.consoleUI.destroy();
    this.mainMenu.destroy();
  }

  // ---- Actions ----

  /** World map, menu, catalog or interior catalog overlays block world shortcuts. */
  private overlayOpen(): boolean {
    return (
      this.scenes.has(WorldMapScene) ||
      this.scenes.has(MenuScene) ||
      this.scenes.has(CatalogScene) ||
      this.scenes.has(InteriorCatalogScene)
    );
  }

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
        void this.session
          .toggleMenu()
          .catch((error) => this.consoleEngine.output.printError(String(error)));
      }
    });
    this.actions.on("toggle_debug", () => {
      if (this.overlayOpen()) return;
      this.toggleDebug();
    });
    this.actions.on("toggle_editor", () => {
      if (this.overlayOpen()) return;
      this.toggleEditor();
    });
    this.actions.on("toggle_console", () => {
      this.consoleUI.toggle();
    });
    this.actions.on("toggle_base_mode", () => {
      if (this.overlayOpen()) return;
      if (this.debugEnabled) this.debugPanel.toggleBaseMode();
    });
  }

  private toggleDebug(): void {
    this.debugEnabled = !this.debugEnabled;
    this.debugPanel.visible = this.debugEnabled;
  }

  private toggleEditor(): void {
    if (this.doorPresentation.busy || this.chrome.optionsDialog.visible) return;
    if (this.scenes.current instanceof EditScene) {
      this.scenes.replace(new PlayScene());
    } else {
      this.scenes.replace(new EditScene());
    }
  }

  private toggleWorldMap(): void {
    if (this.doorPresentation.busy || this.chrome.optionsDialog.visible) return;
    if (this.scenes.current instanceof WorldMapScene) {
      this.scenes.pop();
      return;
    }
    if (!(this.scenes.current instanceof PlayScene || this.scenes.current instanceof EditScene))
      return;
    this.scenes.push(new WorldMapScene(this.worldMap));
  }

  private applyStartupRoute(): void {
    const params = new URLSearchParams(window.location.search);
    this.interiorCatalog.setRouteState(readInteriorRouteState(params));

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

  // ---- Helpers (also exposed via GameContext) ----

  /** Bounded gameplay context for automatic fault reporting. */
  getFaultContext(): FaultReport["context"] {
    const p = this.stateView.playerEntity.position;
    return {
      mode: "serialized",
      worldId: (this.mainMenu.currentWorldId ?? "").slice(0, 100),
      generation: (this.canvas.dataset.generation ?? "").slice(0, 2000),
      x: p.wx,
      y: p.wy,
      serverTick: this.stateView.serverTick,
      hidden: document.hidden,
    };
  }

  /** Send a request and resolve the response with its matching requestId. */
  gcSendRequest<R extends RequestMessage>(msg: R): Promise<RequestResponse<R>> {
    if (
      this.adminToken &&
      ["create-world", "recreate-world", "delete-world", "rename-world", "rcon"].includes(msg.type)
    )
      return this.requests.send({ ...msg, adminToken: this.adminToken });
    return this.requests.send(msg);
  }

  private showWorldIdentity(generation: GenerationDescriptor): void {
    this.canvas.dataset.generator = descriptorChoice(generation);
    this.canvas.dataset.seed = String(generation.seed);
    this.canvas.dataset.generation = JSON.stringify(generation);
  }

  // ---- Collaborator hosts (getters read the client lazily) ----

  private playInputHost(): PlayInputHost {
    const client = this;
    return {
      get currentScene() {
        return client.scenes?.current;
      },
      get stateView() {
        return client.stateView;
      },
      camera: this.camera,
      transport: this.transport,
      get audioManager() {
        return client.audioManager;
      },
      get doorBusy() {
        return client.doorPresentation.busy;
      },
      get storagePaused() {
        return client.chrome.storagePaused;
      },
      get menuOpen() {
        return client.chrome.menuOpen;
      },
      get zoom() {
        return client.debugPanel.zoom;
      },
      set zoom(zoom: number) {
        client.debugPanel.setZoom(zoom);
      },
    };
  }

  private sessionHost(): WorldSessionHost {
    const client = this;
    return {
      transport: this.transport,
      camera: this.camera,
      scenes: this.scenes,
      mainMenu: this.mainMenu,
      stateView: this.stateView,
      profile: this.profile,
      profileStore: this.profileStore,
      get menuBlocked() {
        return client.doorPresentation.busy || client.chrome.optionsDialog.visible;
      },
      clearPlayInput: () => this.playInput.clearPlayInput(),
      sendRequest: (msg) => this.gcSendRequest(msg),
      takeRequestId: () => this.nextRequestId++,
    };
  }

  private chromeHost(): MenuChromeHost {
    const client = this;
    return {
      canvas: this.canvas,
      renderHost: this.renderHost,
      get loop() {
        return client.loop;
      },
      get stateView() {
        return client.stateView;
      },
      mainMenu: this.mainMenu,
      get scenes() {
        return client.scenes;
      },
      get consoleEngine() {
        return client.consoleEngine;
      },
      xrManager: this.xrManager,
      profile: this.profile,
      profileStore: this.profileStore,
      get doorBusy() {
        return client.doorPresentation.busy;
      },
      toggleMenu: () => this.session.toggleMenu(),
      toggleWorldMap: () => this.toggleWorldMap(),
      toggleEditor: () => this.toggleEditor(),
      toggleDebug: () => this.toggleDebug(),
    };
  }

  private messageHost(): ServerMessageHost {
    const client = this;
    return {
      stateView: this.stateView,
      canvas: this.canvas,
      camera: this.camera,
      get renderer() {
        return client.renderer;
      },
      sceneFrame: this.sceneFrame,
      scenes: this.scenes,
      mainMenu: this.mainMenu,
      editorModel: this.editorModel,
      audioManager: this.audioManager,
      doorPresentation: this.doorPresentation,
      consoleEngine: this.consoleEngine,
      chatHUD: this.chatHUD,
      requests: this.requests,
      get debugPaused() {
        return client.debugPanel.paused;
      },
      get initDone() {
        return client.initDone;
      },
      playActive: () => this.playInput.playActive(),
      clearPlayInput: () => this.playInput.clearPlayInput(),
      showStorageStatus: (message, paused) => this.chrome.showStorageStatus(message, paused),
      showWorldIdentity: (generation) => this.showWorldIdentity(generation),
      sendVisibleRange: (force) => this.session.sendVisibleRange(force),
      sendDebugState: (paused, force) => this.session.sendDebugState(paused, force),
      sendRequest: (msg) => this.gcSendRequest(msg),
      takeRequestId: () => this.nextRequestId++,
      destroy: () => this.destroy(),
    };
  }

  // ---- GameContext construction ----

  private buildGameContext(): GameContext {
    // Use a proxy-like object so mutable fields (debugEnabled, gemSpriteCanvas, editorButton)
    // always reflect the latest value from GameClient.
    const client = this;
    const input = this.playInput;
    return {
      doorPresentation: this.doorPresentation,
      get realmId() {
        return client.mainMenu.currentWorldId;
      },
      get storagePaused() {
        return client.chrome.storagePaused;
      },
      get inputBlocked() {
        return input.inputBlocked;
      },
      get touchMovement() {
        return input.movementMode;
      },
      get carDriving() {
        return input.carDriving;
      },
      tapMovement: input.tapMovement,
      trainTapMovement: input.trainTapMovement,
      touchPinch: input.touchPinch,
      touchTap: input.touchTap,
      touchHold: input.touchHold,
      canvas: this.canvas,
      ctx: this.ctx,
      camera: this.camera,
      actions: this.actions,
      stateView: this.stateView,
      transport: this.transport,
      get spriteCatalog() {
        return client.renderer.assets;
      },
      get renderer() {
        return client.renderer;
      },
      beginWorld: () => client.renderHost.beginWorld(client.camera),
      endWorld: () => client.renderHost.endWorld(),
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
        return client.chrome.editorButton;
      },
      set editorButton(v) {
        client.chrome.editorButton = v;
      },
      get xrActive() {
        return client.xrManager.active;
      },
      flushServer: () => this.session.flushServer(),
      sendRequest: <R extends RequestMessage>(msg: R) => this.gcSendRequest(msg),
      sendVisibleRange: (force?: boolean) => this.session.sendVisibleRange(force),
      sendDebugState: (paused: boolean, force?: boolean) =>
        this.session.sendDebugState(paused, force),
    };
  }

  // ---- UI ----

  private resize(): void {
    // Use the canvas's actual displayed size (respects split-screen CSS when 3D view is active)
    const rect = this.canvas.getBoundingClientRect();
    this.renderHost.resize(Math.round(rect.width), Math.round(rect.height));
    this.camera.setViewport(this.canvas.width, this.canvas.height);
  }
}

function readInteriorRouteState(params: URLSearchParams): InteriorCatalogRouteState {
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
