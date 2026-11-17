import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { RemoteStateView } from "../src/client/ClientStateView.js";
import { PlayerPredictor } from "../src/client/PlayerPredictor.js";
import { predictInput } from "../src/client/predictInput.js";
import { createPlayer } from "../src/entities/Player.js";
import { PHYSICS_DT } from "../src/physics/PhysicsDefaults.js";
import { FLAT_SCENARIO } from "../src/scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../src/scenarios/ScenarioSession.js";
import { decodeServerMessage } from "../src/shared/binaryCodec.js";
import { required } from "../src/shared/required.js";
import { World } from "../src/world/World.js";

const { values } = parseArgs({ options: { json: { type: "string" } } });

interface Sample {
  tick: number;
  displayedX: number;
  bufferedX: number;
  authorityX: number;
  predictedX: number | undefined;
  sameTickErrorPx: number | undefined;
  ready: boolean;
  guestInContact: boolean;
}

async function pass(extraFrameDelay: number) {
  const session = await ScenarioSession.create({
    version: 1,
    id: "nearby-prediction-handoff",
    generation: FLAT_SCENARIO,
    player: createPlayer(100, 100),
    guest: createPlayer(175, 120),
    props: [],
  });
  let now = 0;
  const predictor = new PlayerPredictor(
    () => session.gravity,
    () => now,
  );
  const replica = new RemoteStateView(new World());
  const buffer = new RemoteStateView(new World());
  replica.setPredictor(predictor);
  const guest = required(session.guest).player;
  const scene = required(session.realm.physicsScene);
  const authorityHistory = new Map<number, number>();
  const queued: ArrayBuffer[][] = [];
  const samples: Sample[] = [];

  function receive(packets: ArrayBuffer[]) {
    for (const packet of packets) {
      const message = decodeServerMessage(packet);
      // The buffered control gets the very same frames at the same time.
      for (const view of [replica, buffer]) {
        if (message.type === "frame") view.applyFrame(message, now);
        else if (message.type.startsWith("sync-"))
          view.applyMessage(message as Parameters<typeof view.applyMessage>[0]);
      }
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

  const guestX = (view: RemoteStateView) =>
    required(view.entities.find((entity) => entity.id === guest.id)).position.wx;

  try {
    await predictor.ready;
    const walk = { dx: 1, dy: 0, sprinting: false, jump: false };
    const run = { ...walk, dx: -1, sprinting: true };
    await session.step({ ...walk, dx: 0 });
    receive(session.frames());

    for (let seq = 2; seq <= 60; seq++) {
      now += PHYSICS_DT;
      if (queued.length > extraFrameDelay) receive(required(queued.shift()));
      predictInput(
        predictor,
        seq,
        walk,
        PHYSICS_DT,
        replica.world,
        replica.props,
        replica.serverEntities,
      );
      session.accept({ type: "player-input", seq, ...run }, undefined, 1);
      await session.step(walk);
      authorityHistory.set(scene.physicsTick, guest.position.wx);
      queued.push(session.frames());

      replica.beginPresentation(now, 0.5);
      buffer.beginPresentation(now, 0.5);
      const published = predictor.publishedBody(guest.id);
      const matched = authorityHistory.get(published.tick ?? -1);
      samples.push({
        tick: scene.physicsTick,
        displayedX: guestX(replica),
        bufferedX: guestX(buffer),
        authorityX: guest.position.wx,
        predictedX: published.body?.position.wx,
        sameTickErrorPx:
          matched !== undefined && published.body
            ? Math.abs(published.body.position.wx - matched)
            : undefined,
        ready: predictor.recoveryDiagnostics.status === "ready",
        guestInContact: required(replica.physicsState).contacts.some((pair) =>
          pair.includes(guest.id),
        ),
      });
      buffer.endPresentation();
      replica.endPresentation();
    }
  } finally {
    replica.setPredictor(null);
    await session.close();
  }

  const handoffs = samples.flatMap((sample, i) => {
    const prior = samples[i - 1];
    // After the startup window, both players are already at a steady speed.
    if (!prior || sample.tick <= 10) return [];
    const displayedDeltaPx = sample.displayedX - prior.displayedX;
    const bufferedDeltaPx = sample.bufferedX - prior.bufferedX;
    const authorityDeltaPx = sample.authorityX - prior.authorityX;
    if (Math.abs(displayedDeltaPx - bufferedDeltaPx) < 1) return [];
    return [{ ...sample, displayedDeltaPx, bufferedDeltaPx, authorityDeltaPx }];
  });
  return { extraFrameDelay, handoffs, samples };
}

const runs = [await pass(0), await pass(3)];
console.log(
  JSON.stringify(
    runs.map(({ extraFrameDelay, handoffs }) => ({ extraFrameDelay, handoffs })),
    null,
    2,
  ),
);
if (values.json) await writeFile(values.json, `${JSON.stringify(runs, null, 2)}\n`);
