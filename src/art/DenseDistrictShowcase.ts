import type { GameAssets } from "../assets/GameAssets.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { PIXEL_SCALE } from "../config/constants.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { createProp } from "../entities/PropFactories.js";
import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import type { ActorPlacement } from "../generation/Generator.js";
import { createGenerator } from "../generation/Generator.js";
import { DENSE_CITY_ASSETS, denseBuilding } from "../generation/regional/DenseCityAssets.js";
import { DenseDistrictStrategy } from "../generation/regional/DenseDistrictStrategy.js";
import type { Bounds } from "../generation/regional/RegionalPlanner.js";
import { Camera } from "../rendering/Camera.js";
import { drawScene2D } from "../rendering/Canvas2DRenderer.js";
import { collectScene } from "../rendering/collectScene.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { World } from "../world/World.js";

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
export type DenseReviewCase = (typeof DENSE_REVIEW_CASES)[number];
/** These views select windows of the actual generator, never separate placements. */
export function denseReviewScene(c: DenseReviewCase) {
  const generator = createGenerator(DENSE_DEMO_GENERATION);
  if (!(generator.terrain instanceof DenseDistrictStrategy))
    throw new Error("Missing dense generator");
  const plan = generator.terrain.districts.owner(0, 0);
  if (!plan) throw new Error("Missing dense checkpoint");
  const { x, y } = plan.center;
  const bounds: Bounds =
    c.window === "whole"
      ? { minX: x - 50, minY: y - 46, maxX: x + 50, maxY: y + 46 }
      : c.window === "frontage"
        ? { minX: x - 43, minY: y - 39, maxX: x + 43, maxY: y + 5 }
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
    generation: DENSE_DEMO_GENERATION,
    plan,
    bounds,
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
    props: s.props,
    actors: s.actors,
  };
}
export function denseReviewPrefabs(s: DenseReviewScene) {
  return [
    ...new Set(s.props.filter((p) => p.type.startsWith("prop-city-dense-v1-")).map((p) => p.type)),
  ].map(denseBuilding);
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
      for (const w of p.walls ?? (p.collider ? [p.collider] : []))
        rect({
          minX: (p.position.wx + w.offsetX - w.width / 2) / 16,
          minY: (p.position.wy + w.offsetY - w.height) / 16,
          maxX: (p.position.wx + w.offsetX + w.width / 2) / 16,
          maxY: (p.position.wy + w.offsetY) / 16,
        });
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
    buildings: props.filter((p) => p.type.startsWith("prop-city-dense")).length,
  };
}
