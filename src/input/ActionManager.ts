import type { ActionMapConfig, ActionName } from "./ActionMap.js";
import { DEFAULT_ACTION_MAP } from "./ActionMap.js";
import { GamepadPoller } from "./GamepadPoller.js";
import type { TouchButtons } from "./TouchButtons.js";
import type { TouchJoystick } from "./TouchJoystick.js";

const SQRT2_INV = 1 / Math.sqrt(2);

export interface Movement {
  dx: number;
  dy: number;
  sprinting: boolean;
  jump: boolean;
}

type DiscreteCallback = () => void;

export class ActionManager {
  private config: ActionMapConfig;
  private keyToActions = new Map<string, ActionName[]>();
  private boundKeys = new Set<string>();
  private readonly keysDown = new Set<string>();
  private readonly listeners = new Map<ActionName, Set<DiscreteCallback>>();
  private touchJoystick: TouchJoystick | null = null;
  private touchButtons: TouchButtons | null = null;
  private gamepadPoller: GamepadPoller | null = new GamepadPoller();

  constructor(config?: ActionMapConfig) {
    this.config = config ?? DEFAULT_ACTION_MAP;
    this.rebuildIndex();
  }

  private rebuildIndex(): void {
    this.keyToActions.clear();
    this.boundKeys.clear();
    for (const binding of this.config) {
      for (const key of binding.keys) {
        this.boundKeys.add(key);
        const existing = this.keyToActions.get(key);
        if (existing) {
          existing.push(binding.action);
        } else {
          this.keyToActions.set(key, [binding.action]);
        }
      }
    }
  }

  setConfig(config: ActionMapConfig): void {
    this.config = config;
    this.rebuildIndex();
  }

  getConfig(): ActionMapConfig {
    return this.config;
  }

  disableGamepad(): void {
    this.gamepadPoller = null;
  }

  setTouchJoystick(joystick: TouchJoystick): void {
    this.touchJoystick = joystick;
  }

  setTouchButtons(buttons: TouchButtons): void {
    this.touchButtons = buttons;
  }

  attach(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.keysDown.clear();
  }

  // --- Continuous action polling ---

  isHeld(action: ActionName): boolean {
    // Check on-screen touch buttons
    if (this.touchButtons) {
      if (action === "jump" && this.touchButtons.jumpPressed) return true;
      if (action === "throw" && this.touchButtons.throwPressed) return true;
      if (action === "sprint" && this.touchButtons.sprintPressed) return true;
    }
    const binding = this.config.find((b) => b.action === action);
    if (!binding) return false;
    return binding.keys.some((k) => this.keysDown.has(k));
  }

  getMovement(): Movement {
    if (this.touchJoystick?.isActive()) {
      const touch = this.touchJoystick.getMovement();
      return {
        dx: touch.dx,
        dy: touch.dy,
        sprinting: this.isHeld("sprint"),
        jump: this.isHeld("jump"),
      };
    }
    let dx = 0;
    let dy = 0;
    if (this.isHeld("move_left")) dx -= 1;
    if (this.isHeld("move_right")) dx += 1;
    if (this.isHeld("move_up")) dy -= 1;
    if (this.isHeld("move_down")) dy += 1;
    if (dx !== 0 && dy !== 0) {
      dx *= SQRT2_INV;
      dy *= SQRT2_INV;
    }
    const sprinting = this.isHeld("sprint");
    const jump = this.isHeld("jump");

    // Merge gamepad: if keyboard is idle, use gamepad stick; always OR sprint
    const gp = this.gamepadPoller?.poll();
    if (gp && dx === 0 && dy === 0 && (gp.dx !== 0 || gp.dy !== 0)) {
      return { dx: gp.dx, dy: gp.dy, sprinting: sprinting || gp.sprinting, jump: jump || gp.jump };
    }
    return {
      dx,
      dy,
      sprinting: sprinting || (gp?.sprinting ?? false),
      jump: jump || (gp?.jump ?? false),
    };
  }

  getPanDirection(): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;
    if (this.isHeld("pan_left")) dx -= 1;
    if (this.isHeld("pan_right")) dx += 1;
    if (this.isHeld("pan_up")) dy -= 1;
    if (this.isHeld("pan_down")) dy += 1;
    return { dx, dy };
  }

  // --- Discrete action subscriptions ---

  on(action: ActionName, cb: DiscreteCallback): () => void {
    let set = this.listeners.get(action);
    if (!set) {
      set = new Set();
      this.listeners.set(action, set);
    }
    set.add(cb);
    return () => {
      set.delete(cb);
    };
  }

  // --- Testing helpers ---

  pressKey(key: string): void {
    if (this.keysDown.has(key)) return; // ignore repeat
    this.keysDown.add(key);
    this.fireActionsForKey(key);
  }

  releaseKey(key: string): void {
    this.keysDown.delete(key);
  }

  // --- Internal handlers ---

  private onKeyDown = (e: KeyboardEvent): void => {
    // preventDefault for all bound keys to prevent browser defaults
    // (Tab focus, F3 dev tools, Space scroll, etc.)
    // Safe because DOM UI elements use stopPropagation.
    if (this.boundKeys.has(e.key)) {
      e.preventDefault();
    }
    if (this.keysDown.has(e.key)) return; // ignore repeat
    this.keysDown.add(e.key);
    this.fireActionsForKey(e.key);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.key);
  };

  private onBlur = (): void => {
    this.keysDown.clear();
  };

  private fireActionsForKey(key: string): void {
    const actions = this.keyToActions.get(key);
    if (!actions) return;
    for (const action of actions) {
      const callbacks = this.listeners.get(action);
      if (callbacks) {
        for (const cb of callbacks) {
          cb();
        }
      }
    }
  }
}
