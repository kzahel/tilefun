import type { OutdoorMetadata } from "../assets/outdoor/OutdoorCatalog.js";
import { outdoorId, parseOutdoorMetadata } from "../assets/outdoor/OutdoorCatalog.js";
import type { Prop } from "../entities/Prop.js";
import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import { resolveDescriptor } from "../generation/GenerationDescriptor.js";
import { type ArtRect, intersects, validateRect } from "./ArtCatalog.js";
export function selectedSceneFeatures(props: readonly Prop[], rect: ArtRect): Prop[] {
  return props
    .filter((p) =>
      (
        p.sprite.parts ?? [
          { dx: 0, dy: 0, spriteWidth: p.sprite.spriteWidth, spriteHeight: p.sprite.spriteHeight },
        ]
      ).some((part) =>
        intersects(rect, [
          p.position.wx + part.dx - part.spriteWidth / 2,
          p.position.wy + part.dy - part.spriteHeight,
          part.spriteWidth,
          part.spriteHeight,
        ]),
      ),
    )
    .slice(0, 40);
}
export interface AssetAnnotation {
  candidateId?: string;
  candidateFingerprint?: string;
  /** Original human edit/decision time, preserved by status replies. */
  createdAt: string;
  assetId: string;
  catalogRevision: string;
  metadataFingerprint: string;
  metadata: OutdoorMetadata;
  /** Catalog definition against which the human made this edit; null for a new region. */
  baseMetadata: OutdoorMetadata | null;
  verdict: "note" | "approved" | "changes";
}
export interface AssetSuggestion {
  assetId: string;
  rect: ArtRect;
  sourceFingerprint: string;
  metadataFingerprint: string;
  metadata: OutdoorMetadata;
}
export interface SceneAnnotation {
  candidateId: string;
  renderFingerprint: string;
  generation: GenerationDescriptor;
  /** World pixels, not sheet coordinates. */
  bounds: ArtRect;
  rect: ArtRect;
  featureIds: string[];
  suggestions: AssetSuggestion[];
}
export function annotationHash(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("Invalid annotation revision");
  return value;
}
export function parseAssetAnnotation(value: unknown, rect: ArtRect): AssetAnnotation {
  const v = value as AssetAnnotation;
  if (
    typeof v?.createdAt !== "string" ||
    v.createdAt.length > 40 ||
    !Number.isFinite(Date.parse(v.createdAt))
  )
    throw new Error("Invalid metadata decision time");
  if (!v || v.assetId !== outdoorId(rect) || !["note", "approved", "changes"].includes(v.verdict))
    throw new Error("Invalid asset annotation");
  const metadata = parseOutdoorMetadata(v.metadata, rect);
  if (v.verdict === "approved" && (metadata.colliders === null || metadata.kind === "unknown"))
    throw new Error("Define asset kind and collision behavior before approving");
  if (
    v.candidateId !== undefined &&
    (!/^vehicle:[a-z0-9-]+:(north|east|south|west)$/.test(v.candidateId) || !v.candidateFingerprint)
  )
    throw new Error("Invalid vehicle candidate reference");
  return {
    ...(v.candidateId
      ? { candidateId: v.candidateId, candidateFingerprint: annotationHash(v.candidateFingerprint) }
      : {}),
    createdAt: v.createdAt,
    assetId: v.assetId,
    catalogRevision: annotationHash(v.catalogRevision),
    metadataFingerprint: annotationHash(v.metadataFingerprint),
    metadata,
    baseMetadata: v.baseMetadata === null ? null : parseOutdoorMetadata(v.baseMetadata, rect),
    verdict: v.verdict,
  };
}
export function parseSceneAnnotation(
  value: unknown,
  sheet: { width: number; height: number },
): SceneAnnotation {
  const v = value as SceneAnnotation;
  if (
    !v ||
    typeof v.candidateId !== "string" ||
    !/^district:district-v[0-9]+-[a-z0-9-]{1,100}$/.test(v.candidateId)
  )
    throw new Error("Invalid neighborhood annotation");
  const b = v.bounds;
  if (
    !Array.isArray(b) ||
    b.length !== 4 ||
    b.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e8) ||
    b[2] <= 0 ||
    b[3] <= 0 ||
    b[2] > 4096 ||
    b[3] > 4096
  )
    throw new Error("Invalid world bounds");
  const r = v.rect;
  if (
    !Array.isArray(r) ||
    r.length !== 4 ||
    r.some((n) => !Number.isFinite(n)) ||
    r[2] <= 0 ||
    r[3] <= 0 ||
    r[0] < b[0] ||
    r[1] < b[1] ||
    r[0] + r[2] > b[0] + b[2] ||
    r[1] + r[3] > b[1] + b[3]
  )
    throw new Error("Selection is outside neighborhood");
  if (
    !Array.isArray(v.featureIds) ||
    v.featureIds.length > 40 ||
    v.featureIds.some((id) => typeof id !== "string" || id.length > 250)
  )
    throw new Error("Invalid feature selection");
  if (!Array.isArray(v.suggestions) || v.suggestions.length > 12)
    throw new Error("Too many asset suggestions");
  const suggestions = v.suggestions.map((s) => {
    const rect = validateRect(s.rect, sheet);
    if (s.assetId !== outdoorId(rect)) throw new Error("Asset reference does not match rectangle");
    return {
      assetId: s.assetId,
      rect,
      sourceFingerprint: annotationHash(s.sourceFingerprint),
      metadataFingerprint: annotationHash(s.metadataFingerprint),
      metadata: parseOutdoorMetadata(s.metadata, rect),
    };
  });
  return {
    candidateId: v.candidateId,
    renderFingerprint: annotationHash(v.renderFingerprint),
    generation: resolveDescriptor(v.generation),
    bounds: [...b],
    rect: [...r],
    featureIds: [...v.featureIds],
    suggestions,
  };
}
