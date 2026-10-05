// Characterize autonomous-carrier clock differences without changing gameplay.
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { required } from "../../src/art/ArtCatalog.js";
import { RemoteStateView } from "../../src/client/ClientStateView.js";
import { PlayerPredictor } from "../../src/client/PlayerPredictor.js";
import { FlatStrategy } from "../../src/generation/FlatStrategy.js";
import { curvedTrainRecipe } from "../../src/scenarios/CurvedTrainRecipe.js";
import { ScenarioSession } from "../../src/scenarios/ScenarioSession.js";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
} from "../../src/shared/binaryCodec.js";
import { roofSupport } from "../../src/traffic/RoofSupport.js";
import { LocalTransport } from "../../src/transport/LocalTransport.js";
import { World } from "../../src/world/World.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
const tickDt = 1 / 60;
const results = [];
for (const body of ["three-carriage", "whole-body", "ground", "ground-walking"] as const) {
  for (const pattern of [[1], [2, 0, 1, 1, 1]]) {
    for (const commandDt of [tickDt, 0.01667]) {
      const recipe = curvedTrainRecipe(false);
      const line = required(recipe.railways?.[0]);
      line.start = -128;
      line.end = 128;
      line.y = 0;
      line.path = {
        closed: false,
        segments: [{ kind: "line", x: -2048, y: 0, endX: 2048, endY: 0 }],
        stops: [
          { distance: 320, name: "Start" },
          { distance: 3776, name: "End" },
        ],
      };
      if (body === "whole-body") delete line.path;
      const s = await ScenarioSession.create(recipe);
      try {
        const service = required(s.realm.railway?.services.get(line.id));
        service.record.dwell = 0;
        await s.command({ kind: "train-position", roof: true });
        // Reach cruise speed using production authority; exclude acceleration.
        for (let i = 0; i < 125; i++) await s.step(idle);
        const onGround = body.startsWith("ground");
        const input = body === "ground-walking" ? { ...idle, dx: 1 } : idle;
        if (onGround)
          await s.command({
            kind: "teleport",
            position: { wx: service.entity.position.wx, wy: 100 },
          });
        const view = new RemoteStateView(new World(new FlatStrategy()));
        const applyFrames = () => {
          for (const frame of s.frames()) {
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
                throw Error(`Unexpected scenario replication message: ${message.type}`);
            }
          }
        };
        applyFrames();
        const predictor = new PlayerPredictor(() => s.physics);
        predictor.reset(view.serverPlayerEntity);
        const transport = new LocalTransport();
        let seq = s.player.lastProcessedInputSeq;
        const samples = [];
        for (let tick = 0; tick < 180; tick++) {
          const count = required(pattern[tick % pattern.length]);
          for (let i = 0; i < count; i++) {
            predictor.storeInput(++seq, input, commandDt);
            predictor.update(commandDt, input, view.world, view.props, view.entities);
            const message = decodeClientMessage(
              encodeClientMessage({
                type: "player-input",
                ...input,
                seq,
                dtMs: commandDt * 1000,
              }),
            );
            if (message.type !== "player-input") throw Error("Unexpected input codec");
            s.player.inputQueue.push(message);
          }
          await s.ready();
          s.realm.tick(tickDt, transport.serverSide, false, new Set());
          applyFrames();
          const before = required(predictor.player).position.wx;
          predictor.reconcile(
            view.serverPlayerEntity,
            view.lastProcessedInputSeq,
            view.world,
            view.props,
            view.entities,
          );
          const authoritative = s.player.player;
          samples.push({
            tick,
            inputCount: count,
            signedCorrection: required(predictor.lastCorrection).wx,
            reconcileDisplacement: required(predictor.player).position.wx - before,
            serverRoofOffset: authoritative.position.wx - service.entity.position.wx,
            speed: service.speed,
            support: roofSupport(authoritative, s.realm.entityManager.entities)?.id,
          });
        }
        if (samples.some((sample) => Math.abs(sample.speed - 192) > 0.001))
          throw Error("Probe left constant-speed straight section");
        if (!onGround && samples.some((sample) => sample.support !== service.entity.id))
          throw Error("Probe lost authoritative roof support");
        const corrections = samples.map((sample) => sample.signedCorrection);
        const offsets = samples.map((sample) => sample.serverRoofOffset);
        results.push({
          body,
          pattern,
          commandDt,
          minCorrectionPx: Math.min(...corrections),
          maxCorrectionPx: Math.max(...corrections),
          maxAbsCorrectionPx: Math.max(...corrections.map(Math.abs)),
          ...(onGround ? {} : { serverOffsetRangePx: Math.max(...offsets) - Math.min(...offsets) }),
          samples: samples.slice(0, 10),
        });
      } finally {
        await s.close();
      }
    }
  }
}
const report = {
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  scope:
    "Production Realm, railway, replication, codec and predictor; idle rider, 192px/s straight, idle/walking ground controls; deterministic input/server clock schedules; no browser rendering or transport delay",
  results,
};
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9);
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.table(results.map(({ samples: _samples, ...result }) => result));
