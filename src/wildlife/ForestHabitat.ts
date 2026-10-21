import { TerrainId } from "../autotile/TerrainId.js";
import type { ActorPlacement } from "../generation/Generator.js";
import type { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { DEER_TYPE } from "./Deer.js";
import { faunaType } from "./Fauna.js";
import { forageType, sourceType } from "./ForageResources.js";

/** Existing homes own one browse shrub or three finite real shiny pebbles per cell. */
export function forestSupplies(
  actors: readonly ActorPlacement[],
  nature: NaturalLandscape,
  cx: number,
  cy: number,
): ActorPlacement[] {
  const rows: ActorPlacement[] = [];
  for (const type of [DEER_TYPE, faunaType("raven")]) {
    const a = actors
      .filter((e) => e.type === type)
      .sort((a, b) => a.featureId.localeCompare(b.featureId))[0];
    if (!a) continue;
    const points: { wx: number; wy: number }[] = [];
    for (const [dx = 0, dy = 0] of [
      [40, 20],
      [-40, 20],
      [0, 48],
      [0, -48],
      [56, -24],
      [-56, -24],
      [56, 40],
      [-56, 40],
    ]) {
      const wx = Math.max(cx * 256 + 16, Math.min(cx * 256 + 240, a.wx + dx)),
        wy = Math.max(cy * 256 + 16, Math.min(cy * 256 + 240, a.wy + dy));
      if (
        Math.hypot(wx - a.wx, wy - a.wy) < 20 ||
        points.some((p) => Math.hypot(wx - p.wx, wy - p.wy) < 16) ||
        nature.inThicket(wx / 16, wy / 16, 1) ||
        ![-8, 8].every((x) =>
          [-8, 8].every((y) =>
            [TerrainId.Grass, TerrainId.Sand, TerrainId.SandLight].includes(
              nature.terrain((wx + x) / 16, (wy + y) / 16),
            ),
          ),
        )
      )
        continue;
      points.push({ wx, wy });
      rows.push({
        featureId: `${a.featureId}:forest:${points.length - 1}`,
        type: type === DEER_TYPE ? sourceType("browse-shrub") : forageType("shiny"),
        wx,
        wy,
        route: [],
      });
      if (points.length >= (type === DEER_TYPE ? 1 : 3)) break;
    }
  }
  return rows;
}
