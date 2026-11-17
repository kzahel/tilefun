import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { TerrainEditor } from "../editor/TerrainEditor.js";
import { RoadType } from "../road/RoadType.js";
import type { Realm } from "../server/Realm.js";
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

/** Stage authored road surfaces before the first lab frame. */
export async function paintScenarioRoads(
  roads: ScenarioRecipe["roads"],
  ready: (range: ChunkRange) => Promise<unknown>,
  realm: Pick<Realm, "world" | "saveManager">,
): Promise<void> {
  for (const area of roads ?? []) {
    if (
      !Object.values(area).every((v) => Number.isSafeInteger(v) && v % 16 === 0) ||
      area.right <= area.left ||
      area.bottom <= area.top ||
      (area.right - area.left) * (area.bottom - area.top) > 1048576
    )
      throw Error("Invalid scenario road bounds");
    await ready({
      minCx: Math.floor(area.left / CHUNK_SIZE_PX),
      maxCx: Math.floor((area.right - 1) / CHUNK_SIZE_PX),
      minCy: Math.floor(area.top / CHUNK_SIZE_PX),
      maxCy: Math.floor((area.bottom - 1) / CHUNK_SIZE_PX),
    });
    for (let y = area.top / 16; y < area.bottom / 16; y++)
      for (let x = area.left / 16; x < area.right / 16; x++) {
        const cx = Math.floor(x / 16),
          cy = Math.floor(y / 16),
          c = realm.world.getChunkIfLoaded(cx, cy);
        if (!c) throw Error("Scenario road is not ready");
        const lx = ((x % 16) + 16) % 16,
          ly = ((y % 16) + 16) % 16;
        if (!c.getRoad(lx, ly)) c.setRoad(lx, ly, RoadType.Asphalt);
        realm.saveManager?.markChunkDirty(`${cx},${cy}`);
      }
  }
}
