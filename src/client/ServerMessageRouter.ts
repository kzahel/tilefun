import type { AudioManager } from "../audio/AudioManager.js";
import type { ConsoleEngine } from "../console/ConsoleEngine.js";
import type { SceneManager } from "../core/SceneManager.js";
import type { EditorModel } from "../editor/EditorModel.js";
import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import type { Camera } from "../rendering/Camera.js";
import type { RenderBackend } from "../rendering/RenderFrame.js";
import { MenuScene } from "../scenes/MenuScene.js";
import type { DeviceSession } from "../session/DeviceSession.js";
import type { RealmInfo, ServerMessage } from "../shared/protocol.js";
import type { RequestMessage, RequestResponse } from "../shared/requests.js";
import { LAST_WORLD_KEY } from "../shared/storageKeys.js";
import type { ChatHUD } from "../ui/ChatHUD.js";
import type { MainMenu } from "../ui/MainMenu.js";
import type { RemoteStateView } from "./ClientStateView.js";
import type { DoorPresentation } from "./DoorPresentation.js";
import type { ReloadCamera } from "./ReloadCamera.js";
import type { RequestBroker } from "./RequestBroker.js";

type RealmEntered = Extract<ServerMessage, { type: "world-loaded" | "realm-joined" }>;

/** Client surfaces that incoming server messages update. */
export interface ServerMessageHost {
  readonly stateView: RemoteStateView;
  readonly canvas: HTMLCanvasElement;
  readonly camera: Camera;
  readonly renderer: RenderBackend;
  /** Device presentation (scene frame and every view's fades), reset with the realm. */
  readonly device: Pick<DeviceSession, "clearPresentation">;
  readonly scenes: SceneManager;
  readonly mainMenu: MainMenu;
  readonly editorModel: EditorModel;
  readonly audioManager: AudioManager;
  readonly doorPresentation: DoorPresentation;
  readonly consoleEngine: ConsoleEngine;
  readonly chatHUD: ChatHUD;
  readonly requests: RequestBroker;
  readonly debugPaused: boolean;
  readonly initDone: boolean;
  /** Play scene on top and nothing blocks gameplay gestures. */
  playActive(): boolean;
  clearPlayInput(): void;
  showStorageStatus(message: string, paused: boolean): void;
  showWorldIdentity(generation: GenerationDescriptor): void;
  sendVisibleRange(force: boolean): void;
  sendDebugState(paused: boolean, force: boolean): void;
  sendRequest<R extends RequestMessage>(msg: R): Promise<RequestResponse<R>>;
  takeRequestId(): number;
  destroy(): void;
}

/**
 * Applies every server message to the client in arrival order. Buffered
 * frame/sync state waits for the next client tick; request responses resolve
 * after the message's own handling. The switch is exhaustive so each new
 * server message type needs an explicit routing decision.
 */
export class ServerMessageRouter {
  private autoJoinRealm: boolean;
  private reloadCamera: ReloadCamera | null;
  /** Realm list received while in lobby (multiplayer connect flow). */
  private lobbyRealmList: RealmInfo[] | null = null;

  constructor(
    private readonly host: ServerMessageHost,
    options: { autoJoinRealm: boolean; reloadCamera: ReloadCamera | null },
  ) {
    this.autoJoinRealm = options.autoJoinRealm;
    this.reloadCamera = options.reloadCamera;
  }

  /** Realm list buffered before init completed; clears it. */
  takeLobbyRealmList(): RealmInfo[] | null {
    const realms = this.lobbyRealmList;
    this.lobbyRealmList = null;
    return realms;
  }

  route(msg: ServerMessage): void {
    if (!this.apply(msg)) return;
    this.host.requests.receive(msg);
  }

  /** Returns false when the client was torn down and no reply may resolve. */
  private apply(msg: ServerMessage): boolean {
    const host = this.host;
    switch (msg.type) {
      case "vehicle-horn":
        if (host.playActive())
          host.audioManager.playVehicleHorn(msg, host.stateView.playerEntity.position);
        break;
      case "world-loaded":
      case "realm-joined":
        host.clearPlayInput();
        host.editorModel.setPatternStatus({ error: "", canUndo: false, canRedo: false });
        this.enterRealm(msg);
        break;
      case "door-motion":
        if (msg.self) host.clearPlayInput();
        host.doorPresentation.receive(msg);
        break;
      case "storage-status":
        host.showStorageStatus(msg.message, msg.paused);
        break;
      case "pattern-edit-status":
      case "room-edit-status":
        host.editorModel.setPatternStatus(msg);
        break;
      // Buffer frame/sync messages for deferred
      // application during client update tick (prevents async entity
      // position changes that desync camera and entity interpolation)
      case "frame":
      case "sync-room":
      case "sync-session":
      case "sync-invincibility":
      case "sync-chunks":
      case "sync-props":
      case "sync-cvars":
      case "sync-player-names":
      case "sync-editor-cursors":
        host.stateView.bufferMessage(msg);
        break;
      case "realm-list":
        this.receiveRealmList(msg);
        break;
      case "realm-left":
        this.leaveRealm();
        break;
      case "realm-player-count":
        host.mainMenu.updatePlayerCount(msg.worldId, msg.count);
        break;
      case "kicked":
        this.kicked(msg.reason);
        return false;
      case "player-assigned":
        console.log(`[tilefun] Player entity assigned: ${msg.entityId}`);
        break;
      case "chat":
        host.consoleEngine.output.printInfo(`[${msg.sender}] ${msg.text}`);
        host.chatHUD.addMessage(`[${msg.sender}] ${msg.text}`);
        break;
      // Replies that only resolve their pending request.
      case "vehicle-controlled":
      case "world-map":
      case "request-error":
      case "world-created":
      case "world-deleted":
      case "world-list":
      case "world-renamed":
      case "rcon-response":
      case "player-model-set":
        break;
      default:
        msg satisfies never;
    }
    return true;
  }

  private enterRealm(msg: RealmEntered): void {
    const { stateView, canvas } = this.host;
    this.autoJoinRealm = false;
    if (msg.generation) this.host.showWorldIdentity(msg.generation);
    stateView.interior = msg.interior ?? null;
    canvas.dataset.interior = msg.interior ? JSON.stringify(msg.interior) : "";
    console.log(
      `[tilefun:client] ${msg.type} — camera=(${msg.cameraX.toFixed(1)}, ${msg.cameraY.toFixed(1)}), predictor=${stateView.hasPredictedPlayer}, editorEnabled=${stateView.editorEnabled}`,
    );
    if (msg.worldId) {
      this.host.mainMenu.currentWorldId = msg.worldId;
      sessionStorage.setItem(LAST_WORLD_KEY, msg.interior?.parentWorldId ?? msg.worldId);
    }
    this.clearPresentation();
    this.placeCamera(msg);
    this.host.sendVisibleRange(true);
    this.host.sendDebugState(this.host.debugPaused, true);
    this.lobbyRealmList = null;
  }

  private placeCamera(msg: RealmEntered): void {
    const camera = this.host.camera;
    if (this.reloadCamera && this.reloadCamera.realmId === msg.worldId) {
      camera.snapTo(this.reloadCamera.cameraX, this.reloadCamera.cameraY);
      camera.zoom = this.reloadCamera.zoom;
    } else {
      camera.snapTo(msg.cameraX, msg.cameraY);
      camera.zoom = msg.cameraZoom;
      // Snap to player position on next follow() — avoids lerp when
      // switching worlds where the player position differs from saved camera.
      camera.requestSnap();
    }
    this.reloadCamera = null;
  }

  private clearPresentation(): void {
    this.host.stateView.clear();
    this.host.renderer.clear();
    this.host.device.clearPresentation();
  }

  private leaveRealm(): void {
    this.host.stateView.interior = null;
    this.host.canvas.dataset.interior = "";
    this.clearPresentation();
  }

  private receiveRealmList(msg: Extract<ServerMessage, { type: "realm-list" }>): void {
    // Skip unsolicited-broadcast handling when this is a response to
    // a gcSendRequest (e.g. from toggleMenu) — the requestId resolver
    // will deliver it to the caller, which pushes MenuScene itself.
    const isRequestResponse = "requestId" in msg && msg.requestId !== undefined;
    const playableRealms = msg.realms.filter((realm) => !realm.incompatibleReason);
    const firstPlayable = playableRealms[0];
    if (this.autoJoinRealm && firstPlayable) {
      this.autoJoin(playableRealms, firstPlayable);
    } else if (!isRequestResponse && this.host.initDone) {
      // Unsolicited broadcast — show realm browser immediately
      if (!this.host.scenes.has(MenuScene)) {
        this.host.scenes.push(new MenuScene(msg.realms));
      } else {
        this.host.mainMenu.show(msg.realms);
      }
    } else if (!isRequestResponse) {
      // Buffer for after init completes
      this.lobbyRealmList = msg.realms;
    }
  }

  private autoJoin(playableRealms: RealmInfo[], firstPlayable: RealmInfo): void {
    // Auto-join: prefer the last world this tab was in (survives HMR /
    // server restart), falling back to the most active realm.
    const lastWorldId = sessionStorage.getItem(LAST_WORLD_KEY);
    const target =
      (lastWorldId && playableRealms.find((r) => r.id === lastWorldId)) ||
      playableRealms.find((r) => r.playerCount > 0) ||
      firstPlayable;
    this.autoJoinRealm = false; // only auto-join once
    void this.host
      .sendRequest({
        type: "join-realm",
        requestId: this.host.takeRequestId(),
        worldId: target.id,
        resume: true,
      })
      .catch((error) => this.host.mainMenu.showCreationError(String(error)));
  }

  private kicked(reason: string): void {
    console.warn(`[tilefun] Kicked: ${reason}`);
    this.host.destroy();
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.85);color:#fff;display:flex;align-items:center;justify-content:center;font:bold 24px sans-serif;z-index:9999;text-align:center;padding:2em;";
    overlay.textContent = `Disconnected: ${reason}`;
    document.body.appendChild(overlay);
  }
}
