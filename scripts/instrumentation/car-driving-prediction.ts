// Controlled driving characterization: native Realm, binary replicas, prediction,
// GameLoop and camera. Explicit clocks exclude browser/GPU/frame-pacing evidence.
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { required } from "../../src/art/ArtCatalog.js";
import { RemoteStateView } from "../../src/client/ClientStateView.js";
import { PlayerPredictor } from "../../src/client/PlayerPredictor.js";
import { GameLoop } from "../../src/core/GameLoop.js";
import { FlatStrategy } from "../../src/generation/FlatStrategy.js";
import { getServerTickRate, setServerTickRate } from "../../src/physics/PlayerMovement.js";
import { Camera } from "../../src/rendering/Camera.js";
import { interpolatePosition } from "../../src/rendering/EntityInterpolation.js";
import { beginPlayerPresentation, followPlayer } from "../../src/rendering/PlayerPresentation.js";
import { ScenarioSession } from "../../src/scenarios/ScenarioSession.js";
import {
  decodeClientMessage,
  encodeClientMessage,
  quantizeInputDtMs,
} from "../../src/shared/binaryCodec.js";
import { LocalTransport } from "../../src/transport/LocalTransport.js";
import { World } from "../../src/world/World.js";
import { contactRecipe, RIGHT } from "./moving-contact-cases.js";
import { applyContactFrames } from "./moving-contact-run.js";

const PROFILES = ["regular", "late-input", "late-snapshot", "delay50"] as const;
type Profile = (typeof PROFILES)[number];
const PHASE_MS = 1000 / 480;
async function run(serverHz: 30 | 60, profile: Profile) {
  const originalRate = getServerTickRate();
  const recipe = contactRecipe("car-roof");
  recipe.player.position = { wx: -512, wy: -28 };
  recipe.physics = { revision: 0 };
  const session = await ScenarioSession.create(recipe);
  try {
    session.realm.tickRate = serverHz;
    setServerTickRate(serverHz);
    const car = required(session.realm.traffic?.states.get(required(session.handles.car))).entity;
    session.realm.vehicles.enter(session.player, car.id);
    const view = new RemoteStateView(new World(new FlatStrategy()));
    applyContactFrames(view, session.frames());
    let step = 0;
    const nowMs = () => (step * 1000) / 120 + PHASE_MS;
    const predictor = new PlayerPredictor(
      () => session.physics,
      () => 1,
      () => nowMs() / 1000,
    );
    predictor.reset(
      view.serverPlayerEntity,
      view.serverEntities.find((e) => e.id === car.id),
    );
    view.setPredictor(predictor);
    const camera = new Camera();
    camera.setViewport(1280, 900);
    camera.x = car.position.wx;
    camera.y = car.position.wy;
    const transport = new LocalTransport();
    let seq = session.player.lastProcessedInputSeq;
    const incoming: { due: number; buffer: ArrayBuffer }[] = [];
    const outgoing: { due: number; frames: ArrayBuffer[] }[] = [];
    const authority: {
      step: number;
      commands: number;
      ack: number;
      x: number;
      vx: number;
      advance: number;
    }[] = [];
    const reconciliations: { step: number; ack: number; shift: number; velocityShift: number }[] =
      [];
    const samples: {
      step: number;
      alpha: number;
      x: number;
      driverX: number;
      cameraX: number;
      screenX: number;
    }[] = [];
    const loop = new GameLoop({
      update(dt) {
        camera.savePrev();
        let applied = 0;
        while (outgoing[0] && outgoing[0].due <= step) {
          applyContactFrames(view, required(outgoing.shift()).frames);
          applied++;
        }
        if (applied) {
          const beforeX = required(predictor.mount).position.wx;
          const beforeVx = required(predictor.mount).velocity?.vx ?? 0;
          predictor.reconcile(
            view.serverPlayerEntity,
            view.lastProcessedInputSeq,
            view.world,
            view.props,
            view.serverEntities,
            view.mountEntityId,
            {
              simulationTime: required(view.simulationTime),
              serverTick: view.serverTick,
              expectedInputDt: dt,
            },
          );
          reconciliations.push({
            step,
            ack: view.lastProcessedInputSeq,
            shift: required(predictor.mount).position.wx - beforeX,
            velocityShift: (required(predictor.mount).velocity?.vx ?? 0) - beforeVx,
          });
        }
        const commandDt = quantizeInputDtMs(dt * 1000) / 1000;
        predictor.storeInput(++seq, RIGHT, commandDt);
        predictor.update(commandDt, RIGHT, view.world, view.props, view.serverEntities);
        // Every half-second, move one input across a server deadline. Delivery
        // remains ordered; the next tick admits the delayed input and its successor.
        const late = profile === "late-input" && seq > serverHz && seq % (serverHz / 2) === 0;
        const due =
          step + 120 / serverHz + (late ? 120 / serverHz : 0) + (profile === "delay50" ? 6 : 0);
        incoming.push({
          due: Math.max(due, incoming.at(-1)?.due ?? 0),
          buffer: encodeClientMessage({
            type: "player-input",
            ...RIGHT,
            seq,
            dtMs: commandDt * 1000,
          }),
        });
        followPlayer(camera, view.serverPlayerEntity, false, 0, predictor);
      },
      render(alpha) {
        view.beginPresentation(nowMs() / 1000, alpha);
        const player = view.presentedPlayerEntity;
        beginPlayerPresentation(
          camera,
          player,
          alpha,
          undefined,
          false,
          0,
          view.cameraPresentation,
        );
        const displayed = required(view.entities.find((e) => e.id === car.id));
        const pose = interpolatePosition(displayed.position, displayed.prevPosition, alpha);
        samples.push({
          step,
          alpha,
          x: pose.wx,
          driverX: player.position.wx,
          cameraX: camera.x,
          screenX: camera.worldToScreen(pose.wx, pose.wy).sx,
        });
        camera.restoreActual();
        view.endPresentation();
      },
    });
    loop.setTickRate(serverHz);
    for (step = 1; step <= 480; step++) {
      if (step % (120 / serverHz) === 0) {
        let commands = 0;
        while (incoming[0] && incoming[0].due <= step) {
          const message = decodeClientMessage(required(incoming.shift()).buffer);
          if (message.type !== "player-input") throw Error("Unexpected input");
          session.player.inputQueue.push(message);
          commands++;
        }
        await session.ready();
        const beforeX = car.position.wx;
        session.realm.tick(1 / serverHz, transport.serverSide, false, new Set());
        authority.push({
          step,
          commands,
          ack: session.player.lastProcessedInputSeq,
          x: car.position.wx,
          vx: car.velocity?.vx ?? 0,
          advance: car.position.wx - beforeX,
        });
        const late = profile === "late-snapshot" && step > 120 && step % 60 === 0;
        const due = step + (late ? 2 : 0) + (profile === "delay50" ? 6 : 0);
        outgoing.push({ due: Math.max(due, outgoing.at(-1)?.due ?? 0), frames: session.frames() });
      }
      loop.externalTick(nowMs());
    }
    if (samples.length !== 480 || Math.abs(car.velocity?.vx ?? 0) < 100)
      throw Error("Fixture failed to retain clear-ground cruise");
    const settled = samples.filter((s) => s.step > 120);
    const changes = settled.slice(1).map((b, i) => {
      const a = required(settled[i]);
      return { world: b.x - a.x, screen: b.screenX - a.screenX };
    });
    const cruiseReconciliations = reconciliations.filter((s) => s.step > 120);
    const missing = authority.filter((s) => s.step > 120 && s.commands === 0);
    return {
      serverHz,
      profile,
      summary: {
        maxReconcileShiftPx: Math.max(0, ...cruiseReconciliations.map((s) => Math.abs(s.shift))),
        maxReconcileVelocityShift: Math.max(
          0,
          ...cruiseReconciliations.map((s) => Math.abs(s.velocityShift)),
        ),
        missingInputTicks: missing.length,
        motionWithoutInputPx: missing.reduce((sum, s) => sum + s.advance, 0),
        minWorldStepPx: Math.min(...changes.map((s) => s.world)),
        maxWorldStepPx: Math.max(...changes.map((s) => s.world)),
        maxScreenStepPx: Math.max(...changes.map((s) => Math.abs(s.screen))),
        maxDriverCarSeparationPx: Math.max(...settled.map((s) => Math.abs(s.driverX - s.x))),
        endAuthorityX: car.position.wx,
      },
      authority,
      reconciliations,
      samples,
    };
  } finally {
    await session.close();
    setServerTickRate(originalRate);
  }
}
const results = [];
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
for (const hz of [60, 30] as const)
  for (const profile of PROFILES) {
    const a = await run(hz, profile),
      b = await run(hz, profile);
    if (hash(a) !== hash(b)) throw Error(`Non-repeatable ${hz}/${profile}`);
    results.push({ ...a, repeatIdentical: true, traceHash: hash(a) });
  }
console.table(results.map((r) => ({ serverHz: r.serverHz, profile: r.profile, ...r.summary })));
const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
if (output)
  await writeFile(
    output,
    `${JSON.stringify(
      {
        scope:
          "Four seconds of native clear-ground driving; 30/60Hz authority, 120Hz controlled presentation. No browser, GPU, timers or physical display measurement.",
        results,
      },
      null,
      2,
    )}\n`,
  );
if (process.argv.includes("--assert-continuous"))
  for (const result of results)
    if (
      result.summary.maxReconcileShiftPx > 0.001 ||
      result.summary.maxWorldStepPx - result.summary.minWorldStepPx > 0.001
    )
      throw Error(`Driving discontinuity: ${result.serverHz}/${result.profile}`);
