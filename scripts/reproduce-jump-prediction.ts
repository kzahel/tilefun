import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { RemoteStateView } from "../src/client/ClientStateView.js";
import { PlayerPredictor } from "../src/client/PlayerPredictor.js";
import { predictInput } from "../src/client/predictInput.js";
import type { Entity } from "../src/entities/Entity.js";
import type { BodyRotation } from "../src/physics/BodyRotation.js";
import { PHYSICS_DT } from "../src/physics/PhysicsDefaults.js";
import type { PhysicsBodyState, PhysicsState } from "../src/physics/PhysicsState.js";
import { jumpParkRecipe } from "../src/scenarios/JumpParkRecipe.js";
import { ScenarioSession } from "../src/scenarios/ScenarioSession.js";
import { decodeServerMessage } from "../src/shared/binaryCodec.js";
import { required } from "../src/shared/required.js";
import { manualCarMovement } from "../src/traffic/CarControls.js";
import { World } from "../src/world/World.js";

// A correctness reproduction, not a timing benchmark. Both lanes execute the
// same authoritative inputs; only frame delivery to the predictor differs.
const { values } = parseArgs({
  options: {
    json: { type: "string" },
    "direct-state": { type: "boolean", default: false },
  },
});

function rotationError(a: BodyRotation, b: BodyRotation): number {
  const dot = a.reduce((sum, n, i) => sum + n * required(b[i]), 0);
  const length = Math.hypot(...a) * Math.hypot(...b);
  return (2 * Math.acos(Math.min(1, Math.abs(dot) / length)) * 180) / Math.PI;
}

function pose(entity: Entity) {
  return {
    x: entity.position.wx,
    y: entity.position.wy,
    z: entity.wz ?? 0,
    rotation: entity.bodyRotation,
  };
}

async function reproduce(deliveryDelay: number) {
  const session = await ScenarioSession.create(jumpParkRecipe("open-wheel-racer", "sky"));
  let now = 0;
  // Inject simulation time so host CPU speed cannot change replay slicing.
  const predictor = new PlayerPredictor(
    () => session.gravity,
    () => now,
  );
  const replica = new RemoteStateView(new World());
  const authority = new Map<number, PhysicsBodyState>();
  const numerical = new Map<number, PhysicsState>();
  const deliveries: ArrayBuffer[][] = [];
  const samples = [];
  try {
    await predictor.ready;
    const car = required(session.realm.entityManager.byId.get(required(session.handles.car)));
    const scene = required(session.realm.physicsScene);
    const frames = () => {
      if (values["direct-state"])
        numerical.set(scene.physicsTick, required(session.realm.physicsState));
      return session.frames();
    };
    const receive = (packets: ArrayBuffer[]) => {
      for (const packet of packets) {
        const message = decodeServerMessage(packet);
        if (message.type === "frame") replica.applyFrame(message, now);
        else if (message.type.startsWith("sync-"))
          replica.applyMessage(message as Parameters<typeof replica.applyMessage>[0]);
      }
      if (!predictor.player) predictor.reset(replica.serverPlayerEntity);
      const state = required(replica.physicsState);
      predictor.reconcile(
        replica.serverPlayerEntity,
        replica.lastProcessedInputSeq,
        replica.world,
        replica.props,
        replica.serverEntityMap,
        replica.mountEntityId,
        {
          serverTick: replica.serverTick,
          physics: values["direct-state"] ? required(numerical.get(state.tick)) : state,
        },
      );
    };

    await session.command({ kind: "enter-vehicle", entityId: car.id });
    // Landing is sensitive to the initial suspension settling. Keep this exact
    // three-tick setup rather than depending on asynchronous startup timing.
    const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
    for (let tick = 0; tick < 3; tick++) await session.step(idle);
    receive(frames());
    predictor.sampleWork(true);
    const input = manualCarMovement({ dx: 0, dy: -1, jump: false, sprinting: true });
    for (let seq = 4; seq <= 270; seq++) {
      now += PHYSICS_DT;
      predictInput(
        predictor,
        seq,
        input,
        PHYSICS_DT,
        replica.world,
        replica.props,
        replica.serverEntities,
      );
      await session.step(input);
      const state = structuredClone(required(scene.bodyState(car.id)));
      authority.set(scene.physicsTick, state);
      const published = predictor.publishedBody(car.id);
      const matched = authority.get(required(published.tick));
      if (!matched || !published.body) throw Error("Missing matching-tick prediction");
      const predicted = pose(published.body);
      const positionError = Math.hypot(
        predicted.x - matched.x,
        predicted.y - matched.y,
        predicted.z - matched.z,
      );
      deliveries.push(frames());
      if (deliveries.length > deliveryDelay) receive(required(deliveries.shift()));
      samples.push({
        tick: scene.physicsTick,
        comparedTick: published.tick,
        authority: matched,
        predicted,
        positionError,
        rotationErrorDegrees: rotationError(
          required(predicted.rotation),
          required(matched.rotation),
        ),
        reconciliation: predictor.lastReconcileDiagnostics,
      });
    }
    const worst = required([...samples].sort((a, b) => b.positionError - a.positionError)[0]);
    return {
      deliveryDelay,
      directState: values["direct-state"],
      peakHeight: Math.max(...samples.map((s) => s.authority.z)),
      worst,
      work: predictor.sampleWork(),
      samples,
    };
  } finally {
    predictor.clearPredicted();
    await session.close();
  }
}

const results = [];
for (const delay of [0, 2]) {
  const result = await reproduce(delay);
  results.push(result);
  console.log(
    JSON.stringify({
      deliveryDelayTicks: delay,
      tick: result.worst.tick,
      comparedTick: result.worst.comparedTick,
      positionErrorPx: result.worst.positionError,
      rotationErrorDegrees: result.worst.rotationErrorDegrees,
      grounded: result.worst.authority.grounded,
      peakHeight: result.peakHeight,
      forwardSteps: result.work.forwardSteps,
      replaySteps: result.work.replaySteps,
    }),
  );
}
if (values.json) await writeFile(values.json, `${JSON.stringify(results, null, 2)}\n`);
