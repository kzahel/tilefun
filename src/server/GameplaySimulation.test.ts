import { describe, expect, it, vi } from "vitest";
import { createCampfire } from "../entities/Campfire.js";
import { createChicken } from "../entities/Chicken.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createGem } from "../entities/Gem.js";
import { createGhostAngry } from "../entities/Ghost.js";
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
  describe("gem collection", () => {
    it("collects a gem when player is close enough", () => {
      const em = new EntityManager();
      const player = createPlayer(100, 100);
      em.spawn(player);
      em.spawn(createGem(105, 100)); // within 18px
      const session = makeSession({ player });
      const markMetaDirty = vi.fn();

      tickGameplay(session, em, 1 / 60, { markMetaDirty });

      expect(session.gemsCollected).toBe(1);
      expect(em.entities.filter((e) => e.type === "gem")).toHaveLength(0);
      expect(markMetaDirty).toHaveBeenCalled();
    });

    it("does not collect a gem that is far away", () => {
      const em = new EntityManager();
      const player = createPlayer(100, 100);
      em.spawn(player);
      em.spawn(createGem(200, 200)); // far away
      const session = makeSession({ player });

      tickGameplay(session, em, 1 / 60, noopCallbacks);

      expect(session.gemsCollected).toBe(0);
      expect(em.entities.filter((e) => e.type === "gem")).toHaveLength(1);
    });
  });

  describe("baddie contact", () => {
    it("applies knockback and scatters gems on baddie contact", () => {
      const em = new EntityManager();
      const player = createPlayer(100, 100);
      em.spawn(player);
      const baddie = createGhostAngry(105, 84); // within 12px of player body center (offsetY=-16)
      em.spawn(baddie);
      const session = makeSession({ player, gemsCollected: 3 });

      tickGameplay(session, em, 1 / 60, noopCallbacks);

      expect(session.invincibilityTimer).toBeCloseTo(1.5 - 1 / 60);
      expect(session.knockbackVx).not.toBe(0);
      expect(session.gemsCollected).toBe(0); // lost 3
      // 3 scattered gems should have been spawned
      const gems = em.entities.filter((e) => e.type === "gem");
      expect(gems).toHaveLength(3);
    });

    it("does not apply damage during invincibility", () => {
      const em = new EntityManager();
      const player = createPlayer(100, 100);
      em.spawn(player);
      em.spawn(createGhostAngry(105, 100));
      const session = makeSession({ player, gemsCollected: 5, invincibilityTimer: 1.0 });

      tickGameplay(session, em, 1 / 60, noopCallbacks);

      expect(session.gemsCollected).toBe(5); // no gem loss
    });
  });

  describe("buddy scare", () => {
    it("scares a buddy away from a baddie", () => {
      const em = new EntityManager();
      const player = createPlayer(0, 0);
      em.spawn(player);

      const buddy = createChicken(100, 100);
      const buddyAI = buddy.wanderAI;
      expect(buddyAI).not.toBeNull();
      if (buddyAI) {
        buddyAI.following = true;
        buddyAI.befriendable = true;
      }
      em.spawn(buddy);

      const baddie = createGhostAngry(105, 100); // within 14px of buddy
      em.spawn(baddie);

      const session = makeSession({ player, invincibilityTimer: 2.0 }); // invincible to skip player damage

      tickGameplay(session, em, 1 / 60, noopCallbacks);

      expect(buddy.wanderAI?.following).toBe(false);
      expect(buddy.wanderAI?.state).toBe("walking");
    });
  });

  describe("campfire ghost trap", () => {
    it("destroys hostile entity that overlaps a campfire and spawns a gem", () => {
      const em = new EntityManager();
      const player = createPlayer(0, 0);
      em.spawn(player);
      const fire = createCampfire(100, 100);
      em.spawn(fire);
      const ghost = createGhostAngry(105, 100); // within 16px of campfire
      em.spawn(ghost);
      const session = makeSession({ player });

      tickGameplay(session, em, 1 / 60, noopCallbacks);

      expect(em.entities.find((e) => e.type === "ghost-angry")).toBeUndefined();
      // A reward gem should have been spawned
      expect(em.entities.filter((e) => e.type === "gem")).toHaveLength(1);
    });

    it("does not destroy hostile entity far from campfire", () => {
      const em = new EntityManager();
      const player = createPlayer(0, 0);
      em.spawn(player);
      em.spawn(createCampfire(100, 100));
      em.spawn(createGhostAngry(200, 200)); // far from fire
      const session = makeSession({ player });

      tickGameplay(session, em, 1 / 60, noopCallbacks);

      expect(em.entities.find((e) => e.type === "ghost-angry")).toBeDefined();
    });
  });

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
