import { beforeAll, describe, expect, it } from "vitest";
import { BRIDGE_HEIGHT, PLAYER_FOOT_OFFSET, slabVertices } from "./BridgeFixture.js";
import { POSE_STRIDE } from "./PhysicsProtocol.js";
import { initRapier, RapierWorld } from "./RapierWorld.js";

beforeAll(initRapier);
const idle = { x: 0, z: 0, jump: false };
function step(world: RapierWorld, frames: number, input = idle) {
  for (let i = 0; i < frames; i++) world.step(input);
}

describe("experimental shared Rapier backend", () => {
  it("climbs both ramps and crosses deck section joins with continuous support", () => {
    const world = new RapierWorld(2, 0);
    try {
      step(world, 20);
      step(world, 200, { ...idle, x: 1 });
      expect(world.player.translation().x).toBeGreaterThan(1);
      expect(world.diagnostics().feetY).toBeCloseTo(BRIDGE_HEIGHT, 1);
      step(world, 240, { ...idle, x: 1 });
      expect(world.player.translation().x).toBeGreaterThan(17);
      expect(world.diagnostics().feetY).toBeCloseTo(0, 1);
      step(world, 430, { ...idle, x: -1 });
      expect(world.player.translation().x).toBeLessThan(-8);
      expect(world.diagnostics().feetY).toBeCloseTo(0, 1);
    } finally {
      world.dispose();
    }
  });

  it("keeps the lower passage distinct and blocks a jump at the deck underside", () => {
    const world = new RapierWorld(8, 0);
    try {
      world.teleport("underpass");
      step(world, 65, { ...idle, z: -1 });
      expect(Math.abs(world.player.translation().z)).toBeLessThan(0.3);
      expect(world.diagnostics().feetY).toBeCloseTo(0, 1);
      let maximum = 0;
      for (let i = 0; i < 55; i++) {
        world.step({ ...idle, jump: i === 0 });
        maximum = Math.max(maximum, world.diagnostics().feetY);
      }
      expect(maximum).toBeGreaterThan(0.5);
      expect(maximum + 2 * PLAYER_FOOT_OFFSET).toBeLessThan(2.3);
      expect(world.diagnostics().feetY).toBeCloseTo(0, 1);
    } finally {
      world.dispose();
    }
  });

  it("rides a translating support through ascent and descent without falling through", () => {
    const world = new RapierWorld(8, 0);
    try {
      world.teleport("platform");
      step(world, 30);
      let largestError = 0,
        highest = 0,
        lowest = Infinity;
      for (let i = 0; i < 600; i++) {
        world.step(idle);
        const feet = world.diagnostics().feetY;
        highest = Math.max(highest, feet);
        lowest = Math.min(lowest, feet);
        largestError = Math.max(
          largestError,
          Math.abs(feet - world.platform.translation().y - 0.1),
        );
      }
      expect(highest).toBeGreaterThan(2.5);
      expect(lowest).toBeLessThan(0.3);
      expect(largestError).toBeLessThan(0.12);
    } finally {
      world.dispose();
    }
  });

  it("uses the same slab geometry at the far end of a kilometre bridge; bounds loose objects", () => {
    const world = new RapierWorld(256, 0);
    try {
      expect(world.shapes.filter((shape) => shape.id.startsWith("deck-"))).toHaveLength(256);
      for (const shape of world.shapes) {
        const vertices = slabVertices(shape);
        expect([...vertices].every(Number.isFinite)).toBe(true);
      }
      world.teleport("far");
      step(world, 20);
      step(world, 200, { ...idle, x: -1 });
      expect(world.diagnostics().feetY).toBeCloseTo(BRIDGE_HEIGHT, 1);
      world.spawn(600);
      expect(world.poses().length / POSE_STRIDE).toBe(514);
      world.spawn(100);
      expect(world.poses().length / POSE_STRIDE).toBe(514);
    } finally {
      world.dispose();
    }
  });

  it("simulates dynamic loose objects and publishes their actual poses", () => {
    const world = new RapierWorld(8, 0);
    try {
      world.teleport("deck");
      world.spawn(2);
      const initial = world.poses();
      step(world, 180);
      const settled = world.poses();
      expect(settled[2 * POSE_STRIDE + 2]).toBeLessThan(initial[2 * POSE_STRIDE + 2] ?? 0);
      expect(world.diagnostics().sleeping).toBeGreaterThan(0);
    } finally {
      world.dispose();
    }
  });
});
