import { required } from "../../src/art/ArtCatalog.js";
import { RemoteStateView } from "../../src/client/ClientStateView.js";
import { PlayerPredictor } from "../../src/client/PlayerPredictor.js";
import { aabbsOverlap, getEntityAABB } from "../../src/entities/collision.js";
import { FlatStrategy } from "../../src/generation/FlatStrategy.js";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
} from "../../src/shared/binaryCodec.js";
import { roofSupport } from "../../src/traffic/RoofSupport.js";
import { LocalTransport } from "../../src/transport/LocalTransport.js";
import { World } from "../../src/world/World.js";
import {
  COMMAND_DT,
  type ContactCase,
  contactTarget,
  IDLE,
  openContactCase,
  RIGHT,
  SERVER_DT,
} from "./moving-contact-cases.js";

export const CONTACT_PROFILES = [
  { name: "lockstep", inputs: [1], tx: 0, rx: 0, frameBatch: 1 },
  { name: "uneven", inputs: [2, 0, 1, 1, 1], tx: 0, rx: 0, frameBatch: 1 },
  { name: "delay50", inputs: [1], tx: 3, rx: 3, frameBatch: 1 },
  { name: "batched-frames", inputs: [1], tx: 0, rx: 0, frameBatch: 4 },
  { name: "uneven-delay50", inputs: [2, 0, 1, 1, 1], tx: 3, rx: 3, frameBatch: 1 },
] as const;
export type ContactProfile = (typeof CONTACT_PROFILES)[number];

export function applyContactFrames(view: RemoteStateView, frames: ArrayBuffer[]) {
  for (const frame of frames) {
    const message = decodeServerMessage(frame);
    switch (message.type) {
      case "frame":
      case "sync-chunks":
      case "sync-props":
      case "sync-session":
      case "sync-invincibility":
      case "sync-cvars":
      case "sync-player-names":
      case "sync-editor-cursors":
      case "sync-room":
        view.applyMessage(message);
        break;
      default:
        throw Error(`Unexpected scenario message ${message.type}`);
    }
  }
}

export async function runContactCase(name: ContactCase, profile: ContactProfile, ticks = 180) {
  const session = await openContactCase(name);
  try {
    const view = new RemoteStateView(new World(new FlatStrategy()));
    applyContactFrames(view, session.frames());
    let clock = 0;
    const predictor = new PlayerPredictor(
      () => session.physics,
      () => 1,
      () => clock,
    );
    predictor.reset(view.serverPlayerEntity);
    const transport = new LocalTransport();
    const input = name.endsWith("roof") ? IDLE : RIGHT;
    let seq = session.player.lastProcessedInputSeq;
    const incoming: { tick: number; buffer: ArrayBuffer }[] = [];
    const outgoing: { tick: number; frames: ArrayBuffer[] }[] = [];
    const samples = [];
    for (let tick = 0; tick < ticks; tick++) {
      clock = tick * SERVER_DT;
      const count = required(profile.inputs[tick % profile.inputs.length]);
      for (let i = 0; i < count; i++) {
        predictor.storeInput(++seq, input, COMMAND_DT);
        predictor.update(COMMAND_DT, input, view.world, view.props, view.entities);
        incoming.push({
          tick: tick + profile.tx,
          buffer: encodeClientMessage({
            type: "player-input",
            ...input,
            seq,
            dtMs: COMMAND_DT * 1000,
          }),
        });
      }
      const queueBefore = session.player.lastProcessedInputSeq;
      const serverBeforeX = session.player.player.position.wx;
      while (incoming[0] && incoming[0].tick <= tick) {
        const message = decodeClientMessage(required(incoming.shift()).buffer);
        if (message.type !== "player-input") throw Error("Unexpected input");
        session.player.inputQueue.push(message);
      }
      await session.ready();
      session.realm.tick(SERVER_DT, transport.serverSide, false, new Set());
      outgoing.push({ tick: tick + profile.rx, frames: session.frames() });
      const before = { ...required(predictor.player).position };
      let framesApplied = 0;
      if ((tick + 1) % profile.frameBatch === 0) {
        while (outgoing[0] && outgoing[0].tick <= tick) {
          applyContactFrames(view, required(outgoing.shift()).frames);
          framesApplied++;
        }
      }
      if (framesApplied)
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
            expectedInputDt: SERVER_DT,
          },
        );
      const predicted = required(predictor.player),
        player = session.player.player;
      const target = contactTarget(session, name);
      const replica = target && view.serverEntities.find((e) => e.id === target.id);
      const collider = player.collider && target?.collider;
      const overlap =
        collider &&
        aabbsOverlap(
          getEntityAABB(player.position, required(player.collider)),
          getEntityAABB(required(target).position, collider),
        );
      samples.push({
        tick,
        sentSeq: seq,
        ackSeq: view.lastProcessedInputSeq,
        commandsProcessed: session.player.lastProcessedInputSeq - queueBefore,
        serverAdvanceX: player.position.wx - serverBeforeX,
        commandsPredicted: count,
        framesApplied,
        replayCount: framesApplied ? (predictor.lastReconcileDiagnostics?.replayCount ?? 0) : null,
        shiftX: framesApplied ? predicted.position.wx - before.wx : 0,
        shiftY: framesApplied ? predicted.position.wy - before.wy : 0,
        serverX: player.position.wx,
        serverY: player.position.wy,
        serverZ: player.wz ?? 0,
        replicaPlayerX: view.serverPlayerEntity.position.wx,
        predictedX: predicted.position.wx,
        predictedY: predicted.position.wy,
        predictedZ: predicted.wz ?? 0,
        targetX: target?.position.wx ?? null,
        targetY: target?.position.wy ?? null,
        targetVx: target?.velocity?.vx ?? null,
        targetVy: target?.velocity?.vy ?? null,
        replicaTargetX: replica?.position.wx ?? null,
        replicaTargetY: replica?.position.wy ?? null,
        targetClientSolid: target?.collider?.clientSolid === true,
        targetSolid: target?.collider ? target.collider.solid !== false : false,
        serverOffsetX: target ? player.position.wx - target.position.wx : null,
        replicaOffsetX: replica ? predicted.position.wx - replica.position.wx : null,
        roofSupported:
          roofSupport(player, session.realm.entityManager.entities)?.id === target?.id &&
          target !== undefined,
        overlap: overlap === true,
        distance: target
          ? Math.hypot(
              player.position.wx - target.position.wx,
              player.position.wy - target.position.wy,
            )
          : null,
      });
    }
    const shifts = samples
      .filter((s) => s.framesApplied)
      .map((s) => Math.hypot(s.shiftX, s.shiftY));
    const roofOffsets = samples
      .filter((s) => s.roofSupported)
      .map((s) => required(s.serverOffsetX));
    const serverInputBlockedTicks = name.endsWith("roof")
      ? null
      : samples.filter(
          (s) =>
            s.commandsProcessed > 0 &&
            s.serverAdvanceX < s.commandsProcessed * 64 * COMMAND_DT - 0.001,
        ).length;
    // Fail if setup silently misses contact or loses the moving roof. These are
    // fixture validity checks, not assertions that the current bug is fixed.
    if (name !== "free-walk" && !name.endsWith("roof") && !serverInputBlockedTicks)
      throw Error(`Fixture never constrained walking: ${name}/${profile.name}`);
    if (name.endsWith("roof") && samples.some((s) => !s.roofSupported))
      throw Error(`Fixture lost roof support: ${name}/${profile.name}`);
    if (
      name.endsWith("roof") &&
      samples.some(
        (s) =>
          Math.abs(
            Math.hypot(s.targetVx ?? 0, s.targetVy ?? 0) - (name === "car-roof" ? 36 : 192),
          ) > 0.01,
      )
    )
      throw Error(`Fixture left cruise speed: ${name}/${profile.name}`);
    return {
      case: name,
      profile: profile.name,
      maxPostReplayShiftPx: Math.max(...shifts),
      shiftsOverQuarterPixel: shifts.filter((s) => s > 0.25).length,
      shiftsOverOnePixel: shifts.filter((s) => s > 1).length,
      maxReplayCount: Math.max(...samples.map((s) => s.replayCount ?? 0)),
      maxTargetSnapshotDistancePx: Math.max(
        0,
        ...samples
          .filter((s) => s.targetX !== null && s.replicaTargetX !== null)
          .map((s) =>
            Math.hypot(
              required(s.targetX) - required(s.replicaTargetX),
              required(s.targetY) - required(s.replicaTargetY),
            ),
          ),
      ),
      serverInputBlockedTicks,
      serverRoofOffsetRangePx: roofOffsets.length
        ? Math.max(...roofOffsets) - Math.min(...roofOffsets)
        : null,
      roofLossTicks: name.endsWith("roof") ? samples.filter((s) => !s.roofSupported).length : null,
      targetClientSolid: samples[0]?.targetClientSolid ?? null,
      minTargetDistancePx: samples.some((s) => s.distance !== null)
        ? Math.min(
            Infinity,
            ...samples.filter((s) => s.distance !== null).map((s) => required(s.distance)),
          )
        : null,
      samples,
    };
  } finally {
    await session.close();
  }
}
