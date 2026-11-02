import { expect, it } from "vitest";
import { RemoteStateView } from "../../client/ClientStateView.js";
import { PlayerPredictor } from "../../client/PlayerPredictor.js";
import { ENTITY_FACTORIES } from "../../entities/EntityFactories.js";
import { createPlayer } from "../../entities/Player.js";
import { FLAT_SCENARIO } from "../../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../../scenarios/ScenarioSession.js";
import { PlayerSession } from "../../server/PlayerSession.js";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
  encodeServerMessage,
} from "../../shared/binaryCodec.js";
import type { BufferedMessage } from "../../shared/protocol.js";
import { World } from "../../world/World.js";

it("reconciles separate host/guest predictors through ordered delayed binary inputs and replicas", async () => {
  const npc = ENTITY_FACTORIES.chicken?.(80, 32);
  if (!npc?.wanderAI) throw Error("Missing NPC");
  npc.wanderAI.timer = 100;
  const session = await ScenarioSession.create({
    version: 1,
    id: "realm-prediction",
    generation: FLAT_SCENARIO,
    props: [],
    player: createPlayer(32, 32),
    actors: [npc],
    physics: { characterPhysics: 3 },
  });
  const guest = new PlayerSession("delayed-guest");
  guest.editorEnabled = false;
  await session.realm.addPlayer(guest);
  guest.visibleRange = { ...session.player.visibleRange };
  Object.assign(guest.player.position, { wx: 32, wy: 80 });
  session.realm.entityManager.spatialHash.update(guest.player);
  const seats = [session.player, guest];
  let now = 0;
  const views = seats.map(() => new RemoteStateView(new World()));
  const predictors = seats.map(
    () =>
      new PlayerPredictor(
        () => session.physics,
        () => 1,
        () => now,
      ),
  );
  const commands: { due: number; seat: number; buffer: ArrayBuffer }[] = [];
  const frames: { due: number; seat: number; buffers: ArrayBuffer[] }[] = [];
  const lastInputDue = [0, 0],
    lastFrameDue = [0, 0];
  let maxCorrection = 0;
  const apply = (seat: number, buffers: ArrayBuffer[]) => {
    const view = views[seat],
      predictor = predictors[seat];
    if (!view || !predictor) throw Error("Missing client");
    for (const buffer of buffers) {
      const message = decodeServerMessage(buffer);
      // Settings are scoped to this fixture, like ScenarioClient.
      if (
        message.type !== "sync-cvars" &&
        (message.type === "frame" || message.type.startsWith("sync-"))
      )
        view.applyMessage(message as BufferedMessage);
    }
    if (!predictor.player) predictor.reset(view.serverPlayerEntity);
    else {
      predictor.reconcile(
        view.serverPlayerEntity,
        view.lastProcessedInputSeq,
        view.world,
        view.props,
        view.serverEntities,
        view.mountEntityId,
      );
      maxCorrection = Math.max(maxCorrection, predictor.lastReconcileDiagnostics?.resimPosErr ?? 0);
    }
  };
  try {
    seats.forEach((seat, i) => {
      apply(i, session.realm.replicate(seat.clientId).map(encodeServerMessage));
    });
    for (let tick = 1; tick <= 180; tick++) {
      now = tick / 60;
      seats.forEach((_seat, i) => {
        const input = {
          dx: tick < 75 ? 1 : tick < 85 ? -1 : tick < 110 ? 1 : 0,
          dy: 0,
          jump: tick === 55,
          sprinting: false,
        };
        const message = { type: "player-input" as const, seq: tick, ...input, dtMs: 16.67 };
        const buffer = encodeClientMessage(message);
        const decoded = decodeClientMessage(buffer);
        if (decoded.type !== "player-input") throw Error("Invalid input");
        const predictor = predictors[i],
          view = views[i];
        if (!predictor || !view) throw Error("Missing client");
        const dt = (decoded.dtMs ?? 16.67) / 1000;
        predictor.storeInput(tick, input, dt);
        predictor.update(dt, input, view.world, view.props, view.serverEntities);
        const due = Math.max(lastInputDue[i] ?? 0, tick + (i ? 2 + (tick % 4) : 0));
        lastInputDue[i] = due;
        commands.push({ due, seat: i, buffer });
      });
      while (commands.some((packet) => packet.due <= tick)) {
        const index = commands.findIndex((packet) => packet.due <= tick),
          packet = commands.splice(index, 1)[0];
        if (!packet) throw Error("Missing command");
        const seat = seats[packet.seat];
        if (!seat) throw Error("Missing seat");
        session.realm.handleMessage(seat.clientId, seat, decodeClientMessage(packet.buffer));
      }
      session.tick(1 / 60);
      seats.forEach((seat, i) => {
        const due = Math.max(lastFrameDue[i] ?? 0, tick + (i ? 2 + ((tick * 3) % 4) : 0));
        lastFrameDue[i] = due;
        frames.push({
          due,
          seat: i,
          buffers: session.realm.replicate(seat.clientId).map(encodeServerMessage),
        });
      });
      while (frames.some((packet) => packet.due <= tick)) {
        const index = frames.findIndex((packet) => packet.due <= tick),
          packet = frames.splice(index, 1)[0];
        if (!packet) throw Error("Missing frame");
        apply(packet.seat, packet.buffers);
      }
    }
    // Flush ordered pending commands and replicas, then compare the same final
    // authoritative horizon. Current displayed poses are not a same-time metric.
    for (const packet of commands) {
      const seat = seats[packet.seat];
      if (seat)
        session.realm.handleMessage(seat.clientId, seat, decodeClientMessage(packet.buffer));
    }
    session.tick(1 / 60);
    for (const packet of frames) apply(packet.seat, packet.buffers);
    seats.forEach((seat, i) => {
      apply(i, session.realm.replicate(seat.clientId).map(encodeServerMessage));
      expect(predictors[i]?.player?.position.wx).toBeCloseTo(seat.player.position.wx, 2);
      expect(predictors[i]?.recoveryDiagnostics.retainedInputs).toBeLessThan(32);
    });
    expect(maxCorrection).toBeLessThan(16);
    expect(
      session.realm.entityManager.entities.find((e) => e.type === "chicken")?.position.wx,
    ).toBeGreaterThan(80);
  } finally {
    predictors.forEach((predictor) => {
      predictor.clearPredicted();
    });
    await session.close();
  }
});
