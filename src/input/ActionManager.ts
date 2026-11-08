import type { Movement } from "../shared/Movement.js";
import type { ActionMapConfig, ActionName } from "./ActionMap.js";
import { DEFAULT_ACTION_MAP } from "./ActionMap.js";
import {
  CONTROLLER_ACTIONS,
  CONTROLLER_EVENT,
  type ControllerCommand,
  controllerInput,
} from "./ControllerInput.js";
import { acceptsGameKey } from "./KeyFocus.js";
import { eventCode, keyLabel } from "./KeyLabels.js";
import type { TouchButtons } from "./TouchButtons.js";
import type { TouchJoystick } from "./TouchJoystick.js";

const SQRT2_INV = 1 / Math.sqrt(2);

type DiscreteCallback = () => void;

export interface ActionManagerOptions {
  /** An embedded lab's root: keys and pads count only while focus is inside it,
   * never on its form controls (see KeyFocus). The game page passes none. */
  root?: HTMLElement;
}

export class ActionManager {
  private config: ActionMapConfig;
  private keyToActions = new Map<string, ActionName[]>();
  private boundKeys = new Set<string>();
  private readonly keysDown = new Set<string>();
  private readonly listeners = new Map<ActionName, Set<DiscreteCallback>>();
  private hornPressLatched = false;
  consumeHornPress(): boolean {
    const touch = this.touchButtons?.consumeHornPress() ?? false;
    const pressed = this.hornPressLatched || touch;
    this.hornPressLatched = false;
    return pressed;
  }
  private touchJoystick: TouchJoystick | null = null;
  private touchButtons: TouchButtons | null = null;
  private gamepad = true;
  private readonly root: HTMLElement | null;

  constructor(config?: ActionMapConfig, options: ActionManagerOptions = {}) {
    this.config = config ?? DEFAULT_ACTION_MAP;
    this.root = options.root ?? null;
    this.rebuildIndex();
  }

  /** Pads drive this manager: enabled and, for a lab, focused. */
  private get padActive(): boolean {
    return this.gamepad && (!this.root || this.root.contains(document.activeElement));
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
    this.gamepad = false;
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
    window.addEventListener(CONTROLLER_EVENT, this.onController);
    this.root?.addEventListener("focusout", this.onFocusOut);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener(CONTROLLER_EVENT, this.onController);
    this.root?.removeEventListener("focusout", this.onFocusOut);
    this.clearHeld();
  }

  /** Forget held keys. A set that reads pads also resets the shared pad collector; a
   * keyboard guest's scheme (pads disabled) leaves seat 0's pad alone. */
  clearHeld(): void {
    this.keysDown.clear();
    if (this.gamepad) controllerInput.reset();
    this.hornPressLatched = false;
  }

  /** The label of this map's first key for an action, on the player's layout. */
  hint(action: ActionName): string {
    const code = this.config.find((binding) => binding.action === action)?.keys[0];
    return code ? keyLabel(code) : "";
  }

  // --- Continuous action polling ---

  isHeld(action: ActionName): boolean {
    if (this.padActive && controllerInput.held.has(action)) return true;
    // Check on-screen touch buttons
    if (this.touchButtons) {
      if (action === "jump" && this.touchButtons.jumpPressed) return true;
      if (action === "honk" && this.touchButtons.hornPressed) return true;
      if (action === "throw" && this.touchButtons.throwPressed) return true;
      if (action === "sprint" && this.touchButtons.sprintPressed) return true;
      if (action === "reverse" && this.touchButtons.reversePressed) return true;
      if (action === "vehicle_lights" && this.touchButtons.lightsPressed) return true;
      if (action === "vehicle_style" && this.touchButtons.stylePressed) return true;
    }
    const binding = this.config.find((b) => b.action === action);
    if (!binding) return false;
    return binding.keys.some((k) => this.keysDown.has(k));
  }

  getMovement(normalizeDiagonal = true): Movement {
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
    if (normalizeDiagonal && dx !== 0 && dy !== 0) {
      dx *= SQRT2_INV;
      dy *= SQRT2_INV;
    }
    const sprinting = this.isHeld("sprint");
    const jump = this.isHeld("jump");

    // Merge gamepad: if keyboard is idle, use gamepad stick; always OR sprint
    const gp = this.padActive ? controllerInput.movement : undefined;
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
    if (this.padActive && dx === 0 && dy === 0) return controllerInput.movement;
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

  /** Run an action's listeners as its key would (a guest pad's menu button, 226). */
  trigger(action: ActionName): void {
    for (const callback of this.listeners.get(action) ?? []) callback();
  }

  // --- Testing helpers (physical `KeyboardEvent.code` values, e.g. "KeyW") ---

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
    if (e.ctrlKey || e.metaKey) return; // OS/browser shortcuts are not gameplay keys
    if (!acceptsGameKey(e.target, this.root)) return;
    const key = eventCode(e); // physical position: layout- and Shift-independent
    // Bound keys skip browser defaults (Tab, F3, Space scroll); DOM UI stops propagation.
    if (this.boundKeys.has(key)) e.preventDefault();
    if (this.keysDown.has(key)) return; // ignore repeat
    this.keysDown.add(key);
    this.fireActionsForKey(key);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    // macOS sends no keyup for keys released while ⌘ was held.
    e.key === "Meta" ? this.keysDown.clear() : this.keysDown.delete(eventCode(e));
  };

  private onController = (event: Event): void => {
    if (!this.padActive || event.defaultPrevented) return;
    const action = CONTROLLER_ACTIONS[(event as CustomEvent<ControllerCommand>).detail];
    if (action) for (const callback of this.listeners.get(action) ?? []) callback();
  };

  private onBlur = (): void => {
    this.clearHeld();
  };

  /** A lab's held keys release when focus leaves it (the keyup goes elsewhere). */
  private onFocusOut = (event: FocusEvent): void => {
    if (!this.root?.contains(event.relatedTarget as Node | null)) this.clearHeld();
  };

  private fireActionsForKey(key: string): void {
    const actions = this.keyToActions.get(key);
    if (!actions) return;
    for (const action of actions) {
      if (action === "honk") this.hornPressLatched = true;
      const callbacks = this.listeners.get(action);
      if (callbacks) {
        for (const cb of callbacks) {
          cb();
        }
      }
    }
  }
}
