import { expect, it } from "vitest";
import {
  contactRecipe,
  contactTarget,
  IDLE,
  openContactCase,
} from "../../scripts/instrumentation/moving-contact-cases.js";
import { applyContactFrames } from "../../scripts/instrumentation/moving-contact-run.js";
import { required } from "../art/ArtCatalog.js";
import { GameLoop } from "../core/GameLoop.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import { World } from "../world/World.js";
import { RemoteStateView } from "./ClientStateView.js";
import { PlayerPredictor } from "./PlayerPredictor.js";

for (const hz of [30, 60]) {
  for (const name of ["train-roof", "car-roof"] as const) {
    it(`keeps the same roof-relative position for an idle native ${name} jump at ${hz}Hz`, async () => {
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

for (const hz of [30, 60])
  for (const delayTicks of [0, 2]) {
    it(`keeps idle jump presentation aligned at ${hz}Hz authority / 120Hz display (${delayTicks} delayed snapshots)`, async () => {
      const session = await openContactCase("train-roof", {
        ...contactRecipe("train-roof"),
        physics: { revision: 0 },
      });
      try {
        session.realm.tickRate = hz;
        const view = new RemoteStateView(new World(new FlatStrategy()));
        let now = 0;
        const queued: ArrayBuffer[][] = [];
        const apply = (deferred = false) => {
          let frames = session.frames();
          if (deferred) {
            queued.push(frames);
            frames = queued.length > delayTicks ? required(queued.shift()) : [];
          }
          for (const buffer of frames) {
            const msg = decodeServerMessage(buffer);
            if (msg.type === "frame") view.applyFrame(msg, now);
            else applyContactFrames(view, [buffer]);
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
            apply(true);
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
        const before = required(samples.filter((s) => s.time < 0.95).at(-1));
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
        expect(
          Math.max(
            ...samples.filter((s) => s.time >= 1).map((s) => Math.abs(s.offset - before.offset)),
          ),
        ).toBeLessThan(0.1);
      } finally {
        await session.close();
      }
    });
  }

for (const hz of [30, 60])
  for (const name of ["train-roof", "car-roof"] as const) {
    it(`admits passive flight once with alternating 2/0 commands (${name}, ${hz}Hz)`, async () => {
      const session = await openContactCase(name, {
        ...contactRecipe(name),
        physics: { revision: 0 },
      });
      try {
        session.realm.tickRate = hz;
        const roof = required(contactTarget(session, name)),
          p = session.player.player;
        const offset = p.position.wx - roof.position.wx;
        const transport = new LocalTransport();
        let seq = session.player.lastProcessedInputSeq,
          airborne = false;
        const errors: number[] = [];
        for (let tick = 0; tick < hz * 2; tick++) {
          await session.ready();
          if (tick % 2 === 0)
            for (let cmd = 0; cmd < 2; cmd++)
              session.player.inputQueue.push({ ...IDLE, jump: true, seq: ++seq, dtMs: 1000 / hz });
          session.realm.tick(1 / hz, transport.serverSide, false, new Set());
          errors.push(Math.abs(p.position.wx - roof.position.wx - offset));
          airborne ||= p.jumpVZ !== undefined;
          if (airborne && p.jumpVZ === undefined) break;
        }
        expect(airborne).toBe(true);
        expect(p.jumpVZ).toBeUndefined();
        expect(Math.max(...errors)).toBeLessThan(0.02);
      } finally {
        await session.close();
      }
    });
  }
