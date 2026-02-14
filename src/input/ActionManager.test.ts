import { describe, expect, it, vi } from "vitest";
import { ActionManager } from "./ActionManager.js";
import type { ActionMapConfig } from "./ActionMap.js";
import { TouchJoystick } from "./TouchJoystick.js";

function makeCanvas(width = 800, height = 600): HTMLCanvasElement {
  return { width, height } as unknown as HTMLCanvasElement;
}

describe("ActionManager", () => {
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
    actions.pressKey("d");
    expect(actions.getMovement().dx).toBe(1);
    actions.releaseKey("d");

    actions.pressKey("a");
    expect(actions.getMovement().dx).toBe(-1);
    actions.releaseKey("a");

    actions.pressKey("w");
    expect(actions.getMovement().dy).toBe(-1);
    actions.releaseKey("w");

    actions.pressKey("s");
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
    actions.pressKey("Shift");
    expect(actions.getMovement().sprinting).toBe(true);
    actions.releaseKey("Shift");
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
    actions.pressKey("a");
    expect(actions.getPanDirection().dx).toBe(-1);
    actions.releaseKey("a");
    actions.pressKey("d");
    expect(actions.getPanDirection().dx).toBe(1);
    actions.releaseKey("d");
    actions.pressKey("w");
    expect(actions.getPanDirection().dy).toBe(-1);
    actions.releaseKey("w");
    actions.pressKey("s");
    expect(actions.getPanDirection().dy).toBe(1);
  });

  // --- isHeld ---

  it("isHeld returns true for held actions", () => {
    const actions = new ActionManager();
    expect(actions.isHeld("pan_modifier")).toBe(false);
    actions.pressKey(" ");
    expect(actions.isHeld("pan_modifier")).toBe(true);
    actions.releaseKey(" ");
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
    // "s" maps to both move_down and pan_down
    actions.pressKey("s");
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

    // Rebind to "e"
    const newConfig: ActionMapConfig = [{ action: "toggle_editor", keys: ["e"] }];
    actions.setConfig(newConfig);

    // Tab no longer fires
    actions.pressKey("Tab");
    expect(cb).toHaveBeenCalledTimes(1);
    actions.releaseKey("Tab");

    // "e" fires
    actions.pressKey("e");
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("setConfig updates movement bindings", () => {
    const actions = new ActionManager();
    const config: ActionMapConfig = [
      { action: "move_up", keys: ["i"] },
      { action: "move_down", keys: ["k"] },
      { action: "move_left", keys: ["j"] },
      { action: "move_right", keys: ["l"] },
      { action: "sprint", keys: ["Shift"] },
    ];
    actions.setConfig(config);

    actions.pressKey("i");
    expect(actions.getMovement().dy).toBe(-1);
    actions.releaseKey("i");

    // Old keys no longer work
    actions.pressKey("w");
    expect(actions.getMovement().dy).toBe(0);
  });
});
