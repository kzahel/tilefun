import type { AudioManager } from "../audio/AudioManager.js";
import type { ConsoleEngine } from "../console/ConsoleEngine.js";
import type { GameLoop } from "../core/GameLoop.js";
import type { Time } from "../core/Time.js";
import type { FaultReport } from "../diagnostics/FaultReport.js";
import type { PerformanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import type { EditorMode } from "../editor/EditorMode.js";
import type { EditorModel } from "../editor/EditorModel.js";
import type { EditorPanel } from "../editor/EditorPanel.js";
import type { TapMovement } from "../input/TapMovement.js";
import type { TouchButtons } from "../input/TouchButtons.js";
import type { TouchJoystick } from "../input/TouchJoystick.js";
import type { Camera } from "../rendering/Camera.js";
import type { DebugPanel } from "../rendering/DebugPanel.js";
import type { RenderBackend } from "../rendering/RenderFrame.js";
import type { RenderHost } from "../rendering/RenderHost.js";
import type { RequestMessage, RequestResponse } from "../shared/requests.js";
import type { NetEmulatedClientTransport } from "../transport/NetEmulatedClientTransport.js";
import type { IClientTransport } from "../transport/Transport.js";
import type { GemHUD } from "../ui/GemHUD.js";
import type { MainMenu } from "../ui/MainMenu.js";
import type { RemoteStateView } from "./ClientStateView.js";
import type { FirstPersonControl } from "./FirstPersonControl.js";

/**
 * The stable surface that Playwright specs and browser instrumentation read
 * from `canvas.__game`. The runtime value is the GameClient instance; this
 * interface names the members that tests may depend on. Adding a member here
 * is an explicit decision to expose it to tests and scripts.
 */
export interface GameTestHooks {
  readonly canvas: HTMLCanvasElement;
  readonly renderHost: RenderHost;
  readonly renderer: RenderBackend;
  readonly camera: Camera;
  readonly loop: GameLoop;
  readonly time: Time;
  readonly performanceMetrics: PerformanceMetrics;
  /** True once init() has completed and the UI is ready. */
  readonly initDone: boolean;

  readonly stateView: RemoteStateView;
  readonly transport: IClientTransport;
  readonly netEmulatedTransport: NetEmulatedClientTransport;
  /** Request correlation counter; callers of `gcSendRequest` take `nextRequestId++`. */
  nextRequestId: number;
  gcSendRequest<R extends RequestMessage>(msg: R): Promise<RequestResponse<R>>;
  getFaultContext(): FaultReport["context"];

  readonly debugPanel: DebugPanel;
  /** Experimental first-person look/view state (tactical 229 captures). */
  readonly firstPerson: FirstPersonControl;
  readonly mainMenu: MainMenu;
  readonly editorMode: EditorMode;
  readonly editorModel: EditorModel;
  readonly editorPanel: EditorPanel;
  readonly consoleEngine: ConsoleEngine;
  readonly audioManager: AudioManager;
  readonly gemHUD: GemHUD;

  readonly tapMovement: TapMovement;
  readonly touchButtons: TouchButtons;
  readonly touchJoystick: TouchJoystick;

  readonly profile: { readonly id: string; readonly name: string } | null;
  /** Profile operations that specs drive through the running client. */
  readonly profileStore:
    | {
        createProfile(name: string): Promise<{ id: string; name: string }>;
        updateProfile?(id: string, updates: object): Promise<void>;
      }
    | undefined;
}

/**
 * Install the client as `canvas.__game`. The value stays the GameClient
 * instance because untyped `.mjs` instrumentation reads it directly.
 */
export function exposeGameTestHooks(canvas: HTMLCanvasElement, hooks: GameTestHooks): void {
  Object.assign(canvas, { __game: hooks });
}
