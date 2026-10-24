import { readFileSync } from "node:fs";
// @ts-expect-error pngjs has no bundled declarations
import { PNG } from "pngjs";
import { expect, it } from "vitest";
import { Direction, type Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { createCurveTrain } from "../railway/CurveTrain.js";
import { RailAlignment } from "../railway/RailPath.js";
import { curvedTrainRecipe } from "../scenarios/CurvedTrainRecipe.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { createVehicle, VEHICLE_MODELS } from "../traffic/Vehicle.js";
import { DUMP_BED, hasDetailedVehicleSurface, hasVehicleBed } from "../traffic/VehicleBed.js";
import { gradeRoofOffset, vehicleGroundPose } from "../traffic/VehicleGroundPose.js";
import { authoredVehicleForType, vehicleMeshHeightScale } from "./AuthoredVehicleMeshes.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import { meshBedFoot, meshGradePoint } from "./MeshGradePose.js";
import { SceneFrame } from "./SceneFrame.js";

const world = { getHeightAt: () => 0, getChunkIfLoaded: () => undefined, getRoadAt: () => 0 };
const terrain = { collectElevationItems: () => [] };

it.each(VEHICLE_MODELS)(
  "attaches a supported passenger to %s fitted mesh without changing physics or fallback height",
  (model) => {
    const car = createVehicle(model, 200, 150);
    car.id = 1;
    car.wz = 16;
    const player = createPlayer(200, 150);
    player.id = 2;
    player.wz =
      16 +
      (model === "car-transporter"
        ? 24.65
        : hasVehicleBed(car)
          ? DUMP_BED.floorZ
          : (car.collider?.physicalHeight ?? 0));
    const before = structuredClone(player);
    const camera = new Camera();
    camera.setViewport(600, 400);
    camera.snapTo(200, 150);
    const items = collectScene(
      [car, player],
      [],
      world,
      camera,
      camera.getVisibleChunkRange(),
      1,
      terrain,
      [],
      false,
      undefined,
      undefined,
      new SceneFrame(),
    );
    const body = items.find(
      (item) => item.kind === "sprite" && item.sheetKey === car.sprite?.sheetKey,
    );
    const candidates = body?.kind === "sprite" && body.bedGroup ? body.bedGroup.contents : items;
    const rider = candidates.find(
      (item) => item.kind === "sprite" && item.sheetKey === player.sprite?.sheetKey,
    );
    if (rider?.kind !== "sprite") throw Error("Missing rider");
    expect(rider.zOffset).toBe(player.wz);
    if (hasDetailedVehicleSurface(car)) {
      expect(rider.meshBedSupport).toBe(true);
      expect(rider.meshRoofSupport).toBeUndefined();
    } else
      expect(rider.meshRoofSupport).toEqual({
        assetId: authoredVehicleForType(car.type)?.assetId,
        heightDelta: (car.collider?.physicalHeight ?? 0) * (1 - vehicleMeshHeightScale(model)),
      });
    expect(player).toEqual(before);
  },
);

it("collects the ramp pilot and its roof rider from the same interpolated wheel pose", () => {
  const car = createVehicle("compact-1", 200, 150, Direction.Right);
  car.id = 1;
  car.wz = 90;
  car.prevWz = 88;
  car.prevPosition = { wx: 192, wy: 150 };
  const player = createPlayer(200, 150);
  player.id = 2;
  player.wz = 90 + (car.collider?.physicalHeight ?? 0);
  player.prevWz = player.wz - 2;
  player.prevPosition = { wx: 192, wy: 150 };
  const ramp = surfaceProp(
    { left: -100, right: 500, top: -150, bottom: 450 },
    { id: "ramp", spaceId: "outside", z: 0, riseX: 150, riseY: 0, thickness: 8, connectsTo: [] },
  );
  const camera = new Camera();
  camera.zoom = 1 / 3;
  camera.setViewport(600, 400);
  camera.snapTo(200, 150);
  const before = structuredClone([car, player]);
  const items = collectScene(
    [car, player],
    [ramp],
    world,
    camera,
    camera.getVisibleChunkRange(),
    0.5,
    terrain,
    [],
    false,
    undefined,
    undefined,
    new SceneFrame(),
  );
  const body = items.find(
    (item) => item.kind === "sprite" && item.sheetKey === car.sprite?.sheetKey,
  );
  const rider = items.find(
    (item) => item.kind === "sprite" && item.sheetKey === player.sprite?.sheetKey,
  );
  const pose = vehicleGroundPose({ ...car, position: { wx: 196, wy: 150 }, wz: 89 }, () => 0, [
    ramp,
  ]);
  if (body?.kind !== "sprite" || rider?.kind !== "sprite" || !pose)
    throw Error("Missing grade scene");
  expect(body.mesh?.gradePitch).toBeCloseTo(Math.atan(0.25));
  expect(body.mesh?.gradeRoll).toBe(0);
  expect(body.mesh?.gradeOffsetZ).toBeCloseTo(pose.offsetZ);
  // Sprite fallback and authority stay at their original upright heights.
  expect(body.zOffset).toBe(89);
  expect(rider.zOffset).toBe(player.wz - 1);
  const height = car.collider?.physicalHeight ?? 0;
  const fit = vehicleMeshHeightScale("compact-1");
  expect(rider.meshRoofSupport?.heightDelta).toBeCloseTo(
    height * (1 - fit) - gradeRoofOffset(pose, 0, 0, 0, height * fit),
  );
  expect([car, player]).toEqual(before);
});

it.each(["dump-truck", "car-transporter"])(
  "attaches %s supported bed feet to its grade without shifting air/underbody actors or fallbacks",
  (model) => {
    const car = createVehicle(model, 200, 150, Direction.Right);
    car.id = 1;
    car.wz = 120;
    const floor = model === "dump-truck" ? DUMP_BED.floorZ : 24.65;
    const player = createPlayer(180, 153);
    player.id = 2;
    player.wz = 120 + floor;
    const below = { ...createPlayer(180, 153), id: 3, wz: 0 };
    const jumping = { ...createPlayer(180, 153), id: 4, wz: player.wz + 20, jumpVZ: 1 };
    const before = structuredClone([car, player, below, jumping]);
    const ramp = surfaceProp(
      { left: 0, right: 400, top: 0, bottom: 300 },
      {
        id: "ramp",
        spaceId: "outside",
        z: 65.625,
        riseX: 50,
        riseY: 18.75,
        thickness: 8,
        connectsTo: [],
      },
    );
    const camera = new Camera();
    camera.zoom = 1 / 3;
    camera.setViewport(600, 400);
    camera.snapTo(200, 150);
    const items = collectScene(
      [car, player, below, jumping],
      [ramp],
      world,
      camera,
      camera.getVisibleChunkRange(),
      1,
      terrain,
      [],
      false,
      undefined,
      undefined,
      new SceneFrame(),
    );
    const body = items.find((i) => i.kind === "sprite" && i.mesh);
    if (body?.kind !== "sprite" || !body.bedGroup || !body.mesh)
      throw Error("Missing detailed bed");
    expect(body.mesh.gradePitch).toBeGreaterThan(0);
    expect(body.mesh.gradeRoll).toBeGreaterThan(0);
    const [supported, underneath, airborne] = body.bedGroup.contents;
    expect(supported?.meshBedSupport).toBe(true);
    expect(supported?.meshRoofSupport).toBeUndefined();
    expect(supported?.zOffset).toBe(player.wz);
    expect(underneath?.meshBedSupport).toBeUndefined();
    expect(underneath?.zOffset).toBe(0);
    expect(airborne?.meshBedSupport).toBeUndefined();
    expect(airborne?.zOffset).toBe(jumping.wz);
    expect([car, player, below, jumping]).toEqual(before);
  },
);

it("inherits a transporter's grade for a passenger on the carried car's fitted roof", () => {
  const truck = createVehicle("car-transporter", 200, 150, Direction.Right);
  truck.id = 1;
  truck.wz = 120;
  truck.transportLoadId = 2;
  const car = createVehicle("compact-1", 179, 150, Direction.Right);
  car.id = 2;
  car.transportedBy = 1;
  car.wz = 144.65;
  const player = createPlayer(179, 150);
  player.id = 3;
  player.wz = car.wz + (car.collider?.physicalHeight ?? 0);
  const before = structuredClone([truck, car, player]);
  const ramp = surfaceProp(
    { left: 0, right: 400, top: 0, bottom: 300 },
    {
      id: "ramp",
      spaceId: "outside",
      z: 65.625,
      riseX: 50,
      riseY: 18.75,
      thickness: 8,
      connectsTo: [],
    },
  );
  const camera = new Camera();
  camera.zoom = 1 / 3;
  camera.setViewport(600, 400);
  camera.snapTo(200, 150);
  const items = collectScene(
    [truck, car, player],
    [ramp],
    world,
    camera,
    camera.getVisibleChunkRange(),
    1,
    terrain,
    [],
    false,
    undefined,
    undefined,
    new SceneFrame(),
  );
  const body = items.find(
    (i) => i.kind === "sprite" && i.mesh?.assetId === "car-transporter-authored-v2",
  );
  if (body?.kind !== "sprite" || !body.mesh) throw Error("Missing carrier");
  const rider = body.bedGroup?.contents[0];
  if (!rider) throw Error("Missing load's roof rider");
  expect(body.towGroup?.mesh?.gradeOffsetZ).toBeUndefined();
  expect(rider.meshBedSupport).toBeUndefined();
  expect(rider.meshRoofSupport?.ownerAssetId).toBe(body.mesh.assetId);
  const expected = meshGradePoint(
    body.mesh,
    -21,
    0,
    24.65 + (car.collider?.physicalHeight ?? 0) * vehicleMeshHeightScale("compact-1"),
  );
  const foot = meshBedFoot(body, rider);
  expect(foot.x).toBeCloseTo(expected.x, 8);
  expect(foot.y).toBeCloseTo(expected.y, 8);
  expect(foot.z).toBeCloseTo(expected.z, 8);
  expect(rider.zOffset).toBe(player.wz);
  const flat = collectScene(
    [truck, car, player],
    [],
    world,
    camera,
    camera.getVisibleChunkRange(),
    1,
    terrain,
    [],
    false,
    undefined,
    undefined,
    new SceneFrame(),
  );
  const flatBody = flat.find((i) => i.kind === "sprite" && i.mesh?.assetId === body.mesh?.assetId);
  if (flatBody?.kind !== "sprite" || !flatBody.bedGroup?.contents[0])
    throw Error("Missing flat carried rider");
  const flatRider = flatBody.bedGroup.contents[0];
  expect(flatRider.meshRoofSupport?.ownerAssetId).toBe(body.mesh.assetId);
  expect(meshBedFoot(flatBody, flatRider).z).toBeCloseTo(
    24.65 + (car.collider?.physicalHeight ?? 0) * vehicleMeshHeightScale("compact-1"),
    8,
  );
  expect([truck, car, player]).toEqual(before);
});

function collect(entity: Entity, alpha = 1, zoom = 1 / 3, frame?: SceneFrame, height = 0) {
  const camera = new Camera();
  camera.zoom = zoom;
  camera.setViewport(400 * 3 * zoom, 300 * 3 * zoom);
  camera.snapTo(200, 150);
  return collectScene(
    [entity],
    [],
    { ...world, getHeightAt: () => height },
    camera,
    camera.getVisibleChunkRange(),
    alpha,
    terrain,
    [],
    false,
    undefined,
    undefined,
    frame,
  );
}

it("keeps a native train comparison disabled and uses physical heading in frameless collection", () => {
  const path = curvedTrainRecipe().railways?.[0]?.path;
  if (!path) throw Error("Missing train path");
  const train = createCurveTrain(new RailAlignment(path), 900)[2];
  if (!train?.sprite) throw Error("Missing front carriage");
  train.position = { wx: 200, wy: 150 };
  train.prevPosition = { ...train.position };
  train.sprite.frameRow = 32;
  train.velocity = { vx: -10, vy: -10 };
  const original = structuredClone(train);
  const native = collect(train, 1, 1 / 3, new SceneFrame({ authoredTrains: false }))[0];
  if (native?.kind !== "sprite") throw Error("Missing native train");
  expect(native.mesh).toBeUndefined();
  for (const frame of [undefined, new SceneFrame()]) {
    const item = collect(train, 1, 1 / 3, frame)[0];
    if (item?.kind !== "sprite") throw Error("Missing train body");
    expect(item.mesh?.assetId).toBe("train-blue-front-authored-v3");
    expect(item.mesh?.orientation[2]).toBeCloseTo(Math.sin(Math.PI / 8));
    expect(item.mesh?.orientation[3]).toBeCloseTo(Math.cos(Math.PI / 8));
  }
  expect(train).toEqual(original);
});

it("collects an incoming bus while its center is above the screen and its front is visible", () => {
  const bus = createVehicle("bus-2", 200, -40, Direction.Down);
  // Actual committed artwork has an opaque front pixel five world pixels inside
  // the viewport at this position, well before the old center-based cutoff.
  const sheet: { width: number; data: Uint8Array } = PNG.sync.read(
    readFileSync("public/assets/vehicles/bus-2-v1.png"),
  );
  const frontRow = 189;
  expect(
    Array.from(
      { length: sheet.width },
      (_, x) => sheet.data[(frontRow * sheet.width + x) * 4 + 3],
    ).some((alpha) => alpha !== undefined && alpha > 0),
  ).toBe(true);
  expect(collect(bus)).toHaveLength(1);
});

it.each(VEHICLE_MODELS)("keeps %s sprite and mesh bounds at all four screen edges", (model) => {
  for (const direction of [Direction.Down, Direction.Up, Direction.Left, Direction.Right]) {
    const car = createVehicle(model, 200, 150, direction);
    for (const zoom of [0.2, 1 / 3, 1]) {
      for (const [wx, wy] of [
        [-95, 150],
        [495, 150],
        [200, -79],
        [200, 443],
      ] as const) {
        car.position = { wx, wy };
        expect(collect(car, 1, zoom)).toHaveLength(1);
      }
      // The fallback spans [-96,96] x [-144,80] around its ground origin.
      // A registered mesh sphere projects to +/- radius horizontally and
      // +/- sqrt(2)*radius vertically under the shared y-z camera. Test just
      // beyond their union plus the 16px effects margin, for every family.
      const radius = authoredVehicleForType(car.type)?.radius ?? 0;
      const halfWidth = Math.max(96, radius);
      const topReach = Math.max(144, radius * Math.SQRT2);
      const bottomReach = Math.max(80, radius * Math.SQRT2);
      for (const [wx, wy] of [
        [-halfWidth - 17, 150],
        [400 + halfWidth + 17, 150],
        [200, -bottomReach - 17],
        [200, 300 + topReach + 17],
      ] as const) {
        car.position = { wx, wy };
        expect(collect(car, 1, zoom)).toHaveLength(0);
      }
    }
  }
});

it("culls at the interpolated position while a vehicle crosses the top edge", () => {
  const bus = createVehicle("bus-2", 200, -200);
  bus.prevPosition = { wx: 200, wy: -40 };
  const before = structuredClone(bus);
  expect(collect(bus, 0)).toHaveLength(1);
  expect(collect(bus, 0.25)).toHaveLength(1);
  expect(collect(bus, 1)).toHaveLength(0);
  expect(bus).toEqual(before);
});

it("culls at the interpolated horizontal position", () => {
  const bus = createVehicle("bus-2", -200, 150);
  bus.prevPosition = { wx: -95, wy: 150 };
  expect(collect(bus, 0)).toHaveLength(1);
  expect(collect(bus, 1)).toHaveLength(0);
});

it("uses displayed height while a vehicle crosses the top edge", () => {
  const bus = createVehicle("bus-2", 200, -40);
  bus.prevWz = 0;
  bus.wz = 200;
  expect(collect(bus, 0)).toHaveLength(1);
  expect(collect(bus, 1)).toHaveLength(0);
});

it("handles negative sprite offsets near the bottom edge", () => {
  const player = createPlayer(200, 400);
  if (!player.sprite) throw new Error("Missing player sprite");
  player.sprite.drawOffsetY = -100;
  expect(collect(player)).toHaveLength(1);
  player.position.wy = 449;
  expect(collect(player)).toHaveLength(0);
});

it("uses terrain and interpolated jump height for legacy entities", () => {
  const player = createPlayer(200, -40);
  delete player.wz;
  player.prevJumpZ = 0;
  player.jumpZ = 200;
  if (!player.sprite) throw new Error("Missing player sprite");
  player.sprite.drawOffsetY = 80;
  expect(collect(player, 0)).toHaveLength(1);
  expect(collect(player, 1)).toHaveLength(0);
  player.position.wy = 350;
  player.jumpZ = 0;
  player.sprite.drawOffsetY = 0;
  expect(collect(player)).toHaveLength(0);
  expect(collect(player, 1, 1 / 3, undefined, 10)).toHaveLength(1);
});

it("retains conservative mesh bounds even when the fallback sprite is outside the view", () => {
  const car = createVehicle("compact-1", 200, -100);
  expect(collect(car, 1, 1 / 3, new SceneFrame())).toHaveLength(1);
  car.position.wy = -120;
  expect(collect(car, 1, 1 / 3, new SceneFrame())).toHaveLength(0);
});

it.each(["police-car", "garbage-truck-green", "garbage-truck-orange", "fire-truck-ladder-2"])(
  "preserves %s colored flashing sprite fallback and off reset",
  (model) => {
    const car = createVehicle(model, 200, 150);
    const frame = new SceneFrame();
    car.emergencyState = 1;
    frame.presentationTime = 0.05;
    const items = collect(car, 1, 1 / 3, frame);
    const item = items[0];
    expect(item?.kind).toBe("sprite");
    if (item?.kind !== "sprite") throw Error("Missing vehicle");
    expect(item.emergencyFlash).toBe(1);
    expect(item.emergencyColors?.[0]).toBe(
      model.startsWith("garbage-") ? "#ffd37a" : model === "police-car" ? "#ff7979" : "#79dfff",
    );
    car.emergencyState = 0;
    expect(collect(car, 1, 1 / 3, frame)[0]).not.toHaveProperty("emergencyFlash");
  },
);
