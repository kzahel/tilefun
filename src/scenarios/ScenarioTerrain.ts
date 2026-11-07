import type { TerrainEditor } from "../editor/TerrainEditor.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

/** Paint recipe terrain with the ordinary editor tile brush after its chunks load. */
export async function paintScenarioTerrain(
  tiles: ScenarioRecipe["terrain"],
  ready: (range: ChunkRange) => Promise<unknown>,
  editor: Pick<TerrainEditor, "applyTileEdit">,
): Promise<void> {
  if (!tiles?.length) return;
  if (
    tiles.length > 16384 ||
    tiles.some(
      (t) =>
        ![t.tx, t.ty, t.terrain].every(Number.isSafeInteger) ||
        Math.abs(t.tx) > 4096 ||
        Math.abs(t.ty) > 4096,
    )
  )
    throw Error("Invalid scenario terrain");
  const cx = tiles.map((t) => Math.floor(t.tx / 16)),
    cy = tiles.map((t) => Math.floor(t.ty / 16));
  // The brush touches neighbouring tile corners; keep a one-chunk margin ready.
  await ready({
    minCx: Math.min(...cx) - 1,
    maxCx: Math.max(...cx) + 1,
    minCy: Math.min(...cy) - 1,
    maxCy: Math.max(...cy) + 1,
  });
  for (const t of tiles) editor.applyTileEdit(t.tx, t.ty, t.terrain, "positive", 0);
}
