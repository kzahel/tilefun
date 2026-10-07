import { expect, it } from "vitest";
import {
  contactRecipe,
  contactTarget,
  IDLE,
  openContactCase,
} from "../../scripts/instrumentation/moving-contact-cases.js";
import { required } from "../art/ArtCatalog.js";
import { GameLoop } from "../core/GameLoop.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";
import { PlayerPredictor } from "./PlayerPredictor.js";

for (const hz of [30, 60]) {
  for (const name of ["train-roof", "car-roof"] as const) {
    it.fails(`keeps the same roof-relative position for an idle native ${name} jump at ${hz}Hz`, async () => {
      const session = await openContactCase(name, {
        ...contactRecipe(name),
        physics: { revision: 0 },
      });
      try {
        session.realm.tickRate = hz;
        const dt = Math.round(100000 / hz) / 100000;
        const roof = required(contactTarget(session, name));
        const player = session.player.player;
        const offset = player.position.wx - roof.position.wx;
        const trace = [];
        let airborne = false;
        for (let tick = 0; tick < hz * 2; tick++) {
          await session.step({ ...IDLE, jump: tick < hz }, dt);
          trace.push({
            tick,
            airborne: player.jumpVZ !== undefined,
            relative: player.position.wx - roof.position.wx - offset,
            vx: player.velocity?.vx,
            roofVx: roof.velocity?.vx,
          });
          airborne ||= player.jumpVZ !== undefined;
          if (airborne && player.jumpVZ === undefined) break;
        }
        expect(airborne).toBe(true);
        expect(player.jumpVZ).toBeUndefined();
        expect(
          Math.max(...trace.map((s) => Math.abs(s.relative))),
          JSON.stringify(trace),
        ).toBeLessThan(0.02);
      } finally {
        await session.close();
      }
    });
  }
}

for (const hz of [30, 60]) {
  it.fails(`keeps idle jump presentation aligned at ${hz}Hz authority / 120Hz display`, async () => {
    const session = await openContactCase("train-roof", {
      ...contactRecipe("train-roof"),
      physics: { revision: 0 },
    });
    try {
      session.realm.tickRate = hz;
      const view = new RemoteStateView(new World(new FlatStrategy()));
      let now = 0;
      const apply = () => {
        for (const buffer of session.frames()) {
          const msg = decodeServerMessage(buffer);
          if (msg.type === "frame") view.applyFrame(msg, now);
          else if (msg.type.startsWith("sync-"))
            view.applyMessage(msg as Parameters<typeof view.applyMessage>[0]);
        }
      };
      apply();
      const predictor = new PlayerPredictor(
        () => session.physics,
        () => 1,
        () => now,
      );
      predictor.reset(view.serverPlayerEntity);
      view.setPredictor(predictor);
      let seq = view.lastProcessedInputSeq;
      let nextInput = IDLE;
      let step = 0;
      const samples: { time: number; offset: number; airborne: boolean; serverOffset: number }[] =
        [];
      const loop = new GameLoop({
        update(dt) {
          apply();
          predictor.reconcile(
            view.serverPlayerEntity,
            view.lastProcessedInputSeq,
            view.world,
            view.props,
            view.serverEntities,
            undefined,
            {
              simulationTime: required(view.simulationTime),
              serverTick: view.serverTick,
            },
          );
          const input = { ...IDLE, jump: step >= hz && step < hz * 2 };
          predictor.storeInput(++seq, input, dt);
          predictor.update(dt, input, view.world, view.props, view.serverEntities);
          nextInput = input;
          step++;
        },
        render(alpha) {
          view.beginPresentation(now, alpha);
          try {
            const roof = required(
              view.entities.find((e) => e.id === contactTarget(session, "train-roof")?.id),
            );
            const p = view.presentedPlayerEntity;
            const rawRoof = required(contactTarget(session, "train-roof"));
            samples.push({
              time: now,
              offset: p.position.wx - roof.position.wx,
              airborne: p.jumpVZ !== undefined,
              serverOffset: session.player.player.position.wx - rawRoof.position.wx,
            });
          } finally {
            view.endPresentation();
          }
        },
      });
      loop.setTickRate(hz);
      for (let frame = 0; frame <= 360; frame++) {
        now = frame / 120;
        if (frame > 0 && frame % (120 / hz) === 0) await session.step(nextInput, 1 / hz);
        loop.externalTick(now * 1000);
      }
      const before = required(samples.findLast((s) => s.time < 0.95));
      const flight = samples.filter((s) => s.airborne);
      expect(flight.length).toBeGreaterThan(30);
      expect(
        Math.max(...flight.map((s) => Math.abs(s.offset - before.offset))),
        JSON.stringify({
          before,
          first: flight[0],
          last: flight.at(-1),
          max: Math.max(...flight.map((s) => s.offset)),
          min: Math.min(...flight.map((s) => s.offset)),
        }),
      ).toBeLessThan(0.1);
    } finally {
      await session.close();
    }
  });
}
