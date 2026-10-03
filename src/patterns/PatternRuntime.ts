import type { GameAssets } from "../assets/GameAssets.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { TerrainEditor } from "../editor/TerrainEditor.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { buildLayeredApartmentPlan } from "../interiors/ApartmentArchitecture.js";
import { parseFloorPlan } from "../interiors/ApartmentFloorPlan.js";
import { Camera } from "../rendering/Camera.js";
import { drawLayeredInteriorMap } from "../rendering/CanvasInteriorMap.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import { World } from "../world/World.js";
import { compileTreeRun, treeRuns } from "./FencedTrees.js";
import { familyDefinition, type PatternDocument, roomSketch } from "./PatternDocument.js";

/** Uses the real World/TerrainEditor/TileRenderer stack, including adjacency bridges. */
export function patternWorld(doc: PatternDocument): World {
  const world = new World(new FlatStrategy()),
    graph = new BlendGraph();
  for (let cy = -1; cy <= Math.floor(doc.height / 16) + 1; cy++)
    for (let cx = -1; cx <= Math.floor(doc.width / 16) + 1; cx++) world.getChunk(cx, cy);
  const editor = new TerrainEditor(world, () => {}, new TerrainAdjacency(graph));
  for (const cell of doc.cells) {
    if (doc.family === "terrain-v1")
      editor.applyTileEdit(cell.x, cell.y, Number(cell.value), "positive", 2);
    else if (doc.family === "city-surfaces-v1")
      editor.applyRoadEdit(cell.x, cell.y, Number(cell.value), "positive");
  }
  world.computeAutotile(graph);
  return world;
}
export function renderPatternDocument(
  canvas: HTMLCanvasElement,
  doc: PatternDocument,
  assets: GameAssets,
  roomAtlas: CanvasImageSource,
  geometry = false,
): void {
  const grid = familyDefinition(doc.family).gridSize;
  canvas.width = doc.width * grid;
  canvas.height = doc.height * grid;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Missing pattern canvas");
  ctx.fillStyle = "#23312b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  if (doc.family === "rooms-v1") {
    const map = buildLayeredApartmentPlan(
      parseFloorPlan(roomSketch(doc), { preserveBounds: true, allowUnreachable: true }),
    );
    drawLayeredInteriorMap(ctx, roomAtlas, map);
  } else {
    const world = patternWorld(doc),
      graph = new BlendGraph(),
      renderer = new TileRenderer(),
      camera = new Camera();
    renderer.setBlendSheets(assets.blendSheets, graph);
    renderer.setVariants(assets.variants);
    renderer.setRoadSheets(assets.sheets);
    camera.zoom = 1 / 3;
    camera.x = canvas.width / 2;
    camera.y = canvas.height / 2;
    camera.setViewport(canvas.width, canvas.height);
    renderer.drawTerrain(
      ctx,
      camera,
      world,
      assets.sheets,
      {
        minCx: 0,
        minCy: 0,
        maxCx: Math.floor((doc.width - 1) / 16),
        maxCy: Math.floor((doc.height - 1) / 16),
      },
      false,
      Infinity,
      0,
    );
    if (doc.family === "fenced-trees-v1") {
      const sheet = assets.sheets.get("me-complete");
      if (!sheet) throw new Error("Missing exterior sheet");
      for (const run of treeRuns(doc.cells))
        for (const p of compileTreeRun(run.length))
          ctx.drawImage(
            sheet.image,
            p.frameCol * 16,
            p.frameRow * 16,
            p.spriteWidth,
            p.spriteHeight,
            run.x * 16 + run.length * 8 + p.dx - p.spriteWidth / 2,
            (run.y + 1) * 16 - p.spriteHeight,
            p.spriteWidth,
            p.spriteHeight,
          );
    }
  }
  if (geometry) {
    ctx.strokeStyle = "#ffbf66";
    ctx.lineWidth = 1;
    if (doc.family === "fenced-trees-v1")
      for (const run of treeRuns(doc.cells)) {
        ctx.strokeRect(run.x * 16 + 0.5, run.y * 16 + 0.5, run.length * 16 - 1, 15);
        ctx.fillStyle = "#ffbf6690";
        ctx.fillRect(run.x * 16, (run.y + 1) * 16 - 8, run.length * 16, 8);
      }
    else if (doc.family === "rooms-v1")
      for (const c of doc.cells)
        if (c.value === "#") ctx.strokeRect(c.x * 32 + 0.5, c.y * 32 + 0.5, 31, 31);
        else for (const c of doc.cells) ctx.strokeRect(c.x * 16 + 0.5, c.y * 16 + 0.5, 15, 15);
  }
}
