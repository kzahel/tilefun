import type { Prop } from "../entities/Prop.js";
import type { FeaturePlacement } from "../generation/regional/DistrictStrategy.js";
import type { Bounds } from "../generation/regional/RegionalPlanner.js";

/** One tile-aligned north/south road above level east/west rails. Units: pixels. */
export const ROAD_RAIL_BRIDGE = {
  halfWidth: 96,
  halfDeck: 64,
  ramp: 384,
  height: 96,
  thickness: 8,
} as const;
export interface RailBridge {
  id: string;
  roadId: string;
  x: number;
  y: number;
  bounds: Bounds;
}
const PARTS = {
  north: {
    bottom: -64,
    length: ROAD_RAIL_BRIDGE.ramp,
    z: 0,
    rise: ROAD_RAIL_BRIDGE.height,
    neighbors: ["deck"],
  },
  deck: {
    bottom: 64,
    length: 128,
    z: ROAD_RAIL_BRIDGE.height,
    rise: 0,
    neighbors: ["north", "south"],
  },
  south: {
    bottom: ROAD_RAIL_BRIDGE.halfDeck + ROAD_RAIL_BRIDGE.ramp,
    length: ROAD_RAIL_BRIDGE.ramp,
    z: ROAD_RAIL_BRIDGE.height,
    rise: -ROAD_RAIL_BRIDGE.height,
    neighbors: ["deck"],
  },
} as const;
export function bridgePart(type: string): keyof typeof PARTS | undefined {
  return (Object.keys(PARTS) as (keyof typeof PARTS)[]).find((p) => type === `prop-road-rail-${p}`);
}
/** Definition-backed parts use their common world center for unique surface/space IDs.
 * This reconstructs the same geometry on save reload without persisting render data. */
export function roadRailBridgeProp(type: string, wx: number, wy: number): Prop | undefined {
  const part = bridgePart(type);
  if (!part) return;
  const p = PARTS[part],
    id = `road-rail:${wx}:${wy - p.bottom}`;
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
      width: 192,
      height: p.length,
      surface: {
        id: `${id}:${part}`,
        spaceId: id,
        z: p.z,
        riseX: 0,
        riseY: p.rise,
        thickness: 8,
        connectsTo: p.neighbors.map((n) => `${id}:${n}`),
      },
    },
    walls: null,
  };
}
export function bridgePlacements(bridge: RailBridge): FeaturePlacement[] {
  return Object.entries(PARTS).map(([part, p]) => ({
    featureId: `${bridge.id}:${part}`,
    propType: `prop-road-rail-${part}`,
    wx: bridge.x * 16,
    wy: bridge.y * 16 + p.bottom,
  }));
}
