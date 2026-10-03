import type { ArtCatalog } from "../art/ArtCatalog.js";
import { required } from "../art/ArtCatalog.js";
import { loadVerifiedArtImage, sha256 } from "../art/ArtSource.js";
import { reviewContext2D } from "../art/reviewCanvas.js";
import type { GameAssets } from "../assets/GameAssets.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export const DOOR_CASES = ["door-butcher-v1-left", "door-butcher-v1-right"];
export async function buildDoorCandidate(
  canvas: HTMLCanvasElement,
  id: string,
  assets: GameAssets,
  catalog: ArtCatalog,
): Promise<WorkshopCandidate> {
  const source = required(catalog.sheets.find((s) => s.id === "door-butcher-v1"));
  const image = await loadVerifiedArtImage(source);
  const atlas = required(assets.sheets.get("me-complete")).image;
  canvas.width = 7 * 112;
  canvas.height = 2 * 96;
  const ctx = reviewContext2D(canvas);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#708577";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let frame = 0; frame < 14; frame++) {
    const x = (frame % 7) * 112,
      y = Math.floor(frame / 7) * 96;
    ctx.drawImage(atlas, 1280, 2384, 112, 80, x, y, 112, 80);
    ctx.drawImage(
      image,
      frame * 16,
      0,
      16,
      32,
      x + (id.endsWith("left") ? 32 : 64),
      y + 48,
      16,
      32,
    );
  }
  const fingerprint = await sha256(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  const revision = await sha256(
    new TextEncoder().encode(JSON.stringify({ id, source: source.fingerprint, version: 1 })),
  );
  const url = `/tilefun/workshop.html#/review/pattern:${id}`;
  const review = {
    scene: "pattern" as const,
    caseId: id,
    prefabIds: [],
    revision,
    renderFingerprint: fingerprint,
    url,
  };
  return {
    id: `pattern:${id}`,
    batchId: "doorways-v1",
    name: `Butcher ${id.endsWith("left") ? "left" : "right"} door · opening and closing`,
    prompt:
      "Read left to right: opening above, closing below. Check the animated panel against the unchanged facade and opposite door. These are new, unapproved animation overlays.",
    kind: "pattern",
    url,
    fingerprint,
    sourceFingerprint: source.fingerprint,
    review,
    art: {
      sheetId: source.id,
      fingerprint: source.fingerprint,
      sheetSize: [source.width, source.height],
      rect: [0, 0, 224, 32],
      sliceKeys: [],
      intent: "pattern",
      buildingReview: review,
    },
  };
}
