import { readFileSync } from "node:fs";
// @ts-expect-error pngjs has no bundled declarations
import { PNG } from "pngjs";
import { expect, it } from "vitest";
import { Direction, type Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { createCurveTrain } from "../railway/CurveTrain.js";
import { RailAlignment } from "../railway/RailPath.js";
import { curvedTrainRecipe } from "../scenarios/CurvedTrainRecipe.js";
import { createVehicle, VEHICLE_MODELS } from "../traffic/Vehicle.js";
import { authoredVehicleForType, vehicleMeshHeightScale } from "./AuthoredVehicleMeshes.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import { SceneFrame } from "./SceneFrame.js";

const world = { getHeightAt: () => 0, getChunkIfLoaded: () => undefined, getRoadAt: () => 0 };
const terrain = { collectElevationItems: () => [] };

it.each(VEHICLE_MODELS)(
  "attaches a roof passenger to %s fitted mesh without changing physics or fallback height",
  (model) => {
    const car = createVehicle(model, 200, 150);
    car.id = 1;
    car.wz = 16;
    const player = createPlayer(200, 150);
    player.id = 2;
    player.wz = 16 + (car.collider?.physicalHeight ?? 0);
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
    const rider = items.find(
      (item) => item.kind === "sprite" && item.sheetKey === player.sprite?.sheetKey,
    );
    if (rider?.kind !== "sprite") throw Error("Missing rider");
    expect(rider.zOffset).toBe(player.wz);
    expect(rider.meshRoofSupport).toEqual({
      assetId: authoredVehicleForType(car.type)?.assetId,
      heightDelta: (car.collider?.physicalHeight ?? 0) * (1 - vehicleMeshHeightScale(model)),
    });
    expect(player).toEqual(before);
  },
);

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
      // Once the entire sprite and the existing effects margin leave the view,
      // the collector must still avoid submitting it. Additional sedans and large cars use an
      // 80px enclosing mesh bound, so their vertical exit is farther away.
      for (const [wx, wy] of [
        [
          model === "fire-truck-ladder-2"
            ? -209
            : model === "fire-truck-ladder-1" || model.startsWith("garbage-truck-")
              ? -161
              : model === "ambulance" || model.startsWith("bus-")
                ? -129
                : -113,
          150,
        ],
        [
          model === "fire-truck-ladder-2"
            ? 609
            : model === "fire-truck-ladder-1" || model.startsWith("garbage-truck-")
              ? 561
              : model === "ambulance" || model.startsWith("bus-")
                ? 529
                : 513,
          150,
        ],
        [
          200,
          model === "fire-truck-ladder-2"
            ? -290
            : model === "fire-truck-ladder-1" || model.startsWith("garbage-truck-")
              ? -221
              : model === "ambulance" || model.startsWith("bus-")
                ? -177
                : model === "police-car" ||
                    model.startsWith("unindexed-sedan-") ||
                    model.startsWith("car-") ||
                    model === "sedan-12"
                  ? -145
                  : -120,
        ],
        [
          200,
          model === "fire-truck-ladder-2"
            ? 590
            : model === "fire-truck-ladder-1" || model.startsWith("garbage-truck-")
              ? 521
              : model === "ambulance" || model.startsWith("bus-")
                ? 477
                : model === "police-car" ||
                    model.startsWith("unindexed-sedan-") ||
                    model.startsWith("car-") ||
                    model === "sedan-12"
                  ? 495
                  : 461,
        ],
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
