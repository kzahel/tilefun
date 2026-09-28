import type { FloorPlan } from "./ApartmentFloorPlan.js";

/** Resolve the surface from the regions incident to the horizontal arms.
 * A run can contain both full-height and cutaway sections. A room beside a
 * vertical continuation does not make the incoming horizontal arm a divider.
 * This classification is independent of atlas pieces and drawing order.
 */
export function horizontalWallSurface(plan: FloorPlan, x: number, y: number): "full" | "cutaway" {
  const boundary = (px: number, py: number): boolean => {
    const c = plan.rows[py]?.[px];
    return c === "#" || c === "+";
  };
  const incidentInterior = (dy: number): boolean =>
    Boolean(plan.inside[y + dy]?.[x]) ||
    [-1, 1].some((dx) => boundary(x + dx, y) && Boolean(plan.inside[y + dy]?.[x + dx]));
  // A direct exterior neighbor is authoritative. Only a boundary endpoint
  // needs the side regions of its incident horizontal arms to resolve it.
  const below = plan.rows[y + 1]?.[x] ?? " ";
  const lowerInterior =
    Boolean(plan.inside[y + 1]?.[x]) || (boundary(x, y + 1) && incidentInterior(1));
  return !lowerInterior && (below === " " || boundary(x, y + 1)) && incidentInterior(-1)
    ? "cutaway"
    : "full";
}
