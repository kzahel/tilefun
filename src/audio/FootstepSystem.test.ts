import { expect, it, vi } from "vitest";
import { createPlayer } from "../entities/Player.js";
import type { Camera } from "../rendering/Camera.js";
import { required } from "../shared/required.js";
import { TileId } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import type { AudioManager } from "./AudioManager.js";
import { FootstepSystem } from "./FootstepSystem.js";

it("silences attached actors, forgets their gait/airborne history and resumes footsteps on exit", () => {
  const player = createPlayer(0, 0);
  const other = createPlayer(16, 0);
  other.id = 1;
  required(player.sprite).moving = true;
  required(other.sprite).moving = true;
  const playOneShot = vi.fn();
  const audio = { ready: true, getBuffer: () => ({}), playOneShot } as unknown as AudioManager;
  const world = {
    getTerrainIfLoaded: () => TileId.Grass,
    getRoadAt: () => 0,
  } as unknown as World;
  const camera = {
    viewportWidth: 640,
    worldToScreen: () => ({ sx: 320, sy: 240 }),
  } as unknown as Camera;
  const footsteps = new FootstepSystem(
    audio,
    () => world,
    () => camera,
    () => player,
    () => [],
  );
  footsteps.update(1 / 60, [player]);
  expect(playOneShot).toHaveBeenCalledOnce();
  player.jumpVZ = 100;
  footsteps.update(1 / 60, [player]);
  expect(playOneShot).toHaveBeenCalledTimes(2);
  playOneShot.mockClear();
  // Both local and remote drivers retain moving sprites, including a car jump.
  player.parentId = 7;
  other.parentId = 8;
  footsteps.update(1, [player, other]);
  delete player.jumpVZ;
  footsteps.update(1, [player, other]);
  expect(playOneShot).not.toHaveBeenCalled();
  // A walking bystander is still audible while the local player drives.
  delete other.parentId;
  footsteps.update(1 / 60, [player, other]);
  expect(playOneShot).toHaveBeenCalledOnce();
  playOneShot.mockClear();
  delete player.parentId;
  footsteps.update(1 / 60, [player]);
  expect(playOneShot).toHaveBeenCalledOnce(); // Fresh step; no false landing.
});
