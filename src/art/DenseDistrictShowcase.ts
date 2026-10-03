import type { GameAssets } from "../assets/GameAssets.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { PIXEL_SCALE } from "../config/constants.js";
import { getEntityAABB } from "../entities/collision.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { createProp } from "../entities/PropFactories.js";
import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import type { ActorPlacement } from "../generation/Generator.js";
import { createGenerator } from "../generation/Generator.js";
import { buildingRecipe } from "../generation/regional/BuildingRecipes.js";
import { CITY_ARCHITECTURE_ASSETS } from "../generation/regional/CityArchitectureAssets.js";
import type { CityPlacesPlan } from "../generation/regional/CityPlacesPlanner.js";
import {
  COMMERCIAL_CITY_ASSETS,
  COMMERCIAL_SURFACE_CELLS,
} from "../generation/regional/CommercialCityAssets.js";
import type { CommercialDistrictPlan } from "../generation/regional/CommercialDistrictPlanner.js";
import { DENSE_CITY_ASSETS } from "../generation/regional/DenseCityAssets.js";
import { DenseDistrictStrategy } from "../generation/regional/DenseDistrictStrategy.js";
import type { Bounds } from "../generation/regional/RegionalPlanner.js";
import { Camera } from "../rendering/Camera.js";
import { drawScene2D } from "../rendering/Canvas2DRenderer.js";
import { collectScene } from "../rendering/collectScene.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { World } from "../world/World.js";
import type { ArtRect } from "./ArtCatalog.js";

export const DENSE_DEMO_GENERATION: GenerationDescriptor = {
  type: "regional",
  version: "regional-v5",
  seed: 2026,
  preset: "temperate-v1",
};
export const DENSE_REVIEW_CASES = [
  {
    id: "district-v1-neighborhood",
    name: "Two-by-two neighborhood",
    prompt: "Review the overall density, building scale, connected streets and pocket green.",
    window: "whole",
  },
  {
    id: "district-v1-frontage",
    name: "Apartments, shops & crossing",
    prompt: "Review how the south-facing frontages meet the sidewalk and central intersection.",
    window: "frontage",
  },
  {
    id: "district-v1-green",
    name: "Hotel block & pocket green",
    prompt: "Review the hotel scale, park edge and clear walking routes around the green.",
    window: "green",
  },
] as const;
export const COMMERCIAL_DEMO_GENERATION: GenerationDescriptor = {
  ...DENSE_DEMO_GENERATION,
  version: "regional-v6",
};
export const COMMERCIAL_REVIEW_CASES = [
  {
    id: "district-v2-commercial",
    name: "Commercial neighborhood",
    prompt:
      "Review the wider avenue, commercial frontage, refuge crossing and furnished parking bays together.",
    window: "whole",
    generation: COMMERCIAL_DEMO_GENERATION,
  },
  {
    id: "district-v2-frontage",
    name: "Shops & furnished sidewalk",
    prompt:
      "Check shop approaches, a clear walking strip behind the meters and seating, and the shorter east crossing.",
    window: "commercial",
    generation: COMMERCIAL_DEMO_GENERATION,
  },
  {
    id: "district-v2-refuge",
    name: "Avenue & refuge crossing",
    prompt:
      "Check the rounded intersection, capped island and open pedestrian landing. The game runs the same crossing route.",
    window: "refuge",
    generation: COMMERCIAL_DEMO_GENERATION,
  },
  {
    id: "district-v2-parking",
    name: "Parked cars & curb bays",
    prompt:
      "Check native car scale and facing, marked occupied/empty bays, meters, curb extensions and sidewalk clearance.",
    window: "parking",
    generation: COMMERCIAL_DEMO_GENERATION,
  },
] as const;
export const PARKING_DEMO_GENERATION: GenerationDescriptor = {
  ...DENSE_DEMO_GENERATION,
  version: "regional-v7",
};
export const PUBLIC_DEMO_GENERATION: GenerationDescriptor = {
  ...DENSE_DEMO_GENERATION,
  version: "regional-v8",
};
export const ARCHITECTURE_DEMO_GENERATION: GenerationDescriptor = {
  ...DENSE_DEMO_GENERATION,
  version: "regional-v9",
};
export const PEDESTRIAN_DEMO_GENERATION: GenerationDescriptor = {
  ...DENSE_DEMO_GENERATION,
  version: "regional-v10",
};
export const CITY_PLACES_REVIEW_CASES = [
  {
    id: "district-v10-destinations",
    name: "People between city places",
    prompt:
      "Review the busier neighborhood. People show initial poses here; Explore / Play here runs twelve people, including eight trips between doors and public seating.",
    window: "whole",
    generation: PEDESTRIAN_DEMO_GENERATION,
    run: "pedestrians",
  },
  {
    id: "district-v10-park-visitors",
    arrival: [-23, 21],
    name: "Homes, refuge & park visitors",
    prompt:
      "Play here to watch home-to-park trips across the admitted refuge crossing, with pauses at seating. Geometry shows the reserved seating approaches and routes.",
    window: "place",
    crop: [-42, -15, -3, 43],
    generation: PEDESTRIAN_DEMO_GENERATION,
    run: "pedestrians",
  },
  {
    id: "district-v10-square-visitors",
    arrival: [22, 21],
    name: "Shops, square & seating",
    prompt:
      "Play here to watch shop-to-square trips across the short east crossing, with destination pauses. The square keeps clear circulation and an open future-market reserve.",
    window: "place",
    crop: [3, -16, 43, 43],
    generation: PEDESTRIAN_DEMO_GENERATION,
    run: "pedestrians",
  },
  {
    id: "district-v9-architecture",
    name: "Residential & commercial neighborhood",
    prompt:
      "Review the wide apartment frontage and office/services building beside the park and public square.",
    window: "whole",
    generation: ARCHITECTURE_DEMO_GENERATION,
    run: "architecture",
  },
  {
    id: "district-v9-residential",
    name: "Wide residential frontage",
    prompt:
      "Check native bay/infill/entrance joins, closed roof edges and the paved approaches to both apartment doors.",
    window: "place",
    crop: [-43, -41, -2, 3],
    generation: ARCHITECTURE_DEMO_GENERATION,
    run: "architecture",
  },
  {
    id: "district-v9-office",
    name: "Office, services & shops",
    prompt:
      "Check the native office/services lobby, roof/floor closure and contrasting shop heights. All doors connect to the shared sidewalk.",
    window: "place",
    crop: [2, -40, 43, 3],
    generation: ARCHITECTURE_DEMO_GENERATION,
    run: "architecture",
  },
  {
    id: "district-v8-public-block",
    name: "Public spaces neighborhood",
    prompt:
      "Compare three public spaces beside housing and shops. All paths and furniture are actual generated placements.",
    window: "whole",
    generation: PUBLIC_DEMO_GENERATION,
    run: "parks",
  },
  {
    id: "district-v8-pocket",
    name: "Pocket park beside apartments",
    prompt: "Review the compact planted park, seating and paths beside the apartment frontage.",
    window: "place",
    crop: [-42, -38, -4, 1],
    generation: PUBLIC_DEMO_GENERATION,
    run: "parks",
  },
  {
    id: "district-v8-park",
    name: "Neighborhood park & play area",
    prompt:
      "Review connected loop paths, open lawn, tree shade, seating and the play area. Paths must leave space for people.",
    window: "place",
    crop: [-42, 2, -3, 43],
    generation: PUBLIC_DEMO_GENERATION,
    run: "parks",
  },
  {
    id: "district-v8-square",
    name: "Public square & market reserve",
    prompt:
      "Review perimeter seating, a clear through route and the open center reserved for a future market.",
    window: "place",
    crop: [3, 2, 43, 43],
    generation: PUBLIC_DEMO_GENERATION,
    run: "parks",
  },
  {
    id: "district-v7-parking-block",
    name: "Shops beside a parking lot",
    prompt:
      "Review the parking lot in the actual commercial neighborhood, with planted edges and a separate walking entrance.",
    window: "whole",
    generation: PARKING_DEMO_GENERATION,
    run: "parking",
  },
  {
    id: "district-v7-parking-lot",
    name: "Marked lot & planted edge",
    prompt:
      "Check native parking spaces, occupied and empty bays, car scale and the south pedestrian path.",
    window: "place",
    crop: [-40, 6, -3, 39],
    generation: PARKING_DEMO_GENERATION,
    run: "parking",
  },
  {
    id: "district-v7-parking-access",
    name: "Driving entrance & pedestrian access",
    prompt:
      "Check the six-tile driving entrance and separate three-tile walking connection to the street sidewalk. Geometry shows both reservations.",
    window: "place",
    crop: [-27, 14, 5, 41],
    generation: PARKING_DEMO_GENERATION,
    run: "parking",
  },
] as const;
export const ALL_DENSE_REVIEW_CASES = [
  ...DENSE_REVIEW_CASES,
  ...COMMERCIAL_REVIEW_CASES,
  ...CITY_PLACES_REVIEW_CASES,
];
export type DenseReviewCase = (typeof ALL_DENSE_REVIEW_CASES)[number];
export const denseReviewRun = (c: DenseReviewCase) =>
  "run" in c ? c.run : "generation" in c ? "commercial" : "districts";
/** These views select windows of the actual generator, never separate placements. */
export function denseReviewScene(c: DenseReviewCase) {
  const generation = "generation" in c ? c.generation : DENSE_DEMO_GENERATION;
  const generator = createGenerator(generation);
  if (!(generator.terrain instanceof DenseDistrictStrategy))
    throw new Error("Missing dense generator");
  const plan = generator.terrain.districts.owner(0, 0);
  if (!plan) throw new Error("Missing dense checkpoint");
  const { x, y } = plan.center;
  const bounds: Bounds =
    "crop" in c
      ? { minX: x + c.crop[0], minY: y + c.crop[1], maxX: x + c.crop[2], maxY: y + c.crop[3] }
      : c.window === "whole"
        ? { minX: x - 50, minY: y - 46, maxX: x + 50, maxY: y + 46 }
        : c.window === "frontage"
          ? { minX: x - 43, minY: y - 39, maxX: x + 43, maxY: y + 5 }
          : c.window === "commercial"
            ? { minX: x + 4, minY: y - 34, maxX: x + 44, maxY: y + 12 }
            : c.window === "refuge"
              ? { minX: x - 40, minY: y - 18, maxX: x - 4, maxY: y + 18 }
              : c.window === "parking"
                ? { minX: x + 7, minY: y - 16, maxX: x + 40, maxY: y + 8 }
                : { minX: x - 43, minY: y - 7, maxX: x + 43, maxY: y + 44 };
  const props = new Map<string, ReturnType<typeof createProp>>(),
    actors = new Map<string, ActorPlacement>();
  for (let cy = Math.floor(bounds.minY / 16); cy <= Math.floor(bounds.maxY / 16); cy++)
    for (let cx = Math.floor(bounds.minX / 16); cx <= Math.floor(bounds.maxX / 16); cx++) {
      for (const p of generator.placements(cx, cy, new Set()).placements) {
        if (!p.featureId) throw new Error("Missing feature ID");
        const prop = createProp(p.propType, p.wx, p.wy);
        prop.proceduralId = p.featureId;
        props.set(p.featureId, prop);
      }
      for (const a of generator.actors?.(cx, cy) ?? []) actors.set(a.featureId, a);
    }
  return {
    definition: c,
    generation,
    plan,
    bounds,
    arrival: "arrival" in c ? { x: x + c.arrival[0], y: y + c.arrival[1] } : { x, y },
    props: [...props.values()],
    actors: [...actors.values()],
  };
}
export type DenseReviewScene = ReturnType<typeof denseReviewScene>;
export function denseReviewComposition(s: DenseReviewScene) {
  return {
    generation: s.generation,
    view: s.definition,
    bounds: s.bounds,
    plan: s.plan,
    assets: DENSE_CITY_ASSETS,
    ...(s.generation.version === "regional-v6" || s.plan.recipe.startsWith("city-places-")
      ? { commercialAssets: COMMERCIAL_CITY_ASSETS }
      : {}),
    ...(s.plan.recipe === "city-places-v9" || s.plan.recipe === "city-places-v10"
      ? { architectureAssets: CITY_ARCHITECTURE_ASSETS }
      : {}),
    props: s.props,
    actors: s.actors,
  };
}
export function denseReviewPrefabs(s: DenseReviewScene) {
  return [
    ...new Set(
      s.props
        .filter(
          (p) =>
            p.type.startsWith("prop-city-dense-v1-") ||
            p.type.startsWith("prop-city-architecture-v1-"),
        )
        .map((p) => p.type),
    ),
  ].map((type) => {
    const recipe = buildingRecipe(type);
    if (!recipe) throw new Error(`Missing review building ${type}`);
    return recipe;
  });
}
export function denseReviewSourceRects(s: DenseReviewScene): ArtRect[] {
  const rects: ArtRect[] = denseReviewPrefabs(s).flatMap((p) =>
    p.parts.map(
      (p) => [p.frameCol * 16, p.frameRow * 16, p.spriteWidth, p.spriteHeight] as ArtRect,
    ),
  );
  if (s.generation.version === "regional-v6" || s.plan.recipe.startsWith("city-places-")) {
    rects.push(
      ...COMMERCIAL_SURFACE_CELLS.flatMap((cell) => cell.map((p) => [...p.rect] as ArtRect)),
    );
    for (const p of s.props.filter((p) => p.sprite.sheetKey === "me-complete" && !p.sprite.parts))
      rects.push([
        p.sprite.frameCol * 16,
        p.sprite.frameRow * 16,
        p.sprite.spriteWidth,
        p.sprite.spriteHeight,
      ]);
  }
  return rects;
}

/** Real chunks, game autotiling, game cached terrain renderer and normal entity
 * factories. Actors are initial poses; gameplay runs the same planned routes.
 */
export function drawDenseDistrictShowcase(
  canvas: HTMLCanvasElement,
  s: DenseReviewScene,
  assets: GameAssets,
  geometry: boolean,
) {
  const b = s.bounds,
    width = (b.maxX - b.minX) * 16,
    height = (b.maxY - b.minY) * 16;
  canvas.width = width;
  canvas.height = height;
  // Approval hashes must use the same raster path in normal GPU-backed
  // browsers and headless builds (chunk overscan and ellipse edge rounding).
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Missing district canvas");
  ctx.imageSmoothingEnabled = false;
  const generator = createGenerator(s.generation),
    world = new World(generator.terrain),
    graph = new BlendGraph();
  const camera = new Camera();
  camera.setViewport(width, height);
  camera.zoom = 1 / PIXEL_SCALE;
  camera.snapTo((b.minX + b.maxX) * 8, (b.minY + b.maxY) * 8);
  const range = camera.getVisibleChunkRange();
  // ChunkManager already adds the one-chunk render halo. Passing an expanded
  // range here would load a second halo and exceed the 81-chunk preview budget.
  world.updateLoadedChunks(range);
  world.computeAutotile(graph);
  const renderer = new TileRenderer();
  renderer.setBlendSheets(assets.blendSheets, graph);
  renderer.setVariants(assets.variants);
  renderer.setRoadSheets(assets.sheets);
  renderer.drawTerrain(ctx, camera, world, assets.sheets, range, false, 4096, 0);
  const props = s.props.map((p, i) => ({ ...p, id: i + 1 })),
    entities = s.actors.map((a, i) => {
      const factory = ENTITY_FACTORIES[a.type];
      if (!factory) throw new Error(a.type);
      return { ...factory(a.wx, a.wy), id: 10000 + i };
    });
  drawScene2D(
    ctx,
    camera,
    collectScene(entities, props, world, camera, range, 1, renderer, [], false),
    assets.sheets,
    undefined,
    true,
    renderer,
  );
  if (geometry) {
    ctx.lineWidth = 1;
    const rect = (r: Bounds) => {
      const p = camera.worldToScreen(r.minX * 16, r.minY * 16);
      ctx.strokeRect(p.sx, p.sy, (r.maxX - r.minX) * 16, (r.maxY - r.minY) * 16);
    };
    ctx.strokeStyle = "#eac469";
    for (const block of s.plan.blocks)
      for (const lot of block.lots) {
        rect(lot.bounds);
        const p = camera.worldToScreen(lot.entrance.x * 16, lot.entrance.y * 16);
        ctx.strokeRect(p.sx - 8, p.sy - 8, 16, 16);
      }
    ctx.strokeStyle = "#ff8282";
    for (const p of props)
      for (const w of p.walls ?? (p.collider ? [p.collider] : [])) {
        const bounds = getEntityAABB(p.position, w);
        rect({
          minX: bounds.left / 16,
          minY: bounds.top / 16,
          maxX: bounds.right / 16,
          maxY: bounds.bottom / 16,
        });
      }
    if (s.plan.recipe === "commercial-district-v1") {
      const facts = (s.plan as CommercialDistrictPlan).commercial;
      ctx.strokeStyle = "#68dfff";
      for (const p of facts.parking) rect(p.bounds);
      ctx.strokeStyle = "#77f6ba";
      for (const b of facts.walkways) rect(b);
      ctx.strokeStyle = "#bf8aff";
      for (const c of facts.crossings) {
        rect(c.bounds);
        if (c.landing) rect(c.landing);
      }
    }
    if ("places" in s.plan)
      for (const place of (s.plan as CityPlacesPlan).places) {
        ctx.strokeStyle = "#68dfff";
        rect(place.bounds);
        for (const bay of place.bays) rect(bay.bounds);
        ctx.strokeStyle = "#77f6ba";
        for (const path of place.paths) rect(path);
        ctx.strokeStyle = "#efb770";
        for (const lane of place.driving) rect(lane);
      }
    if ("walkGraph" in s.plan)
      for (const node of (s.plan as CityPlacesPlan).walkGraph?.nodes ?? []) {
        if (!node.destination) continue;
        const at = camera.worldToScreen(node.wx, node.wy);
        ctx.fillStyle = "#68dfff";
        ctx.fillRect(at.sx - 2, at.sy - 2, 4, 4);
      }
    ctx.strokeStyle = "#77f6ba";
    for (const a of s.actors) {
      ctx.beginPath();
      for (const [i, v] of a.route.entries()) {
        const p = camera.worldToScreen(v.wx, v.wy);
        if (i) ctx.lineTo(p.sx, p.sy);
        else ctx.moveTo(p.sx, p.sy);
      }
      if (a.route.length > 2) ctx.closePath();
      ctx.stroke();
    }
  }
  return {
    chunks: world.chunks.loadedCount,
    width,
    height,
    parts: props.reduce((n, p) => n + (p.sprite.parts?.length ?? 1), 0),
    buildings: props.filter(
      (p) => p.type.startsWith("prop-city-dense") || p.type.startsWith("prop-city-architecture"),
    ).length,
  };
}
