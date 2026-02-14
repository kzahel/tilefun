import { describe, expect, it } from "vitest";
import { EntityManager } from "../entities/EntityManager.js";
import { createGem } from "../entities/Gem.js";
import { createPlayer } from "../entities/Player.js";
import { type GameplaySession, tickGameplay } from "./GameplaySimulation.js";

function makeSession(overrides?: Partial<GameplaySession>): GameplaySession {
  return {
    player: createPlayer(100, 100),
    gemsCollected: 0,
    invincibilityTimer: 0,
    knockbackVx: 0,
    knockbackVy: 0,
    ...overrides,
  };
}

const noopCallbacks = { markMetaDirty: () => {} };

describe("tickGameplay", () => {
  // gem collection → gem-collector mod (gem-collector.test.ts)
  // baddie contact → baddie-contact mod (baddie-contact.test.ts)
  // buddy scare → buddy-scare mod (buddy-scare.test.ts)
  // campfire trap → campfire-trap mod (campfire-trap.test.ts)

  describe("invincibility decay", () => {
    it("decrements invincibility timer", () => {
      const em = new EntityManager();
      const player = createPlayer(100, 100);
      player.velocity = { vx: 0, vy: 0 };
      em.spawn(player);
      const session = makeSession({
        player,
        invincibilityTimer: 1.0,
        knockbackVx: 100,
        knockbackVy: 50,
      });

      tickGameplay(session, em, 0.5, noopCallbacks);

      expect(session.invincibilityTimer).toBe(0.5);
      // knockback should have decayed
      expect(Math.abs(session.knockbackVx)).toBeLessThan(100);
    });

    it("sets flash hidden during invincibility", () => {
      const em = new EntityManager();
      const player = createPlayer(100, 100);
      player.velocity = { vx: 0, vy: 0 };
      em.spawn(player);
      const session = makeSession({ player, invincibilityTimer: 1.0 });

      tickGameplay(session, em, 0.01, noopCallbacks);

      // flashHidden is set based on timer modulo
      expect(player.flashHidden).toBeDefined();
    });

    it("clears flash hidden when invincibility ends", () => {
      const em = new EntityManager();
      const player = createPlayer(100, 100);
      player.flashHidden = true;
      em.spawn(player);
      const session = makeSession({ player, invincibilityTimer: 0 });

      tickGameplay(session, em, 1 / 60, noopCallbacks);

      expect(player.flashHidden).toBe(false);
    });
  });

  describe("gem velocity decay", () => {
    it("decays scattered gem velocity and stops it", () => {
      const em = new EntityManager();
      const player = createPlayer(0, 0);
      em.spawn(player);

      const gem = createGem(200, 200);
      gem.velocity = { vx: 80, vy: 80 };
      em.spawn(gem);
      const session = makeSession({ player });

      // Tick multiple times to decay (need ~2s worth of ticks at rate 1-dt*4)
      for (let i = 0; i < 180; i++) {
        tickGameplay(session, em, 1 / 60, noopCallbacks);
      }

      // Velocity should have decayed to null
      expect(gem.velocity).toBeNull();
    });
  });
});
