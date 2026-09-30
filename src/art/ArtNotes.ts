import { type ArtCatalog, type ArtRect, validateRect } from "./ArtCatalog.js";
export const ART_INTENTS = ["building", "pattern", "prop", "terrain", "other"] as const;
export const ART_STATUSES = ["pending", "in-progress", "resolved"] as const;
export interface BuildingReview {
  scene: "single" | "residential" | "mixed" | "hotel";
  prefabIds: string[];
  /** Hash of the composed recipe definitions, independent of the PNG revision. */
  revision: string;
  /** Unannotated game-rendered pixels, unaffected by preview scale or overlays. */
  renderFingerprint?: string;
  url: string;
}
export interface BuildingVerdict {
  value: "approved" | "changes" | "clear";
  /** Human decision time; agent replies must preserve this ordering. */
  createdAt: string;
}
export interface ArtNote {
  id: string;
  threadId: string;
  sheetId: string;
  fingerprint: string;
  rect: ArtRect;
  sheetSize: [number, number];
  sliceKeys: string[];
  intent: (typeof ART_INTENTS)[number];
  status: (typeof ART_STATUSES)[number];
  note: string;
  reply: string;
  createdAt: string;
  buildingReview?: BuildingReview;
  buildingVerdict?: BuildingVerdict;
}
function parseBuildingReview(value: unknown): BuildingReview {
  if (!value || typeof value !== "object") throw new Error("Invalid building review");
  const v = value as Record<string, unknown>;
  if (
    !["single", "residential", "mixed", "hotel"].includes(v.scene as string) ||
    !Array.isArray(v.prefabIds) ||
    !v.prefabIds.length ||
    v.prefabIds.length > 30 ||
    v.prefabIds.some((id) => typeof id !== "string" || !/^prop-city-[a-z0-9-]{1,100}$/.test(id)) ||
    typeof v.revision !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.revision) ||
    (v.renderFingerprint !== undefined &&
      (typeof v.renderFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(v.renderFingerprint))) ||
    typeof v.url !== "string" ||
    v.url.length > 2000 ||
    !/^\/tilefun\/building-lab\.html\?[^\s#]*$/.test(v.url)
  )
    throw new Error("Invalid building review");
  return {
    scene: v.scene as BuildingReview["scene"],
    prefabIds: [...v.prefabIds],
    revision: v.revision,
    ...(v.renderFingerprint === undefined
      ? {}
      : { renderFingerprint: v.renderFingerprint as string }),
    url: v.url,
  };
}
export function parseArtNote(value: unknown, catalog: ArtCatalog): ArtNote {
  if (!value || typeof value !== "object") throw new Error("Invalid art note");
  const v = value as Record<string, unknown>;
  for (const key of ["id", "threadId"]) {
    if (typeof v[key] !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(v[key]))
      throw new Error(`Invalid ${key}`);
  }
  const sheet = catalog.sheets.find((s) => s.id === v.sheetId);
  if (!sheet || typeof v.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(v.fingerprint))
    throw new Error("Invalid sheet identity");
  // Old revisions remain readable. The UI flags them; never silently reassign their pixels.
  if (
    !Array.isArray(v.sheetSize) ||
    v.sheetSize.length !== 2 ||
    v.sheetSize.some((n) => !Number.isInteger(n) || n < 1 || n > 32768)
  )
    throw new Error("Invalid source dimensions");
  const [width, height] = v.sheetSize;
  if (v.fingerprint === sheet.fingerprint && (width !== sheet.width || height !== sheet.height))
    throw new Error("Source dimensions do not match revision");
  const rect = validateRect(v.rect, { width, height });
  if (
    !Array.isArray(v.sliceKeys) ||
    v.sliceKeys.length > 40 ||
    v.sliceKeys.some((key) => typeof key !== "string" || key.length > 250)
  )
    throw new Error("Invalid slice keys");
  if (
    !ART_INTENTS.includes(v.intent as ArtNote["intent"]) ||
    !ART_STATUSES.includes(v.status as ArtNote["status"])
  )
    throw new Error("Invalid note state");
  if (
    typeof v.note !== "string" ||
    !v.note.trim() ||
    v.note.length > 4000 ||
    typeof v.reply !== "string" ||
    v.reply.length > 4000
  )
    throw new Error("Invalid note text");
  if (
    typeof v.createdAt !== "string" ||
    v.createdAt.length > 40 ||
    !Number.isFinite(Date.parse(v.createdAt))
  )
    throw new Error("Invalid note date");
  const review = v.buildingReview === undefined ? undefined : parseBuildingReview(v.buildingReview);
  let verdict: BuildingVerdict | undefined;
  if (v.buildingVerdict !== undefined) {
    const judgment = v.buildingVerdict as Partial<BuildingVerdict> | null;
    if (
      !review?.renderFingerprint ||
      !judgment ||
      !["approved", "changes", "clear"].includes(judgment.value ?? "") ||
      typeof judgment.createdAt !== "string" ||
      judgment.createdAt.length > 40 ||
      !Number.isFinite(Date.parse(judgment.createdAt))
    )
      throw new Error("Invalid building verdict");
    verdict = { value: judgment.value as BuildingVerdict["value"], createdAt: judgment.createdAt };
  }
  return {
    id: v.id as string,
    threadId: v.threadId as string,
    sheetId: sheet.id,
    fingerprint: v.fingerprint,
    rect,
    sheetSize: [width, height],
    sliceKeys: [...v.sliceKeys],
    intent: v.intent as ArtNote["intent"],
    status: v.status as ArtNote["status"],
    note: v.note,
    reply: v.reply,
    createdAt: v.createdAt,
    ...(review === undefined ? {} : { buildingReview: review }),
    ...(verdict === undefined ? {} : { buildingVerdict: verdict }),
  };
}
export function latestArtNotes(records: readonly ArtNote[]): ArtNote[] {
  const latest = new Map<string, ArtNote>();
  for (const row of records) latest.set(row.threadId, row);
  return [...latest.values()];
}
export function sameArtTarget(a: ArtNote, b: ArtNote): boolean {
  return (
    JSON.stringify(a.sheetSize) === JSON.stringify(b.sheetSize) &&
    a.sheetId === b.sheetId &&
    a.fingerprint === b.fingerprint &&
    JSON.stringify(a.rect) === JSON.stringify(b.rect) &&
    JSON.stringify(a.buildingReview) === JSON.stringify(b.buildingReview) &&
    JSON.stringify(a.buildingVerdict) === JSON.stringify(b.buildingVerdict)
  );
}
