// Reproduction only: production camera, clocks, Realm, codec and prediction.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { required } from "../../src/art/ArtCatalog.js";
import { RemoteStateView } from "../../src/client/ClientStateView.js";
import { PlayerPredictor } from "../../src/client/PlayerPredictor.js";
import { GameLoop } from "../../src/core/GameLoop.js";
import { FlatStrategy } from "../../src/generation/FlatStrategy.js";
import { Camera } from "../../src/rendering/Camera.js";
import { interpolatePosition } from "../../src/rendering/EntityInterpolation.js";
import {
  beginPlayerPresentation,
  bindPredictedPlayerPose,
  followPlayer,
} from "../../src/rendering/PlayerPresentation.js";
import {
  decodeClientMessage,
  encodeClientMessage,
  quantizeInputDtMs,
} from "../../src/shared/binaryCodec.js";
import { LocalTransport } from "../../src/transport/LocalTransport.js";
import { World } from "../../src/world/World.js";
import {
  type ContactCase,
  contactRecipe,
  contactTarget,
  IDLE,
  openContactCase,
} from "./moving-contact-cases.js";
import { applyContactFrames } from "./moving-contact-run.js";

async function cameraCase(serverHz: number, timerMs: number, renderHz: number) {
  const session = await openContactCase("train-roof", {
    ...contactRecipe("train-roof"),
    physics: { revision: 0 },
  });
  try {
    session.realm.tickRate = serverHz;
    const view = new RemoteStateView(new World(new FlatStrategy()));
    applyContactFrames(view, session.frames());
    let nowMs = 0;
    const predictor = new PlayerPredictor(
      () => session.physics,
      () => 1,
      () => nowMs / 1000,
    );
    predictor.reset(view.serverPlayerEntity);
    const camera = new Camera();
    followPlayer(camera, view.serverPlayerEntity, false, 0, predictor);
    const transport = new LocalTransport();
    let seq = session.player.lastProcessedInputSeq;
    const incoming: ArrayBuffer[] = [];
    const outgoing: ArrayBuffer[][] = [];
    const samples: {
      timeMs: number;
      alpha: number;
      serverTick: number;
      playerX: number;
      trainX: number;
      cameraX: number;
      screenX: number;
      roofOffset: number;
    }[] = [];
    const loop = new GameLoop({
      update(dt) {
        camera.savePrev();
        if (outgoing.length) {
          while (outgoing.length) applyContactFrames(view, required(outgoing.shift()));
          predictor.reconcile(
            view.serverPlayerEntity,
            view.lastProcessedInputSeq,
            view.world,
            view.props,
            view.entities,
            view.mountEntityId,
            {
              ...(view.simulationTime !== undefined ? { simulationTime: view.simulationTime } : {}),
              serverTick: view.serverTick,
              expectedInputDt: dt,
            },
          );
        }
        const commandDt = quantizeInputDtMs(dt * 1000) / 1000;
        predictor.storeInput(++seq, IDLE, commandDt);
        predictor.update(commandDt, IDLE, view.world, view.props, view.entities);
        incoming.push(
          encodeClientMessage({ type: "player-input", ...IDLE, seq, dtMs: commandDt * 1000 }),
        );
        followPlayer(camera, view.serverPlayerEntity, false, 0, predictor);
      },
      render(alpha) {
        beginPlayerPresentation(camera, view.serverPlayerEntity, alpha, predictor);
        const shown = bindPredictedPlayerPose(view.serverPlayerEntity, predictor);
        const player = interpolatePosition(shown.position, shown.prevPosition, alpha);
        const replica = required(
          view.serverEntities.find((e) => e.id === contactTarget(session, "train-roof")?.id),
        );
        const train = interpolatePosition(replica.position, replica.prevPosition, alpha);
        samples.push({
          timeMs: nowMs,
          alpha,
          serverTick: view.serverTick,
          playerX: player.wx,
          trainX: train.wx,
          cameraX: camera.x,
          screenX: (player.wx - camera.x) * camera.scale,
          roofOffset: player.wx - train.wx,
        });
        camera.restoreActual();
      },
    });
    loop.setTickRate(serverHz);
    let serverTicks = 0,
      renderedFrames = 0;
    // Independent authority/render events: ideal cadence versus the measured
    // integer timer cadence. The physics dt and advertised rate stay unchanged.
    while (true) {
      const nextRender = (++renderedFrames / renderHz) * 1000 + 1000 / 480;
      if (nextRender > 6000) break;
      while ((serverTicks + 1) * timerMs <= nextRender) {
        nowMs = (serverTicks + 1) * timerMs;
        while (incoming.length) {
          const msg = decodeClientMessage(required(incoming.shift()));
          if (msg.type !== "player-input") throw Error("Unexpected command");
          session.player.inputQueue.push(msg);
        }
        await session.ready();
        session.realm.tick(1 / serverHz, transport.serverSide, false, new Set());
        outgoing.push(session.frames());
        serverTicks++;
      }
      nowMs = nextRender;
      loop.externalTick(nowMs);
    }
    const steps = samples.slice(1).flatMap((b, i) => {
      const a = required(samples[i]);
      if (a.timeMs < 1000) return [];
      return [
        {
          timeMs: b.timeMs,
          screenStep: b.screenX - a.screenX,
          playerStep: b.playerX - a.playerX,
          cameraStep: b.cameraX - a.cameraX,
          tickDelta: b.serverTick - a.serverTick,
        },
      ];
    });
    const skips = steps.filter((s) => s.screenStep > 3);
    return {
      serverHz,
      timerMs,
      renderHz,
      serverTicks,
      samples,
      steps,
      summary: {
        roofOffsetRangePx:
          Math.max(...samples.map((s) => s.roofOffset)) -
          Math.min(...samples.map((s) => s.roofOffset)),
        screenSkips: skips.length,
        advertisedHz: view.tickRate,
        maxScreenStepPx: Math.max(...steps.map((s) => s.screenStep)),
        skipSpacingMs: skips.slice(1).map((s, i) => s.timeMs - required(skips[i]).timeMs),
      },
    };
  } finally {
    await session.close();
  }
}

async function jumpCase(name: ContactCase, platformerAir: boolean, dx: number) {
  const session = await openContactCase(name, {
    ...contactRecipe(name),
    physics: { revision: 0, platformerAir },
  });
  try {
    const carrier = required(contactTarget(session, name));
    const player = session.player.player;
    const initialOffset = player.position.wx - carrier.position.wx;
    const initialVx = required(carrier.velocity).vx;
    const samples = [];
    for (let tick = 0; tick < 60; tick++) {
      await session.step({ ...IDLE, dx, jump: true });
      samples.push({
        tick: tick + 1,
        timeMs: (tick + 1) * 16.67,
        vx: required(player.velocity).vx,
        carrierVx: required(carrier.velocity).vx,
        playerX: player.position.wx,
        carrierX: carrier.position.wx,
        relativeTravel: player.position.wx - carrier.position.wx - initialOffset,
        wz: player.wz ?? 0,
        airborne: player.jumpVZ !== undefined,
      });
      if (tick > 0 && player.jumpVZ === undefined) break;
    }
    if (!required(samples[0]).airborne) throw Error("Jump did not start");
    return {
      case: name,
      platformerAir,
      dx,
      initialVx,
      samples,
      summary: {
        firstVx: required(samples[0]).vx,
        secondVx: required(samples[1]).vx,
        finalRelativeTravel: required(samples.at(-1)).relativeTravel,
        durationMs: required(samples.at(-1)).timeMs,
      },
    };
  } finally {
    await session.close();
  }
}

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
async function repeated<T>(run: () => Promise<T>) {
  const a = await run(),
    b = await run();
  if (hash(a) !== hash(b)) throw Error("Nonrepeatable reproduction");
  return { ...a, repeatIdentical: true, traceHash: hash(a) };
}
const camera = [];
for (const hz of [60, 30])
  for (const timerMs of [1000 / hz, Math.floor(1000 / hz)])
    for (const renderHz of [60, 120])
      camera.push(await repeated(() => cameraCase(hz, timerMs, renderHz)));
const jumps = [];
for (const platformerAir of [true, false])
  for (const dx of [0, 1])
    jumps.push(await repeated(() => jumpCase("train-roof", platformerAir, dx)));
jumps.push(await repeated(() => jumpCase("car-roof", true, 0)));
if (process.argv.includes("--assert-baseline")) {
  for (const c of camera) {
    if (
      c.summary.roofOffsetRangePx > 0.001 ||
      Math.abs(c.summary.advertisedHz - c.serverHz) > 0.001
    )
      throw Error("Roof support or advertised clock changed");
    const roundedTimer = c.timerMs === Math.floor(1000 / c.serverHz);
    if (roundedTimer ? !c.summary.screenSkips : c.summary.screenSkips !== 0)
      throw Error("Missed camera timing reproduction/control");
    if (
      roundedTimer &&
      c.serverHz === 60 &&
      c.summary.skipSpacingMs.some((v) => Math.abs(v - 400) > 0.001)
    )
      throw Error("Camera skip beat changed");
  }
  for (const j of jumps) {
    if (!j.platformerAir && Math.abs(j.summary.firstVx - j.summary.secondVx) > 0.001)
      throw Error("Air-control-off momentum control changed");
    if (j.platformerAir && Math.abs(j.summary.secondVx - j.dx * 64) > 0.001)
      throw Error("Missed momentum loss reproduction");
  }
}
const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
const report = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope:
    "Controlled independent timer/render events using production Realm, codec, replica, prediction, GameLoop and camera; native 120Hz Worker captures separately establish actual browser cadence. Jump traces use full native authority, defaults versus diagnostic air-control-off; no runtime overrides or implementation changes.",
  camera,
  jumps,
};
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.table(
  camera.map(({ serverHz, timerMs, renderHz, summary }) => ({
    serverHz,
    timerMs,
    renderHz,
    ...summary,
  })),
);
console.table(
  jumps.map(({ case: name, platformerAir, dx, summary }) => ({
    case: name,
    platformerAir,
    dx,
    ...summary,
  })),
);
