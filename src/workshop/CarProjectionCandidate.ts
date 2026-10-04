import { sha256 } from "../art/ArtSource.js";
import { CAR_PROXY, carProxyPatches } from "../projection/CarProxy.js";
import geometrySource from "../projection/CarProxy.ts?raw";
import rendererSource from "../projection/CarProxyScene.ts?raw";
import textureSource from "../projection/ProxyTexture.ts?raw";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

/** Discoverable experiment identity, deliberately not an approvable GPU snapshot. */
export async function buildCarProjectionCandidate(): Promise<WorkshopCandidate> {
  const fingerprint = await sha256(
    new TextEncoder().encode(
      JSON.stringify({
        asset: CAR_PROXY,
        patches: carProxyPatches(),
        geometrySource,
        rendererSource,
        textureSource,
      }),
    ),
  );
  return {
    id: "projection:compact-car-v1",
    batchId: "car-projection",
    name: "Blue compact car · projected 3D proxy",
    prompt:
      "Orbit the fitted surfaces, compare the source image and inspect approved collision bounds. This experiment has no gameplay promotion or approval action.",
    url: "/tilefun/workshop.html#/tool/car-projection",
    kind: "projection",
    sourceFingerprint: CAR_PROXY.sourceFingerprint,
    fingerprint,
    excluded: "Exploratory orbit view; not an immutable approval snapshot.",
  };
}
