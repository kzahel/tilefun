import { TerrainId } from "../autotile/TerrainId.js";
import type { ActorPlacement } from "../generation/Generator.js";
import type { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { faunaType } from "./Fauna.js";
import { forageType, sourceType } from "./ForageResources.js";

/** At most one real grass/dust patch per occupied species and owning cell. */
export function herdSupplies(
  actors: readonly ActorPlacement[],
  nature: NaturalLandscape,
  cx: number,
  cy: number,
): ActorPlacement[] {
  const rows: ActorPlacement[] = [];
  for (const species of ["cow", "donkey"] as const) {
    const a = actors.find((e) => e.type === faunaType(species));
    if (!a) continue;
    for (const [dx = 0, dy = 0] of [
      [40, 20],
      [-40, 20],
      [0, 48],
      [0, -48],
      [56, -24],
      [-56, -24],
    ]) {
      const wx = Math.max(cx * 256 + 16, Math.min(cx * 256 + 240, a.wx + dx)),
        wy = Math.max(cy * 256 + 16, Math.min(cy * 256 + 240, a.wy + dy));
      if (
        Math.hypot(wx - a.wx, wy - a.wy) < 20 ||
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
      rows.push({
        featureId: `${a.featureId}:herd:${species}`,
        type: species === "cow" ? sourceType("growing-plant") : forageType("dust"),
        wx,
        wy,
        route: [],
      });
      break;
    }
  }
  return rows;
}
