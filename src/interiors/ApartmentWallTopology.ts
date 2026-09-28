import type { FloorPlan } from "./ApartmentFloorPlan.js";

/** Structural ports are independent of the atlas orientation used at a node.
 * In particular, a one-cell end still connects to a horizontal back wall.
 */
export function wallPorts(plan: FloorPlan, x: number, y: number) {
  const boundary = (dx: number, dy: number): boolean => {
    const cell = plan.rows[y + dy]?.[x + dx];
    return cell === "#" || cell === "+";
  };
  const north = boundary(0, -1);
  const east = boundary(1, 0);
  const south = boundary(0, 1);
  const west = boundary(-1, 0);
  return {
    north,
    east,
    south,
    west,
    count: Number(north) + Number(east) + Number(south) + Number(west),
  };
}
