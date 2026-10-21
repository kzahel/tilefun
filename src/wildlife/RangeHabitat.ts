import { TerrainId } from "../autotile/TerrainId.js";
import type { ActorPlacement } from "../generation/Generator.js";
import type { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { faunaType } from "./Fauna.js";
import { forageType, sourceType } from "./ForageResources.js";

function sites(a: ActorPlacement, nature: NaturalLandscape, cx: number, cy: number, tree: boolean) {
  const points: { wx: number; wy: number }[] = [];
  const offsets = tree
    ? [
        [80, 0],
        [-80, 0],
        [0, -80],
        [0, 80],
      ]
    : [
        [32, 16],
        [-32, 16],
        [0, 40],
        [40, -28],
        [-40, -28],
        [0, -40],
        [56, 40],
        [-56, 40],
        [56, -40],
        [-56, -40],
        [0, 64],
        [0, -64],
      ];
  for (const [dx = 0, dy = 0] of offsets) {
    const wx = Math.max(cx * 256 + 16, Math.min(cx * 256 + 240, a.wx + dx)),
      wy = Math.max(cy * 256 + 16, Math.min(cy * 256 + 240, a.wy + dy));
    if (
      (tree && Math.hypot(wx - a.wx, wy - a.wy) < 64) ||
      points.some((p) => Math.hypot(p.wx - wx, p.wy - wy) < 20) ||
      nature.inThicket(wx / 16, wy / 16, tree ? 2 : 1) ||
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
    if (points.length >= (tree ? 1 : a.type === faunaType("horse") ? 2 : 3)) break;
  }
  return points;
}

/** Share bounded real resources per occupied species/cell; preserve every original animal. */
export function rangeSupplies(
  actors: readonly ActorPlacement[],
  nature: NaturalLandscape,
  cx: number,
  cy: number,
): ActorPlacement[] {
  const rows: ActorPlacement[] = [];
  for (const species of ["horse", "giraffe", "beaver"] as const) {
    const a = actors.find((e) => e.type === faunaType(species));
    if (!a) continue;
    const points = sites(a, nature, cx, cy, species === "giraffe");
    for (const [i, point] of points.entries())
      rows.push({
        featureId: `${a.featureId}:range:${i}`,
        type:
          species === "giraffe"
            ? sourceType("canopy-leaves")
            : species === "horse"
              ? sourceType(i === 0 ? "growing-plant" : "spring-pool")
              : i === 2
                ? forageType("lodge")
                : sourceType("branch-pile"),
        ...point,
        route: [],
      });
  }
  return rows;
}

/** A real ordinary palm supports the same cell-owned giraffe leaf crop. */
export function rangeHabitatProps(nature: NaturalLandscape, cx: number, cy: number) {
  const rows = [];
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (nature.faunaHome(Math.floor(x / 4), Math.floor(y / 4))?.species !== "giraffe") continue;
      const a = nature.wildlife(x, y).find((e) => e.type === faunaType("giraffe"));
      if (!a) continue;
      const point = sites(a, nature, x, y, true)[0];
      if (
        !point ||
        point.wx + 32 < cx * 256 ||
        point.wx - 32 >= (cx + 1) * 256 ||
        point.wy + 16 < cy * 256 ||
        point.wy - 64 >= (cy + 1) * 256
      )
        continue;
      rows.push({ featureId: `${a.featureId}:range-tree`, propType: "prop-palm-tree", ...point });
    }
  return rows;
}
