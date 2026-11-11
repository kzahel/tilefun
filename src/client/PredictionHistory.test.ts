import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { PredictionHistory } from "./PredictionHistory.js";

it("retains position values, replaces the same tick, and retires the oldest retained tick", () => {
  const history = new PredictionHistory(2),
    player = createPlayer(3, 4);
  history.remember(10, player);
  player.position.wx = 0;
  player.position.wy = 0;
  expect(history.distance(10, player)).toBe(5);
  history.remember(11, player);
  player.wz = 12;
  expect(history.distance(10, player)).toBe(13);
  history.remember(10, player); // replace, without retiring tick 11 or changing insertion order
  expect(history.distance(10, player)).toBe(0);
  expect(history.distance(11, player)).toBe(12);
  history.remember(12, player);
  expect(history.distance(10, player)).toBeUndefined();
  expect(history.distance(11, player)).toBe(12); // recycling the oldest record cannot overwrite this one
  history.clear();
  expect(history.distance(11, player)).toBeUndefined();
  history.remember(1, player);
  expect(history.distance(1, player)).toBe(0);
});
