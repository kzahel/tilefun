import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseAssetAnnotation,
  parseSceneAnnotation,
  selectedSceneFeatures,
} from "../art/ArtAnnotations.js";
import { type ArtCatalog, required, validateRect } from "../art/ArtCatalog.js";
import { parseArtNote } from "../art/ArtNotes.js";
import { ALL_DENSE_REVIEW_CASES, denseReviewScene } from "../art/DenseDistrictShowcase.js";
import {
  type OutdoorCatalog,
  outdoorId,
  parseOutdoorMetadata,
} from "../assets/outdoor/OutdoorCatalog.js";
import type { WorkshopCandidate, WorkshopEvent } from "../workshop/WorkshopTypes.js";
import { HttpError } from "./workshopAuth.js";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export async function outdoorAnnotation(
  e: Extract<WorkshopEvent, { type: "asset" | "scene" }>,
  catalog: ArtCatalog,
  candidates: WorkshopCandidate[],
  current: boolean,
  createdAt: string,
  root = ".",
) {
  const sheet = required(catalog.sheets.find((s) => s.id === "me-complete"));
  const base = {
    id: e.id,
    threadId: e.id,
    sheetId: sheet.id,
    fingerprint: sheet.fingerprint,
    sheetSize: [sheet.width, sheet.height],
    sliceKeys: [],
    status: "pending",
    note: e.note,
    reply: "",
    createdAt,
  };
  if (typeof e.note !== "string" || e.note.length > 3500)
    throw new HttpError(400, "Invalid annotation note");
  const bank = JSON.parse(
    await readFile(join(root, "public/data/outdoor-catalog.json"), "utf8"),
  ) as OutdoorCatalog;
  if (bank.sourceFingerprint !== sheet.fingerprint)
    throw new HttpError(409, "Outdoor inventory needs rebuilding");
  if (e.type === "asset") {
    if (e.fingerprint !== sheet.fingerprint || e.catalogRevision !== bank.revision)
      throw new HttpError(409, "Asset source or catalog changed. Reload before reviewing.");
    const rect = validateRect(e.rect, sheet),
      metadata = parseOutdoorMetadata(e.metadata, rect);
    const annotation = parseAssetAnnotation(
      {
        createdAt,
        assetId: outdoorId(rect),
        catalogRevision: bank.revision,
        metadataFingerprint: hash(metadata),
        metadata,
        baseMetadata: bank.assets.find((a) => a.id === outdoorId(rect))?.metadata ?? null,
        verdict: e.verdict,
      },
      rect,
    );
    return parseArtNote(
      {
        ...base,
        rect,
        intent: "prop",
        note:
          e.note.trim() ||
          (e.verdict === "approved"
            ? "Approved this exact asset metadata and geometry."
            : e.verdict === "changes"
              ? "Requested asset metadata changes."
              : "Proposed asset metadata correction."),
        assetAnnotation: annotation,
        status: e.verdict === "approved" ? "resolved" : "pending",
      },
      catalog,
    );
  }
  const candidate = candidates.find((c) => c.id === e.candidateId),
    definition = ALL_DENSE_REVIEW_CASES.find(
      (c) => `district:${c.id}` === e.candidateId && c.window === "whole",
    );
  if (!current || !candidate || candidate.fingerprint !== e.fingerprint || !definition)
    throw new HttpError(409, "Neighborhood changed. Reload the full scene.");
  if (!e.note.trim()) throw new HttpError(400, "Write a location note first");
  const scene = denseReviewScene(definition),
    b = scene.bounds;
  const annotation = parseSceneAnnotation(
    {
      candidateId: candidate.id,
      renderFingerprint: candidate.fingerprint,
      generation: scene.generation,
      bounds: [b.minX * 16, b.minY * 16, (b.maxX - b.minX) * 16, (b.maxY - b.minY) * 16],
      rect: e.rect,
      featureIds: e.featureIds,
      suggestions: e.suggestions,
    },
    sheet,
  );
  for (const id of annotation.featureIds)
    if (!selectedSceneFeatures(scene.props, annotation.rect).some((p) => p.proceduralId === id))
      throw new HttpError(400, "Selected feature does not intersect the neighborhood region");
  for (const s of annotation.suggestions)
    if (s.sourceFingerprint !== sheet.fingerprint || s.metadataFingerprint !== hash(s.metadata))
      throw new HttpError(409, "Suggested asset revision changed");
  // A compatibility source pointer only. World selection lives exclusively in sceneAnnotation.
  return parseArtNote(
    { ...base, rect: [0, 0, 1, 1], intent: "pattern", sceneAnnotation: annotation },
    catalog,
  );
}
