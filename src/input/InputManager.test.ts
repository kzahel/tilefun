import { describe, expect, it } from "vitest";
import { InputManager } from "./InputManager.js";

describe("InputManager", () => {
  it("returns zero movement when no keys pressed", () => {
    const input = new InputManager();
    const m = input.getMovement();
    expect(m.dx).toBe(0);
    expect(m.dy).toBe(0);
  });

  it("returns right movement for ArrowRight", () => {
    const input = new InputManager();
    input.pressKey("ArrowRight");
    const m = input.getMovement();
    expect(m.dx).toBe(1);
    expect(m.dy).toBe(0);
  });

  it("returns left movement for ArrowLeft", () => {
    const input = new InputManager();
    input.pressKey("ArrowLeft");
    const m = input.getMovement();
    expect(m.dx).toBe(-1);
    expect(m.dy).toBe(0);
  });

  it("returns up movement for ArrowUp", () => {
    const input = new InputManager();
    input.pressKey("ArrowUp");
    const m = input.getMovement();
    expect(m.dx).toBe(0);
    expect(m.dy).toBe(-1);
  });

  it("returns down movement for ArrowDown", () => {
    const input = new InputManager();
    input.pressKey("ArrowDown");
    const m = input.getMovement();
    expect(m.dx).toBe(0);
    expect(m.dy).toBe(1);
  });

  it("supports WASD keys", () => {
    const input = new InputManager();
    input.pressKey("d");
    expect(input.getMovement().dx).toBe(1);
    input.releaseKey("d");

    input.pressKey("a");
    expect(input.getMovement().dx).toBe(-1);
    input.releaseKey("a");

    input.pressKey("w");
    expect(input.getMovement().dy).toBe(-1);
    input.releaseKey("w");

    input.pressKey("s");
    expect(input.getMovement().dy).toBe(1);
  });

  it("normalizes diagonal movement", () => {
    const input = new InputManager();
    input.pressKey("ArrowRight");
    input.pressKey("ArrowDown");
    const m = input.getMovement();
    const len = Math.sqrt(m.dx * m.dx + m.dy * m.dy);
    expect(len).toBeCloseTo(1, 5);
  });

  it("cancels opposite directions", () => {
    const input = new InputManager();
    input.pressKey("ArrowLeft");
    input.pressKey("ArrowRight");
    const m = input.getMovement();
    expect(m.dx).toBe(0);
  });

  it("releases keys correctly", () => {
    const input = new InputManager();
    input.pressKey("ArrowRight");
    input.releaseKey("ArrowRight");
    const m = input.getMovement();
    expect(m.dx).toBe(0);
  });

  it("reports sprinting when Shift is held", () => {
    const input = new InputManager();
    expect(input.getMovement().sprinting).toBe(false);
    input.pressKey("Shift");
    expect(input.getMovement().sprinting).toBe(true);
    input.releaseKey("Shift");
    expect(input.getMovement().sprinting).toBe(false);
  });
});
