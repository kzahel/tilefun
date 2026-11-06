import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { required } from "../shared/required.js";
import { teleportBody } from "./PhysicalEdits.js";
import { PhysicsScene } from "./PhysicsScene.js";

const ground = {
  getHeight: () => 0,
  getCollision: () => 0,
  queryProps: () => [],
  geometryVersion: () => ({ identity: 1, revision: 0 }),
};

it("consumes one held airborne jump press on landing and retains it through binary replay", async () => {
  const scene = await PhysicsScene.create(),
    replay = await PhysicsScene.create();
  const p = createPlayer(0, 32),
    copy = createPlayer(0, 32);
  p.id = copy.id = 1;
  try {
    scene.synchronize([p]);
    scene.step(new Map([[1, { vx: 0, vy: 0, jump: true }]]), ground);
    scene.step(new Map(), ground); // Release the original jump.
    scene.step(new Map([[1, { vx: 0, vy: 0, jump: true }]]), ground);
    expect(scene.bodyState(1)?.jumpQueued).toBe(true);
    const frame = decodeServerMessage(
      encodeServerMessage({
        type: "frame",
        serverTick: 3,
        playerEntityId: 1,
        lastProcessedInputSeq: 0,
        physics: scene.snapshot(),
      }),
    );
    if (frame.type !== "frame") throw Error("Missing frame");
    replay.synchronize([copy]);
    replay.restore(required(frame.physics));
    let launches = 0,
      previous = required(scene.bodyState(1)).vz;
    for (let tick = 0; tick < 150; tick++) {
      const held = new Map([[1, { vx: 0, vy: 0, jump: true }]]);
      scene.synchronize([p]);
      scene.step(held, ground);
      replay.step(held, ground);
      const state = required(scene.bodyState(1));
      if (state.vz > 100 && previous <= 0) launches++;
      expect(replay.bodyState(1)?.z).toBeCloseTo(state.z, 3);
      previous = state.vz;
    }
    expect(launches).toBe(1);
    expect(p.wz).toBeLessThan(0.1);
    expect(scene.bodyState(1)?.jumpQueued).toBeUndefined();
  } finally {
    scene.dispose();
    replay.dispose();
  }
});
it("cancels a queued held request on release and explicit relocation", async () => {
  const scene = await PhysicsScene.create(),
    p = createPlayer(0, 32);
  p.id = 1;
  try {
    teleportBody(p, { wx: 0, wy: 32, wz: 30 });
    p.jumpVZ = -1;
    scene.synchronize([p]);
    scene.step(new Map([[1, { vx: 0, vy: 0, jump: true }]]), ground);
    expect(scene.bodyState(1)?.jumpQueued).toBe(true);
    scene.step(new Map(), ground);
    expect(scene.bodyState(1)?.jumpQueued).toBeUndefined();
    scene.step(new Map([[1, { vx: 0, vy: 0, jump: true }]]), ground);
    expect(scene.bodyState(1)?.jumpQueued).toBe(true);
    teleportBody(p, { wx: 80, wy: 32, wz: 0 });
    scene.synchronize([p]);
    expect(scene.bodyState(1)?.jumpQueued).toBeUndefined();
    scene.step(new Map([[1, { vx: 0, vy: 0, jump: true }]]), ground);
    expect(p.wz).toBeLessThan(0.1);
  } finally {
    scene.dispose();
  }
});
