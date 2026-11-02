import { sha256 } from "../art/ArtSource.js";
import recipe from "../scenarios/CoopRecipe.ts?raw";
import latency from "../scenarios/OrderedLatency.ts?raw";
import replica from "../scenarios/ScenarioReplica.ts?raw";
import page from "./PhysicsPage.tsx?raw";
import viewport from "./PhysicsViewport.ts?raw";
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
      "Two ordinary clients share one temporary Realm Worker, the game’s fixed shared physics step, normal binary frames and private prediction. Inspect pushing, head support, reversal and ordered guest latency; pause, step, reset or save/reload.",
    url: "/tilefun/workshop.html#/tool/physics",
    excluded: "Interactive diagnostic; not an immutable art approval snapshot.",
    fingerprint: await sha256(
      new TextEncoder().encode(
        JSON.stringify({
          recipe,
          replica,
          latency,
          page,
          viewport,
          style,
          runtime: scenarioRuntimeSource,
        }),
      ),
    ),
  };
}
