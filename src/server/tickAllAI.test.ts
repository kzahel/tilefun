import { describe, expect, it } from "vitest";
import { ENTITY_ACTIVATION_DISTANCE } from "../config/constants.js";
import { createChicken } from "../entities/Chicken.js";
import { createGhostAngry } from "../entities/Ghost.js";
import { createPlayer } from "../entities/Player.js";
import { tickAllAI } from "./tickAllAI.js";

describe("tickAllAI", () => {
  it("freezes entities beyond activation distance", () => {
    const far = createChicken(ENTITY_ACTIVATION_DISTANCE + 100, 0);
    far.velocity = { vx: 30, vy: 30 };
    far.id = 1;

    tickAllAI([far], { wx: 0, wy: 0 }, 1 / 60, Math.random);

    expect(far.velocity.vx).toBe(0);
    expect(far.velocity.vy).toBe(0);
  });

  it("runs wander AI for entities within activation distance", () => {
    const chicken = createChicken(10, 10);
    chicken.id = 1;
    const ai = chicken.wanderAI;
    expect(ai).not.toBeNull();
    // Force transition to walking by expiring idle timer
    if (ai) ai.timer = 0;

    tickAllAI([chicken], { wx: 0, wy: 0 }, 0.01, () => 0.5);

    expect(chicken.wanderAI?.state).toBe("walking");
  });

  it("runs chase AI for hostile entities in range", () => {
    const ghost = createGhostAngry(50, 0);
    ghost.id = 1;
    const playerPos = { wx: 10, wy: 0 };

    tickAllAI([ghost], playerPos, 1 / 60, Math.random);

    // Ghost should be chasing (within its chase range of 80)
    expect(ghost.wanderAI?.state).toBe("chasing");
    // Should be moving toward player (negative vx)
    expect(ghost.velocity?.vx).toBeLessThan(0);
  });

  it("does not crash with entities that have no wanderAI", () => {
    const player = createPlayer(0, 0);
    player.id = 1;

    // Should not throw
    tickAllAI([player], { wx: 0, wy: 0 }, 1 / 60, Math.random);
  });

  it("activates following entity within range", () => {
    const chicken = createChicken(10, 10);
    chicken.id = 1;
    const ai = chicken.wanderAI;
    expect(ai).not.toBeNull();
    if (ai) {
      ai.befriendable = true;
      ai.following = true;
    }
    const playerPos = { wx: 50, wy: 50 };

    tickAllAI([chicken], playerPos, 1 / 60, Math.random);

    // Should be in "following" state and moving toward player
    expect(chicken.wanderAI?.state).toBe("following");
  });
});
