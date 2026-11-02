import { sha256 } from "../art/ArtSource.js";
import page from "./DeferredVehiclePage.tsx?raw";
import type { WorkshopCandidate } from "./WorkshopTypes.js";
export async function deferredVehicleCandidate(
  id: string,
  name: string,
  url: string,
  batchId = "world-geometry",
): Promise<WorkshopCandidate> {
  return {
    id,
    batchId,
    kind: "geometry",
    name,
    prompt:
      "Historical specialized vehicle simulation, deferred during physics reset 205. Models and static studies remain; basic driving uses the common game kernel.",
    url,
    excluded: "Deferred interactive feature; no current physics qualification or art approval.",
    fingerprint: await sha256(new TextEncoder().encode(page)),
  };
}
