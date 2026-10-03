import type { ArtCatalog } from "../art/ArtCatalog.js";
import { required } from "../art/ArtCatalog.js";
import { sha256 } from "../art/ArtSource.js";
import type { GameAssets } from "../assets/GameAssets.js";
import { FENCED_TREES } from "../patterns/FencedTrees.js";
import { applyPatternEdit, type PatternDocument } from "../patterns/PatternDocument.js";
import { renderPatternDocument } from "../patterns/PatternRuntime.js";
import { buildDoorCandidate } from "./DoorCandidates.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export const TREE_PATTERN_CASES = [
  {
    id: "fenced-trees-v1-short",
    name: "Tree strip · minimum caps",
    length: 4,
    split: false,
    parallel: false,
  },
  {
    id: "fenced-trees-v1-repeat",
    name: "Tree strip · full repeat",
    length: 9,
    split: false,
    parallel: false,
  },
  {
    id: "fenced-trees-v1-long",
    name: "Tree strip · extended repeat",
    length: 20,
    split: false,
    parallel: false,
  },
  {
    id: "fenced-trees-v1-split",
    name: "Tree strip · erased middle / new ends",
    length: 17,
    split: true,
    parallel: false,
  },
  {
    id: "fenced-trees-v1-parallel",
    name: "Tree strips · independent adjacent rows",
    length: 13,
    split: false,
    parallel: true,
  },
] as const;
export function treeCaseDocument(id: string): PatternDocument {
  const c = required(TREE_PATTERN_CASES.find((c) => c.id === id));
  let d: PatternDocument = {
    version: 1,
    family: "fenced-trees-v1",
    width: 24,
    height: 16,
    cells: [],
  };
  d = applyPatternEdit(d, {
    path: [
      { x: 2, y: 6 },
      { x: 2 + c.length - 1, y: 6 },
    ],
    shape: "horizontal",
    value: 1,
    erase: false,
  });
  if (c.split)
    d = applyPatternEdit(d, {
      path: [{ x: 10, y: 6 }],
      shape: "horizontal",
      value: 1,
      erase: true,
    });
  if (c.parallel)
    d = applyPatternEdit(d, {
      path: [
        { x: 4, y: 7 },
        { x: 16, y: 7 },
      ],
      shape: "horizontal",
      value: 1,
      erase: false,
    });
  return d;
}
export function renderPatternCandidate(
  canvas: HTMLCanvasElement,
  id: string,
  assets: GameAssets,
  geometry = false,
) {
  if (id.replace(/^pattern:/, "").startsWith("door-")) return;
  renderPatternDocument(
    canvas,
    treeCaseDocument(id.replace(/^pattern:/, "")),
    assets,
    assets.sheets.get("me-complete")?.image ?? canvas,
    geometry,
  );
}
export async function buildPatternCandidate(
  canvas: HTMLCanvasElement,
  id: string,
  assets: GameAssets,
  catalog: ArtCatalog,
): Promise<WorkshopCandidate> {
  if (id.startsWith("door-")) return buildDoorCandidate(canvas, id, assets, catalog);
  const c = required(TREE_PATTERN_CASES.find((c) => c.id === id)),
    source = required(catalog.sheets.find((s) => s.id === "me-complete"));
  if (source.fingerprint !== FENCED_TREES.sourceFingerprint)
    throw new Error("Tree kit source changed; create a new kit revision.");
  renderPatternCandidate(canvas, id, assets);
  const ctx = required(canvas.getContext("2d")),
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const fingerprint = await sha256(pixels.data),
    revision = await sha256(
      new TextEncoder().encode(
        JSON.stringify({ kit: FENCED_TREES, document: treeCaseDocument(id) }),
      ),
    );
  const url = `/tilefun/workshop.html#/review/${encodeURIComponent(`pattern:${id}`)}`;
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
    batchId: "patterns",
    name: c.name,
    prompt:
      "Review the cap/repeat joins and south fence. Geometry shows the candidate ground footprint. Source art and game brush share this compiler.",
    kind: "pattern",
    url,
    fingerprint,
    sourceFingerprint: source.fingerprint,
    review,
    art: {
      sheetId: source.id,
      fingerprint: source.fingerprint,
      sheetSize: [source.width, source.height],
      rect: [1568, 0, 208, 96],
      sliceKeys: [],
      intent: "pattern",
      buildingReview: review,
    },
  };
}
