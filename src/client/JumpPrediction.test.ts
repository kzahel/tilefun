import { expect, it } from "vitest";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { jumpParkRecipe } from "../scenarios/JumpParkRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import { required } from "../shared/required.js";
import { manualCarMovement } from "../traffic/CarControls.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";
import { PlayerPredictor } from "./PlayerPredictor.js";
import { predictInput } from "./predictInput.js";

it("replays a fast sky-jump landing without a sideways kick at the slab join", async () => {
  const session = await ScenarioSession.create(jumpParkRecipe("open-wheel-racer", "sky"));
  let now = 0;
  const predictor = new PlayerPredictor(
    () => session.gravity,
    () => now,
  );
  const view = new RemoteStateView(new World());
  const frames: ArrayBuffer[][] = [];
  try {
    await predictor.ready;
    const id = required(session.handles.car);
    const scene = required(session.realm.physicsScene);
    const receive = (packets: ArrayBuffer[]) => {
      for (const packet of packets) {
        const message = decodeServerMessage(packet);
        if (message.type === "frame") view.applyFrame(message, now);
        else if (message.type.startsWith("sync-"))
          view.applyMessage(message as Parameters<typeof view.applyMessage>[0]);
      }
      if (!predictor.player) predictor.reset(view.serverPlayerEntity);
      predictor.reconcile(
        view.serverPlayerEntity,
        view.lastProcessedInputSeq,
        view.world,
        view.props,
        view.serverEntityMap,
        view.mountEntityId,
        { serverTick: view.serverTick, physics: required(view.physicsState) },
      );
    };
    await session.command({ kind: "enter-vehicle", entityId: id });
    // Exact settling matters: this fixture previously diverged 13.56 px / 6.55°.
    const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
    for (let tick = 0; tick < 3; tick++) await session.step(idle);
    receive(session.frames());
    predictor.sampleWork(true);
    const input = manualCarMovement({ dx: 0, dy: -1, jump: false, sprinting: true });
    let peak = 0,
      maxPositionError = 0,
      maxAngle = 0,
      landed = false;
    for (let seq = 4; seq <= 270; seq++) {
      now += PHYSICS_DT;
      predictInput(predictor, seq, input, PHYSICS_DT, view.world, view.props, view.serverEntities);
      await session.step(input);
      const authority = required(scene.bodyState(id));
      const published = predictor.publishedBody(id);
      // Compare the same physics tick, not a predicted pose against an old frame.
      expect(published.tick).toBe(scene.physicsTick);
      const predicted = required(published.body);
      maxPositionError = Math.max(
        maxPositionError,
        Math.hypot(
          predicted.position.wx - authority.x,
          predicted.position.wy - authority.y,
          (predicted.wz ?? 0) - authority.z,
        ),
      );
      const a = required(authority.rotation),
        b = required(predicted.bodyRotation);
      const dot = a.reduce((n, v, i) => n + v * required(b[i]), 0);
      maxAngle = Math.max(
        maxAngle,
        (2 * Math.acos(Math.min(1, Math.abs(dot) / (Math.hypot(...a) * Math.hypot(...b)))) * 180) /
          Math.PI,
      );
      peak = Math.max(peak, authority.z);
      landed ||= peak > 190 && authority.grounded && authority.x > 850;
      frames.push(session.frames());
      if (frames.length > 2) receive(required(frames.shift()));
    }
    expect(peak).toBeGreaterThan(190);
    expect(landed).toBe(true);
    expect(predictor.sampleWork().replaySteps).toBeGreaterThan(700);
    expect(maxPositionError).toBeLessThan(0.1);
    expect(maxAngle).toBeLessThan(0.1);
  } finally {
    predictor.clearPredicted();
    await session.close();
  }
});
