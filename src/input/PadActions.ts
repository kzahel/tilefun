import type { Movement } from "../shared/Movement.js";
import type { ActionName } from "./ActionMap.js";
import {
  CONTROLLER_HELD_ACTIONS,
  controllerActionHint,
  controllerAxes,
} from "./ControllerBindings.js";
import type { SeatActions } from "./SeatInput.js";

/** Buttons a guest pad presses as actions (standard mapping, as seat 0's pad). */
const PRESSES: Partial<Record<number, PadPress>> = {
  0: "jump",
  3: "enter_place",
  9: "toggle_menu",
  13: "vehicle_recover",
};
export type PadPress = "jump" | "enter_place" | "toggle_menu" | "vehicle_recover";

/** The parts of a `Gamepad` a seat reads. */
export interface PadReading {
  readonly connected: boolean;
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean }[];
}

const STILL: Movement = { dx: 0, dy: 0, sprinting: false, jump: false };

/** The right stick through the left stick's dead zone: first-person look (249). */
function rightStick(pad: PadReading): { dx: number; dy: number } {
  return controllerAxes(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
}

/**
 * One guest's pad as a seat's action set (226), polled with the page's pads.
 * Held actions and the stick follow seat 0's pad bindings; jump, enter, menu and
 * equipment fire on a fresh press. After joining, a clear or a menu, the pad acts again only
 * once every button is released, so the press that joined does not also jump.
 */
export class PadActions implements SeatActions {
  private readonly held = new Set<ActionName>();
  private movement = STILL;
  private lookStick = { dx: 0, dy: 0 };
  private previous = new Set<number>();
  private blocked = true;
  private hornLatched = false;
  private readonly listeners = new Map<PadPress, Set<() => void>>();

  constructor(readonly index: number) {}

  /** One poll of this pad; `ui` while a menu has focus (it presses nothing). */
  poll(pad: PadReading | undefined, ui: boolean): void {
    const pressed = new Set<number>();
    if (pad?.connected)
      for (const [index, button] of pad.buttons.entries()) if (button.pressed) pressed.add(index);
    if (!pad?.connected || ui || (this.blocked && pressed.size > 0)) {
      this.lookStick = { dx: 0, dy: 0 };
      this.clearHeld();
      this.previous = pressed;
      return;
    }
    this.blocked = false;
    this.held.clear();
    for (const index of pressed) {
      const action = CONTROLLER_HELD_ACTIONS[index];
      if (action) this.held.add(action);
    }
    const axes = controllerAxes(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    this.movement = { ...axes, sprinting: this.held.has("sprint"), jump: this.held.has("jump") };
    this.lookStick = rightStick(pad);
    for (const index of pressed) {
      if (this.previous.has(index)) continue;
      if (index === 5) this.hornLatched = true;
      const press = PRESSES[index];
      if (press) for (const callback of this.listeners.get(press) ?? []) callback();
    }
    this.previous = pressed;
  }

  /** Stick movement; the stick is already radial, so diagonals need no normalizing. */
  getMovement(_normalizeDiagonal = true): Movement {
    return this.movement;
  }

  /** The right stick: first-person look (249). */
  getLook(): { dx: number; dy: number } {
    return this.lookStick;
  }

  isHeld(action: ActionName): boolean {
    return this.held.has(action);
  }

  consumeHornPress(): boolean {
    const pressed = this.hornLatched;
    this.hornLatched = false;
    return pressed;
  }

  on(action: PadPress, callback: () => void): () => void {
    let set = this.listeners.get(action);
    if (!set) {
      set = new Set();
      this.listeners.set(action, set);
    }
    set.add(callback);
    return () => set.delete(callback);
  }

  /** The pad button for an action, as seat 0's pad hints label it ("Y"). */
  hint(action: ActionName): string {
    return controllerActionHint(action);
  }

  /** Forget held buttons; the pad acts again once every button is released. */
  clearHeld(): void {
    this.held.clear();
    this.movement = STILL;
    this.hornLatched = false;
    this.blocked = true;
  }
}
