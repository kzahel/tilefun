import { TerrainId } from "../../autotile/TerrainId.js";
import type { ActorPlacement } from "../Generator.js";
import type { FeaturePlacement } from "../StructureGenerator.js";
import { pathDistance } from "./PlanGeometry.js";
import type { Bounds, Point } from "./RegionalPlanner.js";

export type LeisureKind = "camp" | "garden" | "beach" | "play";
export interface LeisureDestination {
  id: string;
  name: string;
  kind: LeisureKind;
  arrival: Point;
}
export interface LeisurePlace extends LeisureDestination {
  center: Point;
  bounds: Bounds;
  paths: Point[][];
  props: FeaturePlacement[];
  actors: ActorPlacement[];
  pond?: Point;
  volleyball?: Point;
}

function pondTerrain(pond: Point, x: number, y: number) {
  const dx = x - pond.x,
    dy = y - pond.y,
    radius = Math.hypot(dx / 7, dy / 5);
  if (radius >= 1.2) return;
  if (Math.abs(dx) < 4.5 && dy >= 1) return TerrainId.Sand;
  if (radius < 0.55) return TerrainId.DeepWater;
  return radius < 1 ? TerrainId.ShallowWater : TerrainId.Sand;
}
function loopEntrance(gate: Point, center: Point): Point[] {
  const horizontal = Math.abs(gate.x - center.x) > Math.abs(gate.y - center.y);
  const corner = {
    x: center.x + (gate.x < center.x ? -13 : 13),
    y: center.y + (gate.y < center.y ? -10 : 8),
  };
  return [gate, horizontal ? { x: gate.x, y: corner.y } : { x: corner.x, y: gate.y }, corner];
}
export function leisureTerrain(place: LeisurePlace, x: number, y: number): TerrainId | undefined {
  const b = place.bounds;
  if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) return;
  if (place.pond) {
    const water = pondTerrain(place.pond, x, y);
    if (water !== undefined) return water;
  }
  if (place.volleyball) {
    const dx = Math.abs(x - place.volleyball.x),
      dy = Math.abs(y - place.volleyball.y);
    if (dx <= 4.5 && dy <= 4 && (dx >= 4 || dy >= 3.5)) return TerrainId.SandLight;
  }
  if (place.paths.some((path) => pathDistance(path, x, y) < 1.5)) return TerrainId.DirtLight;
  if (
    place.kind === "camp" &&
    Math.hypot((x - place.center.x + 2) / 9, (y - place.center.y + 1) / 7) < 1
  )
    return TerrainId.DirtWarm;
  if (place.kind === "beach") {
    const r = Math.hypot((x - place.center.x) / 11, (y - place.center.y) / 6);
    return r < 1 ? TerrainId.Sand : undefined;
  }
  return TerrainId.Grass;
}

/** Coordinates and path points are in tiles; props and actors use bottom-centre pixels. */
export function leisurePlace(
  kind: Exclude<LeisureKind, "play">,
  id: string,
  name: string,
  center: Point,
  bounds: Bounds,
  entrance: Point,
  variant: number,
  second?: Point,
): LeisurePlace {
  const at = (dx: number, dy: number) => ({ x: center.x + dx, y: center.y + dy });
  const props: FeaturePlacement[] = [],
    actors: ActorPlacement[] = [],
    paths: Point[][] = [];
  const prop = (key: string, propType: string, dx: number, dy: number) => {
    const p = at(dx, dy);
    props.push({ featureId: `${id}:${key}`, propType, wx: p.x * 16, wy: p.y * 16 });
  };
  const actor = (key: string, type: string, dx: number, dy: number) => {
    const p = at(dx, dy);
    actors.push({ featureId: `${id}:${key}`, type, wx: p.x * 16, wy: p.y * 16, route: [] });
  };
  const south = at(0, 8);
  function connect(p: Point, target: Point) {
    // Approach the interior along the edge first, keeping the furnished quadrants clear.
    const horizontal = Math.abs(p.x - center.x) > Math.abs(p.y - center.y);
    paths.push([p, horizontal ? { x: p.x, y: target.y } : { x: target.x, y: p.y }, target]);
  }
  if (kind !== "garden") connect(entrance, south);
  const place: LeisurePlace = {
    kind,
    id,
    name,
    center,
    bounds,
    arrival: south,
    paths,
    props,
    actors,
  };
  if (kind === "camp") {
    prop("entrance", "prop-park-campSign", entrance.x - center.x, entrance.y - center.y);
    prop("blue", "prop-tent-blue", -6, -4);
    prop("green", "prop-tent-green", 2, -6);
    prop("lantern", "prop-park-lantern", -3, -4);
    prop("packs", "prop-park-backpack", 4, -5);
    prop("stove", "prop-park-cookingPot", 1, 1);
    actor("fire", "campfire", -2, 2);
    prop("log", "prop-park-logLong", -2, 4);
    prop("picnic", "prop-picnic-table", -8, 5);
    paths.push([south, at(0, 5), at(8, 5)]);
    if (variant < 0.4) prop("lookout", "prop-tree-house", 10, 0);
    else if (variant < 0.75) {
      place.pond = at(10, -6);
      prop("pier", "prop-park-dock", 10, -2);
    } else {
      prop("shade", "prop-oak-tree", 10, -4);
      prop("bench", "prop-bench", 10, 1);
    }
    for (const [i, dx] of [-12, -4, 6].entries()) prop(`grove-${i}`, "prop-oak-tree", dx, -12);
  } else if (kind === "garden") {
    const north = at(0, -10);
    // Bring the two approaches onto opposite sides of the loop. They never
    // cut across the fountain court, picnic lawn or flower beds.
    paths.push(loopEntrance(entrance, center), loopEntrance(second ?? entrance, center));
    paths.push([south, at(-13, 8), at(-13, -10), north], [south, at(13, 8), at(13, -10), north]);
    prop("gate", "prop-park-hedgeArch", -13, 3);
    prop("fountain", "prop-garden-fountain", 0, -5);
    prop("garden-seat", "prop-bench", -8, -3);
    prop("flower-bed", "prop-park-flowers", -9, 3);
    prop("sunflowers", "prop-park-sunflower", -7, 2);
    prop("shade", "prop-oak-tree", 7, -5);
    prop("lawn", "prop-picnic-table", 7, 2);
    prop("seat", "prop-bench", 3, 5);
    prop("topiary", "prop-dino-topiary", -6, -8);
    prop("back-oak", "prop-oak-tree", -16, -12);
    prop("flower-border", "prop-park-flowers", -9, -5);
    prop("second-table", "prop-picnic-table", 8, 5);
    prop("gate-tree", "prop-oak-tree", 16, 6);
  } else {
    paths.push([south, at(0, 4)]);
    prop("sign", "prop-park-beachSign", -8, 5);
    prop("shade", "prop-beach-umbrella", -6, 0);
    prop("towel", "prop-park-towel", -5, 2);
    prop("castle", "prop-sand-castle", -2, 0);
    prop("bucket", "prop-park-bucket", -1, 1);
    prop("towel-blue", "prop-park-towelBlue", 6, 3);
    if (variant < 0.4) {
      place.volleyball = at(4, -1);
      prop("volleyball", "prop-park-volleyNet", 4, -1);
      actor("ball", "ball", 4, 1);
    } else if (variant < 0.8) prop("kiosk", "prop-park-boatBar", 4, -2);
    else prop("picnic", "prop-picnic-table", 5, -2);
  }
  return place;
}
