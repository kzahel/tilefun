// Diagnostic fixture only: an analytic constant-speed authority, real client
// codec/replica/prediction/camera. No Realm, timers, DOM, browser or renderer.
import { required } from "../../src/art/ArtCatalog.js";
import { RemoteStateView } from "../../src/client/ClientStateView.js";
import { PlayerPredictor } from "../../src/client/PlayerPredictor.js";
import { GameLoop } from "../../src/core/GameLoop.js";
import { createPlayer } from "../../src/entities/Player.js";
import { FlatStrategy } from "../../src/generation/FlatStrategy.js";
import { getMovementPhysicsParams } from "../../src/physics/PlayerMovement.js";
import { createTrain } from "../../src/railway/Train.js";
import { Camera } from "../../src/rendering/Camera.js";
import { interpolatePosition } from "../../src/rendering/EntityInterpolation.js";
import { beginPlayerPresentation, followPlayer } from "../../src/rendering/PlayerPresentation.js";
import {
  decodeServerMessage,
  encodeServerMessage,
  quantizeInputDtMs,
} from "../../src/shared/binaryCodec.js";
import { serializeEntity } from "../../src/shared/serialization.js";
import { World } from "../../src/world/World.js";

export interface PresentationCase {
  serverHz: 30 | 60;
  renderHz: 60 | 120;
  /** One 10ms late snapshot at t=1500ms; delivery remains ordered. */
  lateSnapshot: boolean;
}
export const PRESENTATION_CASES: PresentationCase[] = [30, 60].flatMap((serverHz) =>
  [60, 120].flatMap((renderHz) =>
    [false, true].map((lateSnapshot) => ({
      serverHz: serverHz as 30 | 60,
      renderHz: renderHz as 60 | 120,
      lateSnapshot,
    })),
  ),
);
const SPEED = 192,
  ROOF_OFFSET = 10,
  DURATION_MS = 3000,
  WARMUP_MS = 1000;

export function runPresentationCase(config: PresentationCase) {
  const world = new World(new FlatStrategy());
  for (let cx = -1; cx <= 3; cx++) world.getChunk(cx, 0);
  const view = new RemoteStateView(world);
  const train = createTrain(0, 64);
  train.id = 2;
  train.velocity = { vx: SPEED, vy: 0 };
  const rider = createPlayer(ROOF_OFFSET, 64);
  rider.id = 1;
  rider.wz = 44;
  view.applyFrame({
    type: "frame",
    serverTick: 0,
    simulationTime: 0,
    lastProcessedInputSeq: 0,
    playerEntityId: 1,
    entityBaselines: [serializeEntity(train), serializeEntity(rider)],
  });
  let nowMs = 0;
  const physics = { ...getMovementPhysicsParams(), revision: 0 };
  const predictor = new PlayerPredictor(
    () => physics,
    () => 1,
    () => nowMs / 1000,
  );
  predictor.reset(view.serverPlayerEntity);
  predictor.reconcile(view.serverPlayerEntity, 0, world, [], view.serverEntities);
  const camera = new Camera();
  camera.setViewport(1280, 900);
  followPlayer(camera, view.serverPlayerEntity, false, 0, predictor);

  let previousArrival = 0;
  const packets = Array.from({ length: (config.serverHz * DURATION_MS) / 1000 }, (_, i) => {
    const tick = i + 1;
    const sourceTimeMs = (tick * 1000) / config.serverHz;
    const late = config.lateSnapshot && tick === config.serverHz * 1.5;
    const arrivalMs = Math.max(sourceTimeMs + (late ? 10 : 0), previousArrival);
    previousArrival = arrivalMs;
    const wx = (SPEED * sourceTimeMs) / 1000;
    return {
      arrivalMs,
      buffer: encodeServerMessage({
        type: "frame",
        serverTick: tick,
        simulationTime: sourceTimeMs / 1000,
        lastProcessedInputSeq: 0,
        playerEntityId: 1,
        entityDeltas: [
          { id: 2, position: { wx, wy: 64 } },
          { id: 1, position: { wx: wx + ROOF_OFFSET, wy: 64 } },
        ],
      }),
    };
  });
  let nextPacket = 0,
    appliedSinceRender = 0;
  const samples: {
    timeMs: number;
    alpha: number;
    serverTick: number;
    sourceTimeMs: number;
    framesApplied: number;
    trainX: number;
    riderX: number;
    cameraX: number;
    screenX: number;
    roofOffset: number;
  }[] = [];
  const loop = new GameLoop({
    update(dt) {
      camera.savePrev();
      let applied = 0;
      while (packets[nextPacket] && required(packets[nextPacket]).arrivalMs <= nowMs) {
        const message = decodeServerMessage(required(packets[nextPacket++]).buffer);
        if (message.type !== "frame") throw Error("Unexpected fixture packet");
        view.applyFrame(message);
        applied++;
      }
      if (applied)
        predictor.reconcile(view.serverPlayerEntity, 0, world, [], view.serverEntities, undefined, {
          simulationTime: required(view.simulationTime),
          serverTick: view.serverTick,
          expectedInputDt: dt,
        });
      predictor.update(
        quantizeInputDtMs(dt * 1000) / 1000,
        { dx: 0, dy: 0, sprinting: false, jump: false },
        world,
        [],
        view.serverEntities,
      );
      followPlayer(camera, view.serverPlayerEntity, false, 0, predictor);
      appliedSinceRender += applied;
    },
    render(alpha) {
      beginPlayerPresentation(camera, view.serverPlayerEntity, alpha, predictor);
      const shown = required(predictor.presentationPlayer);
      const p = interpolatePosition(shown.position, shown.prevPosition, alpha);
      const car = required(view.serverEntities.find((e) => e.id === 2));
      const t = interpolatePosition(car.position, car.prevPosition, alpha);
      samples.push({
        timeMs: nowMs,
        alpha,
        serverTick: view.serverTick,
        sourceTimeMs: required(view.simulationTime) * 1000,
        framesApplied: appliedSinceRender,
        trainX: t.wx,
        riderX: p.wx,
        cameraX: camera.x,
        screenX: camera.worldToScreen(p.wx, p.wy).sx,
        roofOffset: p.wx - t.wx,
      });
      appliedSinceRender = 0;
      camera.restoreActual();
    },
  });
  loop.setTickRate(config.serverHz);
  // Explicit phase keeps fractional timestamps away from rounding boundaries.
  for (let frame = 1; frame <= (DURATION_MS * config.renderHz) / 1000; frame++) {
    nowMs = (frame * 1000) / config.renderHz + 1000 / 480;
    loop.externalTick(nowMs);
  }
  const steps = samples.slice(1).flatMap((b, i) => {
    const a = required(samples[i]);
    if (a.timeMs < WARMUP_MS) return [];
    const expectedStep = (SPEED * (b.timeMs - a.timeMs)) / 1000;
    return [
      {
        timeMs: b.timeMs,
        trainStep: b.trainX - a.trainX,
        worldStepError: b.trainX - a.trainX - expectedStep,
        screenStep: b.screenX - a.screenX,
        cameraStep: b.cameraX - a.cameraX,
        framesApplied: b.framesApplied,
      },
    ];
  });
  return {
    ...config,
    samples,
    steps,
    summary: {
      maxWorldStepErrorPx: Math.max(...steps.map((s) => Math.abs(s.worldStepError))),
      backwardFrames: steps.filter((s) => s.trainStep < -0.01).length,
      maxScreenStepPx: Math.max(...steps.map((s) => Math.abs(s.screenStep))),
      roofOffsetRangePx:
        Math.max(...samples.map((s) => s.roofOffset)) -
        Math.min(...samples.map((s) => s.roofOffset)),
    },
  };
}
