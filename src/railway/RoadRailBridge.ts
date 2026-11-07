import type { Prop } from "../entities/Prop.js";
import type { FeaturePlacement } from "../generation/regional/DistrictStrategy.js";
import type { Bounds } from "../generation/regional/RegionalPlanner.js";

/** One tile-aligned road deck above level rails. Units: pixels. A `south` bridge
 * carries a north/south road over east/west track; an `east` bridge carries an
 * east/west road over north/south track with the same deck and ramps rotated. */
export const ROAD_RAIL_BRIDGE = {
  halfWidth: 96,
  halfDeck: 64,
  ramp: 384,
  height: 96,
  thickness: 8,
} as const;
/** Tiles from the rail centerline to the outer end of either ramp. */
export const BRIDGE_REACH_TILES = (ROAD_RAIL_BRIDGE.halfDeck + ROAD_RAIL_BRIDGE.ramp) / 16;
export type BridgeAxis = "south" | "east";
export interface RailBridge {
  id: string;
  roadId: string;
  /** Direction the carried road runs: `south` = north/south road. */
  axis: BridgeAxis;
  /** Road centerline (south) or rail centerline (east), tiles. */
  x: number;
  /** Rail centerline (south) or road centerline (east), tiles. */
  y: number;
  bounds: Bounds;
}
interface Part {
  /** Signed offset of the part's far edge (south/east) from the rail, along the road. */
  end: number;
  length: number;
  z: number;
  rise: number;
  neighbors: readonly string[];
}
const { halfDeck, ramp, height } = ROAD_RAIL_BRIDGE;
const SOUTH: Record<string, Part> = {
  north: { end: -halfDeck, length: ramp, z: 0, rise: height, neighbors: ["deck"] },
  deck: { end: halfDeck, length: 2 * halfDeck, z: height, rise: 0, neighbors: ["north", "south"] },
  south: { end: halfDeck + ramp, length: ramp, z: height, rise: -height, neighbors: ["deck"] },
};
const EAST: Record<string, Part> = {
  west: { end: -halfDeck, length: ramp, z: 0, rise: height, neighbors: ["deck"] },
  deck: { end: halfDeck, length: 2 * halfDeck, z: height, rise: 0, neighbors: ["west", "east"] },
  east: { end: halfDeck + ramp, length: ramp, z: height, rise: -height, neighbors: ["deck"] },
};
const PREFIX = { south: "prop-road-rail-", east: "prop-road-rail-x-" } as const;
function parse(type: string): { axis: BridgeAxis; part: string; p: Part } | undefined {
  for (const axis of ["east", "south"] as const) {
    if (!type.startsWith(PREFIX[axis])) continue;
    const part = type.slice(PREFIX[axis].length),
      p = (axis === "east" ? EAST : SOUTH)[part];
    if (p) return { axis, part, p };
  }
  return undefined;
}
export function bridgePart(type: string): string | undefined {
  return parse(type)?.part;
}
export const isRoadRailBridge = (type: string) => parse(type) !== undefined;
/** Definition-backed parts use their common world center for unique surface/space IDs.
 * This reconstructs the same geometry on save reload without persisting render data.
 * South parts anchor at their bottom edge; east parts at their bottom-center. */
export function roadRailBridgeProp(type: string, wx: number, wy: number): Prop | undefined {
  const parsed = parse(type);
  if (!parsed) return;
  const { axis, part, p } = parsed;
  const east = axis === "east";
  const id = east
    ? `road-rail-x:${wx - p.end + p.length / 2}:${wy - ROAD_RAIL_BRIDGE.halfWidth}`
    : `road-rail:${wx}:${wy - p.end}`;
  return {
    id: 0,
    type,
    isProp: true,
    position: { wx, wy },
    sprite: {
      sheetKey: "geometry-surface",
      frameCol: 0,
      frameRow: 0,
      spriteWidth: 0,
      spriteHeight: 0,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: east ? p.length : 2 * ROAD_RAIL_BRIDGE.halfWidth,
      height: east ? 2 * ROAD_RAIL_BRIDGE.halfWidth : p.length,
      surface: {
        id: `${id}:${part}`,
        spaceId: id,
        z: p.z,
        riseX: east ? p.rise : 0,
        riseY: east ? 0 : p.rise,
        thickness: ROAD_RAIL_BRIDGE.thickness,
        connectsTo: p.neighbors.map((n) => `${id}:${n}`),
      },
    },
    walls: null,
  };
}
export function bridgePlacements(bridge: RailBridge): FeaturePlacement[] {
  const east = bridge.axis === "east";
  return Object.entries(east ? EAST : SOUTH).map(([part, p]) => ({
    featureId: `${bridge.id}:${part}`,
    propType: `${PREFIX[bridge.axis]}${part}`,
    wx: east ? bridge.x * 16 + p.end - p.length / 2 : bridge.x * 16,
    wy: east ? bridge.y * 16 + ROAD_RAIL_BRIDGE.halfWidth : bridge.y * 16 + p.end,
  }));
}
