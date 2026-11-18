import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { RemoteStateView } from "../src/client/ClientStateView.js";
import { PlayerPredictor } from "../src/client/PlayerPredictor.js";
import { predictInput } from "../src/client/predictInput.js";
import { type BodyRotation, rotateBodyVector } from "../src/physics/BodyRotation.js";
import { PHYSICS_DT } from "../src/physics/PhysicsDefaults.js";
import { angleDifference } from "../src/physics/VehicleMotor.js";
import { EntityMeshPose } from "../src/rendering/EntityMeshPose.js";
import { DRIVING_IDLE, drivingBenchRecipe } from "../src/scenarios/DrivingBenchRecipe.js";
import { ScenarioSession } from "../src/scenarios/ScenarioSession.js";
import {
  decodeServerMessage,
  encodeClientMessage,
  quantizeAxis,
} from "../src/shared/binaryCodec.js";
import { required } from "../src/shared/required.js";
import { manualCarMovement } from "../src/traffic/CarControls.js";
import { World } from "../src/world/World.js";

const { values } = parseArgs({ options: { json: { type: "string" } } });
const settleTicks = 45,
  turnTick = 95,
  turnTicks = 3;
const cases = [
  { name: "small analog input", axis: 0.15, inputDelay: 0, frameDelay: 0, latePress: false },
  { name: "synchronized key press", axis: 1, inputDelay: 0, frameDelay: 0, latePress: false },
  { name: "one late press tick", axis: 1, inputDelay: 0, frameDelay: 0, latePress: true },
  { name: "50 ms frame delay", axis: 1, inputDelay: 0, frameDelay: 3, latePress: false },
  { name: "50 ms each way", axis: 1, inputDelay: 3, frameDelay: 3, latePress: false },
];

function yawDegrees(rotation: BodyRotation) {
  const nose = rotateBodyVector(rotation, 1, 0, 0);
  return (Math.atan2(nose.y, nose.x) * 180) / Math.PI;
}

function yawDelta(next: number, previous: number) {
  return (angleDifference((next * Math.PI) / 180, (previous * Math.PI) / 180) * 180) / Math.PI;
}

async function run({ axis, inputDelay, frameDelay, latePress }: (typeof cases)[number]) {
  const recipe = drivingBenchRecipe("clear");
  // Keep all four wheels on flat pavement through the tap and its settling tail.
  recipe.roads = [{ left: -256, right: 1536, top: -256, bottom: 256 }];
  const session = await ScenarioSession.create(recipe);
  let now = 0;
  const predictor = new PlayerPredictor(
    () => session.gravity,
    () => now,
  );
  const replica = new RemoteStateView(new World());
  replica.setPredictor(predictor);
  const scene = required(session.realm.physicsScene),
    mesh = new EntityMeshPose();
  const inputs: ArrayBuffer[] = [],
    frames: ArrayBuffer[][] = [];
  const samples = [];

  function receive(packets: ArrayBuffer[]) {
    for (const packet of packets) {
      const message = decodeServerMessage(packet);
      if (message.type === "frame") replica.applyFrame(message, now);
      else if (message.type.startsWith("sync-"))
        replica.applyMessage(message as Parameters<typeof replica.applyMessage>[0]);
    }
    if (!predictor.player) predictor.reset(replica.serverPlayerEntity);
    predictor.reconcile(
      replica.serverPlayerEntity,
      replica.lastProcessedInputSeq,
      replica.world,
      replica.props,
      replica.serverEntityMap,
      replica.mountEntityId,
      { serverTick: replica.serverTick, physics: required(replica.physicsState) },
    );
  }

  try {
    await predictor.ready;
    const id = required(session.handles.car);
    await session.command({ kind: "enter-vehicle", entityId: id });
    for (let i = 0; i < settleTicks; i++) await session.step(DRIVING_IDLE);
    receive(session.frames());

    function displayYaw(alpha: number) {
      const time = now + alpha * PHYSICS_DT;
      replica.beginPresentation(time, alpha);
      const entity = required(replica.entities.find((e) => e.id === id));
      const rotation = required(mesh.evaluate(entity, time)).orientation;
      replica.endPresentation();
      return yawDegrees(rotation);
    }

    for (let tick = 1; tick <= turnTick + turnTicks + 30; tick++) {
      if (frames.length > frameDelay) receive(required(frames.shift()));
      const dx = tick >= turnTick && tick < turnTick + turnTicks ? quantizeAxis(axis) : 0;
      const movement = manualCarMovement({ ...DRIVING_IDLE, dy: -1, dx });
      const seq = settleTicks + tick;
      predictInput(
        predictor,
        seq,
        movement,
        PHYSICS_DT,
        replica.world,
        replica.props,
        replica.serverEntities,
      );

      inputs.push(encodeClientMessage({ type: "player-input", seq, ...movement }));
      // A late press arrives with the next held command. Both are admitted on
      // the next authority tick, so the authority sees a two-tick pulse.
      if (!latePress || tick !== turnTick)
        while (inputs.length > inputDelay) session.input(required(inputs.shift()));
      frames.push(session.tick(true));

      const body = required(scene.bodyState(id));
      const published = predictor.publishedBody(id);
      const from = displayYaw(0),
        displayed = displayYaw(0.5),
        to = displayYaw(1);
      if (tick >= turnTick - 1)
        samples.push({
          elapsedTicks: tick - turnTick,
          dx,
          ack: replica.lastProcessedInputSeq,
          physicsTick: scene.physicsTick,
          predictionTick: required(published.tick),
          speed: Math.hypot(body.vx, body.vy),
          authority: yawDegrees(required(body.rotation)),
          predicted: yawDegrees(required(required(published.body).bodyRotation)),
          from,
          displayed,
          to,
        });
      now += PHYSICS_DT;
    }
    return samples;
  } finally {
    replica.setPredictor(null);
    await session.close();
  }
}

const report = [];
for (const config of cases) {
  const samples = await run(config);
  const first = required(samples[0]),
    last = required(samples.at(-1));
  let previous = first,
    peakAuthorityStep = 0,
    worstDisplayReversal = 0,
    maxIntervalJump = 0;
  for (const sample of samples.slice(1)) {
    peakAuthorityStep = Math.max(peakAuthorityStep, yawDelta(sample.authority, previous.authority));
    worstDisplayReversal = Math.min(
      worstDisplayReversal,
      yawDelta(sample.displayed, previous.displayed),
    );
    // Adjacent interpolation endpoints represent the same display time.
    maxIntervalJump = Math.max(maxIntervalJump, Math.abs(yawDelta(sample.from, previous.to)));
    previous = sample;
  }
  const summary = {
    authorityTurnDeg: yawDelta(last.authority, first.authority),
    peakAuthorityStepDeg: peakAuthorityStep,
    worstDisplayReversalDeg: worstDisplayReversal,
    maxIntervalJumpDeg: maxIntervalJump,
  };
  console.log(JSON.stringify({ case: config.name, ...summary }));
  report.push({ config, summary, samples });
}
if (values.json) await writeFile(values.json, `${JSON.stringify(report, null, 2)}\n`);
