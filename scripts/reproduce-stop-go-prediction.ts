import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { RemoteStateView } from "../src/client/ClientStateView.js";
import { PlayerPredictor } from "../src/client/PlayerPredictor.js";
import { predictInput } from "../src/client/predictInput.js";
import type { Entity } from "../src/entities/Entity.js";
import { PHYSICS_DT } from "../src/physics/PhysicsDefaults.js";
import { DRIVING_IDLE, drivingBenchRecipe } from "../src/scenarios/DrivingBenchRecipe.js";
import { ScenarioSession } from "../src/scenarios/ScenarioSession.js";
import { decodeServerMessage } from "../src/shared/binaryCodec.js";
import { required } from "../src/shared/required.js";
import { manualCarMovement } from "../src/traffic/CarControls.js";
import { World } from "../src/world/World.js";

const { values } = parseArgs({ options: { json: { type: "string" } } });
const warmupTicks = 60;
const phases = [
  { throttle: true, ticks: 90 },
  { throttle: false, ticks: 22 },
  { throttle: true, ticks: 90 },
  { throttle: false, ticks: 65 },
];

function pose(entity: Entity) {
  return { x: entity.position.wx, y: entity.position.wy, z: entity.wz ?? 0 };
}

async function drive(holdPredictedPresentation: boolean) {
  const recipe = drivingBenchRecipe("clear");
  required(recipe.parkedVehicles?.[0]).model = "open-wheel-racer";
  const session = await ScenarioSession.create(recipe);
  let now = 0;
  const predictor = new PlayerPredictor(
    () => session.gravity,
    () => now,
  );
  // Diagnostic control: change only the presentation gate. Prediction,
  // input admission and authority still run normally with identical inputs.
  if (holdPredictedPresentation) Object.defineProperty(predictor, "active", { get: () => true });
  const replica = new RemoteStateView(new World());
  replica.setPredictor(predictor);
  const scene = required(session.realm.physicsScene);
  const authorityHistory = new Map<number, ReturnType<typeof pose>>();
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
    for (let tick = 0; tick < warmupTicks; tick++) await session.step(DRIVING_IDLE);
    let packets = session.frames(),
      seq = warmupTicks;
    const initial = required(scene.bodyState(id));
    authorityHistory.set(scene.physicsTick, { x: initial.x, y: initial.y, z: initial.z });

    for (const { throttle, ticks } of phases) {
      const movement = manualCarMovement({
        ...DRIVING_IDLE,
        dy: throttle ? -1 : 0,
        sprinting: true,
      });
      for (let elapsed = 1; elapsed <= ticks; elapsed++) {
        now += PHYSICS_DT;
        receive(packets);
        predictInput(
          predictor,
          ++seq,
          movement,
          PHYSICS_DT,
          replica.world,
          replica.props,
          replica.serverEntities,
        );
        await session.step(movement);
        packets = session.frames();

        const body = required(scene.bodyState(id));
        const authority = { x: body.x, y: body.y, z: body.z };
        authorityHistory.set(scene.physicsTick, authority);
        const published = predictor.publishedBody(id);
        const predicted = pose(required(published.body));
        const matched = required(authorityHistory.get(required(published.tick)));
        replica.beginPresentation(now, 0.5);
        const displayed = pose(required(replica.entities.find((entity) => entity.id === id)));
        samples.push({
          tick: scene.physicsTick - warmupTicks,
          throttle,
          elapsed,
          source: predictor.presentationClock(now) ? "predicted" : "buffered",
          publishedTick: published.tick,
          authority,
          predicted,
          displayed,
          speed: Math.hypot(body.vx, body.vy),
          sameTickError: Math.hypot(
            predicted.x - matched.x,
            predicted.y - matched.y,
            predicted.z - matched.z,
          ),
        });
        replica.endPresentation();
      }
    }

    return samples;
  } finally {
    replica.setPredictor(null);
    await session.close();
  }
}

const production = await drive(false);
const control = await drive(true);
const transitions = production.flatMap((sample, i) => {
  const last = production[i - 1];
  if (!last || last.source === sample.source) return [];
  const controlSample = required(control[i]);
  const controlLast = required(control[i - 1]);
  return [
    {
      tick: sample.tick,
      throttle: sample.throttle,
      sinceInputChangeMs: sample.elapsed * PHYSICS_DT * 1000,
      source: sample.source,
      speedPxPerSecond: sample.speed,
      productionDisplayDeltaPx: sample.displayed.x - last.displayed.x,
      controlDisplayDeltaPx: controlSample.displayed.x - controlLast.displayed.x,
      authorityDeltaPx: sample.authority.x - last.authority.x,
    },
  ];
});
const summary = {
  transitions,
  maxSameTickErrorPx: Math.max(
    ...[...production, ...control].map((sample) => sample.sameTickError),
  ),
  maxAuthorityDifferencePx: Math.max(
    ...production.map(({ authority }, i) => {
      const other = required(control[i]).authority;
      return Math.hypot(authority.x - other.x, authority.y - other.y, authority.z - other.z);
    }),
  ),
  maxDisplayDifferencePx: Math.max(
    ...production.map(({ displayed }, i) => {
      const other = required(control[i]).displayed;
      return Math.hypot(displayed.x - other.x, displayed.y - other.y, displayed.z - other.z);
    }),
  ),
};
console.log(JSON.stringify(summary, null, 2));
if (values.json)
  await writeFile(values.json, `${JSON.stringify({ summary, production, control }, null, 2)}\n`);
