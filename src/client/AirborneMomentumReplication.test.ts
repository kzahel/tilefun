import { expect, it } from "vitest";
import {
  contactRecipe,
  contactTarget,
  IDLE,
  openContactCase,
} from "../../scripts/instrumentation/moving-contact-cases.js";
import { applyContactFrames } from "../../scripts/instrumentation/moving-contact-run.js";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { decodeServerMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import { applyEntityDelta, diffEntitySnapshots } from "../shared/entityDelta.js";
import type { FrameMessage } from "../shared/protocol.js";
import { deserializeEntity, serializeEntity } from "../shared/serialization.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";
import { PlayerPredictor } from "./PlayerPredictor.js";

it("roundtrips airborne momentum through baseline, changed delta and removal", () => {
  const player = createPlayer(0, 0);
  player.airMomentumX = 192;
  player.airMomentumY = -36;
  const before = serializeEntity(player);
  const wire = (fields: Partial<FrameMessage>) =>
    decodeServerMessage(
      encodeServerMessage({
        type: "frame",
        serverTick: 1,
        playerEntityId: 1,
        lastProcessedInputSeq: 0,
        ...fields,
      }),
    ) as FrameMessage;
  const replica = deserializeEntity(
    required(wire({ entityBaselines: [before] }).entityBaselines?.[0]),
  );
  expect(replica.airMomentumX).toBe(192);
  expect(replica.airMomentumY).toBe(-36);
  player.airMomentumX = 0;
  delete player.airMomentumY;
  const changed = serializeEntity(player);
  const delta = required(diffEntitySnapshots(before, changed));
  applyEntityDelta(replica, required(wire({ entityDeltas: [delta] }).entityDeltas?.[0]));
  expect(replica.airMomentumX).toBe(0);
  expect(replica.airMomentumY).toBeUndefined();
  delete player.airMomentumX;
  applyEntityDelta(replica, required(diffEntitySnapshots(changed, serializeEntity(player))));
  expect(replica.airMomentumX).toBeUndefined();
});

for (const hz of [30, 60])
  for (const caseName of ["train-roof", "car-roof"] as const) {
    it(`replays a full ${caseName} flight and midair reversal at ${hz}Hz from batched binary snapshots`, async () => {
      const session = await openContactCase(caseName, {
        ...contactRecipe(caseName),
        physics: { revision: 0 },
      });
      try {
        session.realm.tickRate = hz;
        const dt = Math.round(100000 / hz) / 100000;
        const view = new RemoteStateView(new World(new FlatStrategy()));
        applyContactFrames(view, session.frames());
        const predictor = new PlayerPredictor(() => session.physics);
        predictor.reset(view.serverPlayerEntity);
        let seq = view.lastProcessedInputSeq;
        const queued: ArrayBuffer[][] = [];
        let sawMomentum = false,
          landed = false;
        for (let tick = 0; tick < hz * 2; tick++) {
          const input = { ...IDLE, jump: true, dx: tick < hz / 6 ? 1 : tick < hz / 3 ? -1 : 0 };
          predictor.storeInput(++seq, input, dt);
          predictor.update(dt, input, view.world, view.props, view.entities);
          await session.step(input, dt);
          queued.push(session.frames());
          if (tick % 3 !== 2) continue;
          applyContactFrames(view, queued.splice(0, queued.length - 1).flat());
          predictor.reconcile(
            view.serverPlayerEntity,
            view.lastProcessedInputSeq,
            view.world,
            view.props,
            view.entities,
            view.mountEntityId,
            {
              serverTick: view.serverTick,
              ...(view.simulationTime === undefined ? {} : { simulationTime: view.simulationTime }),
            },
          );
          const authoritative = session.player.player,
            predicted = required(predictor.player);
          if (authoritative.airMomentumX === undefined)
            expect(predicted.airMomentumX).toBeUndefined();
          else expect(predicted.airMomentumX).toBeCloseTo(authoritative.airMomentumX, 5);
          expect(predicted.velocity?.vx).toBeCloseTo(required(authoritative.velocity).vx, 3);
          if (authoritative.jumpVZ !== undefined) {
            expect(predicted.position.wx).toBeCloseTo(authoritative.position.wx, 2);
          } else {
            // Supported prediction binds to the newest delivered roof, not the
            // authority's newer world pose. Compare walking offsets in that frame.
            const carrier = required(contactTarget(session, caseName));
            const replica = required(view.serverEntities.find((e) => e.id === carrier.id));
            expect(predicted.position.wx - replica.position.wx).toBeCloseTo(
              authoritative.position.wx - carrier.position.wx,
              2,
            );
          }
          if (authoritative.jumpVZ !== undefined) {
            sawMomentum = true;
            const speed = caseName === "train-roof" ? 192 : 36;
            expect(authoritative.airMomentumX).toBeCloseTo(speed, 5);
            expect(authoritative.velocity?.vx).toBeCloseTo(speed + input.dx * 64, 5);
          } else {
            landed = true;
            break;
          }
        }
        expect(sawMomentum).toBe(true);
        expect(landed).toBe(true);
        // Departure state must be removed from the final replicated landing pose.
        applyContactFrames(view, queued.flat());
        expect(view.serverPlayerEntity.airMomentumX).toBeUndefined();
      } finally {
        await session.close();
      }
    });
  }

it("preserves passive motion through native authority ticks with no new commands", async () => {
  const session = await openContactCase("train-roof", {
    ...contactRecipe("train-roof"),
    physics: { revision: 0 },
  });
  try {
    await session.step({ ...IDLE, jump: true });
    const transport = new LocalTransport();
    for (let i = 0; i < 10; i++) {
      await session.ready();
      session.realm.tick(1 / 60, transport.serverSide, false, new Set());
      expect(session.player.player.velocity?.vx).toBeCloseTo(192, 8);
    }
  } finally {
    await session.close();
  }
});
