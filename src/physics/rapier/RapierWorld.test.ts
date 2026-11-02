import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BRIDGE_HEIGHT,
  PLAYER_FOOT_OFFSET,
  PLAYER_HALF_HEIGHT,
  PLAYER_RADIUS,
  slabVertices,
} from "./BridgeFixture.js";
import { POSE_STRIDE } from "./PhysicsProtocol.js";
import { pairInput, setupPair } from "./PhysicsScenarios.js";
import { initRapier, PHYSICS_DT, PHYSICS_WALK_SPEED, RapierWorld } from "./RapierWorld.js";

beforeAll(initRapier);
const idle = { x: 0, z: 0, jump: false };
function step(world: RapierWorld, frames: number, input = idle) {
  for (let i = 0; i < frames; i++) world.step(input);
}

describe("experimental shared Rapier backend", () => {
  it("resolves simultaneous rising/falling cap approaches before committing either motor", () => {
    const world = new RapierWorld(2, 0);
    try {
      step(world, 30);
      const y = world.motorFor(0).y;
      world.configurePair(
        [
          { x: -15, y, z: 0 },
          { x: -15, y: y + 2 * PLAYER_FOOT_OFFSET + 0.18, z: 0 },
        ],
        null,
      );
      const snapshot = world.snapshot();
      Object.assign(snapshot.motors[0] ?? {}, { grounded: true, verticalSpeed: 0 });
      Object.assign(snapshot.motors[1] ?? {}, { grounded: false, verticalSpeed: -5.7 });
      world.restoreFull(snapshot);
      world.step({ ...idle, jump: true });
      const lower = world.motorFor(0),
        upper = world.motorFor(1);
      expect(upper.y - lower.y).toBeGreaterThan(2 * PLAYER_FOOT_OFFSET - 0.001);
    } finally {
      world.dispose();
    }
  });
  it("validates ascent-clipped endpoints beneath a sloped ceiling", () => {
    const world = new RapierWorld(2, 0);
    try {
      step(world, 30);
      const lowerY = world.motorFor(0).y,
        upperY = lowerY + 0.96;
      const underside = upperY + PLAYER_HALF_HEIGHT + PLAYER_RADIUS * Math.sqrt(5) + 0.02;
      const desc = RAPIER.ColliderDesc.convexHull(
        slabVertices({
          id: "ceiling",
          x: -15.5,
          y: 0,
          z: 0,
          width: 2,
          depth: 4,
          low: underside - 2 + 0.1,
          high: underside + 2 + 0.1,
          thickness: 0.1,
          color: 0,
        }),
      );
      if (!desc) throw Error("Invalid ceiling");
      const ceiling = world.world.createCollider(desc.setTranslation(-15.5, 0, 0));
      const handle = ceiling.handle;
      world.world.step();
      world.configurePair(
        [
          { x: -15.5, y: upperY, z: 0 },
          { x: -15, y: lowerY, z: 0 },
        ],
        null,
      );
      const snapshot = world.snapshot();
      Object.assign(snapshot.motors[0] ?? {}, { grounded: false, verticalSpeed: 6 });
      Object.assign(snapshot.motors[1] ?? {}, { grounded: true, verticalSpeed: 0 });
      world.restoreFull(snapshot);
      world.step({ ...idle, x: 1 });
      const player = world.player.collider(0),
        roof = world.world.getCollider(handle);
      const contact = player.shape.contactShape(
        player.translation(),
        player.rotation(),
        roof.shape,
        roof.translation(),
        roof.rotation(),
        0.1,
      );
      expect(contact?.distance ?? 1).toBeGreaterThan(-0.0001);
    } finally {
      world.dispose();
    }
  });
  it("lets a rider cross a controlled player's shoulder without steering the supporting player", () => {
    for (const rider of [0, 1] as const) {
      const world = new RapierWorld(2, 0);
      try {
        step(world, 30);
        const lower = { x: -15, y: world.motorFor(0).y, z: 0 },
          upper = { ...lower, x: -15.5, y: lower.y + 0.7 + Math.sqrt(0.56 ** 2 - 0.5 ** 2) + 0.02 };
        world.configurePair(rider === 0 ? [upper, lower] : [lower, upper], null);
        const start = world.motorFor(rider === 0 ? 1 : 0);
        for (let tick = 0; tick < 20; tick++)
          world.step(
            rider === 0 ? { ...idle, x: 1 } : idle,
            rider === 1 ? { ...idle, x: 1 } : idle,
          );
        const end = world.motorFor(rider === 0 ? 1 : 0);
        expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeLessThan(0.002);
        expect(world.motorFor(rider).y).toBeGreaterThan(start.y + 0.7);
      } finally {
        world.dispose();
      }
    }
  });
  it("preserves jump height while continuing to walk into a controlled player", () => {
    const peaks: number[] = [];
    for (const contact of [true, false]) {
      const world = new RapierWorld(2, 0);
      try {
        if (contact) setupPair(world, "player-jump");
        else
          world.configurePair(
            [
              { x: -15, y: 0.67, z: 0 },
              { x: -5, y: 0.67, z: 0 },
            ],
            null,
          );
        let peak = 0;
        for (let tick = 1; tick <= 150; tick++) {
          world.step(pairInput("player-jump", 0, tick));
          peak = Math.max(peak, world.motorFor(0).y);
          const a = world.motorFor(0),
            b = world.motorFor(1);
          const verticalGap = Math.max(0, Math.abs(a.y - b.y) - 2 * PLAYER_HALF_HEIGHT);
          expect(Math.hypot(a.x - b.x, a.z - b.z, verticalGap)).toBeGreaterThan(
            2 * PLAYER_RADIUS - 0.001,
          );
        }
        peaks.push(peak);
      } finally {
        world.dispose();
      }
    }
    expect(peaks[0]).toBeGreaterThan((peaks[1] ?? 0) - 0.02);
  });
  it.each([
    { name: "head-on push into idle player", offset: 0, opposed: false },
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
          // Removing runaway velocity must preserve pushing: the idle actor
          // must travel, in BOTH seat orders, even though it has no input.
          if (offset === 0 && !opposed)
            expect(world.motorFor(controlled === 0 ? 1 : 0).x).toBeGreaterThan(-13);
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

  it("bounds combined sideways pushing and the recipient's own walking", () => {
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
      let maxSpeed = 0;
      for (let tick = 0; tick < 60; tick++) {
        const before = [world.motorFor(0), world.motorFor(1)] as const;
        world.step({ ...idle, x: 1 }, { ...idle, z: 1 });
        for (const seat of [0, 1] as const) {
          const after = world.motorFor(seat);
          maxSpeed = Math.max(
            maxSpeed,
            Math.hypot(after.x - before[seat].x, after.z - before[seat].z) / PHYSICS_DT,
          );
        }
      }
      expect(maxSpeed).toBeLessThan(PHYSICS_WALK_SPEED + 0.05);
      expect(world.motorFor(1).z).toBeGreaterThan(4);
    } finally {
      world.dispose();
    }
  });

  it("pushes an idle actor up to a wall without pushing either capsule through it", () => {
    const world = new RapierWorld(2, 0);
    try {
      world.configurePair(
        [
          { x: -15.58, y: 0.67, z: 0 },
          { x: -15, y: 0.67, z: 0 },
        ],
        null,
      );
      world.world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 1, 2).setTranslation(-14.3, 1, 0));
      for (let tick = 1; tick <= 150; tick++) {
        world.step(tick >= 30 && tick < 120 ? { ...idle, x: 1 } : idle);
        const first = world.motorFor(0),
          second = world.motorFor(1);
        expect(first.x).toBeLessThan(-14.665);
        expect(second.x).toBeLessThan(-14.665);
        expect(Math.hypot(first.x - second.x, first.z - second.z)).toBeGreaterThan(0.565);
      }
      expect(world.motorFor(1).x).toBeGreaterThan(-14.85);
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
