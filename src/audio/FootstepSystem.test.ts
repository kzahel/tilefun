import { expect, it, vi } from "vitest";
import { createPlayer } from "../entities/Player.js";
import type { Camera } from "../rendering/Camera.js";
import { required } from "../shared/required.js";
import { createPredator } from "../wildlife/Predator.js";
import { restorePredatorPose } from "../wildlife/PredatorMotion.js";
import { TileId } from "../world/TileRegistry.js";
import type { World } from "../world/World.js";
import type { AudioManager } from "./AudioManager.js";
import { FootstepSystem } from "./FootstepSystem.js";

it("paces predator steps from the active gait clip and silences non-gait or stalled poses", () => {
  const player = createPlayer(0, 0);
  const tiger = createPredator("tiger", 16, 0);
  tiger.id = 1;
  const ai = required(tiger.predator);
  const playOneShot = vi.fn();
  const footsteps = new FootstepSystem(
    { ready: true, getBuffer: () => ({}), playOneShot } as unknown as AudioManager,
    () => ({ getTerrainIfLoaded: () => TileId.Grass, getRoadAt: () => 0 }) as unknown as World,
    () =>
      ({ viewportWidth: 640, worldToScreen: () => ({ sx: 320, sy: 240 }) }) as unknown as Camera,
    () => player,
    () => [],
  );
  const run = (seconds: number) => {
    playOneShot.mockClear();
    for (let t = 0; t < seconds * 60; t++) footsteps.update(1 / 60, [player, tiger]);
    return playOneShot.mock.calls.length;
  };
  const pose = (state: NonNullable<typeof tiger.predator>["state"], vx: number) => {
    ai.state = state;
    restorePredatorPose(tiger);
    tiger.velocity = { vx, vy: 0 };
  };

  // Walk clip: 12 frames x 100ms, so one contact per 600ms (base sprite would give 50ms).
  pose("patrol", 30);
  expect(run(1.25)).toBe(3);
  // Feeding, or a patrol pose that has reached its aim/is blocked, makes no steps.
  pose("feed", 0);
  expect(run(2)).toBe(0);
  pose("patrol", 0);
  expect(run(2)).toBe(0);
});

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
