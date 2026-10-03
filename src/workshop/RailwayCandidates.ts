import type { ArtSheet } from "../art/ArtCatalog.js";
import { loadVerifiedArtImage, sha256 } from "../art/ArtSource.js";
import { reviewContext2D } from "../art/reviewCanvas.js";
import {
  drawRailway,
  RAIL_CASES,
  RAIL_MOTION_REVISION,
  RAIL_SOURCE,
  railCase,
} from "../railway/RailwayPreview.js";
import rendererSource from "../railway/RailwayPreview.ts?raw";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export const RAIL_SHEET: ArtSheet = {
  id: RAIL_SOURCE.sheetId,
  name: "Railway review source",
  image: RAIL_SOURCE.image,
  width: RAIL_SOURCE.width,
  height: RAIL_SOURCE.height,
  tileSize: 16,
  fingerprint: RAIL_SOURCE.sha256,
  source: "src/railway/RailwaySource.json",
};
let imagePromise: Promise<HTMLImageElement> | undefined;
export function railwayImage() {
  imagePromise ??= loadVerifiedArtImage(RAIL_SHEET).catch((error) => {
    imagePromise = undefined;
    throw error;
  });
  return imagePromise;
}
export const RAIL_SAMPLE_TIMES = [0, 2, 4, 6, 8, 10, 12, 16, 20, 23] as const;
export async function buildRailwayCandidate(
  canvas: HTMLCanvasElement,
  id: string,
): Promise<WorkshopCandidate> {
  const c = railCase(id),
    image = await railwayImage(),
    frames: string[] = [];
  const animated = !["patterns", "corners", "junction-art", "network"].includes(c.scene);
  for (const t of animated ? RAIL_SAMPLE_TIMES : [0]) {
    drawRailway(canvas, image, c, t);
    frames.push(
      await sha256(reviewContext2D(canvas).getImageData(0, 0, canvas.width, canvas.height).data),
    );
  }
  const revision = await sha256(
    new TextEncoder().encode(
      JSON.stringify({
        source: RAIL_SOURCE,
        c,
        motion: RAIL_MOTION_REVISION,
        samples: RAIL_SAMPLE_TIMES,
        rendererSource,
      }),
    ),
  );
  const fingerprint = await sha256(new TextEncoder().encode(JSON.stringify({ revision, frames })));
  const caseId = `rail-v1-${c.id}`,
    candidateId = `pattern:${caseId}`;
  const url = `/tilefun/workshop.html#/review/${encodeURIComponent(candidateId)}`;
  const review = {
    scene: "pattern" as const,
    caseId,
    prefabIds: [],
    revision,
    renderFingerprint: fingerprint,
    url,
  };
  drawRailway(canvas, image, c);
  return {
    id: candidateId,
    batchId: c.batch,
    name: c.name,
    prompt: c.prompt,
    kind: "railway",
    url,
    fingerprint,
    sourceFingerprint: RAIL_SOURCE.sha256,
    review,
    art: {
      sheetId: RAIL_SOURCE.sheetId,
      fingerprint: RAIL_SOURCE.sha256,
      sheetSize: [RAIL_SOURCE.width, RAIL_SOURCE.height],
      rect: [0, 0, RAIL_SOURCE.width, RAIL_SOURCE.height],
      sliceKeys: [],
      intent: "pattern",
      buildingReview: review,
    },
  };
}
export async function buildRailwayCandidates() {
  const canvas = document.createElement("canvas"),
    result: WorkshopCandidate[] = [];
  for (const c of RAIL_CASES) result.push(await buildRailwayCandidate(canvas, c.id));
  return result;
}
