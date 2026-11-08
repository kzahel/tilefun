import { describe, expect, it, vi } from "vitest";
import { ActionManager } from "./ActionManager.js";
import type { ActionMapConfig } from "./ActionMap.js";
import { TouchJoystick } from "./TouchJoystick.js";

function makeCanvas(width = 800, height = 600): HTMLCanvasElement {
  return { width, height } as unknown as HTMLCanvasElement;
}

describe("ActionManager", () => {
  it("triggers an action's listeners as its key would (a guest pad's menu button, 226)", () => {
    const actions = new ActionManager();
    const fired: string[] = [];
    actions.on("toggle_menu", () => fired.push("menu"));
    actions.on("jump", () => fired.push("jump"));
    actions.trigger("toggle_menu");
    expect(fired).toEqual(["menu"]);
  });

  it("dispatches interact without throwing or jumping", () => {
    const actions = new ActionManager();
    const context = vi.fn(),
      throwing = vi.fn();
    actions.on("enter_place", context);
    actions.on("throw", throwing);
    actions.pressKey("KeyE");
    expect(context).toHaveBeenCalledOnce();
    expect(throwing).not.toHaveBeenCalled();
    expect(actions.getMovement().jump).toBe(false);
  });
  // --- Movement (play mode) ---

  it("returns zero movement when no keys pressed", () => {
    const actions = new ActionManager();
    const m = actions.getMovement();
    expect(m.dx).toBe(0);
    expect(m.dy).toBe(0);
  });

  it("returns right movement for ArrowRight", () => {
    const actions = new ActionManager();
    actions.pressKey("ArrowRight");
    expect(actions.getMovement().dx).toBe(1);
    expect(actions.getMovement().dy).toBe(0);
  });

  it("returns left movement for ArrowLeft", () => {
    const actions = new ActionManager();
    actions.pressKey("ArrowLeft");
    expect(actions.getMovement().dx).toBe(-1);
  });

  it("returns up movement for ArrowUp", () => {
    const actions = new ActionManager();
    actions.pressKey("ArrowUp");
    expect(actions.getMovement().dy).toBe(-1);
  });

  it("returns down movement for ArrowDown", () => {
    const actions = new ActionManager();
    actions.pressKey("ArrowDown");
    expect(actions.getMovement().dy).toBe(1);
  });

  it("supports WASD keys", () => {
    const actions = new ActionManager();
    actions.pressKey("KeyD");
    expect(actions.getMovement().dx).toBe(1);
    actions.releaseKey("KeyD");

    actions.pressKey("KeyA");
    expect(actions.getMovement().dx).toBe(-1);
    actions.releaseKey("KeyA");

    actions.pressKey("KeyW");
    expect(actions.getMovement().dy).toBe(-1);
    actions.releaseKey("KeyW");

    actions.pressKey("KeyS");
    expect(actions.getMovement().dy).toBe(1);
  });

  it("normalizes diagonal movement", () => {
    const actions = new ActionManager();
    actions.pressKey("ArrowRight");
    actions.pressKey("ArrowDown");
    const m = actions.getMovement();
    const len = Math.sqrt(m.dx * m.dx + m.dy * m.dy);
    expect(len).toBeCloseTo(1, 5);
  });

  it("keeps full throttle while steering when axes are independent", () => {
    const actions = new ActionManager();
    actions.pressKey("ArrowRight");
    actions.pressKey("ArrowUp");
    const movement = actions.getMovement(false);
    expect(movement.dx).toBe(1);
    expect(movement.dy).toBe(-1);
  });

  it("cancels opposite directions", () => {
    const actions = new ActionManager();
    actions.pressKey("ArrowLeft");
    actions.pressKey("ArrowRight");
    expect(actions.getMovement().dx).toBe(0);
  });

  it("releases keys correctly", () => {
    const actions = new ActionManager();
    actions.pressKey("ArrowRight");
    actions.releaseKey("ArrowRight");
    expect(actions.getMovement().dx).toBe(0);
  });

  it("reports sprinting when Shift is held", () => {
    const actions = new ActionManager();
    expect(actions.getMovement().sprinting).toBe(false);
    actions.pressKey("ShiftLeft");
    expect(actions.getMovement().sprinting).toBe(true);
    actions.releaseKey("ShiftLeft");
    expect(actions.getMovement().sprinting).toBe(false);
  });

  it("touch joystick overrides keyboard when active", () => {
    const actions = new ActionManager();
    const joy = new TouchJoystick(makeCanvas());
    actions.setTouchJoystick(joy);
    actions.pressKey("ArrowLeft");
    joy.simulateTouchStart(100, 300);
    joy.simulateTouchMove(150, 300);
    const m = actions.getMovement();
    expect(m.dx).toBeGreaterThan(0);
    expect(m.sprinting).toBe(false);
  });

  it("falls back to keyboard when touch inactive", () => {
    const actions = new ActionManager();
    const joy = new TouchJoystick(makeCanvas());
    actions.setTouchJoystick(joy);
    actions.pressKey("ArrowRight");
    expect(actions.getMovement().dx).toBe(1);
  });

  // --- Pan direction (editor mode) ---

  it("returns zero pan when no keys pressed", () => {
    const actions = new ActionManager();
    const p = actions.getPanDirection();
    expect(p.dx).toBe(0);
    expect(p.dy).toBe(0);
  });

  it("returns correct pan direction", () => {
    const actions = new ActionManager();
    actions.pressKey("KeyA");
    expect(actions.getPanDirection().dx).toBe(-1);
    actions.releaseKey("KeyA");
    actions.pressKey("KeyD");
    expect(actions.getPanDirection().dx).toBe(1);
    actions.releaseKey("KeyD");
    actions.pressKey("KeyW");
    expect(actions.getPanDirection().dy).toBe(-1);
    actions.releaseKey("KeyW");
    actions.pressKey("KeyS");
    expect(actions.getPanDirection().dy).toBe(1);
  });

  // --- isHeld ---

  it("isHeld returns true for held actions", () => {
    const actions = new ActionManager();
    expect(actions.isHeld("pan_modifier")).toBe(false);
    actions.pressKey("Space");
    expect(actions.isHeld("pan_modifier")).toBe(true);
    actions.releaseKey("Space");
    expect(actions.isHeld("pan_modifier")).toBe(false);
  });

  // --- Discrete action callbacks ---

  it("fires discrete callback on key press", () => {
    const actions = new ActionManager();
    const cb = vi.fn();
    actions.on("toggle_editor", cb);
    actions.pressKey("Tab");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not fire discrete callback on key repeat", () => {
    const actions = new ActionManager();
    const cb = vi.fn();
    actions.on("toggle_editor", cb);
    actions.pressKey("Tab");
    actions.pressKey("Tab"); // already held, simulates repeat
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("fires callback again after release + re-press", () => {
    const actions = new ActionManager();
    const cb = vi.fn();
    actions.on("toggle_editor", cb);
    actions.pressKey("Tab");
    actions.releaseKey("Tab");
    actions.pressKey("Tab");
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("unsubscribe prevents future callbacks", () => {
    const actions = new ActionManager();
    const cb = vi.fn();
    const unsub = actions.on("toggle_editor", cb);
    actions.pressKey("Tab");
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    actions.releaseKey("Tab");
    actions.pressKey("Tab");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("one key fires multiple actions", () => {
    const actions = new ActionManager();
    const moveCb = vi.fn();
    const panCb = vi.fn();
    actions.on("move_down", moveCb);
    actions.on("pan_down", panCb);
    // KeyS maps to both move_down and pan_down
    actions.pressKey("KeyS");
    expect(moveCb).toHaveBeenCalledTimes(1);
    expect(panCb).toHaveBeenCalledTimes(1);
  });

  // --- Config replacement ---

  it("setConfig changes bindings immediately", () => {
    const actions = new ActionManager();
    const cb = vi.fn();
    actions.on("toggle_editor", cb);

    // Default: Tab triggers toggle_editor
    actions.pressKey("Tab");
    expect(cb).toHaveBeenCalledTimes(1);
    actions.releaseKey("Tab");

    // Rebind to KeyE
    const newConfig: ActionMapConfig = [{ action: "toggle_editor", keys: ["KeyE"] }];
    actions.setConfig(newConfig);

    // Tab no longer fires
    actions.pressKey("Tab");
    expect(cb).toHaveBeenCalledTimes(1);
    actions.releaseKey("Tab");

    // KeyE fires
    actions.pressKey("KeyE");
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("setConfig updates movement bindings", () => {
    const actions = new ActionManager();
    const config: ActionMapConfig = [
      { action: "move_up", keys: ["KeyI"] },
      { action: "move_down", keys: ["KeyK"] },
      { action: "move_left", keys: ["KeyJ"] },
      { action: "move_right", keys: ["KeyL"] },
      { action: "sprint", keys: ["ShiftLeft"] },
    ];
    actions.setConfig(config);

    actions.pressKey("KeyI");
    expect(actions.getMovement().dy).toBe(-1);
    actions.releaseKey("KeyI");

    // Old keys no longer work
    actions.pressKey("KeyW");
    expect(actions.getMovement().dy).toBe(0);
  });
});

it("latches a complete horn tap between simulation frames and clears pending input", () => {
  const actions = new ActionManager();
  actions.pressKey("Space");
  expect(actions.isHeld("honk")).toBe(true);
  expect(actions.getMovement().jump).toBe(true); // Space still jumps on foot.
  actions.releaseKey("Space");
  expect(actions.getMovement().jump).toBe(false);
  expect(actions.isHeld("honk")).toBe(false);
  expect(actions.consumeHornPress()).toBe(true);
  expect(actions.consumeHornPress()).toBe(false);
  actions.pressKey("KeyH");
  actions.clearHeld();
  expect(actions.consumeHornPress()).toBe(false);
});

describe("physical key bindings", () => {
  type KeyHandler = (event: Pick<KeyboardEvent, "code" | "key" | "preventDefault">) => void;
  const keyEvent = (code: string, key: string) => ({ code, key, preventDefault() {} });
  const handlers = (actions: ActionManager) =>
    actions as unknown as { onKeyDown: KeyHandler; onKeyUp: KeyHandler };

  it("keeps WASD and E at their positions on another layout (Dvorak)", () => {
    const actions = new ActionManager();
    const enter = vi.fn();
    actions.on("enter_place", enter);
    const { onKeyDown, onKeyUp } = handlers(actions);
    // Dvorak types "," on the W key and "." on the E key.
    onKeyDown(keyEvent("KeyW", ","));
    expect(actions.getMovement().dy).toBe(-1);
    onKeyUp(keyEvent("KeyW", ","));
    expect(actions.getMovement().dy).toBe(0);
    onKeyDown(keyEvent("KeyE", "."));
    expect(enter).toHaveBeenCalledOnce();
    // The key that types "w" on Dvorak sits on QWERTY's comma and does not move.
    onKeyDown(keyEvent("Comma", "w"));
    expect(actions.getMovement().dy).toBe(0);
  });

  it("releases a key pressed before Shift changed its character", () => {
    const actions = new ActionManager();
    const { onKeyDown, onKeyUp } = handlers(actions);
    onKeyDown(keyEvent("KeyD", "d"));
    onKeyUp(keyEvent("KeyD", "D"));
    expect(actions.getMovement().dx).toBe(0);
  });

  it("ignores Ctrl/⌘ shortcuts and releases keys when ⌘ is released (macOS)", () => {
    const actions = new ActionManager();
    const { onKeyDown, onKeyUp } = handlers(actions);
    // AZERTY Ctrl+Z is the physical W key: undo must not walk.
    onKeyDown({ ...keyEvent("KeyW", "z"), ctrlKey: true } as KeyboardEvent);
    expect(actions.getMovement().dy).toBe(0);
    onKeyDown(keyEvent("KeyD", "d"));
    // macOS sends no keyup for D when it is released while ⌘ is held.
    onKeyUp(keyEvent("MetaLeft", "Meta"));
    expect(actions.getMovement().dx).toBe(0);
  });

  it("falls back to the typed character when a virtual keyboard sends no code", () => {
    const actions = new ActionManager();
    const { onKeyDown } = handlers(actions);
    onKeyDown(keyEvent("", "a"));
    expect(actions.getMovement().dx).toBe(-1);
  });
});
