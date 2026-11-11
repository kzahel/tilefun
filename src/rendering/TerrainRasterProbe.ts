import { Spritesheet } from "../assets/Spritesheet.js";
import { TileVariants } from "../assets/TileVariants.js";
import { BlendGraph, MAX_BLEND_LAYERS } from "../autotile/BlendGraph.js";
import { TerrainId } from "../autotile/TerrainId.js";
import { RoadType } from "../road/RoadType.js";
import { required } from "../shared/required.js";
import { Chunk } from "../world/Chunk.js";
import { getTileDef, registerDefaultTiles, TileId } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { TileRenderer } from "./TileRenderer.js";

/** Browser-only byte oracle: identical production row painting, with completion
 * reads enabled vs suppressed. Native reads of the full result bypass the shim.
 * No alternative renderer or retained shipping switch. */
function runCompletion(complete: boolean) {
  const native = OffscreenCanvasRenderingContext2D.prototype.getImageData;
  const unused = new ImageData(1, 1);
  let rows = 0;
  OffscreenCanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h, settings) {
    if (
      this.canvas.width === 256 &&
      this.canvas.height === 256 &&
      x === 0 &&
      w === 256 &&
      h === 16
    ) {
      rows++;
      if (!complete) return unused;
    }
    return native.call(this, x, y, w, h, settings);
  };
  const renderer = new TileRenderer(() => 0);
  try {
    const { world, chunk, sheets, camera, visible } = terrainFixture(renderer);
    const snapshots: Uint8ClampedArray[] = [];
    for (const [index, budget] of [3, 13, 5, 11].entries()) {
      if (index === 2) {
        chunk.setDetail(2, 3, TileId.Empty);
        chunk.setRoad(7, 7, RoadType.Sidewalk);
        chunk.blendBase[0] = TerrainId.DeepWater;
        chunk.invalidateVisuals();
      }
      renderer.prepareTerrain(camera, world, sheets, visible, Infinity, budget);
      const id = required(renderer.groundResourceId(chunk, -1, 0, false));
      const canvas = required(renderer.resolveTerrainResource(id));
      snapshots.push(native.call(required(canvas.getContext("2d")), 0, 0, 256, 256).data);
    }
    return { snapshots, rows };
  } finally {
    renderer.clear();
    OffscreenCanvasRenderingContext2D.prototype.getImageData = native;
  }
}

function paintedSheet() {
  const image = new OffscreenCanvas(512, 512);
  const paint = required(image.getContext("2d"));
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      paint.fillStyle = `rgba(${x * 7},${y * 7},${(x + y) * 3},0.7)`;
      paint.fillRect(x * 16, y * 16, 16, 16);
      paint.clearRect(x * 16 + 2, y * 16 + 3, 3, 2);
    }
  return new Spritesheet(image, 16, 16);
}

function terrainFixture(renderer: TileRenderer) {
  const sheet = paintedSheet(),
    detail = required(getTileDef(TileId.FlowerRed));
  const sheets = new Map(
    ["shallowwater", "me21", "me25", "me26", detail.sheetKey].map((key) => [key, sheet]),
  );
  const graph = new BlendGraph();
  renderer.setBlendSheets(
    graph.allSheets.map(() => sheet),
    graph,
  );
  renderer.setVariants(new TileVariants(sheet));
  renderer.setRoadSheets(sheets);
  const world = new World(),
    chunk = new Chunk();
  world.chunks.put(-1, 0, chunk);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      chunk.blendBase[y * 16 + x] = (x + y) % 2 ? TerrainId.Grass : TerrainId.Sand;
      if (x % 3 === 0) chunk.blendLayers[(y * 16 + x) * MAX_BLEND_LAYERS] = 257;
      if (x === 7 || x === 8) chunk.setRoad(x, y, x === 7 ? RoadType.LineWhite : RoadType.Sidewalk);
      if ((x + y) % 5 === 0) chunk.setDetail(x, y, TileId.FlowerRed);
    }
  const camera = new Camera();
  camera.snapTo(-128, 128);
  return { world, chunk, sheets, camera, visible: { minCx: -1, maxCx: -1, minCy: 0, maxCy: 0 } };
}

export function probeTerrainRasterCompletion() {
  if (!getTileDef(TileId.FlowerRed)) registerDefaultTiles();
  const expected = runCompletion(false),
    actual = runCompletion(true);
  return {
    completedRows: actual.rows,
    mismatches: actual.snapshots.map((pixels, i) =>
      pixels.reduce((n, v, j) => n + Number(v !== expected.snapshots[i]?.[j]), 0),
    ),
    digests: actual.snapshots.map((pixels) => {
      let hash = 2166136261;
      for (const v of pixels) hash = Math.imul(hash ^ v, 16777619);
      return hash >>> 0;
    }),
    coloredBytes: actual.snapshots.map((pixels) => pixels.filter((v) => v !== 0).length),
  };
}
