import { expect, it } from "vitest";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { required } from "../shared/required.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { PhysicsScene } from "./PhysicsScene.js";

it("restores independently owned states, clears optional metadata and keeps setter scratch private", async () => {
  const scene = await PhysicsScene.create(),
    car = createVehicle("compact-1", -64, 10, Direction.Right),
    player = createPlayer(12, 34);
  car.id = 1;
  player.id = 2;
  try {
    scene.synchronize([car, player]);
    const first = scene.snapshot(),
      state = required(first.bodies[0]);
    Object.assign(state, {
      x: -70,
      y: 42,
      z: 21,
      prevX: -71,
      prevY: 40,
      prevZ: 20,
      vx: 7,
      vy: 8,
      vz: 9,
      heading: 0.7,
      prevHeading: 0.6,
      rotation: [0.1, 0.2, 0.3, Math.sqrt(0.86)],
      prevRotation: [0, 0, 0, 1],
      angularVelocity: [0.2, 0.3, 0.4],
      altitude: 55,
      supportId: 2,
      inheritedVx: 11,
      inheritedVy: 12,
      desiredHeading: 1.1,
      desiredDriveSpeed: 33,
      desiredSteering: 0.5,
      controlUntil: 123,
      jumpQueued: true,
      bedTilt: 0.5,
      bedTarget: 1,
    });
    const original = structuredClone(first);
    for (const body of first.bodies) {
      if (body.rotation) Object.freeze(body.rotation);
      if (body.prevRotation) Object.freeze(body.prevRotation);
      if (body.angularVelocity) Object.freeze(body.angularVelocity);
      Object.freeze(body);
    }
    Object.freeze(first.bodies);
    Object.freeze(first);
    const borrowed = scene.bodyState(1);
    scene.restore(first);
    expect(scene.bodyState(1)).not.toBe(borrowed);
    expect(scene.snapshot()).toEqual(first);
    expect(car.position).toEqual({ wx: -70, wy: 42 });
    expect(player.position).toEqual({ wx: 12, wy: 34 });
    expect(car.bodyRotation).toEqual(state.rotation);
    const second = original.bodies.map((body) => {
      // A valid minimal packet omits ALL optional fields, including vehicle rotations.
      const { id, kind } = body;
      return {
        id,
        kind,
        x: body.x + 100,
        y: body.y,
        z: body.z,
        prevX: body.prevX,
        prevY: body.prevY,
        prevZ: body.prevZ,
        vx: 0,
        vy: 0,
        vz: 0,
        heading: 0,
        prevHeading: 0,
        jumpHeld: false,
        grounded: true,
        groundZ: 0,
        desiredVx: 0,
        desiredVy: 0,
        normalX: 0,
        normalY: 1,
        normalZ: 0,
      };
    });
    const next = { ...first, tick: first.tick + 1, bodies: second };
    scene.restore(next);
    expect(scene.snapshot()).toEqual(next);
    expect(scene.bodyState(1)).not.toBe(borrowed);
    expect(first).toEqual(original); // a later restore never changes retained packet data
    expect(car.bodyRotation).toEqual([0, 0, 0, 1]); // not another body's scratch quaternion
    scene.step(new Map(), {
      getCollision: () => 0,
      getHeight: () => 0,
      queryProps: () => [],
      geometryVersion: () => ({ identity: null, revision: 0 }),
    });
    expect(first).toEqual(original);
    expect(scene.diagnostics.worldSteps).toBe(1); // restores never advance simulation
  } finally {
    scene.dispose();
  }
});
