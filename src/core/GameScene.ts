import type { Spritesheet } from "../assets/Spritesheet.js";
import type { ClientStateView } from "../client/ClientStateView.js";
import type { EditorMode } from "../editor/EditorMode.js";
import type { EditorPanel } from "../editor/EditorPanel.js";
import type { PropCatalog } from "../editor/PropCatalog.js";
import type { ActionManager } from "../input/ActionManager.js";
import type { TouchJoystick } from "../input/TouchJoystick.js";
import type { Camera } from "../rendering/Camera.js";
import type { DebugPanel } from "../rendering/DebugPanel.js";
import type { TileRenderer } from "../rendering/TileRenderer.js";
import type { GameServer } from "../server/GameServer.js";
import type { ClientMessage } from "../shared/protocol.js";
import type { IClientTransport } from "../transport/Transport.js";
import type { MainMenu } from "../ui/MainMenu.js";
import type { SceneManager } from "./SceneManager.js";

/**
 * Shared resources available to all scenes.
 * Constructed once by GameClient and passed to SceneManager.
 */
export interface GameContext {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly camera: Camera;
  readonly actions: ActionManager;
  readonly stateView: ClientStateView;
  readonly transport: IClientTransport;
  readonly sheets: Map<string, Spritesheet>;
  readonly tileRenderer: TileRenderer;

  // DOM UI components (scenes control their visibility)
  readonly editorMode: EditorMode;
  readonly editorPanel: EditorPanel;
  readonly mainMenu: MainMenu;
  readonly propCatalog: PropCatalog;
  readonly debugPanel: DebugPanel;
  readonly touchJoystick: TouchJoystick;

  // Server access (local mode only, null in serialized)
  readonly server: GameServer | null;
  readonly serialized: boolean;

  // Scene manager reference (so scenes can push/pop)
  readonly scenes: SceneManager;

  // Mutable client-side state
  gemSpriteCanvas: HTMLCanvasElement | null;
  debugEnabled: boolean;
  editorButton: HTMLButtonElement | null;

  // Helper methods
  flushServer(): void;
  sendRequest<T>(msg: ClientMessage & { requestId: number }): Promise<T>;
  sendVisibleRange(): void;
}

/**
 * A game scene/state. Managed on a stack by SceneManager.
 * Each scene owns its update, render, and lifecycle.
 */
export interface GameScene {
  /** If true, the scene below also renders (for overlays like menus). */
  readonly transparent: boolean;

  /** Called when this scene is pushed onto the stack. */
  onEnter(ctx: GameContext): void;

  /** Called when this scene is popped from the stack. */
  onExit(ctx: GameContext): void;

  /** Called when this scene becomes the top again (scene above was popped). */
  onResume(ctx: GameContext): void;

  /** Called when another scene is pushed on top of this one. */
  onPause(ctx: GameContext): void;

  /** Fixed-timestep update. Only the top scene's update() is called. */
  update(dt: number, ctx: GameContext): void;

  /** Render frame. Called bottom-up through transparent scene chain. */
  render(alpha: number, ctx: GameContext): void;
}
