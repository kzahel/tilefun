import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { RemoteStateView } from "../../src/client/ClientStateView.js";
import { PlayerPredictor } from "../../src/client/PlayerPredictor.js";
import { performanceMetrics } from "../../src/diagnostics/PerformanceMetrics.js";
import { PHYSICS_DT } from "../../src/physics/PhysicsDefaults.js";
import { Camera } from "../../src/rendering/Camera.js";
import { collectScene } from "../../src/rendering/collectScene.js";
import { collectSceneOrder } from "../../src/rendering/RenderFrame.js";
import { WorldRasterFrame } from "../../src/rendering/WorldRasterFrame.js";
import { CROWD_VIEW } from "../../src/scenarios/CrowdBenchRecipe.js";
import { applyRecipeAppearances, scenarioGravity } from "../../src/scenarios/ScenarioRecipe.js";
import { DeviceSession } from "../../src/session/DeviceSession.js";
import { decodeServerMessage } from "../../src/shared/binaryCodec.js";
import type { BufferedMessage } from "../../src/shared/protocol.js";
import { serializeEntity } from "../../src/shared/serialization.js";
import { vehicleChoice } from "../../src/ui/PlacePrompts.js";
import { World } from "../../src/world/World.js";
import { loadReceivers } from "./meshes.js";
import { assertEquivalent, compare, lane, option, output, replay, reportBase } from "./options.js";
import { assertComparable, compareOutcome, delta, sha256, summarize } from "./report.js";
import { readTape } from "./tape.js";

export async function runReplay() {
  const { tape, sha256: tapeSha256 } = await readTape(replay);
  const scene = option("scene", "moving");
  if (!["moving", "frozen"].includes(scene)) throw Error("--scene must be moving or frozen");
  if (scene === "frozen" && lane !== "render")
    throw Error("Frozen scene is a render-only workload");
  const verify = process.argv.includes("--verify");
  if (assertEquivalent && !verify) throw Error("Replay --assert-equivalent requires --verify");
  const meshes = lane === "render" ? await loadReceivers(tape.recipe) : undefined;
  const base = reportBase({
    tapeSha256,
    warmup: tape.warmup,
    ticks: tape.ticks,
    updatesHz: 60,
    presentationHz: 120,
    scene,
    view: { width: 960, height: 640, ...CROWD_VIEW },
    meshes: meshes?.inputs ?? [],
  });
  const instrumentation = { ...base.instrumentation, verify, fineGrainedTimers: lane === "client" };
  const previous = compare ? JSON.parse(await readFile(compare, "utf8")) : undefined;
  const comparison = previous
    ? assertComparable(
        { ...base, instrumentation },
        previous,
        process.argv.includes("--allow-incompatible"),
      )
    : [];
  const view = new RemoteStateView(new World());
  const device = new DeviceSession(view);
  let now = 0;
  const predictor = device.startPrediction(
    new PlayerPredictor(
      () => scenarioGravity(tape.recipe),
      () => now,
    ),
  );
  const camera = new Camera();
  camera.setViewport(960, 640);
  camera.zoom = CROWD_VIEW.zoom;
  camera.snapTo(CROWD_VIEW.camera.wx, CROWD_VIEW.camera.wy);
  const raster = new WorldRasterFrame();
  const terrain = {
    // This fixture is flat: there are no elevated terrain items to compile.
    collectElevationItems: () => [],
    meshSurfaceGeometry: (id: string) => meshes?.assets.get(id)?.surfaceGeometry,
  };
  const stages: Record<string, number[]> = {};
  let measured = false;
  const timed = (name: string, fn: () => void) => {
    if (!measured) return fn();
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    const values = stages[name] ?? [];
    stages[name] = values;
    values.push(elapsed);
  };
  const apply = (packets: ArrayBuffer[]) => {
    for (const packet of packets) {
      const message = decodeServerMessage(packet);
      if (message.type === "frame") view.applyFrame(message, now);
      else if (message.type === "world-loaded") {
        view.clear();
        device.clearPresentation();
      } else if (message.type.startsWith("sync-")) view.applyMessage(message as BufferedMessage);
    }
  };
  const stateHash = createHash("sha256");
  const sceneHash = createHash("sha256");
  const state = () => JSON.stringify(view.serverEntities.map(serializeEntity));
  let finalScene = "",
    itemCount = 0,
    orderCount = 0,
    promptKey = "";
  const counts = { updates: 0, presentations: 0, collectedFrames: 0 };
  const observer = performanceMetrics.enabled;
  performanceMetrics.enabled = false;
  try {
    await predictor.ready;
    apply(tape.initial);
    applyRecipeAppearances(view, tape.recipe.player, tape.recipe.actors);
    device.reconcile(true);
    for (let tick = 0; tick < tape.steps.length; tick++) {
      measured = tick >= tape.warmup;
      now = (tick + 1) / 60;
      const packets = tape.steps[tick];
      if (!packets) throw Error("Missing recorded tick");
      const frozen = scene === "frozen" && measured;
      if (!frozen) {
        const update = () => {
          timed("client.decodeApply", () => apply(packets));
          timed("client.appearances", () =>
            applyRecipeAppearances(view, tape.recipe.player, tape.recipe.actors),
          );
          timed("client.reconcile", () => {
            device.reconcile(false);
          });
          timed("client.animation", () => view.tickAnimations(PHYSICS_DT));
          timed("client.prompts", () => {
            promptKey = vehicleChoice(view, true).key;
          });
        };
        if (lane === "client") timed("client.update", update);
        else {
          measured = false;
          update();
          measured = tick >= tape.warmup;
        }
        if (measured) counts.updates++;
      }
      if (verify && measured) stateHash.update(`${tick}:`).update(state());
      for (const alpha of [0, 0.5]) {
        now = (tick + 1 + alpha) / 60;
        const begin = () => view.beginPresentation(now, alpha, frozen);
        if (lane === "client") timed("client.presentation", begin);
        else begin();
        try {
          if (lane === "render") {
            device.frame.presentationTime = scene === "frozen" && measured ? tape.warmup / 60 : now;
            raster.begin(camera);
            try {
              timed("render.prepare", () => {
                const items = collectScene(
                  view.entities,
                  view.props,
                  view.world,
                  camera,
                  camera.getVisibleChunkRange(),
                  alpha,
                  terrain,
                  [],
                  false,
                  undefined,
                  device.frame,
                  { observer: view.presentedPlayerEntity, visibility: "auto" },
                );
                collectSceneOrder(items, device.frame.drawOrder);
              });
              if (measured) {
                counts.collectedFrames++;
                itemCount += device.frame.items.length;
                orderCount += device.frame.drawOrder.length;
                if (verify || tick === tape.steps.length - 1) {
                  finalScene = JSON.stringify({
                    items: device.frame.items,
                    order: device.frame.drawOrder,
                  });
                  if (verify) sceneHash.update(`${tick}:${alpha}:`).update(finalScene);
                }
              }
            } finally {
              raster.end();
              device.frame.release();
            }
          }
        } finally {
          view.endPresentation();
        }
        if (measured) counts.presentations++;
      }
    }
    if (counts.presentations !== tape.ticks * 2) throw Error("Replay window was incomplete");
    const outcome = {
      finalStateSha256: sha256(state()),
      finalSceneSha256: sha256(finalScene),
      ...(verify
        ? { allStatesSha256: stateHash.digest("hex"), allScenesSha256: sceneHash.digest("hex") }
        : {}),
    };
    const outcomeMatches = compareOutcome(outcome, previous?.outcome, assertEquivalent);
    const report = {
      ...base,
      instrumentation,
      comparisonIssues: comparison,
      stages: Object.fromEntries(
        Object.entries(stages).map(([name, values]) => [name, summarize(values)]),
      ),
      work: {
        ...counts,
        meanSceneItems: itemCount / Math.max(1, counts.collectedFrames),
        meanDrawOrderEntries: orderCount / Math.max(1, counts.collectedFrames),
        finalEntities: view.serverEntities.length,
        finalServerTick: view.serverTick,
        finalReceivers: { ...device.frame.receiverStats },
        promptKey,
      },
      outcome,
      outcomeMatches,
      scope:
        lane === "client"
          ? "Synchronous decode/apply, recipe appearances, empty-backlog reconciliation, animation and prompts at 60Hz; presentation sampling at 120Hz. No input prediction, transport scheduling, DOM or graphics."
          : "Shared collectScene and collectSceneOrder with actual GLB receivers at 120Hz. Replica processing/presentation outside timer. No terrain raster, particles, WebGL submission, uploads or GPU execution.",
    };
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    if (comparison.length) console.log(`INCOMPATIBLE COMPARISON: ${comparison.join(", ")}`);
    console.log(
      `crowd:bench ${lane} · ${scene} · ${tape.ticks} ticks / ${counts.presentations} presentations`,
    );
    for (const [name, v] of Object.entries(report.stages))
      console.log(
        `  ${name.padEnd(26)} p50 ${v.p50} ms${delta(v.p50, previous?.stages?.[name]?.p50)}, p95 ${v.p95} ms (${v.count} samples)`,
      );
    console.log("work:", report.work);
    console.log("outcome:", report.outcome);
    if (previous) console.log("outcome matches:", outcomeMatches);
    console.log(`Report: ${output}`);
  } finally {
    performanceMetrics.enabled = observer;
    device.dispose();
    meshes?.dispose();
  }
}
