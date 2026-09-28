import type { FloorPlan } from "./ApartmentFloorPlan.js";
import { horizontalWallSurface } from "./ApartmentWallSurfaces.js";
import { wallPorts } from "./ApartmentWallTopology.js";

export interface VerticalWallProfile {
  column: 0 | 1;
  facing: "east" | "west";
  /** Left edge of the 7px rail, relative to this 32px sketch cell. */
  railX: number;
  /** Translate the face so either handed atlas piece meets that rail. */
  tileOffsetX: number;
}

export interface WallFacingConstraint {
  required: ("east" | "west")[];
  /** Structural locations explaining the requirement before tile selection. */
  sources: {
    x: number;
    y: number;
    facing: "east" | "west";
    kind: "exterior" | "corner" | "mass";
  }[];
  conflict: boolean;
}

/** Exterior exposures and full-height corner ports constrain a whole wall.
 * Shared sections inherit that facing instead of imposing the atlas default.
 */
export function wallFacingConstraint(plan: FloorPlan, x: number, y: number): WallFacingConstraint {
  const at = (px: number, py: number): string => plan.rows[py]?.[px] ?? " ";
  const inside = (px: number, py: number): boolean => Boolean(plan.inside[py]?.[px]);
  const boundary = (py: number): boolean => "#+".includes(at(x, py));
  let top = y;
  let bottom = y;
  while (boundary(top - 1)) top--;
  while (boundary(bottom + 1)) bottom++;
  const sources: WallFacingConstraint["sources"] = [];
  for (let py = top; py <= bottom; py++)
    for (const side of [-1, 1]) {
      if (at(x - side, py) !== " " || inside(x - side, py)) continue;
      // Include endpoint quadrants: even a one-cell link between two junctions
      // has an exterior face, without an intervening straight sketch cell.
      if ([0, -1, 1].some((dy) => py + dy >= top && py + dy <= bottom && inside(x + side, py + dy)))
        sources.push({ x, y: py, facing: side < 0 ? "west" : "east", kind: "exterior" });
    }
  for (let py = top; py <= bottom; py++) {
    for (const side of [-1, 1]) {
      if (!inside(x - side, py)) continue;
      if (
        [-1, 1].some(
          (dy) =>
            at(x, py) === "#" &&
            at(x + side, py) === "#" &&
            at(x, py + dy) === "#" &&
            at(x + side, py + dy) === "#",
        )
      )
        sources.push({ x, y: py, facing: side === 1 ? "west" : "east", kind: "mass" });
    }
    const ports = wallPorts(plan, x, py);
    if (ports.count !== 2 || horizontalWallSurface(plan, x, py) !== "full") continue;
    // Full-height atlas corners connect N+W / S+E on an east-facing wall,
    // and N+E / S+W on a west-facing wall. Cutaway rails impose no facing.
    const facing =
      (ports.north && ports.west) || (ports.south && ports.east)
        ? "east"
        : (ports.north && ports.east) || (ports.south && ports.west)
          ? "west"
          : null;
    if (facing) sources.push({ x, y: py, facing, kind: "corner" });
  }
  const required = [...new Set(sources.map((source) => source.facing))];
  return { required, sources, conflict: required.length > 1 };
}

/** Resolve a consistent facing and rail from boundary and corner constraints.
 * Unconstrained shared partitions retain the established east-facing style.
 * Atlas rail offsets are east 0 and west 9 within a 16px face tile.
 */
export function verticalWallProfile(plan: FloorPlan, x: number, y: number): VerticalWallProfile {
  const boundary = (py: number): boolean => "#+".includes(plan.rows[py]?.[x] ?? " ");
  const inside = (dx: number, py: number): boolean => Boolean(plan.inside[py]?.[x + dx]);
  let top = y;
  let bottom = y;
  while (boundary(top - 1)) top--;
  while (boundary(bottom + 1)) bottom++;
  const sections = Array.from({ length: bottom - top + 1 }, (_, i) => top + i).filter(
    (py) => inside(-1, py) || inside(1, py),
  );
  if (sections.length === 0) return { column: 0, facing: "east", railX: 0, tileOffsetX: 0 };
  const first = sections[0] ?? y;
  const constraint = wallFacingConstraint(plan, x, y);
  // Exterior constraints anchor the upper corner. Unconstrained partitions
  // reserve the west floor half when needed anywhere along the run; a bend
  // at the first section is not an exterior corner imposing the other column.
  const exteriorAnchor =
    !constraint.conflict && constraint.sources.some((source) => source.kind === "exterior");
  const column = (exteriorAnchor ? inside(-1, first) : sections.some((py) => inside(-1, py)))
    ? 1
    : 0;
  const local = sections.reduce(
    (best, py) =>
      Math.abs(py - y) < Math.abs(best - y) ||
      (Math.abs(py - y) === Math.abs(best - y) && py > best)
        ? py
        : best,
    first,
  );
  // A contradictory run cannot be solved by selecting one thin face. These
  // provisional thin placements are replaced atomically by the two-sided
  // assembly pass; the conflict remains available as its diagnostic reason.
  const facing = constraint.conflict
    ? inside(1, local)
      ? "east"
      : "west"
    : (constraint.required[0] ?? "east");
  const anchorFacing = constraint.conflict ? (inside(1, first) ? "east" : "west") : facing;
  const railX = column * 16 + (anchorFacing === "west" ? 9 : 0);
  return { column, facing, railX, tileOffsetX: railX - column * 16 - (facing === "east" ? 0 : 9) };
}
