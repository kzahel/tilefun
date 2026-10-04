import type { ArtSheet } from "../art/ArtCatalog.js";
import { loadVerifiedArtImage, sha256 } from "../art/ArtSource.js";
import { reviewContext2D } from "../art/reviewCanvas.js";
import definitions from "../wildlife/reviews.json";
import rendererSource from "./WildlifeCandidates.ts?raw";
import type { ReviewBatch, WorkshopCandidate } from "./WorkshopTypes.js";

export interface WildlifeReview {
  id: string;
  animalId: string;
  revision: string;
  name: string;
  batchId: string;
  galleryUrl: string;
  sheet: ArtSheet;
  contact: ArtSheet;
  scene: ArtSheet;
  files: { path: string; sha256: string }[];
  preview: string;
}
export const WILDLIFE_REVIEWS = definitions as WildlifeReview[];
export const WILDLIFE_BATCHES: ReviewBatch[] = [
  ...new Set(WILDLIFE_REVIEWS.map((d) => d.batchId)),
].map((id) => ({
  id,
  name: `Wildlife · ${id.replace(/^wildlife-v2-/, "")}`,
  description: "Fresh elevated-view animal art and motion; human approval pending.",
  toolId: "wildlife-v2",
}));

export async function buildWildlifeCandidate(
  canvas: HTMLCanvasElement,
  id: string,
  evidence: "complete" | "render-inputs" = "complete",
) {
  const d = WILDLIFE_REVIEWS.find((row) => `pattern:wildlife-v2-${row.id}` === id);
  if (!d) throw new Error("Unknown wildlife revision");
  // Builds need the committed native render bank. Human review additionally
  // requires every exact archived animation/player artifact, without exception.
  const renderInputs = new Set([d.sheet.image, d.scene.image, d.contact.image]);
  for (const file of d.files) {
    if (evidence === "render-inputs" && !renderInputs.has(file.path)) continue;
    const response = await fetch(`/tilefun/${file.path}`);
    if (
      !response.ok ||
      (await sha256(new Uint8Array(await response.arrayBuffer()))) !== file.sha256
    )
      throw new Error(`Wildlife artifact changed: ${file.path}`);
  }
  const [contact, scene] = await Promise.all([
    loadVerifiedArtImage(d.contact),
    loadVerifiedArtImage(d.scene),
  ]);
  canvas.width = Math.max(contact.width, scene.width);
  canvas.height = contact.height + scene.height;
  const ctx = reviewContext2D(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scene, 0, 0);
  ctx.drawImage(contact, 0, scene.height);
  const revision = await sha256(new TextEncoder().encode(JSON.stringify({ d, rendererSource })));
  const fingerprint = await sha256(
    new TextEncoder().encode(
      JSON.stringify({
        revision,
        pixels: await sha256(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
      }),
    ),
  );
  const url = `/tilefun/workshop.html#/review/${encodeURIComponent(id)}`;
  const review = {
    scene: "pattern" as const,
    caseId: `wildlife-v2-${d.id}`,
    prefabIds: [],
    revision,
    renderFingerprint: fingerprint,
    url,
  };
  const candidate: WorkshopCandidate = {
    id,
    batchId: d.batchId,
    kind: "wildlife",
    name: d.name,
    prompt:
      "Inspect native scale, elevated perspective, rear anatomy, head volume and near/far foot contacts. Open playback for full walking and action cycles.",
    url,
    fingerprint,
    sourceFingerprint: d.sheet.fingerprint,
    review,
    art: {
      sheetId: d.sheet.id,
      fingerprint: d.sheet.fingerprint,
      sheetSize: [d.sheet.width, d.sheet.height],
      rect: [0, 0, d.sheet.width, d.sheet.height],
      sliceKeys: [],
      intent: "pattern",
      buildingReview: review,
    },
  };
  return candidate;
}
export async function buildWildlifeCandidates() {
  const canvas = document.createElement("canvas");
  const results: WorkshopCandidate[] = [];
  for (const row of WILDLIFE_REVIEWS)
    results.push(
      await buildWildlifeCandidate(canvas, `pattern:wildlife-v2-${row.id}`, "render-inputs"),
    );
  return results;
}
