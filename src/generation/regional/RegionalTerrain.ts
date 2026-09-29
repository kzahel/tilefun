import { TerrainId } from "../../autotile/TerrainId.js";

/** The same supported material chain in overview and exact realization. */
export function regionalTerrainForElevation(elevation: number): TerrainId {
  if (elevation < -0.12) return TerrainId.DeepWater;
  if (elevation < 0) return TerrainId.ShallowWater;
  if (elevation < 0.025) return TerrainId.Sand;
  if (elevation < 0.055) return TerrainId.SandLight;
  return TerrainId.Grass;
}
