import { expect, it } from "vitest";
import type { Entity } from "../entities/Entity.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import {
  physicsStateBytes,
  readPhysicsState,
  writePhysicsState,
} from "../shared/physicsStateCodec.js";
import { required } from "../shared/required.js";
import { EXCAVATOR_REST, excavatorAngles, nextExcavatorPose } from "../traffic/Excavator.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { PhysicsScene } from "./PhysicsScene.js";
import type { MotionIntent } from "./PhysicsState.js";

function ground(props: ReturnType<typeof surfaceProp>[] = []) {
  return {
    getCollision: () => 0,
    getHeight: () => 0,
    queryProps: () => props,
    geometryVersion: () => ({ identity: props, revision: 0 }),
  };
}

function steps(scene: PhysicsScene, body: Entity, count: number, geometry = ground()) {
  for (let i = 0; i < count; i++) {
    scene.synchronize([body]);
    scene.step(new Map(), geometry);
  }
}

it("blocks the powered arm against a real roof collider while the chassis fits underneath", async () => {
  const scene = await PhysicsScene.create();
  try {
    const body = { ...createVehicle("excavator", 0, 0), id: 1 };
    const roof = surfaceProp(
      { left: 12, top: -24, right: 60, bottom: 24 },
      { id: "roof", spaceId: "roof", z: 66.5, thickness: 3, riseX: 0, riseY: 0, connectsTo: [] },
    );
    const covered = ground([roof]);
    steps(scene, body, 60, covered);
    const target = nextExcavatorPose(body.vehicleExcavator, "boom-up");
    body.vehicleExcavatorTarget = target;
    steps(scene, body, 60, covered);
    expect(excavatorAngles(body.vehicleExcavator).boom).toBeGreaterThan(
      excavatorAngles(EXCAVATOR_REST).boom,
    );
    expect(excavatorAngles(body.vehicleExcavator).boom).toBeLessThan(excavatorAngles(target).boom);
    expect(body.vehicleExcavatorTarget).toBeUndefined();

    body.vehicleExcavatorTarget = target;
    steps(scene, body, 60);
    expect(body.vehicleExcavator).toBe(target);
  } finally {
    scene.dispose();
  }
});

it("replays the partially moved 3D excavator pose from the numerical wire snapshot", async () => {
  const authority = await PhysicsScene.create();
  const prediction = await PhysicsScene.create();
  try {
    const body = { ...createVehicle("excavator", 0, 0), id: 1 };
    const geometry = ground();
    steps(authority, body, 60, geometry);
    const target = nextExcavatorPose(body.vehicleExcavator, "swing-left");
    body.vehicleExcavatorTarget = target;
    steps(authority, body, 6, geometry);
    const snapshot = authority.snapshot();
    const wire = new DataView(new ArrayBuffer(physicsStateBytes(snapshot)));
    expect(writePhysicsState(wire, 0, snapshot)).toBe(wire.byteLength);
    const [decoded, bytesRead] = readPhysicsState(wire, 0);
    expect(bytesRead).toBe(wire.byteLength);
    expect(decoded?.bodies[0]?.excavatorPose).toBe(body.vehicleExcavator);
    expect(decoded?.bodies[0]?.excavatorTarget).toBe(target);
    expect(body.vehicleExcavatorRate).toBeLessThan(0);
    expect(decoded?.bodies[0]?.excavatorRate).toBe(body.vehicleExcavatorRate);
    const copy = structuredClone(body);
    delete copy.vehicleExcavator;
    delete copy.vehicleExcavatorTarget;
    delete copy.vehicleExcavatorRate;
    prediction.synchronize([copy]);
    prediction.restore(required(decoded));
    expect(copy.vehicleExcavator).toBe(body.vehicleExcavator);
    for (let i = 0; i < 30; i++) {
      authority.step(new Map(), geometry);
      prediction.step(new Map(), geometry);
      expect(copy.vehicleExcavator).toBe(body.vehicleExcavator);
      expect(copy.vehicleExcavatorRate).toBe(body.vehicleExcavatorRate);
    }
    expect(copy.vehicleExcavator).toBe(target);
  } finally {
    authority.dispose();
    prediction.dispose();
  }
});

it("builds up momentum, then brakes to the boom's exact target", async () => {
  const scene = await PhysicsScene.create();
  try {
    const body = { ...createVehicle("excavator", 0, 0), id: 1 };
    const geometry = ground();
    steps(scene, body, 60, geometry);
    const start = excavatorAngles(body.vehicleExcavator).boom;
    const target = nextExcavatorPose(body.vehicleExcavator, "boom-up");
    const goal = excavatorAngles(target).boom;
    body.vehicleExcavatorTarget = target;
    const rates: number[] = [];
    const samples: number[] = [];
    for (let tick = 0; tick < 60 && body.vehicleExcavatorTarget !== undefined; tick++) {
      steps(scene, body, 1, geometry);
      rates.push(body.vehicleExcavatorRate ?? 0);
      samples.push(excavatorAngles(body.vehicleExcavator).boom);
    }
    const peak = Math.max(...rates);
    const peakIndex = rates.indexOf(peak);
    expect(samples[0]).toBeGreaterThan(start);
    expect(required(samples[0]) - start).toBeLessThan(Math.PI / 720);
    expect(peakIndex).toBeGreaterThan(3);
    expect(peak).toBeGreaterThan(20);
    expect(required(rates.at(-2))).toBeLessThan(peak / 2);
    expect(rates.at(-1)).toBe(0);
    expect(
      rates.every(
        (rate, i) => Math.abs(rate - (rates[i - 1] ?? 0)) <= required(rates[0]) + 0.00001,
      ),
    ).toBe(true);
    expect(samples.every((angle, i) => angle >= (samples[i - 1] ?? start) && angle <= goal)).toBe(
      true,
    );
    expect(body.vehicleExcavator).toBe(target);
  } finally {
    scene.dispose();
  }
});

it("holds a steady slew through a full turn, then brakes when the input expires after replay", async () => {
  const scene = await PhysicsScene.create();
  const replay = await PhysicsScene.create();
  try {
    const body = { ...createVehicle("excavator", 0, 0), id: 1 };
    const geometry = ground();
    steps(scene, body, 60, geometry);
    const deadline = scene.physicsTick + 420;
    const held: MotionIntent = {
      vx: 0,
      vy: 0,
      excavatorAction: "swing-right",
      controlUntil: deadline,
    };
    const intents = new Map([[body.id, held]]);
    let yaw = excavatorAngles(body.vehicleExcavator).yaw;
    let turned = 0;
    while (scene.physicsTick < deadline) {
      scene.synchronize([body]);
      scene.step(intents, geometry);
      const next = excavatorAngles(body.vehicleExcavator).yaw;
      const change = (next - yaw + 2 * Math.PI) % (2 * Math.PI);
      expect(change).toBeLessThan(0.018);
      if (turned > Math.PI / 12) {
        expect(change).toBeGreaterThan(0.016);
        expect(body.vehicleExcavatorRate).toBe(58);
      }
      yaw = next;
      turned += change;
    }
    expect(turned).toBeGreaterThan(2 * Math.PI);
    const snapshot = scene.snapshot();
    const wire = new DataView(new ArrayBuffer(physicsStateBytes(snapshot)));
    expect(writePhysicsState(wire, 0, snapshot)).toBe(wire.byteLength);
    const [decoded, bytesRead] = readPhysicsState(wire, 0);
    expect(bytesRead).toBe(wire.byteLength);
    expect(decoded?.bodies[0]?.excavatorHeld).toBe("swing-right");
    const copy = structuredClone(body);
    replay.synchronize([copy]);
    replay.restore(required(decoded));

    let previousRate = 58;
    const releasedYaw = yaw;
    for (let tick = 0; tick < 40; tick++) {
      scene.synchronize([body]);
      scene.step(intents, geometry);
      replay.synchronize([copy]);
      replay.step(new Map(), geometry);
      const rate = body.vehicleExcavatorRate ?? 0;
      expect(rate).toBeLessThanOrEqual(previousRate);
      expect(copy.vehicleExcavator).toBe(body.vehicleExcavator);
      expect(copy.vehicleExcavatorRate).toBe(body.vehicleExcavatorRate);
      previousRate = rate;
    }
    expect(body.vehicleExcavatorRate).toBeUndefined();
    const stoppedYaw = excavatorAngles(body.vehicleExcavator).yaw;
    expect(stoppedYaw - releasedYaw).toBeCloseTo((5.8 * Math.PI) / 180, 3);
  } finally {
    scene.dispose();
    replay.dispose();
  }
});
