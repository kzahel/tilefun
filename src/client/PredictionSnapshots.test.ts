import { expect, it } from "vitest";
import { createChicken } from "../entities/Chicken.js";
import { createPlayer } from "../entities/Player.js";
import { capturePredictionBodies } from "./PredictionSnapshots.js";

it("captures detached queued bodies in physics order and leaves missing metadata absent", () => {
  const player = createPlayer(12, 34),
    npc = createChicken(56, 78);
  player.id = 1;
  npc.id = 2;
  npc.tags = new Set(["before"]);
  const entities = new Map([
    [1, player],
    [99, createPlayer(0, 0)],
    [2, npc],
  ]);
  const captured = capturePredictionBodies([{ id: 2 }, { id: 404 }, { id: 1 }], entities);
  expect([...captured.keys()]).toEqual([2, 1]); // physics order, independent of replica index order
  const privateNpc = captured.get(2),
    privatePlayer = captured.get(1);
  if (!privateNpc || !privatePlayer) throw Error("Expected captured bodies");
  player.position.wx = 999;
  if (npc.sprite) npc.sprite.frameCol = 99;
  npc.tags.add("later");
  entities.delete(2);
  expect(privatePlayer.position).toEqual({ wx: 12, wy: 34 });
  expect(privateNpc.sprite?.frameCol).not.toBe(99);
  expect(privateNpc.tags).toEqual(new Set(["before"]));
  privateNpc.position.wy = -10;
  if (privateNpc.collider) privateNpc.collider.width++;
  expect(npc.position.wy).toBe(78);
  expect(privateNpc.collider?.width).not.toBe(npc.collider?.width);
  expect(capturePredictionBodies([], entities).size).toBe(0);
});
