import type { GameAssets } from "../assets/GameAssets.js";
import { TerrainId, toBaseTerrainId } from "../autotile/TerrainId.js";
import { Camera } from "../rendering/Camera.js";
import type { GpuRenderBackend } from "../rendering/GpuRenderBackend.js";
import {
  MATERIAL_COLOURS,
  STUDY_GRAPH,
  studySample,
  type TerrainStudy,
} from "./TerrainBlendStudy.js";

/** Draw the ordinary production terrain through WebGL, at one texel per pixel. */
export function drawTerrainStudy(gpu: GpuRenderBackend, study: TerrainStudy): void {
  const camera = new Camera();
  camera.zoom = 1 / 3;
  camera.x = (study.x + study.size / 2) * 16;
  camera.y = (study.y + study.size / 2) * 16;
  camera.setViewport(study.size * 16, study.size * 16);
  const visible = {
    minCx: Math.floor(study.x / 16),
    minCy: Math.floor(study.y / 16),
    maxCx: Math.floor((study.x + study.size - 1) / 16),
    maxCy: Math.floor((study.y + study.size - 1) / 16),
  };
  gpu.clear();
  gpu.resize(camera.viewportWidth, camera.viewportHeight);
  gpu.beginFrame();
  gpu.prepareTerrain(camera, study.world, visible, {
    scope: "visible",
    rowBudget: Infinity,
    timeBudgetMs: Infinity,
  });
  gpu.submit(camera, { kind: "clear", color: "#23312b" });
  gpu.submit(camera, {
    kind: "terrain",
    draws: gpu.collectTerrain(camera, study.world, visible, { overscanPixels: 0 }),
  });
}

/** False-colour half-tile samples, before blending. No artwork inference. */
export function drawStudySamples(canvas: HTMLCanvasElement, study: TerrainStudy): void {
  canvas.width = canvas.height = study.size * 16;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Sample map unavailable");
  for (let sy = 0; sy < study.size * 2; sy++)
    for (let sx = 0; sx < study.size * 2; sx++) {
      const raw = studySample(study, study.x * 2 + sx, study.y * 2 + sy);
      ctx.fillStyle = MATERIAL_COLOURS[toBaseTerrainId(raw)];
      ctx.fillRect(sx * 8, sy * 8, 8, 8);
      if (raw !== toBaseTerrainId(raw)) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(sx * 8 + 3, sy * 8 + 3, 2, 2);
      }
    }
}

/** Source crops for an inspected stack; cumulative previews use the real base fill. */
export function drawStudyStack(
  canvas: HTMLCanvasElement,
  assets: GameAssets,
  sprites: readonly { sheetIndex: number; col: number; row: number }[],
  cumulative: boolean,
  base: TerrainId,
): void {
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Tile preview unavailable");
  ctx.imageSmoothingEnabled = false;
  if (cumulative) {
    assets.sheets.get("shallowwater")?.drawTile(ctx, 1, 0, 0, 0, 1);
    const fill = STUDY_GRAPH.getBaseFill(base);
    if (base !== TerrainId.ShallowWater && fill)
      assets.blendSheets[fill.sheetIndex]?.drawTile(ctx, fill.col, fill.row, 0, 0, 1);
  }
  for (const s of sprites) assets.blendSheets[s.sheetIndex]?.drawTile(ctx, s.col, s.row, 0, 0, 1);
}
