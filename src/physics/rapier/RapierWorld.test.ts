import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, it } from "vitest";
import { BRIDGE_HEIGHT, PLAYER_FOOT_OFFSET, slabVertices } from "./BridgeFixture.js";
import { POSE_STRIDE } from "./PhysicsProtocol.js";
import { initRapier, PHYSICS_DT, PHYSICS_WALK_SPEED, RapierWorld } from "./RapierWorld.js";

beforeAll(initRapier);
const idle = { x: 0, z: 0, jump: false };
function step(world: RapierWorld, frames: number, input = idle) {
  for (let i = 0; i < frames; i++) world.step(input);
}

describe("experimental shared Rapier backend", () => {
  it.each([
    { name: "head-on simultaneous", offset: 0, opposed: true },
    { name: "glancing release feedback", offset: 0.1, opposed: false },
    { name: "glancing speed burst", offset: 0.3, opposed: false },
  ])(
    "bounds $name contacts in either control seat without post-release drift",
    ({ offset, opposed }) => {
      for (const controlled of [0, 1] as const) {
        const world = new RapierWorld(2, 0);
        try {
          const positions = [
            { x: -16, y: 0.67, z: 0 },
            { x: -14, y: 0.67, z: offset },
          ] as const;
          world.configurePair(controlled === 0 ? positions : [positions[1], positions[0]], null);
          let maxSpeed = 0,
            minSeparation = Infinity,
            maxHeight = 0;
          let released:
            | readonly [ReturnType<RapierWorld["motorFor"]>, ReturnType<RapierWorld["motorFor"]>]
            | undefined;
          for (let tick = 1; tick <= 300; tick++) {
            const before = [world.motorFor(0), world.motorFor(1)] as const;
            const inputs =
              tick >= 30 && tick < 90
                ? [{ ...idle, x: 1 }, opposed ? { ...idle, x: -1 } : idle]
                : [idle, idle];
            if (controlled === 1) inputs.reverse();
            world.step(inputs[0] ?? idle, inputs[1] ?? idle);
            const after = [world.motorFor(0), world.motorFor(1)] as const;
            minSeparation = Math.min(
              minSeparation,
              Math.hypot(after[0].x - after[1].x, after[0].z - after[1].z),
            );
            for (const seat of [0, 1] as const) {
              maxSpeed = Math.max(
                maxSpeed,
                Math.hypot(after[seat].x - before[seat].x, after[seat].z - before[seat].z) /
                  PHYSICS_DT,
              );
              maxHeight = Math.max(maxHeight, after[seat].y);
              if (released)
                expect(
                  Math.hypot(after[seat].x - released[seat].x, after[seat].z - released[seat].z),
                ).toBeLessThan(0.002);
            }
            if (tick === 90) released = after;
          }
          // Controller normal nudges are sub-millimetre; these bounds reject the
          // original 20.6 m/s burst, 4.65 m drift, overlap and accidental autostep.
          expect(maxSpeed).toBeLessThan(PHYSICS_WALK_SPEED + 0.05);
          expect(minSeparation).toBeGreaterThan(0.565);
          expect(maxHeight).toBeLessThan(0.7);
          // Contact must not trap either actor when input turns away.
          const before = [world.motorFor(0), world.motorFor(1)] as const;
          for (let tick = 0; tick < 30; tick++) world.step({ ...idle, z: -1 }, { ...idle, z: 1 });
          expect(before[0].z - world.motorFor(0).z).toBeGreaterThan(1);
          expect(world.motorFor(1).z - before[1].z).toBeGreaterThan(1);
        } finally {
          world.dispose();
        }
      }
    },
  );

  it.each(["follow", "jump"] as const)("allows %s from resting player contact", (action) => {
    const world = new RapierWorld(2, 0);
    try {
      world.configurePair(
        [
          { x: -15.58, y: 0.67, z: 0 },
          { x: -15, y: 0.67, z: 0 },
        ],
        null,
      );
      step(world, 30);
      const before = [world.motorFor(0), world.motorFor(1)] as const;
      expect(before[1].x - before[0].x).toBeLessThan(0.6);
      let peak = before[0].y;
      for (let tick = 0; tick < 60; tick++) {
        world.step(
          action === "follow" ? { ...idle, x: 1 } : { ...idle, jump: tick === 0 },
          action === "follow" ? { ...idle, x: 1 } : idle,
        );
        peak = Math.max(peak, world.motorFor(0).y);
      }
      if (action === "follow") {
        expect(world.motorFor(0).x - before[0].x).toBeGreaterThan(4);
        expect(world.motorFor(1).x - before[1].x).toBeGreaterThan(4);
      } else {
        expect(peak - before[0].y).toBeGreaterThan(0.8);
        expect(world.motorFor(0).grounded).toBe(true);
      }
    } finally {
      world.dispose();
    }
  });

  it("keeps an actor's contact slide outside adjacent terrain", () => {
    const world = new RapierWorld(2, 0);
    try {
      world.configurePair(
        [
          { x: -16, y: 0.67, z: 0 },
          { x: -14, y: 0.67, z: 0.1 },
        ],
        null,
      );
      world.world.createCollider(
        RAPIER.ColliderDesc.cuboid(4, 1, 0.1).setTranslation(-14, 1, -0.8),
      );
      for (let tick = 1; tick <= 180; tick++) {
        world.step(tick >= 30 && tick < 120 ? { ...idle, x: 1 } : idle);
        const first = world.motorFor(0),
          second = world.motorFor(1);
        expect(first.z).toBeGreaterThan(-0.425);
        expect(Math.hypot(first.x - second.x, first.z - second.z)).toBeGreaterThan(0.565);
      }
    } finally {
      world.dispose();
    }
  });

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
