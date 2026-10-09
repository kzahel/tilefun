import {
  type CharacterAnnotation,
  parseCharacterAnnotation,
} from "../characters/CharacterReview.js";
import {
  type AssetAnnotation,
  parseAssetAnnotation,
  parseSceneAnnotation,
  type SceneAnnotation,
} from "./ArtAnnotations.js";
import { type ArtCatalog, type ArtRect, validateRect } from "./ArtCatalog.js";
import { CITY_REVIEW_RUNS } from "./CityReviewRuns.js";
export const ART_INTENTS = ["building", "pattern", "prop", "terrain", "other"] as const;
export const ART_STATUSES = ["pending", "in-progress", "resolved"] as const;
export interface BuildingReview {
  scene:
    | "single"
    | "residential"
    | "mixed"
    | "hotel"
    | "street"
    | "surface"
    | "district"
    | "pattern";
  /** Stable context identity for a surface or street scene, independent of its building. */
  caseId?: string;
  propTypes?: string[];
  surfaceRecipe?: string;
  districtRecipe?:
    | "dense-district-v1"
    | "dense-district-v2"
    | "current-dense-district-v1"
    | "commercial-district-v1"
    | "city-places-v7"
    | "city-places-v8"
    | "city-places-v9"
    | "city-places-v10";
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
  characterAnnotation?: CharacterAnnotation;
  assetAnnotation?: AssetAnnotation;
  sceneAnnotation?: SceneAnnotation;
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
    ![
      "single",
      "residential",
      "mixed",
      "hotel",
      "street",
      "surface",
      "district",
      "pattern",
    ].includes(v.scene as string) ||
    !Array.isArray(v.prefabIds) ||
    (v.scene === "surface" || v.scene === "pattern"
      ? v.prefabIds.length !== 0
      : v.scene !== "district" && !v.prefabIds.length) ||
    v.prefabIds.length > 30 ||
    v.prefabIds.some((id) => typeof id !== "string" || !/^prop-city-[a-z0-9-]{1,100}$/.test(id)) ||
    typeof v.revision !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.revision) ||
    (v.renderFingerprint !== undefined &&
      (typeof v.renderFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(v.renderFingerprint))) ||
    typeof v.url !== "string" ||
    v.url.length > 2000 ||
    !(v.scene === "pattern"
      ? /^\/tilefun\/workshop\.html#\/review\/pattern%3A[a-z0-9-]+$/.test(v.url)
      : /^\/tilefun\/building-lab\.html\?[^\s#]*$/.test(v.url))
  )
    throw new Error("Invalid building review");
  if (v.scene !== "district" && v.districtRecipe !== undefined)
    throw new Error("Invalid district recipe context");
  if (v.scene === "pattern") {
    if (
      typeof v.caseId !== "string" ||
      !/^(?:fenced-trees-v1-[a-z-]+|rail-v1-[a-z-]{1,80}|wildlife-v2-[a-z0-9-]{1,100})$/.test(
        v.caseId,
      ) ||
      v.url !== `/tilefun/workshop.html#/review/pattern%3A${v.caseId}` ||
      v.propTypes !== undefined ||
      v.surfaceRecipe !== undefined ||
      v.districtRecipe !== undefined
    )
      throw new Error("Invalid pattern review context");
  } else if (v.scene === "street") {
    if (v.surfaceRecipe !== undefined) throw new Error("Invalid street recipe context");
    if (
      typeof v.caseId !== "string" ||
      !/^street-v[0-9]+-[a-z0-9-]{1,100}$/.test(v.caseId) ||
      !Array.isArray(v.propTypes) ||
      v.propTypes.length > 64 ||
      v.propTypes.some((id) => typeof id !== "string" || !/^prop-[a-z0-9-]{1,100}$/.test(id)) ||
      !v.url.includes("run=streets")
    )
      throw new Error("Invalid street review");
    const url = new URL(v.url, "https://tilefun.invalid");
    if (url.searchParams.get("case") !== v.caseId || url.searchParams.get("run") !== "streets")
      throw new Error("Street review URL does not match case");
  } else if (v.scene === "surface") {
    const url = new URL(v.url, "https://tilefun.invalid");
    if (
      typeof v.caseId !== "string" ||
      !/^surface-v[0-9]+-[a-z0-9-]{1,100}$/.test(v.caseId) ||
      !["city-surfaces-v1", "city-surfaces-v2"].includes(v.surfaceRecipe as string) ||
      v.propTypes !== undefined ||
      url.searchParams.get("run") !==
        (v.surfaceRecipe === "city-surfaces-v2" ? "road-geometry" : "surfaces") ||
      url.searchParams.get("case") !== v.caseId
    )
      throw new Error("Invalid surface review context");
  } else if (v.scene === "district") {
    const url = new URL(v.url, "https://tilefun.invalid");
    if (
      typeof v.caseId !== "string" ||
      !/^district-v[0-9]+-[a-z0-9-]{1,100}$/.test(v.caseId) ||
      ![
        "dense-district-v1",
        "dense-district-v2",
        "current-dense-district-v1",
        "commercial-district-v1",
        ...Object.values(CITY_REVIEW_RUNS).map((r) => r.recipe),
      ].includes(v.districtRecipe as string) ||
      v.surfaceRecipe !== undefined ||
      !Array.isArray(v.propTypes) ||
      v.propTypes.length > 64 ||
      v.propTypes.some((id) => typeof id !== "string" || !/^prop-[a-z0-9-]{1,100}$/.test(id)) ||
      url.searchParams.get("run") !==
        (Object.entries(CITY_REVIEW_RUNS).find(([, r]) => r.recipe === v.districtRecipe)?.[0] ??
          (v.districtRecipe === "commercial-district-v1" ? "commercial" : "districts")) ||
      url.searchParams.get("case") !== v.caseId
    )
      throw new Error("Invalid district review context");
  } else if (
    v.caseId !== undefined ||
    v.propTypes !== undefined ||
    v.surfaceRecipe !== undefined ||
    v.districtRecipe !== undefined
  )
    throw new Error("Invalid building review context");
  return {
    scene: v.scene as BuildingReview["scene"],
    ...(v.scene === "street"
      ? { caseId: v.caseId as string, propTypes: [...(v.propTypes as string[])] }
      : {}),
    ...(v.scene === "surface"
      ? { caseId: v.caseId as string, surfaceRecipe: v.surfaceRecipe as string }
      : {}),
    ...(v.scene === "district"
      ? {
          caseId: v.caseId as string,
          districtRecipe: v.districtRecipe as NonNullable<BuildingReview["districtRecipe"]>,
          propTypes: [...(v.propTypes as string[])],
        }
      : {}),
    ...(v.scene === "pattern" ? { caseId: v.caseId as string } : {}),
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
    ...(v.characterAnnotation === undefined
      ? {}
      : { characterAnnotation: parseCharacterAnnotation(v.characterAnnotation) }),
    ...(v.assetAnnotation === undefined
      ? {}
      : { assetAnnotation: parseAssetAnnotation(v.assetAnnotation, rect) }),
    ...(v.sceneAnnotation === undefined
      ? {}
      : { sceneAnnotation: parseSceneAnnotation(v.sceneAnnotation, { width, height }) }),
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
    JSON.stringify(a.buildingVerdict) === JSON.stringify(b.buildingVerdict) &&
    JSON.stringify(a.characterAnnotation) === JSON.stringify(b.characterAnnotation) &&
    JSON.stringify(a.assetAnnotation) === JSON.stringify(b.assetAnnotation) &&
    JSON.stringify(a.sceneAnnotation) === JSON.stringify(b.sceneAnnotation)
  );
}
