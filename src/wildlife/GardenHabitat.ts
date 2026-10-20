import { TerrainId } from "../autotile/TerrainId.js";
import type { ActorPlacement } from "../generation/Generator.js";
import type { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { faunaType } from "./Fauna.js";
import { sourceType } from "./ForageResources.js";

/** One bounded shared supply set per occupied species/cell; no RNG or animal edits. */
export function gardenSupplies(
  actors: readonly ActorPlacement[],
  nature: NaturalLandscape,
  cx: number,
  cy: number,
): ActorPlacement[] {
  const result: ActorPlacement[] = [];
  for (const species of ["chicken", "bee", "ruby-throated-hummingbird"] as const) {
    const a = actors.find((e) => e.type === faunaType(species));
    if (!a) continue;
    const sites: { wx: number; wy: number }[] = [];
    for (const [dx, dy] of [
      [24, 12],
      [-24, 12],
      [0, -28],
      [40, -12],
      [-40, -12],
      [0, 36],
    ]) {
      const wx = Math.max(cx * 256 + 12, Math.min(cx * 256 + 244, a.wx + (dx ?? 0))),
        wy = Math.max(cy * 256 + 12, Math.min(cy * 256 + 244, a.wy + (dy ?? 0)));
      if (
        sites.some((p) => Math.hypot(p.wx - wx, p.wy - wy) < 16) ||
        nature.inThicket(wx / 16, wy / 16, 1) ||
        ![TerrainId.Grass, TerrainId.Sand, TerrainId.SandLight].includes(
          nature.terrain(wx / 16, wy / 16),
        )
      )
        continue;
      sites.push({ wx, wy });
      if (sites.length >= (species === "chicken" ? 1 : 3)) break;
    }
    for (const [i, p] of sites.entries())
      result.push({
        featureId: `${a.featureId}:garden:${i}`,
        type: sourceType(
          species === "chicken" ? "scratch-patch" : i === 2 ? "growing-plant" : "nectar-flower",
        ),
        ...p,
        route: [],
      });
  }
  return result;
}
