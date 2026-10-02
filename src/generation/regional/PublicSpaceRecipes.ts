import type { CityPlace } from "./CityPlacesPlanner.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import type { Bounds } from "./RegionalPlanner.js";

/** Public spaces reserve circulation first. Native props furnish the remaining
 * lawn/seating zones, with no independent preview coordinates. */
export function publicSpace(
  id: string,
  kind: "pocket-park" | "neighborhood-park" | "square",
  bounds: Bounds,
): CityPlace {
  const { minX: x, minY: y, maxX: r, maxY: b } = bounds,
    cx = Math.floor((x + r) / 2),
    cy = Math.floor((y + b) / 2);
  const paths: Bounds[] = [
    { minX: cx - 1, minY: y - 2, maxX: cx + 2, maxY: b + 2 },
    { minX: x - 2, minY: cy - 1, maxX: r + 2, maxY: cy + 2 },
  ];
  if (kind === "neighborhood-park")
    paths.push(
      { minX: x + 2, minY: y + 2, maxX: r - 2, maxY: y + 4 },
      { minX: x + 2, minY: b - 4, maxX: r - 2, maxY: b - 2 },
      { minX: x + 2, minY: y + 2, maxX: x + 4, maxY: b - 2 },
      { minX: r - 4, minY: y + 2, maxX: r - 2, maxY: b - 2 },
    );
  const furniture: FeaturePlacement[] = [],
    add = (suffix: string, propType: string, tx: number, ty: number) =>
      furniture.push({ featureId: `${id}:${suffix}`, propType, wx: tx * 16, wy: ty * 16 });
  if (kind === "pocket-park") {
    add("tree:north", "prop-oak-tree", x + 3, y + 5);
    add("tree:south", "prop-oak-tree", r - 3, b - 4);
    add("bench", "prop-bench", x + 3, cy + 4);
    add("planter", "prop-city-commercial-v1-planter", r - 2, y + 3);
  } else if (kind === "neighborhood-park") {
    add("tree:nw", "prop-oak-tree", x + 6, y + 7);
    add("tree:ne", "prop-oak-tree", r - 6, y + 7);
    add("tree:sw", "prop-oak-tree", x + 6, b - 5);
    add("tree:se", "prop-oak-tree", r - 6, b - 5);
    add("bench:west", "prop-bench", x + 7, cy + 4);
    add("bench:east", "prop-bench", r - 7, cy + 4);
    add("play", "prop-seesaw", x + 10, y + 8);
  } else {
    // Keep a generous cross-shaped through-route and the central market reserve
    // clear. Seating and planters stay along the outside furnishing strip.
    for (const [i, tx] of [x + 6, r - 6].entries()) {
      add(`bench:${i}`, "prop-bench", tx, b - 2);
      add(`planter:${i}`, "prop-city-commercial-v1-planter", tx, y + 3);
    }
    add("bin", "prop-city-commercial-v1-bin-blue", r - 2, cy + 4);
    add("lamp", "prop-street-lamp", x + 2, cy - 5);
  }
  return {
    id,
    kind,
    bounds,
    ...(kind === "square" ? { paving: [bounds] } : {}),
    driving: [],
    paths,
    bays: [],
    furniture,
    overlays: [],
    entrances: [
      { x: cx, y: y - 2, mode: "walking" },
      { x: cx, y: b + 2, mode: "walking" },
      { x: x - 2, y: cy, mode: "walking" },
      { x: r + 2, y: cy, mode: "walking" },
    ],
  };
}
