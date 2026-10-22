import type { Prop } from "../../entities/Prop.js";

/** Small east/west practice bridge. Pixel geometry, ordinary persistent props;
 * its open 40px underpass also fits small cars. Maximum grade is 0.375. */
const parts = {
  west: { x: -112, width: 128, z: 0, rise: 48, neighbors: ["deck"] },
  deck: { x: 0, width: 96, z: 48, rise: 0, neighbors: ["west", "east"] },
  east: { x: 112, width: 128, z: 48, rise: -48, neighbors: ["deck"] },
} as const;
export function depotBridgeProp(type: string, wx: number, wy: number): Prop | undefined {
  const name = (Object.keys(parts) as (keyof typeof parts)[]).find(
    (p) => type === `prop-depot-bridge-${p}`,
  );
  if (!name) return;
  const p = parts[name],
    id = `depot-bridge:${wx}:${wy}`;
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
      offsetX: p.x,
      offsetY: 0,
      width: p.width,
      height: 128,
      surface: {
        id: `${id}:${name}`,
        spaceId: id,
        z: p.z,
        riseX: p.rise,
        riseY: 0,
        thickness: 8,
        connectsTo: p.neighbors.map((n) => `${id}:${n}`),
      },
    },
    walls: null,
  };
}
