import type { FloorPlan } from "./ApartmentFloorPlan.js";
import { verticalWallProfile, wallFacingConstraint } from "./ApartmentWallAlignment.js";
import { horizontalWallSurface } from "./ApartmentWallSurfaces.js";
import { wallPorts } from "./ApartmentWallTopology.js";
import { type LayeredInteriorMap, placeInteriorTile } from "./LayeredInteriorMap.js";

const wall = (col: number, row: number) =>
  `room-builder/3d-walls/c${String(col).padStart(2, "0")}-r${String(row).padStart(2, "0")}`;
const floor = (cell: string) =>
  "KT".includes(cell) ? "room-builder/floors/c13-r35" : "room-builder/floors/c01-r31";

/** A contradictory thin-face domain has a deterministic two-sided candidate.
 * Both rails retain fixed positions for the entire run, including its doors.
 * Only room-facing sides receive a shaded face; exterior stays uncovered.
 */
export function placeTwoSidedWalls(map: LayeredInteriorMap, plan: FloorPlan): void {
  const at = (x: number, y: number) => plan.rows[y]?.[x] ?? " ";
  for (let x = 0; x < plan.width; x++)
    for (let y = 0; y < plan.height; y++) {
      if (at(x, y) !== "#" || !wallFacingConstraint(plan, x, y).conflict) continue;
      const ports = wallPorts(plan, x, y);
      const ox = x * 2,
        oy = y * 2;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const cell = map.cells[oy + dy]?.[ox + dx];
          if (cell) {
            cell.wall = [];
            cell.foreground = [];
            cell.floor = [];
          }
        }
      const cutaway = !ports.south && horizontalWallSurface(plan, x, y) === "cutaway";
      if (cutaway) {
        for (let dx = 0; dx < 2; dx++) {
          const start = dx === 0 && !ports.west ? 9 : 0;
          const end = dx === 1 && !ports.east ? 7 : 16;
          placeInteriorTile(map, "foreground", ox + dx, oy, {
            key: wall(11, 5),
            cropX: start,
            cropWidth: end - start,
            cropHeight: 6,
          });
        }
        continue;
      }
      const starts = at(x, y - 1) === "+" || !ports.north;
      const ends = at(x, y + 1) === "+" || !ports.south;
      for (let dy = 0; dy < 2; dy++) {
        for (const side of [-1, 1]) {
          const dx = side < 0 ? 0 : 1;
          const col = side < 0 ? 13 : 10;
          const connected = side < 0 ? ports.west : ports.east;
          // The incoming arm owns its height. A continuing vertical wall must
          // not turn a south cutaway into a full face over exterior space.
          const lowBranch = connected && horizontalWallSurface(plan, x + side, y) === "cutaway";
          const branch = connected && !lowBranch;
          const room = Boolean(plan.inside[y]?.[x + side]);
          const visible = room || branch;
          if (room && starts)
            placeInteriorTile(map, "floor", ox + dx, oy + dy, { key: floor(at(x + side, y)) });
          const taper = starts && !branch && dy === 0;
          const row = taper ? 4 : ends ? 3 + dy : branch ? dy : 2;
          const sourceCol = taper
            ? side < 0
              ? 14
              : 9
            : branch && dy === 0 && !ends
              ? side < 0
                ? 12
                : 11
              : col;
          placeInteriorTile(map, "wall", ox + dx, oy + dy, {
            key: wall(sourceCol, row),
            ...(!visible ? { cropX: side < 0 ? 9 : 0, cropWidth: 7 } : {}),
          });
          if (starts && branch && dy === 0)
            placeInteriorTile(map, "foreground", ox + dx, oy, {
              key: wall(11, 2),
              cropX: side < 0 ? 9 : 0,
              cropWidth: 7,
              cropHeight: 1,
            });
          // Join the white arm and rail surfaces without retaining the atlas
          // piece's internal vertical outline through their intersection.
          if (connected && dy === 0)
            placeInteriorTile(map, "foreground", ox + dx, oy, {
              key: wall(11, 5),
              cropX: side < 0 ? 0 : 6,
              cropWidth: 10,
              cropHeight: 6,
            });
        }
        // Remove the two internal rail outlines: this is one wide top surface.
        const seamRow = ends ? 3 + dy : 2;
        placeInteriorTile(map, "foreground", ox, oy + dy, {
          key: starts && !ends && dy === 0 ? wall(9, 4) : wall(10, seamRow),
          cropX: 2,
          cropWidth: 1,
          offsetX: 13,
          drawWidth: 2,
        });
      }
    }
}

/** A thick wall has a continuous top plane above its frontmost face. */
export function placeWallMassSurfaces(map: LayeredInteriorMap, plan: FloorPlan): void {
  const solid = (x: number, y: number) => plan.rows[y]?.[x] === "#";
  const mass = (x: number, y: number) =>
    solid(x, y) &&
    solid(x, y + 1) &&
    ((solid(x - 1, y) && solid(x - 1, y + 1)) || (solid(x + 1, y) && solid(x + 1, y + 1)));
  for (let y = 0; y < plan.height - 1; y++)
    for (let x = 0; x < plan.width; x++) {
      if (!solid(x, y) || !solid(x, y + 1)) continue;
      const west = solid(x - 1, y) && solid(x - 1, y + 1);
      const east = solid(x + 1, y) && solid(x + 1, y + 1);
      if (!west && !east) continue;
      const wide = wallFacingConstraint(plan, x, y).conflict;
      const upperSideRoom = plan.inside[y - 1]?.[x - 1] || plan.inside[y - 1]?.[x + 1];
      let edges: [number, number][] = [];
      if (!solid(x, y - 1)) edges = [[0, 32]];
      else if (!mass(x, y - 1) && upperSideRoom) {
        // A thin wall above occupies only its rail, not the whole sketch cell.
        const upperWide = wallFacingConstraint(plan, x, y - 1).conflict;
        const start = upperWide ? 9 : verticalWallProfile(plan, x, y - 1).railX;
        edges = [
          [0, start + 1],
          [start + (upperWide ? 13 : 6), 32],
        ];
      }
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          // Keep an exposed side face at the edge of the mass, and fill the
          // interior with one top surface rather than a row of disconnected caps.
          if (wide && ((dx === 0 && !west) || (dx === 1 && !east))) continue;
          const cell = map.cells[y * 2 + dy]?.[x * 2 + dx];
          if (!cell) continue;
          cell.wall = [];
          cell.foreground = [];
          cell.floor = [];
          placeInteriorTile(map, "floor", x * 2 + dx, y * 2 + dy, {
            key: wall(10, 2),
            cropX: 2,
            cropWidth: 1,
            offsetX: -2,
            drawWidth: 16,
          });
          if (dy === 0) {
            for (const [start, end] of edges) {
              const left = Math.max(start, dx * 16),
                right = Math.min(end, (dx + 1) * 16);
              if (right <= left) continue;
              placeInteriorTile(map, "foreground", x * 2 + dx, y * 2, {
                key: wall(11, 2),
                cropX: left - dx * 16,
                cropWidth: right - left,
                cropHeight: 1,
              });
            }
          }
          for (const side of [-1, 1]) {
            if ((side < 0 ? dx !== 0 : dx !== 1) || solid(x + side, y)) continue;
            placeInteriorTile(map, "foreground", x * 2 + dx, y * 2 + dy, {
              key: wall(8, 1),
              cropWidth: 1,
              offsetX: side < 0 ? 0 : 15,
            });
          }
        }
      // Replacing either half must preserve the joined rail seam. Previously
      // the right-hand mass edge lost the seam stored in its replaced left half.
      if (wide)
        for (let dy = 0; dy < 2; dy++)
          placeInteriorTile(map, "foreground", x * 2, y * 2 + dy, {
            key:
              dy === 0 && edges.some(([start, end]) => start <= 15 && end > 15)
                ? wall(9, 4)
                : wall(10, 2),
            cropX: 2,
            cropWidth: 1,
            offsetX: 13,
            drawWidth: 2,
          });
      // The front rail and the mass behind it share a top plane. Its upper
      // stroke is internal; keep only the room-facing and exterior boundaries.
      if (!mass(x, y + 1)) {
        const start = wide && !west ? 10 : !solid(x - 1, y) ? 1 : 0;
        const end = wide && !east ? 22 : !solid(x + 1, y) ? 31 : 32;
        for (let dx = 0; dx < 2; dx++) {
          const left = Math.max(start, dx * 16),
            right = Math.min(end, (dx + 1) * 16);
          if (right <= left) continue;
          placeInteriorTile(map, "foreground", x * 2 + dx, (y + 1) * 2, {
            key: wall(10, 2),
            cropX: 2,
            cropWidth: 1,
            cropHeight: 1,
            offsetX: left - dx * 16 - 2,
            drawWidth: right - left,
          });
        }
      }
    }
}
