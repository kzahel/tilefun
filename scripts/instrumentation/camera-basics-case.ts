// Numeric diagnostic, not a replacement runtime: explicit timestamps drive
// production GameLoop, replica, prediction, camera and projection. No rider.
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

export type CameraSubject = "train-locked" | "train-smoothed" | "player" | "player-noclip";
export type CameraFault =
  | "none"
  | "snapshot-late-10ms"
  | "delivery-gap-100ms"
  | "render-gap-100ms"
  | "render-gap-600ms";
export interface CameraBasicsCase {
  subject: CameraSubject;
  fault: CameraFault;
  serverHz: 30 | 60;
  renderHz: 60 | 120;
}
export const CAMERA_SUBJECTS: CameraSubject[] = [
  "train-locked",
  "train-smoothed",
  "player",
  "player-noclip",
];
export const CAMERA_CONTROLS: CameraBasicsCase[] = CAMERA_SUBJECTS.flatMap((subject) =>
  ([30, 60] as const).flatMap((serverHz) =>
    ([60, 120] as const).map((renderHz) => ({
      subject,
      serverHz,
      renderHz,
      fault: "none" as const,
    })),
  ),
);
// Delivery faults belong to remote trains. Pure local movement deliberately has
// no reconciliation/transport, isolating its own loop and camera first.
export const CAMERA_FAULT_CASES: CameraBasicsCase[] = CAMERA_SUBJECTS.flatMap((subject) =>
  (
    [
      "render-gap-100ms",
      "render-gap-600ms",
      ...(subject.startsWith("train") ? ["snapshot-late-10ms", "delivery-gap-100ms"] : []),
    ] as CameraFault[]
  ).map((fault) => ({ subject, serverHz: 60, renderHz: 120, fault })),
);
const DURATION_MS = 3000;
const WARMUP_MS = 1000;
const TRAIN_SPEED = 192;
const PLAYER_SPEED = 768;

export function runCameraBasicsTrace(config: CameraBasicsCase, phaseMs = 1000 / 480) {
  const remote = config.subject.startsWith("train");
  const world = new World(new FlatStrategy());
  // Flat, resident terrain: no generation/streaming/collisions can masquerade as
  // a timing failure. Noclip uses the real predictor's collision bypass.
  for (let cx = -1; cx <= 10; cx++) world.getChunk(cx, 0);
  const view = new RemoteStateView(world);
  const subject = remote ? createTrain(0, 64) : createPlayer(0, 64);
  subject.id = 1;
  subject.velocity = { vx: remote ? TRAIN_SPEED : PLAYER_SPEED, vy: 0 };
  view.applyFrame({
    type: "frame",
    serverTick: 0,
    simulationTime: 0,
    lastProcessedInputSeq: 0,
    playerEntityId: 1,
    entityBaselines: [serializeEntity(subject)],
  });
  let nowMs = 0;
  const physics = { ...getMovementPhysicsParams(), revision: 0, walkSpeed: PLAYER_SPEED };
  const predictor = remote
    ? null
    : new PlayerPredictor(
        () => physics,
        () => 1,
        () => nowMs / 1000,
      );
  if (predictor) {
    predictor.noclip = config.subject === "player-noclip";
    predictor.reset(subject);
  }
  const camera = new Camera();
  camera.setViewport(1280, 900);
  followPlayer(camera, subject, false, 0, predictor);
  let priorArrival = 0;
  const packets = Array.from({ length: (config.serverHz * DURATION_MS) / 1000 }, (_, i) => {
    const tick = i + 1,
      sourceMs = (tick * 1000) / config.serverHz;
    let arrivalMs = sourceMs;
    if (config.fault === "snapshot-late-10ms" && tick === config.serverHz * 1.5) arrivalMs += 10;
    if (config.fault === "delivery-gap-100ms" && sourceMs >= 1500 && sourceMs < 1600)
      arrivalMs = 1600;
    // Ordered delivery, matching Worker transport; hold later packets behind an
    // earlier late packet rather than injecting packet reordering.
    arrivalMs = Math.max(arrivalMs, priorArrival);
    priorArrival = arrivalMs;
    return {
      arrivalMs,
      buffer: encodeServerMessage({
        type: "frame",
        serverTick: tick,
        simulationTime: sourceMs / 1000,
        lastProcessedInputSeq: 0,
        playerEntityId: 1,
        entityDeltas: [{ id: 1, position: { wx: (TRAIN_SPEED * sourceMs) / 1000, wy: 64 } }],
      }),
    };
  });
  let nextPacket = 0,
    updates = 0,
    framesApplied = 0,
    commandTimeMs = 0;
  const samples: {
    frame: number;
    timeMs: number;
    alpha: number;
    updates: number;
    serverTick: number;
    framesApplied: number;
    commandTimeMs: number;
    targetX: number;
    cameraX: number;
    screenX: number;
    landmarkScreenX: number;
  }[] = [];
  let frame = 0;
  const loop = new GameLoop({
    update(dt) {
      camera.savePrev();
      if (remote)
        while (packets[nextPacket] && required(packets[nextPacket]).arrivalMs <= nowMs) {
          const message = decodeServerMessage(required(packets[nextPacket++]).buffer);
          if (message.type !== "frame") throw Error("Unexpected fixture packet");
          view.applyFrame(message);
          framesApplied++;
        }
      if (predictor) {
        const inputDt = quantizeInputDtMs(dt * 1000) / 1000;
        commandTimeMs += inputDt * 1000;
        predictor.update(inputDt, { dx: 1, dy: 0, sprinting: false, jump: false }, world, [], []);
      }
      if (config.subject !== "train-locked")
        followPlayer(camera, view.serverPlayerEntity, false, 0, predictor);
      updates++;
    },
    render(alpha) {
      const shown = predictor ? required(predictor.presentationPlayer) : view.serverPlayerEntity;
      const p = interpolatePosition(shown.position, shown.prevPosition, alpha);
      if (config.subject === "train-locked") {
        // Same exact displayed-pose framing as ScenarioPresentationHost's
        // diagnostic fixedCamera callback; no player or follow filter involved.
        camera.applyInterpolation(alpha);
        camera.x = p.wx;
        camera.y = p.wy;
      } else beginPlayerPresentation(camera, view.serverPlayerEntity, alpha, predictor);
      samples.push({
        frame,
        timeMs: nowMs,
        alpha,
        updates,
        serverTick: view.serverTick,
        framesApplied,
        commandTimeMs,
        targetX: p.wx,
        cameraX: camera.x,
        screenX: camera.worldToScreen(p.wx, p.wy).sx,
        // A fixed world landmark reveals camera motion even when the locked
        // subject is perfectly centered. Screen-relative alignment alone lies.
        landmarkScreenX: camera.worldToScreen(0, 64).sx,
      });
      updates = framesApplied = 0;
      camera.restoreActual();
    },
  });
  loop.setTickRate(config.serverHz);
  for (frame = 1; frame <= (DURATION_MS * config.renderHz) / 1000; frame++) {
    nowMs = (frame * 1000) / config.renderHz + phaseMs;
    const gapEnd =
      config.fault === "render-gap-100ms" ? 1600 : config.fault === "render-gap-600ms" ? 2100 : 0;
    if (nowMs >= 1500 && nowMs < gapEnd) continue;
    loop.externalTick(nowMs);
  }
  // Input duration is quantized on the real wire. Its tiny systematic rate
  // difference is separate from presentation discontinuities.
  const effectiveSpeed = remote
    ? TRAIN_SPEED
    : (PLAYER_SPEED * quantizeInputDtMs(1000 / config.serverHz) * config.serverHz) / 1000;
  const steps = samples.slice(1).flatMap((b, i) => {
    const a = required(samples[i]);
    if (a.timeMs < WARMUP_MS) return [];
    const elapsedMs = b.timeMs - a.timeMs,
      expectedStep = (effectiveSpeed * elapsedMs) / 1000;
    return [
      {
        timeMs: b.timeMs,
        elapsedMs,
        expectedStep,
        targetStep: b.targetX - a.targetX,
        worldStepError: b.targetX - a.targetX - expectedStep,
        cameraStep: b.cameraX - a.cameraX,
        cameraStepError: b.cameraX - a.cameraX - expectedStep,
        screenStep: b.screenX - a.screenX,
        landmarkScreenStep: b.landmarkScreenX - a.landmarkScreenX,
      },
    ];
  });
  return { config, effectiveSpeed, samples, steps };
}

export function compareCameraBasics(config: CameraBasicsCase) {
  const trace = runCameraBasicsTrace(config);
  // Evaluate against uninterrupted execution at the SAME timestamps. This
  // separates skipped frames from new errors and avoids copying camera math.
  const control = runCameraBasicsTrace({ ...config, fault: "none" });
  const reference = new Map(control.samples.map((s) => [s.frame, s]));
  const comparisons = trace.samples
    .filter((s) => s.timeMs >= WARMUP_MS)
    .map((s) => {
      const r = required(reference.get(s.frame));
      return {
        timeMs: s.timeMs,
        worldDeviation: s.targetX - r.targetX,
        cameraDeviation: s.cameraX - r.cameraX,
        screenDeviation: s.screenX - r.screenX,
      };
    });
  const maxAbs = (xs: number[]) => Math.max(...xs.map(Math.abs));
  return {
    ...trace,
    comparisons,
    summary: {
      maxWorldStepErrorPx: maxAbs(trace.steps.map((s) => s.worldStepError)),
      maxCameraStepErrorPx: maxAbs(trace.steps.map((s) => s.cameraStepError)),
      maxWorldDeviationPx: maxAbs(comparisons.map((s) => s.worldDeviation)),
      maxCameraDeviationPx: maxAbs(comparisons.map((s) => s.cameraDeviation)),
      maxScreenDeviationPx: maxAbs(comparisons.map((s) => s.screenDeviation)),
      backwardTargetFrames: trace.steps.filter((s) => s.targetStep < -0.01).length,
      backwardCameraFrames: trace.steps.filter((s) => s.cameraStep < -0.01).length,
      maxElapsedMs: Math.max(...trace.steps.map((s) => s.elapsedMs)),
    },
  };
}
