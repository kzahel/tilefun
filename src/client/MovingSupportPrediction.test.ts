import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { getEntityAABB } from "../entities/collision.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { createTrain } from "../railway/Train.js";
import { interpolatePosition } from "../rendering/EntityInterpolation.js";
import { bindPredictedPlayerPose } from "../rendering/PlayerPresentation.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { bedFloorSupport, DUMP_BED } from "../traffic/VehicleBed.js";
import { World } from "../world/World.js";
import { PlayerPredictor } from "./PlayerPredictor.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it("rebases an upright predicted rider onto committed inclined floors and their displayed pose", () => {
  const world = new World(new FlatStrategy());
  world.getChunk(0, 0);
  const truck = createVehicle("dump-truck", 100, 100, Direction.Right);
  truck.id = 2;
  const player = createPlayer(100 + DUMP_BED.center.x, 103);
  player.id = 1;
  player.wz = player.groundZ = DUMP_BED.floorZ;
  const predictor = new PlayerPredictor();
  predictor.reset(player);
  predictor.reconcile(player, 0, world, [], [truck]);
  for (let i = 1; i <= 8; i++) {
    truck.vehicleBedTilt = i * 0.03;
    truck.vehicleBedTarget = 0.3;
    predictor.update(1 / 60, idle, world, [], [truck]);
    const physics = required(predictor.player);
    expect(physics.wz).toBeCloseTo(
      required(bedFloorSupport(truck, getEntityAABB(physics.position, required(physics.collider)))),
      5,
    );
    const shown = required(
      predictor.samplePresentationPlayer(0.5, [
        { ...truck, vehicleBedTilt: truck.vehicleBedTilt - 0.01 },
      ]),
    );
    expect(shown.wz).toBeCloseTo(
      required(
        bedFloorSupport(
          { ...truck, vehicleBedTilt: truck.vehicleBedTilt - 0.01 },
          getEntityAABB(shown.position, required(shown.collider)),
        ),
      ),
      5,
    );
    expect(physics.parentId).toBeUndefined();
    expect(physics.jumpVZ).toBeUndefined();
  }
});
it("preserves the recessed bed support height during repeated prediction and presentation", () => {
  const world = new World(new FlatStrategy());
  world.getChunk(0, 0);
  const truck = createVehicle("dump-truck", 80, 80, Direction.Right);
  truck.vehicleBed = true;
  truck.id = 2;
  const player = createPlayer(80 + DUMP_BED.center.x, 83);
  player.id = 1;
  player.wz = player.groundZ = DUMP_BED.floorZ;
  const predictor = new PlayerPredictor();
  predictor.reset(player);
  predictor.reconcile(player, 0, world, [], [truck]);
  for (let i = 0; i < 8; i++) {
    truck.prevPosition = { ...truck.position };
    truck.position.wx += 2;
    predictor.update(1 / 60, idle, world, [], [truck]);
    expect(predictor.player?.wz).toBeCloseTo(DUMP_BED.floorZ, 6);
    expect(predictor.presentationPlayer?.wz).toBeCloseTo(DUMP_BED.floorZ, 6);
    expect(predictor.samplePresentationPlayer(0.5, [truck])?.wz).toBeCloseTo(DUMP_BED.floorZ, 6);
    expect(predictor.player?.jumpVZ).toBeUndefined();
  }
});
it("shares the carrier's render endpoints while replaying roof walking and detaches on jump/loss", () => {
  const world = new World(new FlatStrategy());
  world.getChunk(0, 0);
  const train = createTrain(80, 80);
  train.id = 2;
  train.velocity = { vx: 192, vy: 0 };
  train.prevPosition = { wx: 73.6, wy: 80 };
  const player = createPlayer(90, 80);
  player.id = 1;
  player.wz = 44;
  const predictor = new PlayerPredictor();
  predictor.reset(player);
  predictor.reconcile(player, 0, world, [], [train]);
  for (const commands of [0, 2, 0, 1, 4]) {
    for (let i = 0; i < commands; i++) predictor.update(1 / 60, idle, world, [], [train]);
    for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
      const shown = bindPredictedPlayerPose(player, predictor);
      const a = interpolatePosition(shown.position, shown.prevPosition, alpha);
      const b = interpolatePosition(train.position, train.prevPosition, alpha);
      expect(a.wx - b.wx).toBeCloseTo(10, 9);
      expect(a.wy - b.wy).toBeCloseTo(0, 9);
    }
  }
  predictor.storeInput(1, { ...idle, dx: 1 }, 1 / 60);
  predictor.update(1 / 60, { ...idle, dx: 1 }, world, [], [train]);
  const relative = required(predictor.player).position.wx - train.position.wx;
  expect(relative).toBeGreaterThan(10);
  train.prevPosition = { ...train.position };
  train.position.wx += 6.4;
  player.position.wx += 6.4;
  predictor.reconcile(player, 0, world, [], [train]);
  expect(required(predictor.player).position.wx - train.position.wx).toBeCloseTo(relative, 9);
  expect(predictor.lastReconcileDiagnostics?.resimSupportPosErr).toBeLessThan(0.000001);
  predictor.update(1 / 60, { ...idle, jump: true }, world, [], [train]);
  expect(required(predictor.player).velocity?.vx).toBeCloseTo(192, 9);
  const vx = required(predictor.player).velocity?.vx ?? 0;
  predictor.update(1 / 60, { ...idle, jump: true }, world, [], [train]);
  expect(required(predictor.player).velocity?.vx).toBeLessThanOrEqual(vx);
  expect(predictor.presentationPlayer?.wz).toBeGreaterThan(44);
  predictor.reset(player);
  predictor.reconcile(player, 0, world, [], [train]);
  predictor.update(1 / 60, idle, world, [], []);
  expect(predictor.presentationPlayer?.prevPosition).toEqual(predictor.prevPosition);
});

it("inherits carrier momentum once when walking off the edge", () => {
  const world = new World(new FlatStrategy());
  world.getChunk(0, 0);
  world.getChunk(1, 0);
  const train = createTrain(80, 80);
  train.id = 2;
  train.velocity = { vx: 192, vy: 0 };
  const player = createPlayer(80 + required(train.collider).width / 2 + 2, 80);
  player.id = 1;
  player.wz = 44;
  const predictor = new PlayerPredictor();
  predictor.reset(player);
  const right = { ...idle, dx: 1 };
  for (let i = 0; i < 15 && predictor.player?.jumpVZ === undefined; i++)
    predictor.update(1 / 60, right, world, [], [train]);
  expect(predictor.player?.jumpVZ).toBeDefined();
  const vx = required(required(predictor.player).velocity).vx;
  expect(vx).toBeGreaterThan(192);
  predictor.update(1 / 60, right, world, [], [train]);
  expect(required(required(predictor.player).velocity).vx).toBeLessThan(vx + 1);
});

it("keeps the displayed departure position when jumping from a buffered roof", () => {
  const world = new World(new FlatStrategy());
  world.getChunk(0, 0);
  const train = createTrain(80, 80);
  train.id = 2;
  train.velocity = { vx: 192, vy: 0 };
  const player = createPlayer(90, 80);
  player.id = 1;
  player.wz = 44;
  const predictor = new PlayerPredictor();
  predictor.reset(player);
  predictor.reconcile(player, 0, world, [], [train]);
  predictor.update(1 / 60, idle, world, [], [train]);
  const displayedTrain = { ...train, position: { wx: 70.4, wy: 80 } };
  const before = required(predictor.samplePresentationPlayer(1, [displayedTrain]));
  predictor.update(1 / 60, { ...idle, jump: true }, world, [], [train]);
  const after = required(predictor.samplePresentationPlayer(1, [displayedTrain]));
  expect(after.position.wx - before.position.wx).toBeCloseTo(192 / 60, 8);
  // Borrowing never moves the physics player onto the delayed display timeline.
  expect(predictor.player?.position.wx).toBeCloseTo(93.2, 8);
  // A scripted midair teleport clears passive state; its old display shift
  // must not survive even for a relocation below the large-snap threshold.
  const physics = required(predictor.player);
  delete physics.airMomentumX;
  delete physics.airMomentumY;
  expect(predictor.samplePresentationPlayer(1, [])?.position.wx).toBeCloseTo(93.2, 8);
});

it("replays an unacknowledged takeoff from a grounded acknowledgement without consuming it twice", () => {
  const world = new World(new FlatStrategy());
  world.getChunk(0, 0);
  const train = createTrain(80, 80);
  train.id = 2;
  train.velocity = { vx: 192, vy: 0 };
  const player = createPlayer(90, 80);
  player.id = 1;
  player.wz = 44;
  const predictor = new PlayerPredictor();
  predictor.reset(player);
  predictor.reconcile(player, 0, world, [], [train]);
  const jump = { ...idle, jump: true, jumpPressed: true };
  predictor.storeInput(1, jump, 1 / 30);
  predictor.update(1 / 30, jump, world, [], [train]);
  const before = required(predictor.player).jumpVZ;
  predictor.reconcile(player, 0, world, [], [train]);
  expect(predictor.player?.jumpVZ).toBe(before);
  expect(predictor.player?.airMomentumX).toBe(192);
  predictor.reconcile(player, 0, world, [], [train]);
  expect(predictor.player?.jumpVZ).toBe(before);
  expect(predictor.player?.velocity?.vx).toBe(192);
});
