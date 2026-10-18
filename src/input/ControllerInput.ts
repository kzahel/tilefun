import type { ActionName } from "./ActionMap.js";

export type ControllerCommand =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "back"
  | "menu"
  | "interact"
  | "throw"
  | "edit"
  | "map";
export const CONTROLLER_EVENT = "tilefun-controller";
const BUTTONS: Record<number, ControllerCommand> = {
  0: "confirm",
  1: "back",
  2: "throw",
  3: "interact",
  4: "edit",
  8: "map",
  9: "menu",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};
export const CONTROLLER_ACTIONS: Partial<Record<ControllerCommand, ActionName>> = {
  menu: "toggle_menu",
  confirm: "jump",
  throw: "throw",
  interact: "enter_place",
  edit: "toggle_editor",
  map: "toggle_world_map",
};

export function controllerAxes(x: number, y: number): { dx: number; dy: number } {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= 0.18) return { dx: 0, dy: 0 };
  const scale = Math.min(1, (magnitude - 0.18) / 0.82) / magnitude;
  return { dx: x * scale, dy: y * scale };
}

/** Frame-boundary collector. UI consumes semantic commands before gameplay does. */
export class ControllerInput {
  uiActive: () => boolean = () => false;
  held = new Set<ActionName>();
  rightStick = { dx: 0, dy: 0 };
  erase = false;
  get connected(): boolean {
    return this.source >= 0;
  }
  movement = { dx: 0, dy: 0, sprinting: false, jump: false };
  private previous = new Set<ControllerCommand>();
  private repeatAt = 0;
  private repeating: ControllerCommand | undefined;
  private blocked = true;
  private wasUI = false;
  private source = -1;
  private frame = 0;

  start(): void {
    if (this.frame || new URLSearchParams(location.search).has("nogamepad")) return;
    const tick = (now: number) => {
      this.sample(typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [], now);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
    window.addEventListener("blur", this.reset);
    document.addEventListener("visibilitychange", this.reset);
  }
  stop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    window.removeEventListener("blur", this.reset);
    document.removeEventListener("visibilitychange", this.reset);
    this.reset();
  }
  reset = (): void => {
    this.blocked = true;
    this.held.clear();
    this.rightStick = { dx: 0, dy: 0 };
    this.erase = false;
    this.movement = { dx: 0, dy: 0, sprinting: false, jump: false };
    this.previous.clear();
    this.repeating = undefined;
  };

  sample(pads: readonly (Gamepad | null)[], now: number): ControllerCommand[] {
    const standard = pads.filter((p): p is Gamepad => !!p?.connected && p.mapping === "standard");
    // Keep one active source until it is idle; two held pads must not fight every frame.
    const meaningful = (p: Gamepad) =>
      p.buttons.some((button) => button.pressed) || p.axes.some((axis) => Math.abs(axis) > 0.35);
    const current = standard.find((p) => p.index === this.source);
    const active =
      !current || !meaningful(current)
        ? standard.find((p) => p.index !== this.source && meaningful(p))
        : undefined;
    const gp = active ?? current ?? standard[0];
    if (!gp || (typeof document !== "undefined" && (document.hidden || !document.hasFocus()))) {
      if (!gp) this.source = -1;
      this.reset();
      return [];
    }
    if (gp.index !== this.source) {
      this.reset();
      this.source = gp.index;
    }
    const ui = this.uiActive();
    if (ui !== this.wasUI) {
      this.reset();
      this.wasUI = ui;
    }
    const axes = controllerAxes(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
    const buttons = gp.buttons;
    if (this.blocked) {
      if (buttons.some((b) => b.pressed) || gp.axes.some((axis) => Math.abs(axis) > 0.18))
        return [];
      this.blocked = false;
    }
    this.rightStick = ui ? { dx: 0, dy: 0 } : controllerAxes(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
    this.erase = !ui && !!buttons[6]?.pressed;
    this.held.clear();
    if (!ui) {
      if (buttons[0]?.pressed) this.held.add("jump");
      if (buttons[2]?.pressed) this.held.add("throw");
      if (buttons[5]?.pressed) this.held.add("honk");
      if (buttons[7]?.pressed) this.held.add("sprint");
    }
    this.movement = {
      ...(!ui ? axes : { dx: 0, dy: 0 }),
      sprinting: this.held.has("sprint"),
      jump: this.held.has("jump"),
    };
    const commands = new Set<ControllerCommand>();
    for (const [index, command] of Object.entries(BUTTONS))
      if (buttons[Number(index)]?.pressed) commands.add(command);
    if (ui) {
      if (axes.dy < -0.5) commands.add("up");
      if (axes.dy > 0.5) commands.add("down");
      if (axes.dx < -0.5) commands.add("left");
      if (axes.dx > 0.5) commands.add("right");
    }
    const emitted: ControllerCommand[] = [];
    for (const command of commands) {
      const direction = ["up", "down", "left", "right"].includes(command);
      const fresh = !this.previous.has(command);
      if (fresh || (ui && direction && command === this.repeating && now >= this.repeatAt)) {
        emitted.push(command);
        if (direction) {
          this.repeating = command;
          this.repeatAt = now + (fresh ? 380 : 110);
        }
      }
    }
    this.previous = commands;
    for (const command of emitted)
      if (typeof window !== "undefined")
        window.dispatchEvent(
          new CustomEvent(CONTROLLER_EVENT, { detail: command, cancelable: true }),
        );
    return emitted;
  }
}
export const controllerInput = new ControllerInput();
