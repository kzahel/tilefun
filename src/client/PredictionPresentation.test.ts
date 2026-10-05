import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { World } from "../world/World.js";
import { PlayerPredictor } from "./PlayerPredictor.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it.each([30, 60, 120])(
  "decays small display corrections in seconds without altering physics (%iHz)",
  (hz) => {
    let time = 0;
    const p = createPlayer(80, 80);
    p.id = 1;
    p.wz = 0;
    const world = new World(new FlatStrategy());
    world.getChunk(0, 0);
    const predictor = new PlayerPredictor(undefined, undefined, () => time);
    predictor.reset(p);
    predictor.update(1 / 60, idle, world, [], []);
    const before = { ...required(predictor.presentationPlayer).position };
    const prev = { ...required(predictor.presentationPlayer).prevPosition };
    p.position.wx -= 1;
    predictor.reconcile(p, 0, world, [], []);
    expect(required(predictor.player).position.wx).toBe(79);
    expect(required(predictor.presentationPlayer).position).toEqual(before);
    expect(required(predictor.presentationPlayer).prevPosition).toEqual(prev);
    for (let i = 1; i <= hz; i++) {
      time = i / hz;
      predictor.presentationPlayer;
    }
    expect(required(predictor.presentationPlayer).position.wx).toBeCloseTo(79, 6);
    expect(required(predictor.player).position.wx).toBe(79);
    p.position.wx = 150;
    predictor.reconcile(p, 0, world, [], []);
    expect(required(predictor.presentationPlayer).position.wx).toBe(150);
    predictor.clearPredicted();
    expect(predictor.presentationPlayer).toBeNull();
  },
);
