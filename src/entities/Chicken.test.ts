import { describe, expect, it } from "vitest";
import { CHICKEN_SPRITE_SIZE } from "../config/constants.js";
import { createChicken } from "./Chicken.js";

describe("createChicken", () => {
  it("creates entity at given position", () => {
    const c = createChicken(50, 75);
    expect(c.position.wx).toBe(50);
    expect(c.position.wy).toBe(75);
  });

  it("has type chicken", () => {
    const c = createChicken(0, 0);
    expect(c.type).toBe("chicken");
  });

  it("has wanderAI component", () => {
    const c = createChicken(0, 0);
    expect(c.wanderAI).not.toBeNull();
    expect(c.wanderAI?.state).toBe("idle");
  });

  it("has collider component", () => {
    const c = createChicken(0, 0);
    expect(c.collider).not.toBeNull();
    expect(c.collider?.width).toBeGreaterThan(0);
  });

  it("has sprite with correct dimensions", () => {
    const c = createChicken(0, 0);
    expect(c.sprite?.spriteWidth).toBe(CHICKEN_SPRITE_SIZE);
    expect(c.sprite?.spriteHeight).toBe(CHICKEN_SPRITE_SIZE);
    expect(c.sprite?.sheetKey).toBe("chicken");
  });
});
