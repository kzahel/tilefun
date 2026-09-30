import type { Spritesheet } from "../assets/Spritesheet.js";
import { PIXEL_SCALE } from "../config/constants.js";
import { createProp } from "../entities/PropFactories.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { buildingVisualBounds } from "../generation/regional/BuildingRecipes.js";
import type { CityBuildingPrefab } from "../generation/regional/CityBuildingPrefabs.js";
import { Camera } from "../rendering/Camera.js";
import { drawScene2D } from "../rendering/Canvas2DRenderer.js";
import { collectScene } from "../rendering/collectScene.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { World } from "../world/World.js";

/** Ground is a diagnostic stage; building composition is the exact gameplay pipeline. */
export function drawBuildingShowcase(
  canvas: HTMLCanvasElement,
  placements: readonly { prefab: CityBuildingPrefab; wx: number; wy: number }[],
  sheet: Spritesheet,
  geometry: boolean,
) {
  const bounds = placements.map((p) => ({ ...buildingVisualBounds(p.prefab), wx: p.wx, wy: p.wy }));
  const minX = Math.min(...bounds.map((p) => p.wx + p.minX)) - 24;
  const maxX = Math.max(...bounds.map((p) => p.wx + p.maxX)) + 24;
  const minY = Math.min(...bounds.map((p) => p.wy + p.minY)) - 24;
  const maxY = 64;
  canvas.width = (maxX - minX) * 2;
  canvas.height = (maxY - minY) * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Missing building canvas");
  // Resizing resets context state. Match gameplay's nearest-neighbor sampling
  // so transparent atlas gutters cannot bleed into adjoining facade pieces.
  ctx.imageSmoothingEnabled = false;
  const camera = new Camera();
  camera.setViewport(canvas.width, canvas.height);
  camera.zoom = 2 / PIXEL_SCALE;
  camera.snapTo((minX + maxX) / 2, (minY + maxY) / 2);
  ctx.fillStyle = "#20302a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const baseline = camera.worldToScreen(0, 0).sy;
  ctx.fillStyle = "#83958c";
  ctx.fillRect(0, baseline, canvas.width, 64);
  ctx.fillStyle = "#394341";
  ctx.fillRect(0, baseline + 64, canvas.width, 64);
  ctx.fillStyle = "#d3cba7";
  ctx.fillRect(0, baseline + 100, canvas.width, 3);
  const props = placements.map((p, i) => ({ ...createProp(p.prefab.type, p.wx, p.wy), id: i + 1 }));
  const world = new World(new FlatStrategy());
  const items = collectScene(
    [],
    props,
    world,
    camera,
    camera.getVisibleChunkRange(),
    1,
    new TileRenderer(),
    [],
    false,
  );
  drawScene2D(ctx, camera, items, new Map([["me-complete", sheet]]), undefined);
  if (geometry)
    for (const p of placements) {
      const topLeft = camera.worldToScreen(
        p.wx - p.prefab.width / 2,
        p.wy - p.prefab.groundDepth / 2,
      );
      ctx.strokeStyle = "#8befb5";
      ctx.lineWidth = 2;
      ctx.strokeRect(topLeft.sx, topLeft.sy, p.prefab.width * 2, p.prefab.groundDepth * 2);
      const entry = camera.worldToScreen(p.wx + p.prefab.entrance.dx, p.wy + p.prefab.entrance.dy);
      ctx.fillStyle = "#ffdb7c";
      ctx.beginPath();
      ctx.arc(entry.sx, entry.sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  return { width: maxX - minX, height: maxY - minY, parts: items.length };
}
