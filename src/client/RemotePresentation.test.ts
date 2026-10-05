import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { createTrain } from "../railway/Train.js";
import { serializeEntity } from "../shared/serialization.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";
import { PlayerPredictor } from "./PlayerPredictor.js";
import { RemotePresentation } from "./RemotePresentation.js";

it("borrows sampled poses without modifying committed replica/collision data", () => {
  const view = new RemoteStateView(new World(new FlatStrategy()));
  const train = createTrain(0, 64);
  train.id = 1;
  view.applyFrame(
    {
      type: "frame",
      serverTick: 0,
      simulationTime: 0,
      playerEntityId: 1,
      lastProcessedInputSeq: 0,
      entityBaselines: [serializeEntity(train)],
    },
    0,
  );
  view.applyFrame(
    {
      type: "frame",
      serverTick: 6,
      simulationTime: 0.1,
      playerEntityId: 1,
      lastProcessedInputSeq: 0,
      entityDeltas: [{ id: 1, position: { wx: 19.2, wy: 64 } }],
    },
    0.1,
  );
  const committed = view.serverPlayerEntity;
  const before = structuredClone(committed);
  view.beginPresentation(0.1, 0.5);
  expect(view.playerEntity.position.wx).toBeCloseTo(9.6);
  expect(view.entities[0]).not.toBe(committed);
  expect(view.serverPlayerEntity).toBe(committed);
  expect(committed).toEqual(before);
  view.endPresentation();
  expect(view.playerEntity).toBe(committed);
  expect(view.entities[0]).toBe(committed);
});

it("holds paused authority and resumes without hidden wall-time debt", () => {
  const presentation = new RemotePresentation();
  const train = createTrain(20, 64);
  presentation.record([train], 1, 0);
  presentation.sample([train], 0);
  expect(presentation.sample([train], 10, true)[0]?.position.wx).toBe(20);
  expect(presentation.sample([train], 20, true)[0]?.position.wx).toBe(20);
  expect(presentation.sample([train], 21)[0]?.position.wx).toBe(20);
  train.position.wx = 23.2;
  presentation.record([train], 1 + 1 / 60, 21 + 1 / 60);
  expect(presentation.sample([train], 21 + 1 / 60)[0]?.position.wx).toBeCloseTo(23.2);
});

it("does not reuse motion after visibility exit, relocation, or replica clear", () => {
  const presentation = new RemotePresentation();
  const train = createTrain(0, 64);
  train.id = 2;
  presentation.record([train], 0, 0);
  train.position.wx = 19.2;
  presentation.record([train], 0.1, 0.1);
  presentation.record([], 0.2, 0.2);
  train.position.wx = 40;
  presentation.record([train], 0.3, 0.3);
  expect(presentation.sample([train], 0.31)[0]?.position.wx).toBe(40);
  train.position.wx = 2000;
  presentation.record([train], 0.4, 0.4);
  expect(presentation.sample([train], 0.41)[0]?.position.wx).toBe(2000);
  presentation.clear();
  train.position.wx = -100;
  presentation.record([train], 0, 1);
  expect(presentation.sample([train], 1)[0]?.position.wx).toBe(-100);
});

it("keeps locally predicted walking responsive on a separately sampled carrier", () => {
  const world = new World(new FlatStrategy());
  world.getChunk(0, 0);
  world.getChunk(-1, 0);
  const train = createTrain(0, 64);
  train.id = 2;
  const player = createPlayer(10, 64);
  player.id = 1;
  player.wz = 44;
  const predictor = new PlayerPredictor();
  predictor.reset(player);
  predictor.reconcile(player, 0, world, [], [player, train]);
  predictor.update(
    1 / 60,
    { dx: 1, dy: 0, sprinting: false, jump: false },
    world,
    [],
    [player, train],
  );
  const before = structuredClone(predictor.player);
  const displayedTrain = { ...train, position: { wx: -10, wy: 64 } };
  const a = predictor.samplePresentationPlayer(0, [displayedTrain]);
  const b = predictor.samplePresentationPlayer(1, [displayedTrain]);
  expect(a?.position.wx).toBeCloseTo(0);
  expect(b?.position.wx).toBeGreaterThan(a?.position.wx ?? 0);
  expect((b?.position.wx ?? 0) - (a?.position.wx ?? 0)).toBeLessThan(2);
  expect(predictor.player).toEqual(before);
  expect(predictor.presentationClock(0.5)).toBeNull();
});
