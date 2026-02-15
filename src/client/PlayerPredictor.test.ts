import { describe, expect, it } from "vitest";
import { STEP_UP_THRESHOLD } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop, PropCollider } from "../entities/Prop.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { World } from "../world/World.js";
import { PlayerPredictor } from "./PlayerPredictor.js";

/** Create a mount entity with the rideable tag and rideSpeed. */
function createMount(wx: number, wy: number): Entity {
  const mount = createPlayer(wx, wy);
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
    directional: false,
    rideSpeed: 60,
  };
  mount.tags = new Set(["rideable"]);
  return mount;
}

/** Create a walkable prop surface at a given position. */
function makeWalkableProp(wx: number, wy: number, topZ: number): Prop {
  const collider: PropCollider = {
    offsetX: 0,
    offsetY: 0,
    width: 64,
    height: 64,
    zBase: 0,
    zHeight: topZ,
    walkableTop: true,
    passable: true,
  };
  return {
    id: 100,
    type: "test-step",
    position: { wx, wy },
    sprite: { sheetKey: "test", frameCol: 0, frameRow: 0, spriteWidth: 16, spriteHeight: 16 },
    collider,
    walls: null,
    isProp: true,
  };
}

/** Set up a mounted player+mount pair with predictor. */
function setupMounted() {
  const world = new World(new FlatStrategy());
  const predictor = new PlayerPredictor();

  const serverMount = createMount(100, 100);
  serverMount.id = 10;
  serverMount.wz = 0;
  serverMount.groundZ = 0;

  const serverPlayer = createPlayer(100, 100);
  serverPlayer.id = 1;
  serverPlayer.parentId = serverMount.id;
  serverPlayer.localOffsetX = 0;
  serverPlayer.localOffsetY = 0;
  serverPlayer.wz = 10;
  serverPlayer.jumpZ = 10; // ride offset
  delete serverPlayer.jumpVZ;

  predictor.reset(serverPlayer, serverMount);
  return { world, predictor, serverPlayer, serverMount };
}

describe("PlayerPredictor mount wz tracking", () => {
  it("reconcile syncs mount wz from server", () => {
    const { world, predictor, serverPlayer, serverMount } = setupMounted();

    // Server mount walked onto a step
    serverMount.wz = STEP_UP_THRESHOLD;
    serverMount.groundZ = STEP_UP_THRESHOLD;
    serverPlayer.wz = STEP_UP_THRESHOLD + 10;

    predictor.reconcile(serverPlayer, 0, world, [], [serverMount], serverMount.id);

    expect(predictor.mount?.wz).toBe(STEP_UP_THRESHOLD);
    expect(predictor.mount?.groundZ).toBe(STEP_UP_THRESHOLD);
    expect(predictor.player?.wz).toBe(STEP_UP_THRESHOLD + 10);
  });

  it("prediction updates mount wz when walking onto walkable prop", () => {
    const { world, predictor } = setupMounted();

    // Place a walkable prop at the mount's position
    const prop = makeWalkableProp(100, 100, STEP_UP_THRESHOLD);

    // Predict a tick with no movement (mount stays in place)
    const noMove = { dx: 0, dy: 0, jump: false, sprinting: false, throw: false };
    predictor.update(1 / 60, noMove, world, [prop], []);

    // Mount should have snapped to the walkable surface
    expect(predictor.mount?.wz).toBe(STEP_UP_THRESHOLD);
    // Player should track mount wz + jumpZ
    expect(predictor.player?.wz).toBe(STEP_UP_THRESHOLD + 10);
  });

  it("mount and player wz stay in sync during prediction", () => {
    const { world, predictor } = setupMounted();

    // Walkable prop ahead at x=100..164
    const prop = makeWalkableProp(100, 100, STEP_UP_THRESHOLD);

    // Move mount right across the prop
    const moveRight = { dx: 1, dy: 0, jump: false, sprinting: false, throw: false };
    for (let i = 0; i < 10; i++) {
      predictor.update(1 / 60, moveRight, world, [prop], []);
    }

    const mountWz = predictor.mount?.wz ?? 0;
    const playerWz = predictor.player?.wz ?? 0;

    // Player should be exactly mount.wz + jumpZ (10)
    expect(playerWz).toBe(mountWz + 10);
  });

  it("mount wz returns to ground when walking off prop", () => {
    const { world, predictor, serverPlayer, serverMount } = setupMounted();

    // Start mounted on an elevated surface
    serverMount.wz = STEP_UP_THRESHOLD;
    serverMount.groundZ = STEP_UP_THRESHOLD;
    serverPlayer.wz = STEP_UP_THRESHOLD + 10;
    predictor.reconcile(serverPlayer, 0, world, [], [serverMount], serverMount.id);

    // Predict a tick with no walkable props (mount is on flat ground now)
    const noMove = { dx: 0, dy: 0, jump: false, sprinting: false, throw: false };
    predictor.update(1 / 60, noMove, world, [], []);

    // Mount should snap down to ground (canFall=false)
    expect(predictor.mount?.wz).toBe(0);
    expect(predictor.player?.wz).toBe(10); // 0 + jumpZ
  });

  it("unmounted player does not derive wz from any mount", () => {
    const world = new World(new FlatStrategy());
    const predictor = new PlayerPredictor();

    const serverPlayer = createPlayer(100, 100);
    serverPlayer.id = 1;
    serverPlayer.wz = 0;
    predictor.reset(serverPlayer);

    const noMove = { dx: 0, dy: 0, jump: false, sprinting: false, throw: false };
    predictor.update(1 / 60, noMove, world, [], []);

    expect(predictor.mount).toBeNull();
    expect(predictor.player?.wz).toBe(0);
  });
});
