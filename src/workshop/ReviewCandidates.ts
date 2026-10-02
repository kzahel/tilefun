import { type ArtCatalog, type ArtRect, required } from "../art/ArtCatalog.js";
import type { BuildingReview } from "../art/ArtNotes.js";
import { sha256 } from "../art/ArtSource.js";
import { buildingCaseKey } from "../art/BuildingReviewQueue.js";
import { drawBuildingShowcase } from "../art/BuildingShowcase.js";
import {
  DENSE_REVIEW_CASES,
  denseReviewComposition,
  denseReviewPrefabs,
  denseReviewScene,
  drawDenseDistrictShowcase,
} from "../art/DenseDistrictShowcase.js";
import { drawStreetShowcase } from "../art/StreetShowcase.js";
import { drawSurfaceShowcase } from "../art/SurfaceShowcase.js";
import { type GameAssets, loadSceneAssets } from "../assets/GameAssets.js";
import { createProp } from "../entities/PropFactories.js";
import {
  CITY_BUILDING_PREFABS,
  CITY_PREFAB_SOURCE,
  cityPrefabBlock,
} from "../generation/regional/CityBuildingPrefabs.js";
import { STREET_REVIEW_SCENES, type StreetScene } from "../generation/regional/StreetRecipes.js";
import {
  CITY_SURFACE_CASES,
  citySurfaceComposition,
  composeCitySurface,
} from "../road/CitySurfaceRecipes.js";
import {
  composeStreetStarterSurface,
  STREET_STARTER_SURFACE,
} from "../road/StreetStarterSurface.js";
import type { WorkshopCandidate } from "./WorkshopTypes.js";

export function streetComposition(scene: StreetScene) {
  return {
    scene,
    surface: { ...STREET_STARTER_SURFACE, pieces: composeStreetStarterSurface(scene.bounds) },
    building: required(CITY_BUILDING_PREFABS.find((p) => p.type === scene.buildingType)),
    props: scene.props.map((p) => createProp(p.type, p.wx, p.wy)),
  };
}
export function artReviewDefinitions() {
  return [
    ...CITY_BUILDING_PREFABS.map((p) => ({
      id: `single:${p.type}`,
      batchId: "buildings",
      name: p.name,
      scene: "single" as const,
      prefab: p.type,
      url: `/tilefun/building-lab.html?scene=single&prefab=${p.type}`,
    })),
    ...(["residential", "mixed", "hotel"] as const).map((scene) => ({
      id: `block:${scene}`,
      batchId: "buildings",
      name: `${scene} block`,
      scene,
      prefab: "",
      url: `/tilefun/building-lab.html?scene=${scene}&prefab=${required(cityPrefabBlock(scene)[0]).prefab.type}`,
    })),
    ...CITY_SURFACE_CASES.map((c) => ({
      id: `surface:${c.id}`,
      batchId: "roads",
      name: c.name,
      scene: "surface" as const,
      prefab: c.id,
      url: `/tilefun/building-lab.html?run=surfaces&case=${c.id}`,
    })),
    ...STREET_REVIEW_SCENES.map((c) => ({
      id: `street:${c.id}`,
      batchId: "streets",
      name: c.name,
      scene: "street" as const,
      prefab: c.id,
      url: `/tilefun/building-lab.html?run=streets&case=${c.id}`,
    })),
    ...DENSE_REVIEW_CASES.map((c) => ({
      id: `district:${c.id}`,
      batchId: "districts",
      name: c.name,
      scene: "district" as const,
      prefab: c.id,
      url: `/tilefun/building-lab.html?run=districts&case=${c.id}`,
    })),
  ];
}
export type ArtReviewDefinition = ReturnType<typeof artReviewDefinitions>[number];
export function artReviewContext(d: ArtReviewDefinition) {
  const surface =
    d.scene === "surface" ? required(CITY_SURFACE_CASES.find((c) => c.id === d.prefab)) : undefined;
  const street =
    d.scene === "street"
      ? required(STREET_REVIEW_SCENES.find((c) => c.id === d.prefab))
      : undefined;
  const district =
    d.scene === "district"
      ? denseReviewScene(required(DENSE_REVIEW_CASES.find((c) => c.id === d.prefab)))
      : undefined;
  const prefabs = district
    ? denseReviewPrefabs(district)
    : surface
      ? []
      : street
        ? [required(CITY_BUILDING_PREFABS.find((p) => p.type === street.buildingType))]
        : d.scene === "single"
          ? [required(CITY_BUILDING_PREFABS.find((p) => p.type === d.prefab))]
          : cityPrefabBlock(blockKind(d.scene)).map((p) => p.prefab);
  const composition = district
    ? denseReviewComposition(district)
    : surface
      ? citySurfaceComposition(surface)
      : street
        ? streetComposition(street)
        : prefabs;
  const rects: ArtRect[] = surface
    ? composeCitySurface(surface).map((p) => [...p.rect])
    : [
        ...prefabs.flatMap((p) =>
          p.parts.map(
            (s) => [s.frameCol * 16, s.frameRow * 16, s.spriteWidth, s.spriteHeight] as ArtRect,
          ),
        ),
        ...(street?.props.map((p) => {
          const s = createProp(p.type, p.wx, p.wy).sprite;
          return [s.frameCol * 16, s.frameRow * 16, s.spriteWidth, s.spriteHeight] as ArtRect;
        }) ?? []),
        ...(street
          ? composeStreetStarterSurface(street.bounds).map((p) => [...p.rect] as ArtRect)
          : []),
      ];
  const x = Math.min(...rects.map((r) => r[0])),
    y = Math.min(...rects.map((r) => r[1]));
  const rect: ArtRect = [
    x,
    y,
    Math.max(...rects.map((r) => r[0] + r[2])) - x,
    Math.max(...rects.map((r) => r[1] + r[3])) - y,
  ];
  return { surface, street, district, prefabs, composition, rect };
}
export async function renderArtCandidate(
  canvas: HTMLCanvasElement,
  d: ArtReviewDefinition,
  assets: GameAssets,
  geometry = false,
) {
  const context = artReviewContext(d),
    sheet = required(assets.sheets.get("me-complete"));
  if (context.surface) drawSurfaceShowcase(canvas, context.surface, sheet, geometry);
  else if (context.street) drawStreetShowcase(canvas, context.street, sheet, geometry);
  else if (context.district) {
    await loadSceneAssets(
      assets,
      new Set([
        ...context.district.props.map((p) => p.sprite.sheetKey),
        ...context.district.actors.map((a) => a.type),
      ]),
    );
    drawDenseDistrictShowcase(canvas, context.district, assets, geometry);
  } else
    drawBuildingShowcase(
      canvas,
      d.scene === "single"
        ? [
            {
              prefab: required(CITY_BUILDING_PREFABS.find((p) => p.type === d.prefab)),
              wx: 0,
              wy: 0,
            },
          ]
        : cityPrefabBlock(blockKind(d.scene)),
      sheet,
      geometry,
    );
  return context;
}
export async function canvasFingerprint(canvas: HTMLCanvasElement) {
  const pixels = required(canvas.getContext("2d")).getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  ).data;
  const pixelHash = await sha256(pixels);
  return sha256(new TextEncoder().encode(`${canvas.width}:${canvas.height}:${pixelHash}`));
}
export async function buildArtCandidate(
  canvas: HTMLCanvasElement,
  d: ArtReviewDefinition,
  assets: GameAssets,
  catalog: ArtCatalog,
): Promise<WorkshopCandidate> {
  const context = await renderArtCandidate(canvas, d, assets),
    source = required(catalog.sheets.find((s) => s.id === CITY_PREFAB_SOURCE.sheetId));
  const review: BuildingReview = {
    scene: d.scene,
    prefabIds: context.prefabs.map((p) => p.type),
    url: d.url,
    revision: await sha256(new TextEncoder().encode(JSON.stringify(context.composition))),
    renderFingerprint: await canvasFingerprint(canvas),
    ...(context.surface ? { caseId: context.surface.id, surfaceRecipe: "city-surfaces-v1" } : {}),
    ...(context.street
      ? {
          caseId: context.street.id,
          propTypes: [...new Set(context.street.props.map((p) => p.type))],
        }
      : {}),
    ...(context.district
      ? {
          caseId: context.district.definition.id,
          districtRecipe: context.district.plan.recipe,
          propTypes: context.district.props.map((p) => p.type),
        }
      : {}),
  };
  return {
    id: buildingCaseKey(review),
    batchId: d.batchId,
    name: d.name,
    prompt:
      context.surface?.prompt ??
      context.street?.prompt ??
      context.district?.definition.prompt ??
      "Review the assembled art, frontage and source-piece fit.",
    url: d.url,
    kind: "art",
    ...(context.district
      ? {
          exploreUrl: `/tool/explorer?${new URLSearchParams({
            generation: JSON.stringify(context.district.generation),
            x: String(context.district.plan.center.x),
            y: String(context.district.plan.center.y),
            zoom: "12",
            mode: "tiles",
          })}`,
        }
      : {}),
    fingerprint: required(review.renderFingerprint),
    sourceFingerprint: source.fingerprint,
    review,
    art: {
      sheetId: source.id,
      fingerprint: source.fingerprint,
      sheetSize: [source.width, source.height],
      rect: context.rect,
      sliceKeys: [],
      intent: context.surface
        ? "terrain"
        : context.district || context.street
          ? "pattern"
          : "building",
      buildingReview: review,
    },
  };
}

function blockKind(scene: string): "residential" | "mixed" | "hotel" {
  if (scene === "residential" || scene === "mixed" || scene === "hotel") return scene;
  throw new Error("Not a building block");
}
