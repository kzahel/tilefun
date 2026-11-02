import { expect, it } from "vitest";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { World } from "../world/World.js";
import { characterPhysicsReady, prepareCharacterPhysics } from "./CharacterPhysics.js";
import { getMovementPhysicsParams } from "./PlayerMovement.js";

it("holds unready prediction and replays retained commands after lazy initialization", async () => {
  expect(characterPhysicsReady(0)).toBe(true);
  expect(characterPhysicsReady(1)).toBe(false);
  const player = createPlayer(0, 0);
  player.id = 1;
  const physics = { ...getMovementPhysicsParams(), characterPhysics: 1 as const };
  const predictor = new PlayerPredictor(
    () => ({ ...physics }),
    () => 1,
    () => 0,
  );
  const world = new World(new FlatStrategy());
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) world.getChunk(x, y);
  predictor.reset(player);
  const movement = { dx: 1, dy: 0, jump: false, sprinting: false };
  predictor.storeInput(1, movement, 0.017);
  predictor.update(0.017, movement, world, [], []);
  expect(predictor.player?.position.wx).toBe(0);
  await prepareCharacterPhysics(1);
  predictor.reconcile(player, 0, world, [], []);
  expect(predictor.player?.position.wx).toBeGreaterThan(0.5);
  await expect(prepareCharacterPhysics(1.5)).rejects.toThrow();
});
