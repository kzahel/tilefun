import { TerrainId } from "../autotile/TerrainId.js";
import type { ActorPlacement } from "../generation/Generator.js";
import type { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { faunaType } from "./Fauna.js";

/** One real mouse for an occupied natural fox cell, never from manual placement. */
export function foxPrey(
  actors: readonly ActorPlacement[],
  nature: NaturalLandscape,
  cx: number,
  cy: number,
): ActorPlacement[] {
  const a = actors
    .filter((e) => e.type === faunaType("fox"))
    .sort((a, b) => a.featureId.localeCompare(b.featureId))[0];
  if (!a) return [];
  for (const [dx = 0, dy = 0] of [
    [48, 12],
    [-48, 12],
    [0, 48],
    [0, -48],
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
    return [
      { featureId: `${a.featureId}:hunt-mouse`, type: faunaType("mouse"), wx, wy, route: [] },
    ];
  }
  return [];
}
