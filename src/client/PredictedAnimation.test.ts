import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { createRobin } from "../wildlife/Robin.js";
import { World } from "../world/World.js";
import { PlayerPredictor } from "./PlayerPredictor.js";

const right = { dx: 1, dy: 0, jump: false, sprinting: false },
  idle = { ...right, dx: 0 };
const world = new World(new FlatStrategy());
for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) world.chunks.getOrCreate(x, y);

it("walks through snapshot gaps, retains local phase through replay and stops locally", () => {
  const player = createPlayer(32, 32),
    p = new PlayerPredictor();
  player.id = 1;
  p.reset(player);
  const frames = new Set<number>();
  for (let i = 1; i <= 45; i++) {
    p.storeInput(i, right, 1 / 60);
    p.update(1 / 60, right, world, [], []);
    frames.add(p.player?.sprite?.frameCol ?? 0);
  }
  expect(frames.size).toBeGreaterThan(2);
  const phase = { col: p.player?.sprite?.frameCol, timer: p.player?.sprite?.animTimer };
  p.reconcile(player, 0, world, [], []);
  expect(p.player?.sprite?.frameCol).toBe(phase.col);
  expect(p.player?.sprite?.animTimer).toBe(phase.timer);
  p.update(1 / 60, idle, world, [], []);
  expect(p.player?.sprite?.frameCol).toBe(0);
  expect(p.player?.sprite?.animTimer).toBe(0);
  for (let i = 0; i < 10; i++) p.update(1 / 60, right, world, [], []);
  if (player.sprite) {
    player.sprite.sheetKey = "changed-model";
    player.sprite.frameCol = 2;
    player.sprite.animTimer = 17;
  }
  p.reconcile(player, 45, world, [], []);
  expect(p.player?.sprite?.sheetKey).toBe("changed-model");
  expect(p.player?.sprite?.frameCol).toBe(2);
  expect(p.player?.sprite?.animTimer).toBe(17);
  if (player.sprite) player.sprite.frameCol = 0;
  p.reset(player);
  expect(p.player?.sprite?.frameCol).toBe(0);
});

it("advances ordinary mount animation but leaves physically timed clips authoritative", () => {
  const player = createPlayer(32, 32),
    mount = createPlayer(32, 32),
    p = new PlayerPredictor();
  mount.id = 10;
  mount.type = "cow";
  mount.wanderAI = {
    state: "ridden",
    timer: 0,
    dirX: 0,
    dirY: 0,
    idleMin: 1,
    idleMax: 2,
    walkMin: 1,
    walkMax: 2,
    speed: 20,
    rideSpeed: 60,
    directional: false,
  };
  player.id = 1;
  player.parentId = 10;
  p.reset(player, mount);
  for (let i = 0; i < 10; i++) p.update(1 / 60, right, world, [], [mount]);
  expect(p.mount?.sprite?.frameCol).toBeGreaterThan(0);
  const timer = p.mount?.sprite?.animTimer;
  p.reconcile(player, 0, world, [], [mount], 10);
  expect(p.mount?.sprite?.animTimer).toBe(timer);
  const bird = createRobin(32, 32);
  bird.id = 11;
  if (bird.sprite) {
    bird.sprite.clip = 2;
    bird.sprite.clipElapsedMs = 500;
    bird.sprite.frameCol = 13;
  }
  player.parentId = 11;
  p.reset(player, bird);
  p.update(1 / 60, idle, world, [], [bird]);
  expect(p.mount?.sprite?.clipElapsedMs).toBe(500);
  expect(p.mount?.sprite?.frameCol).toBe(13);
});
