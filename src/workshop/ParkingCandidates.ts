import { type ArtCatalog, required } from "../art/ArtCatalog.js";
import { sha256 } from "../art/ArtSource.js";
import { reviewContext2D } from "../art/reviewCanvas.js";
import { drawParkingStudy, parkingCase, parkingStudy } from "../art/studies/ParkingLotStudy.js";
import renderer from "../art/studies/ParkingLotStudy.ts?raw";
import type { GameAssets } from "../assets/GameAssets.js";
import { CITY_SURFACE_SOURCE } from "../road/CitySurfaceRecipes.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export async function buildParkingCandidate(
  canvas: HTMLCanvasElement,
  id: string,
  assets: GameAssets,
  catalog: ArtCatalog,
): Promise<WorkshopCandidate> {
  const c = parkingCase(id.replace(/^parking-v1-/, ""));
  const source = required(catalog.sheets.find((s) => s.id === CITY_SURFACE_SOURCE.sheetId));
  if (source.fingerprint !== CITY_SURFACE_SOURCE.fingerprint)
    throw new Error("Parking source changed; create a new kit revision.");
  drawParkingStudy(canvas, c.id, required(assets.sheets.get(source.id)));
  const pixels = reviewContext2D(canvas).getImageData(0, 0, canvas.width, canvas.height);
  const fingerprint = await sha256(
    new TextEncoder().encode(`${canvas.width}:${canvas.height}:${await sha256(pixels.data)}`),
  );
  const revision = await sha256(
    new TextEncoder().encode(JSON.stringify({ plan: parkingStudy(c.id), renderer })),
  );
  const caseId = `parking-v1-${c.id}`,
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
  return {
    id: candidateId,
    batchId: "parking-patterns",
    kind: "pattern",
    name: c.name,
    prompt: `${c.description} Inspect bay repeats, car scale, aisle space and pedestrian access. Static layout study: parked cars are scale references. Watch shopping trips and City road connection demonstrate live visits and generated city centers.`,
    url,
    fingerprint,
    sourceFingerprint: source.fingerprint,
    review,
    art: {
      sheetId: source.id,
      fingerprint: source.fingerprint,
      sheetSize: [source.width, source.height],
      rect: [0, 1904, 208, 288],
      sliceKeys: [],
      intent: "pattern",
      buildingReview: review,
    },
  };
}
