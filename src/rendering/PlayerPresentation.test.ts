import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { Camera } from "./Camera.js";
import { beginPlayerPresentation, followPlayer } from "./PlayerPresentation.js";

it("shares predicted camera/body interpolation, height follow and framing at sub-tick times", () => {
  const player = createPlayer(140, 260);
  player.wz = 30;
  const previous = { wx: 100, wy: 200 };
  const predictor = { player, prevPosition: previous, prevWz: 10, prevJumpZ: 4 };
  const camera = new Camera();
  camera.snapTo(80, 150);
  camera.savePrev();
  followPlayer(camera, player, true, -12);
  const actual = { x: camera.x, y: camera.y };
  expect(actual).toEqual({ x: 86, y: 156.8 });
  for (const alpha of [0, 0.25, 0.5, 0.75, 1]) {
    beginPlayerPresentation(camera, player, alpha, predictor, true, -12);
    const f = 1 - 0.9 ** alpha;
    expect(camera.x).toBeCloseTo(80 + (100 + 40 * alpha - 80) * f);
    expect(camera.y).toBeCloseTo(150 + (200 + 60 * alpha - (10 + 20 * alpha) - 12 - 150) * f);
    expect(player.prevPosition).toBe(previous);
    expect(player.prevWz).toBe(10);
    expect(player.prevJumpZ).toBe(4);
    expect(player.position).toEqual({ wx: 140, wy: 260 });
    expect(player.wz).toBe(30);
    camera.restoreActual();
    expect({ x: camera.x, y: camera.y }).toEqual(actual);
  }
});

it("uses replica previous poses without prediction and applies shake after follow", () => {
  const player = createPlayer(120, 180);
  player.prevPosition = { wx: 100, wy: 160 };
  const camera = new Camera();
  camera.snapTo(100, 160);
  camera.savePrev();
  followPlayer(camera, player);
  camera.shakeOffsetX = 3;
  camera.shakeOffsetY = -2;
  beginPlayerPresentation(camera, player, 0.5);
  expect(camera.x).toBeCloseTo(100 + 10 * (1 - Math.sqrt(0.9)) + 3);
  expect(camera.y).toBeCloseTo(160 + 10 * (1 - Math.sqrt(0.9)) - 2);
  camera.restoreActual();
  expect([camera.x, camera.y]).toEqual([102, 162]);
});

it("keeps a snap pending for the first real player and does not sweep teleports", () => {
  const camera = new Camera();
  camera.snapTo(0, 0);
  camera.requestSnap();
  const placeholder = createPlayer(10, 10);
  placeholder.id = -1;
  followPlayer(camera, placeholder);
  expect(camera.x).toBe(0);
  const player = createPlayer(1000, 2000);
  player.id = 42;
  followPlayer(camera, player);
  player.prevPosition = { ...player.position };
  beginPlayerPresentation(camera, player, 0.25);
  expect([camera.x, camera.y]).toEqual([1000, 2000]);
});
