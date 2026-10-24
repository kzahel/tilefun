import { expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { surfaceZAt } from "../physics/SurfacePatch.js";
import { vehicleMeshHeightScale } from "../rendering/AuthoredVehicleMeshes.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { World } from "../world/World.js";
import { drivenCarPose } from "./Driving.js";
import { applyVehicleFacing, createVehicle } from "./Vehicle.js";
import { gradeRoofOffset, vehicleGroundPose } from "./VehicleGroundPose.js";

function fixture(a = 0.25, b = 0, heading = 0) {
  const world = new World(new FlatStrategy());
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) world.getChunk(x, y);
  const ramp = surfaceProp(
    { left: -256, right: 256, top: -256, bottom: 256 },
    {
      id: "wide-ramp",
      spaceId: "outside",
      z: 128 - 256 * a - 256 * b,
      riseX: 512 * a,
      riseY: 512 * b,
      thickness: 8,
      connectsTo: [],
    },
  );
  const car = createVehicle("compact-1", 0, 0, Direction.Right);
  car.id = 1;
  car.vehicleHeading = heading;
  car.velocity = { vx: 72 * Math.cos(heading), vy: 72 * Math.sin(heading) };
  applyVehicleFacing(car);
  if (!car.collider || !ramp.collider?.surface) throw Error("Missing grade fixture");
  const box = getEntityAABB(car.position, car.collider);
  car.wz = car.groundZ =
    128 + (Math.abs(a) * (box.right - box.left)) / 2 + (Math.abs(b) * (box.bottom - box.top)) / 2;
  return {
    world,
    ramp,
    car,
    props: [ramp],
    height: (x: number, y: number) => world.getHeightAt(x, y),
  };
}

it("keeps all measured tyres on a plane through uphill, downhill, cross-slope and diagonal headings", () => {
  for (const heading of [0, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4]) {
    const { car, height, props } = fixture(0.25, 0, heading);
    const before = structuredClone(car);
    const pose = vehicleGroundPose(car, height, props);
    if (!pose) throw Error("Missing ground pose");
    expect(pose.contacts).toHaveLength(4);
    expect(pose.riseX).toBeCloseTo(0.25 * Math.cos(heading), 6);
    expect(pose.riseY).toBeCloseTo(-0.25 * Math.sin(heading), 6);
    for (const wheel of pose.contacts) expect(wheel.z).toBeCloseTo(wheel.surfaceZ, 5);
    expect(car).toEqual(before);
  }
});

it("crosses the ramp crest continuously without pushing tyres through either surface", () => {
  const ramp = surfaceProp(
    { left: -128, right: 0, top: -128, bottom: 128 },
    { id: "ramp", spaceId: "upper", z: 0, riseX: 32, riseY: 0, thickness: 8, connectsTo: [] },
  );
  const deck = surfaceProp(
    { left: 0, right: 128, top: -128, bottom: 128 },
    { id: "deck", spaceId: "upper", z: 32, riseX: 0, riseY: 0, thickness: 8, connectsTo: [] },
  );
  let previous = 0;
  for (let x = -40; x <= 40; x++) {
    const car = createVehicle("compact-1", x, 0, Direction.Right);
    if (!car.collider) throw Error("Missing body");
    car.wz = Math.min(32, 32 + (x + car.collider.width / 2) / 4);
    const pose = vehicleGroundPose(car, () => 0, [ramp, deck]);
    if (!pose) throw Error(`Missing crest pose at ${x}`);
    const center = car.wz + pose.offsetZ;
    if (x > -40) expect(Math.abs(center - previous)).toBeLessThan(0.3);
    previous = center;
    expect(pose.pitch).toBeGreaterThanOrEqual(-1e-6);
    expect(pose.pitch).toBeLessThanOrEqual(Math.atan(0.25) + 1e-6);
    for (const wheel of pose.contacts) {
      expect(wheel.z).toBeGreaterThanOrEqual(wheel.surfaceZ - 1e-6);
      expect(wheel.z - wheel.surfaceZ).toBeLessThan(0.02);
    }
  }
});

it("keeps flat and unsupported presentation unchanged and excludes unrelated upper floors", () => {
  const { car } = fixture(0, 0);
  expect(vehicleGroundPose(car, () => 0, [])).toBeUndefined();
  const floor = surfaceProp(
    { left: -256, right: 256, top: -256, bottom: 256 },
    {
      id: "floor",
      spaceId: "garage",
      z: -48,
      riseX: 0,
      riseY: 0,
      thickness: 8,
      connectsTo: [],
      excavation: {},
    },
  );
  const roof = surfaceProp(
    { left: -256, right: 256, top: -256, bottom: 256 },
    { id: "roof", spaceId: "street", z: 0, riseX: 0, riseY: 0, thickness: 8, connectsTo: [] },
  );
  car.wz = -48;
  const pose = vehicleGroundPose(car, () => 0, [floor, roof]);
  expect(pose?.pitch).toBe(0);
  expect(pose?.roll).toBe(0);
  expect(pose?.offsetZ).toBe(0);
  expect(pose?.contacts.every((p) => p.z === -48)).toBe(true);
  expect(
    vehicleGroundPose({ ...car, type: "vehicle-v1:compact-2" }, () => 0, [floor]),
  ).toBeUndefined();
});

it("preserves conservative roof headroom while visually attaching a rider to the fitted tilted roof", () => {
  const { car, height, props } = fixture(0.3, 0.3, Math.PI / 4);
  const pose = vehicleGroundPose(car, height, props);
  if (!pose || !car.collider) throw Error("Missing pose");
  const h = car.collider.physicalHeight ?? 24,
    fit = vehicleMeshHeightScale("compact-1");
  for (const x of [-8, 0, 8])
    for (const y of [-8, 0, 8]) {
      const delta = h * (1 - fit) - gradeRoofOffset(pose, car.vehicleHeading ?? 0, x, y, h * fit);
      expect(delta).toBeGreaterThan(0);
      expect(Number.isFinite(delta)).toBe(true);
    }
});

it("admits real uphill/downhill rolling turns at 30/50Hz while retaining slab and passenger clearance", () => {
  for (const dt of [1 / 30, 0.02])
    for (const heading of [0, Math.PI]) {
      const { car, props, world } = fixture(0.25, 0, heading);
      const before = structuredClone(car);
      const next = drivenCarPose(
        car,
        { dx: 1, dy: -1, relativeDriving: true },
        dt,
        world,
        props,
        [],
      );
      expect(next).toBeDefined();
      const delta = (next?.vehicleHeading ?? heading) - heading;
      expect(Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)))).toBeGreaterThan(0.01);
      expect(car).toEqual(before);
      if (!car.collider) throw Error("Missing car body");
      const ceiling = surfaceProp(
        { left: -128, right: 128, top: -128, bottom: 128 },
        {
          id: "ceiling",
          spaceId: "ceiling",
          z: (car.wz ?? 0) + 30,
          riseX: 0,
          riseY: 0,
          thickness: 4,
          connectsTo: [],
        },
      );
      const rider = createPlayer(0, 0);
      rider.id = 2;
      rider.wz = (car.wz ?? 0) + (car.collider.physicalHeight ?? 24);
      expect(
        drivenCarPose(
          car,
          { dx: 1, dy: -1, relativeDriving: true },
          dt,
          world,
          [...props, ceiling],
          [car, rider],
        ),
      ).toBeUndefined();
      if (!props[0]?.collider?.surface || !next?.collider) throw Error("Missing support");
      const box = getEntityAABB(next.position, next.collider),
        surface = props[0].collider.surface;
      expect(next.wz).toBeCloseTo(
        Math.max(
          ...[box.left, box.right].flatMap((x) =>
            [box.top, box.bottom].map((y) =>
              surfaceZAt(surface, { left: -256, right: 256, top: -256, bottom: 256 }, x, y),
            ),
          ),
        ),
        5,
      );
    }
});
