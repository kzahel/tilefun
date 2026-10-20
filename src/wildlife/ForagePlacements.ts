import { TerrainId } from "../autotile/TerrainId.js";
import type { ActorPlacement } from "../generation/Generator.js";
import type { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { faunaType } from "./Fauna.js";
import { forageType } from "./ForageResources.js";

/** Natural crow homes are clearings: give each crow an ordinary supported tree. */
export function crowNestTrees(nature: NaturalLandscape, cx: number, cy: number) {
  const rows = [];
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (nature.faunaHome(Math.floor(x / 4), Math.floor(y / 4), true)?.species !== "crow")
        continue;
      for (const actor of nature.wildlife(x, y)) {
        if (actor.type !== faunaType("crow")) continue;
        const wx = actor.wx,
          wy = actor.wy - 52;
        // Include overlapping canopies on both sides of chunk boundaries.
        if (
          wx + 48 < cx * 256 ||
          wx - 48 >= (cx + 1) * 256 ||
          wy + 16 < cy * 256 ||
          wy - 96 >= (cy + 1) * 256
        )
          continue;
        rows.push({ featureId: `${actor.featureId}:nest-tree`, propType: "prop-oak-tree", wx, wy });
      }
    }
  return rows;
}

/** Stable finite litter at natural crow/squirrel homes, owned by its original cell. */
export function foragePlacements(
  actors: readonly ActorPlacement[],
  nature: NaturalLandscape,
  cx: number,
  cy: number,
): ActorPlacement[] {
  const result: ActorPlacement[] = [];
  for (const actor of actors) {
    const crow = actor.type === faunaType("crow"),
      squirrel = actor.type === faunaType("red-squirrel");
    if (!crow && !squirrel) continue;
    for (const [index, offset] of [
      [-24, 24],
      [24, 24],
      [-40, 48],
      [40, 48],
      [0, 56],
      [0, -40],
    ].entries()) {
      const wx = Math.max(cx * 256 + 12, Math.min(cx * 256 + 244, actor.wx + (offset[0] ?? 0)));
      const wy = Math.max(cy * 256 + 12, Math.min(cy * 256 + 244, actor.wy + (offset[1] ?? 0)));
      if (
        ![-4, 4].every((x) =>
          [-4, 4].every((y) =>
            [TerrainId.Grass, TerrainId.Sand, TerrainId.SandLight].includes(
              nature.terrain((wx + x) / 16, (wy + y) / 16),
            ),
          ),
        ) ||
        nature.inThicket(wx / 16, wy / 16, 1)
      )
        continue;
      result.push({
        featureId: `${actor.featureId}:forage:${index}`,
        type: forageType(crow ? "twig" : index % 2 ? "fruit" : "nut"),
        wx,
        wy,
        route: [],
      });
    }
  }
  return result;
}
