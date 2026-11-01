import { sha256 } from "../art/ArtSource.js";
import limits from "../client/PredictionLimits.ts?raw";
import geometry from "../physics/rapier/BridgeFixture.ts?raw";
import pairPredictor from "../physics/rapier/FullWorldPredictor.ts?raw";
import latency from "../physics/rapier/OrderedLatency.ts?raw";
import pairAuthority from "../physics/rapier/PairAuthority.ts?raw";
import pairHarness from "../physics/rapier/PairHarness.ts?raw";
import pairPort from "../physics/rapier/PairWorkerPort.ts?raw";
import client from "../physics/rapier/PhysicsLabClient.ts?raw";
import pairLink from "../physics/rapier/PhysicsLink.ts?raw";
import protocol from "../physics/rapier/PhysicsProtocol.ts?raw";
import pairScenarios from "../physics/rapier/PhysicsScenarios.ts?raw";
import viewport from "../physics/rapier/PhysicsViewport.ts?raw";
import pairWorker from "../physics/rapier/pair.worker.ts?raw";
import worker from "../physics/rapier/physics.worker.ts?raw";
import predictor from "../physics/rapier/RapierPredictor.ts?raw";
import owner from "../physics/rapier/RapierRealmSimulation.ts?raw";
import recipe from "../physics/rapier/RapierScenarioRecipe.ts?raw";
import backend from "../physics/rapier/RapierWorld.ts?raw";
import pairPage from "./PairPhysicsPage.tsx?raw";
import page from "./PhysicsPage.tsx?raw";
import style from "./physics.css?raw";
import { scenarioRuntimeSource } from "./ScenarioRuntimeSource.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildPhysicsCandidate(): Promise<WorkshopCandidate> {
  return {
    id: "geometry:rapier-physics-v1",
    batchId: "physics-prototype",
    kind: "geometry",
    name: "Co-op physics laboratory",
    prompt:
      "Two playable clients share one temporary Realm. Replay dynamic cubes and both players with seeded guest latency, scripted interactions, pause and single-step. Bridge/scale prototype remains available; ordinary game physics is unchanged.",
    url: "/tilefun/workshop.html#/tool/physics",
    excluded: "Interactive backend experiment; not an immutable art approval snapshot.",
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          pairPage,
          pairAuthority,
          pairHarness,
          pairPredictor,
          pairScenarios,
          pairLink,
          pairPort,
          pairWorker,
          geometry,
          backend,
          predictor,
          latency,
          owner,
          recipe,
          limits,
          runtime: scenarioRuntimeSource,
          protocol,
          worker,
          client,
          viewport,
          page,
          style,
          rapier: "0.21.0",
        }),
      ),
    ),
  };
}
