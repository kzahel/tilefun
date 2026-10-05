import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { createTrain } from "../railway/Train.js";
import { interpolatePosition } from "../rendering/EntityInterpolation.js";
import { bindPredictedPlayerPose } from "../rendering/PlayerPresentation.js";
import { World } from "../world/World.js";
import { PlayerPredictor } from "./PlayerPredictor.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
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
