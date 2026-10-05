// Controlled rate reproduction only. Production simulation/prediction is unchanged.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { required } from "../../src/art/ArtCatalog.js";
import { RemoteStateView } from "../../src/client/ClientStateView.js";
import { PlayerPredictor, type ReconcileDiagnostics } from "../../src/client/PlayerPredictor.js";
import { GameLoop } from "../../src/core/GameLoop.js";
import { FlatStrategy } from "../../src/generation/FlatStrategy.js";
import { getServerTickRate, setServerTickRate } from "../../src/physics/PlayerMovement.js";
import { interpolatePosition } from "../../src/rendering/EntityInterpolation.js";
import { bindPredictedPlayerPose } from "../../src/rendering/PlayerPresentation.js";
import {
  decodeClientMessage,
  encodeClientMessage,
  quantizeInputDtMs,
} from "../../src/shared/binaryCodec.js";
import { roofSupport } from "../../src/traffic/RoofSupport.js";
import { LocalTransport } from "../../src/transport/LocalTransport.js";
import { World } from "../../src/world/World.js";
import {
  type ContactCase,
  contactRecipe,
  contactTarget,
  IDLE,
  openContactCase,
  RIGHT,
} from "./moving-contact-cases.js";
import { applyContactFrames } from "./moving-contact-run.js";

const CASES: ContactCase[] = [
  "free-walk",
  "static-wall",
  "person-away",
  "cow-still",
  "car-roof",
  "train-roof",
];
const PROFILES = [
  { name: "server60-render60", renderHz: 60, rates: [60], delayMs: 0, commandHz: null },
  { name: "server60-render120", renderHz: 120, rates: [60], delayMs: 0, commandHz: null },
  { name: "server30-render60", renderHz: 60, rates: [30], delayMs: 0, commandHz: null },
  { name: "server30-render120", renderHz: 120, rates: [30], delayMs: 0, commandHz: null },
  {
    name: "switch60-30-60-render120",
    renderHz: 120,
    rates: [60, 30, 60],
    delayMs: 0,
    commandHz: null,
  },
  {
    name: "switch60-30-60-delay50-render120",
    renderHz: 120,
    rates: [60, 30, 60],
    delayMs: 50,
    commandHz: null,
  },
  { name: "server30-command60-render120", renderHz: 120, rates: [30], delayMs: 0, commandHz: 60 },
];
type Profile = (typeof PROFILES)[number];
const option = (key: string) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);

// Explicit sub-frame phase avoids accidental exact-boundary rounding jitter.
const FRAME_PHASE_MS = 1000 / 480;

async function run(name: ContactCase, profile: Profile) {
  const originalRate = getServerTickRate();
  // A fresh Worker has its own revision counter; Node's global CVar revision
  // otherwise accumulates across this matrix. Only diagnostic metadata is reset.
  const session = await openContactCase(name, { ...contactRecipe(name), physics: { revision: 0 } });
  try {
    let serverHz = required(profile.rates[0]);
    session.realm.tickRate = serverHz;
    setServerTickRate(serverHz);
    const view = new RemoteStateView(new World(new FlatStrategy()));
    applyContactFrames(view, session.frames());
    const predictor = new PlayerPredictor(
      () => session.physics,
      () => 1,
    );
    predictor.reset(view.serverPlayerEntity);
    const transport = new LocalTransport();
    let seq = session.player.lastProcessedInputSeq;
    let clockStep = 0;
    const clientClockStep = () => clockStep + (FRAME_PHASE_MS * 120) / 1000;
    const clientTimeMs = () => (clientClockStep() / 120) * 1000;
    let clientHz = profile.commandHz ?? view.tickRate;
    const input = name.endsWith("roof") ? IDLE : RIGHT;
    const delaySteps = (profile.delayMs * 120) / 1000;
    const incoming: { due: number; buffer: ArrayBuffer }[] = [];
    const outgoing: { due: number; frames: ArrayBuffer[] }[] = [];
    const reconciliations: (ReconcileDiagnostics & {
        timeMs: number;
        shift: number;
        framesApplied: number;
        ack: number;
      })[] = [],
      commands: { timeMs: number; dtMs: number; seq: number; advertisedHz: number }[] = [],
      authority: object[] = [];
    const rendered: {
      timeMs: number;
      alpha: number;
      clientHz: number;
      serverHz: number;
      playerX: number;
      targetX: number | null;
      offsetX: number | null;
    }[] = [];
    const transitions: object[] = [];
    const shifts: number[] = [],
      offsets: number[] = [];
    let blockedTicks = 0,
      roofLossTicks = 0;
    const loop = new GameLoop({
      update(dt) {
        // Same ordering as GameClient: apply buffered state, sync rate, then predict.
        let framesApplied = 0;
        while (outgoing[0] && outgoing[0].due <= clientClockStep()) {
          applyContactFrames(view, required(outgoing.shift()).frames);
          framesApplied++;
        }
        if (framesApplied) {
          const before = { ...required(predictor.player).position };
          predictor.reconcile(
            view.serverPlayerEntity,
            view.lastProcessedInputSeq,
            view.world,
            view.props,
            view.entities,
            view.mountEntityId,
            { serverTick: view.serverTick, expectedInputDt: dt },
          );
          const shift = Math.hypot(
            required(predictor.player).position.wx - before.wx,
            required(predictor.player).position.wy - before.wy,
          );
          shifts.push(shift);
          const diagnostic = required(predictor.lastReconcileDiagnostics);
          reconciliations.push({
            timeMs: clientTimeMs(),
            shift,
            framesApplied,
            ack: view.lastProcessedInputSeq,
            ...diagnostic,
            // Absolute revision counters include earlier sessions in this Node
            // process. Keep within-fixture revision relationships reproducible.
            currentPhysicsRevision: diagnostic.currentPhysicsRevision - session.physics.revision,
            replayPhysicsRevisions: diagnostic.replayPhysicsRevisions.map(
              (r) => r - session.physics.revision,
            ),
          });
        }
        const wantedHz = profile.commandHz ?? view.tickRate;
        if (wantedHz !== clientHz) {
          transitions.push({
            timeMs: clientTimeMs(),
            fromHz: clientHz,
            toHz: wantedHz,
            inFlightDt: dt,
          });
          clientHz = wantedHz;
          loop.setTickRate(clientHz);
        }
        const commandDt = quantizeInputDtMs(dt * 1000) / 1000;
        predictor.storeInput(++seq, input, commandDt);
        predictor.update(commandDt, input, view.world, view.props, view.entities);
        incoming.push({
          due: clientClockStep() + delaySteps,
          buffer: encodeClientMessage({
            type: "player-input",
            ...input,
            seq,
            dtMs: commandDt * 1000,
          }),
        });
        commands.push({
          timeMs: clientTimeMs(),
          dtMs: commandDt * 1000,
          seq,
          advertisedHz: view.tickRate,
        });
      },
      render(alpha) {
        const player = bindPredictedPlayerPose(view.serverPlayerEntity, predictor);
        const p = interpolatePosition(player.position, player.prevPosition, alpha);
        const target = contactTarget(session, name);
        const replica = target && view.serverEntities.find((e) => e.id === target.id);
        const t = replica && interpolatePosition(replica.position, replica.prevPosition, alpha);
        rendered.push({
          timeMs: clientTimeMs(),
          alpha,
          clientHz,
          serverHz,
          playerX: p.wx,
          targetX: t?.wx ?? null,
          offsetX: t ? p.wx - t.wx : null,
        });
      },
    });
    loop.setTickRate(clientHz);
    // externalTick is the production external-clock entry point. No rAF or draw
    // stubs: its initial lastTime is zero and these timestamps start at zero.
    let nextServer = 120 / serverHz;
    for (clockStep = 1; clockStep <= 360; clockStep++) {
      const phase = Math.min(profile.rates.length - 1, Math.floor((clockStep - 1) / 120));
      const wantedServerHz = required(profile.rates[phase]);
      if (wantedServerHz !== serverHz) {
        serverHz = wantedServerHz;
        session.realm.tickRate = serverHz;
        setServerTickRate(serverHz);
        nextServer = clockStep - 1 + 120 / serverHz;
      }
      if (clockStep === nextServer) {
        while (incoming[0] && incoming[0].due <= clockStep) {
          const msg = decodeClientMessage(required(incoming.shift()).buffer);
          if (msg.type !== "player-input") throw Error("Unexpected input");
          session.player.inputQueue.push(msg);
        }
        const beforeX = session.player.player.position.wx;
        const pending = [...session.player.inputQueue];
        await session.ready();
        // Node shares the CVar module with the replica; restore authority's rate
        // before replication, as the real Worker has its own module instance.
        setServerTickRate(serverHz);
        session.realm.tick(1 / serverHz, transport.serverSide, false, new Set());
        outgoing.push({ due: clockStep + delaySteps, frames: session.frames() });
        const target = contactTarget(session, name),
          player = session.player.player;
        const offsetX = target ? player.position.wx - target.position.wx : null;
        if (
          !name.endsWith("roof") &&
          pending.length &&
          player.position.wx - beforeX <
            pending.reduce((n, i) => n + ((i.dtMs ?? 0) / 1000) * 64, 0) - 0.001
        )
          blockedTicks++;
        if (name.endsWith("roof")) {
          if (roofSupport(player, session.realm.entityManager.entities)?.id !== target?.id)
            roofLossTicks++;
          offsets.push(required(offsetX));
          if (
            Math.abs(
              Math.hypot(target?.velocity?.vx ?? 0, target?.velocity?.vy ?? 0) -
                (name === "car-roof" ? 36 : 192),
            ) > 0.01
          )
            throw Error("Lost cruise speed");
        }
        authority.push({
          timeMs: (clockStep / 120) * 1000,
          dt: 1 / serverHz,
          serverHz,
          observedTick: authority.length + 1,
          inputs: pending.length,
          processedSeq: session.player.lastProcessedInputSeq,
          playerX: player.position.wx,
          targetX: target?.position.wx ?? null,
          offsetX,
        });
        nextServer += 120 / serverHz;
      }
      if (clockStep % (120 / profile.renderHz) === 0)
        loop.externalTick((clockStep / 120) * 1000 + FRAME_PHASE_MS);
    }
    if (rendered.length !== 3 * profile.renderHz) throw Error("Missing render samples");
    const expectedTicks =
      profile.rates.length === 1
        ? 3 * required(profile.rates[0])
        : profile.rates.reduce((a, b) => a + b, 0);
    if (authority.length !== expectedTicks) throw Error("Wrong authority clock count");
    const advertisedRates = [...new Set(commands.map((s) => Math.round(s.advertisedHz)))];
    if (profile.rates.some((hz) => !advertisedRates.includes(hz)))
      throw Error("Missing replicated rate transition");
    if (name !== "free-walk" && !name.endsWith("roof") && !blockedTicks)
      throw Error("Missed contact");
    if (roofLossTicks) throw Error("Lost roof support");
    const renderOffsets = rendered.flatMap((s) => (s.offsetX === null ? [] : [s.offsetX]));
    const settledRenderOffsets = rendered
      .filter((s) => s.timeMs > 250)
      .flatMap((s) => (s.offsetX === null ? [] : [s.offsetX]));
    const range = (values: number[]) =>
      values.length ? Math.max(...values) - Math.min(...values) : null;
    return {
      case: name,
      profile: profile.name,
      summary: {
        renderFrames: rendered.length,
        inputCommands: commands.length,
        serverTicks: authority.length,
        advertisedRates,
        minAlpha: Math.min(...rendered.map((s) => s.alpha)),
        maxAlpha: Math.max(...rendered.map((s) => s.alpha)),
        invalidAlphaFrames: rendered.filter((s) => s.alpha < 0 || s.alpha > 1).length,
        intermediateAlphaFrames: rendered.filter((s) => s.alpha > 0.01 && s.alpha < 0.99).length,
        maxPostReplayShiftPx: Math.max(0, ...shifts),
        maxPostReplayShiftAfterStartupPx: Math.max(
          0,
          ...reconciliations.filter((s) => s.timeMs > 250).map((s) => s.shift),
        ),
        shiftsOverQuarterPixel: shifts.filter((s) => s > 0.25).length,
        serverRoofOffsetRangePx: name.endsWith("roof") ? range(offsets) : null,
        renderedRoofOffsetRangePx: name.endsWith("roof") ? range(renderOffsets) : null,
        renderedRoofOffsetRangeAfterStartupPx: name.endsWith("roof")
          ? range(settledRenderOffsets)
          : null,
        maxRenderedRoofOffsetStepAfterStartupPx: name.endsWith("roof")
          ? Math.max(
              0,
              ...settledRenderOffsets
                .slice(1)
                .map((v, i) => Math.abs(v - required(settledRenderOffsets[i]))),
            )
          : null,
        maxRenderedRoofOffsetStepPx: name.endsWith("roof")
          ? Math.max(
              0,
              ...renderOffsets.slice(1).map((v, i) => Math.abs(v - required(renderOffsets[i]))),
            )
          : null,
        blockedTicks,
        roofLossTicks,
        clientRateTransitions: transitions,
      },
      rendered,
      reconciliations,
      commands,
      authority,
    };
  } finally {
    setServerTickRate(originalRate);
    await session.close();
  }
}
const cases = CASES.filter((c) => !option("case") || option("case") === c);
const profiles = PROFILES.filter((p) => !option("profile") || option("profile") === p.name);
if (!cases.length || !profiles.length) throw Error("Unknown --case or --profile");
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const results = [];
for (const name of cases)
  for (const profile of profiles) {
    const a = await run(name, profile),
      b = await run(name, profile);
    // CVar revision is diagnostic process history, not a simulation outcome.
    if (hash(a) !== hash(b)) {
      if (option("output"))
        await writeFile(required(option("output")), JSON.stringify({ a, b }, null, 2));
      throw Error(`Non-repeatable rate fixture ${name}/${profile.name}`);
    }
    results.push({ ...a, repeatIdentical: true, traceHash: hash(a) });
  }
const report = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope:
    "Controlled 60/120Hz timestamps through production GameLoop.externalTick, native Realm/codec/replica/predictor and shared interpolation; no draw/GPU/rAF/display cadence measurement",
  durationSeconds: 3,
  framePhaseMs: FRAME_PHASE_MS,
  profiles: PROFILES,
  results,
};
if (option("output"))
  await writeFile(required(option("output")), `${JSON.stringify(report, null, 2)}\n`);
console.table(
  results.map((r) => ({
    case: r.case,
    profile: r.profile,
    ...r.summary,
    clientRateTransitions: r.summary.clientRateTransitions.length,
  })),
);
