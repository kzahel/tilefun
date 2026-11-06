import type { AudioManager } from "../audio/AudioManager.js";
import type { GameScene } from "../core/GameScene.js";
import { isBefriendHit } from "../game/playInteraction.js";
import type { ActionManager } from "../input/ActionManager.js";
import { TapMovement, type TapTarget, type TouchMovementMode } from "../input/TapMovement.js";
import { TouchButtons } from "../input/TouchButtons.js";
import { TouchHold } from "../input/TouchHold.js";
import { TouchJoystick } from "../input/TouchJoystick.js";
import { TouchPinch } from "../input/TouchPinch.js";
import { TouchTap } from "../input/TouchTap.js";
import { TrainTapMovement } from "../input/TrainTapMovement.js";
import { isTrain } from "../railway/Train.js";
import type { Camera } from "../rendering/Camera.js";
import { PlayScene } from "../scenes/PlayScene.js";
import type { CarDrivingStyle } from "../traffic/CarControls.js";
import { occupiedVehicle } from "../traffic/VehicleSeats.js";
import type { IClientTransport } from "../transport/Transport.js";
import type { RemoteStateView } from "./ClientStateView.js";

/**
 * Client state the play input reads lazily. Several members are created after
 * the controller during GameClient construction, so read them only from
 * event handlers and later calls.
 */
export interface PlayInputHost {
  /** Top scene, or undefined while the client is still constructing. */
  readonly currentScene: GameScene | null | undefined;
  readonly stateView: RemoteStateView;
  readonly camera: Camera;
  readonly transport: IClientTransport;
  readonly audioManager: AudioManager;
  readonly doorBusy: boolean;
  readonly storagePaused: boolean;
  /** The hamburger panel or the Options dialog is open. */
  readonly menuOpen: boolean;
  zoom: number;
}

export interface PlayInputSettings {
  movementMode: TouchMovementMode;
  pinchZoom: boolean;
  carDriving: CarDrivingStyle;
}

/**
 * Play-mode pointer, touch and focus input: touch controls, tap/hold movement,
 * pinch zoom, click/tap interaction and the shared input reset.
 */
export class PlayInputController {
  readonly touchJoystick: TouchJoystick;
  readonly touchButtons: TouchButtons;
  readonly tapMovement = new TapMovement();
  readonly trainTapMovement = new TrainTapMovement();
  readonly touchTap: TouchTap;
  readonly touchHold: TouchHold;
  readonly touchPinch: TouchPinch;
  private readonly settings: PlayInputSettings;
  private focusPaused = false;
  private lastTouchAt = -Infinity;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly actions: ActionManager,
    private readonly host: PlayInputHost,
    settings: PlayInputSettings,
  ) {
    this.settings = settings;
    this.touchJoystick = new TouchJoystick(canvas);
    this.touchButtons = new TouchButtons(canvas);
    this.touchTap = new TouchTap(
      canvas,
      this.touchButtons.claimedTouches,
      (x, y) =>
        (this.movementMode !== "tap" && this.movementMode !== "hold") || this.gestureBlocked
          ? null
          : this.resolveDriveTap(x, y),
      (target) => this.onDestinationTap(target),
    );
    this.touchHold = new TouchHold(canvas, this.touchButtons.claimedTouches, (x, y) =>
      this.movementMode !== "hold" || !this.inPlayScene || this.gestureBlocked
        ? null
        : this.resolveDriveTap(x, y),
    );
    this.touchJoystick.enabled = this.movementMode === "joystick";
    // Let joystick skip touches claimed by on-screen buttons
    this.touchJoystick.claimedTouches = this.touchButtons.claimedTouches;
    this.actions.setTouchJoystick(this.touchJoystick);
    this.actions.setTouchButtons(this.touchButtons);
    this.touchPinch = new TouchPinch(
      canvas,
      this.touchButtons.claimedTouches,
      () => this.pinchZoom && this.playActive(),
      () => {
        const { dx, dy } = this.touchJoystick.getMovement();
        return dx !== 0 || dy !== 0;
      },
      () => this.host.zoom,
      (zoom) => {
        this.host.zoom = zoom;
      },
      () => this.clearPlayInput(),
    );
  }

  get movementMode(): TouchMovementMode {
    return this.settings.movementMode;
  }
  get pinchZoom(): boolean {
    return this.settings.pinchZoom;
  }
  get carDriving(): CarDrivingStyle {
    return this.settings.carDriving;
  }

  setMovementMode(mode: TouchMovementMode): void {
    this.clearPlayInput();
    this.settings.movementMode = mode;
    this.touchJoystick.enabled = mode === "joystick";
  }
  setPinchZoom(enabled: boolean): void {
    this.clearPlayInput();
    this.settings.pinchZoom = enabled;
  }
  setCarDriving(style: CarDrivingStyle): void {
    this.clearPlayInput();
    this.settings.carDriving = style;
  }

  /** Menus, the Options dialog, lost focus or a hidden page block play UI. */
  get uiBlocked(): boolean {
    return this.host.menuOpen || this.focusPaused || document.hidden;
  }
  get inputBlocked(): boolean {
    return this.uiBlocked;
  }
  /** Play scene on top and nothing blocks gameplay gestures. */
  playActive(): boolean {
    return this.inPlayScene && !this.gestureBlocked;
  }

  private get inPlayScene(): boolean {
    return this.host.currentScene instanceof PlayScene;
  }
  private get gestureBlocked(): boolean {
    return this.inputBlocked || this.host.storagePaused || this.host.doorBusy;
  }

  /** Focus, visibility and touch-recency listeners. */
  attachFocusListeners(): void {
    window.addEventListener("blur", this.onInputBlur);
    window.addEventListener("focus", this.onInputFocus);
    document.addEventListener("visibilitychange", this.onInputVisibility);
    this.canvas.addEventListener("touchstart", this.noteTouch, { capture: true, passive: true });
    this.canvas.addEventListener("touchend", this.noteTouch, { capture: true, passive: true });
    this.canvas.addEventListener("touchcancel", this.noteTouch, { capture: true, passive: true });
  }

  /** Desktop click and joystick tap interaction. */
  attachPlayClicks(): void {
    this.canvas.addEventListener("click", (e) => this.onPlayClick(e));
    this.touchJoystick.onTap = (clientX, clientY) => this.onPlayTap(clientX, clientY);
  }

  detachFocusListeners(): void {
    window.removeEventListener("blur", this.onInputBlur);
    window.removeEventListener("focus", this.onInputFocus);
    document.removeEventListener("visibilitychange", this.onInputVisibility);
    this.canvas.removeEventListener("touchstart", this.noteTouch, true);
    this.canvas.removeEventListener("touchend", this.noteTouch, true);
    this.canvas.removeEventListener("touchcancel", this.noteTouch, true);
  }

  clearPlayInput(sendNeutral = true): void {
    const { audioManager, transport } = this.host;
    audioManager.stopSirens();
    audioManager.stopTrains();
    audioManager.stopCarEngine();
    audioManager.stopHorns();
    if (this.host.currentScene instanceof PlayScene)
      transport.send({ type: "vehicle-horn", active: false });
    const scene = this.host.currentScene;
    if (sendNeutral && scene instanceof PlayScene) scene.cancelInput(transport);
    this.tapMovement.cancel();
    this.trainTapMovement.cancel();
    this.touchPinch.reset();
    this.touchTap.reset();
    this.touchHold.reset();
    this.touchJoystick.reset();
    this.touchButtons.reset();
    this.actions.clearHeld();
  }

  /** Handle click in play mode (desktop). */
  private onPlayClick(e: MouseEvent): void {
    if (performance.now() - this.lastTouchAt < 1000 || this.gestureBlocked) return;
    if (!this.inPlayScene) return;
    if (this.movementMode === "tap" || this.movementMode === "hold") {
      const target = this.resolveDriveTap(e.clientX, e.clientY);
      if (target) this.onDestinationTap(target);
      return;
    }
    this.interactAt(e.clientX, e.clientY);
  }

  /** Handle tap in play mode (mobile). */
  private resolveDriveTap(x: number, y: number): TapTarget | null {
    const { stateView } = this.host;
    const target = this.tapMovement.resolve(this.canvas, x, y);
    const vehicle = occupiedVehicle(stateView.playerEntity, stateView.entities);
    if (!target || !vehicle || !isTrain(vehicle)) return target;
    const rect = this.canvas.getBoundingClientRect();
    return { ...target, screenSide: x < rect.left + rect.width / 2 ? -1 : 1 };
  }
  private onPlayTap(clientX: number, clientY: number): void {
    if (this.gestureBlocked) return;
    if (!this.inPlayScene) return;
    this.interactAt(clientX, clientY);
  }
  private interactAt(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const sx = (clientX - rect.left) * (this.canvas.width / rect.width);
    const sy = (clientY - rect.top) * (this.canvas.height / rect.height);
    const world = this.host.camera.screenToWorld(sx, sy);
    this.host.transport.send({
      type: "player-interact",
      wx: world.wx,
      wy: world.wy,
    });
  }

  private onInputBlur = (): void => {
    this.focusPaused = true;
    this.clearPlayInput();
  };
  private onInputFocus = (): void => {
    this.focusPaused = false;
  };
  private onInputVisibility = (): void => {
    if (document.hidden) this.clearPlayInput();
  };
  private noteTouch = (): void => {
    this.lastTouchAt = performance.now();
  };

  private onDestinationTap(target: TapTarget): void {
    if (
      !this.inPlayScene ||
      (this.movementMode !== "tap" && this.movementMode !== "hold") ||
      this.gestureBlocked
    )
      return;
    const { stateView } = this.host;
    const vehicle = occupiedVehicle(stateView.playerEntity, stateView.entities);
    if (vehicle && isTrain(vehicle)) {
      if (this.movementMode === "hold") return;
      this.tapMovement.cancel();
      this.trainTapMovement.tap(target.screenSide ?? 1);
      return;
    }
    const eligible =
      !vehicle &&
      stateView.entities.some((e) =>
        isBefriendHit(
          target.wx,
          target.wy,
          e.position.wx,
          e.position.wy,
          e.wanderAI?.befriendable === true,
        ),
      );
    if (eligible) {
      this.tapMovement.cancel();
      this.host.transport.send({ type: "player-interact", wx: target.wx, wy: target.wy });
    } else if (this.movementMode === "tap") this.tapMovement.setTarget(target);
  }
}
