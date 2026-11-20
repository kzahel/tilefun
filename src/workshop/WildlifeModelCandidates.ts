import { sha256 } from "../art/ArtSource.js";
import { reviewContext2D } from "../art/reviewCanvas.js";
import {
  WILDLIFE_MODEL_REVIEW_PREFIX,
  WILDLIFE_MODEL_REVIEWS,
  wildlifeModelReviewPath,
} from "../wildlife/WildlifeModelReviewBank.js";
import type { ReviewBatch, WorkshopCandidate } from "./WorkshopTypes.js";

const prefix = WILDLIFE_MODEL_REVIEW_PREFIX;
const appearance = "appearance.png";

export function wildlifeModelReview(id: string) {
  return id.startsWith(prefix)
    ? WILDLIFE_MODEL_REVIEWS.find((row) => row.id === id.slice(prefix.length))
    : undefined;
}

export const WILDLIFE_MODEL_BATCHES: ReviewBatch[] = [
  ...new Set(WILDLIFE_MODEL_REVIEWS.map(({ batch }) => batch)),
].map((id) => ({
  id,
  name: `3D wildlife · ${id.replace("wildlife-3d-", "").replaceAll("-", " ")}`,
  description:
    "Compare each animated model with its gameplay sprite and review the exact revision.",
  toolId: "animal-browser",
}));

export async function buildWildlifeModelCandidate(
  canvas: HTMLCanvasElement,
  id: string,
  evidence: "complete" | "render-inputs" = "complete",
): Promise<WorkshopCandidate> {
  const model = wildlifeModelReview(id);
  if (!model) throw new Error(`Unknown wildlife model: ${id}`);
  const sourceFingerprint = model.files[appearance];
  if (!sourceFingerprint) throw new Error(`Missing wildlife model appearance: ${id}`);
  const files = evidence === "complete" ? Object.keys(model.files) : [appearance];
  for (const name of files) {
    const url = `/tilefun/${wildlifeModelReviewPath(model.id, name)}`;
    const response = await fetch(url);
    if (
      !response.ok ||
      (await sha256(new Uint8Array(await response.arrayBuffer()))) !== model.files[name]
    )
      throw new Error(`Wildlife model evidence missing or changed: ${name}`);
  }
  const image = new Image();
  image.src = `/tilefun/${wildlifeModelReviewPath(model.id, appearance)}`;
  await image.decode();
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = reviewContext2D(canvas);
  context.drawImage(image, 0, 0);
  const revision = await sha256(new TextEncoder().encode(JSON.stringify(model)));
  const fingerprint = await sha256(
    new TextEncoder().encode(
      JSON.stringify({
        revision,
        pixels: await sha256(context.getImageData(0, 0, canvas.width, canvas.height).data),
      }),
    ),
  );
  const url = `/tilefun/workshop.html#/review/${encodeURIComponent(id)}`;
  const caseId = `wildlife-3d-${model.id}`;
  const review = {
    scene: "pattern" as const,
    caseId,
    prefabIds: [],
    revision,
    renderFingerprint: fingerprint,
    url,
  };
  return {
    id,
    batchId: model.batch,
    kind: "wildlife",
    name: model.name,
    prompt:
      "Compare the silhouette, ground or water contact, and each named action at game size and speed.",
    url,
    fingerprint,
    sourceFingerprint,
    review,
    art: {
      sheetId: caseId,
      fingerprint: sourceFingerprint,
      sheetSize: [canvas.width, canvas.height],
      rect: [0, 0, canvas.width, canvas.height],
      sliceKeys: [],
      intent: "pattern",
      buildingReview: review,
    },
  };
}

export async function buildWildlifeModelCandidates() {
  const canvas = document.createElement("canvas");
  const candidates: WorkshopCandidate[] = [];
  for (const { id } of WILDLIFE_MODEL_REVIEWS)
    candidates.push(await buildWildlifeModelCandidate(canvas, `${prefix}${id}`, "render-inputs"));
  return candidates;
}
