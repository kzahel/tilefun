import type { FloorPlan, PlanCell, RoomKind } from "./ApartmentFloorPlan.js";
import {
  createLayeredInteriorMap,
  type LayeredInteriorMap,
  placeInteriorTile,
} from "./LayeredInteriorMap.js";

// One sketch cell becomes a two-by-two group of 16px atlas tiles. This gives
// horizontal walls their two source rows and shared vertical walls two faces.
const SCALE = 2;
type Axis = "horizontal" | "vertical";

const FLOOR_TILES: Record<RoomKind, string> = {
  L: "room-builder/floors/c01-r31",
  B: "room-builder/floors/c04-r29",
  K: "room-builder/floors/c13-r29",
  T: "room-builder/floors/c13-r20",
  H: "room-builder/floors/c01-r05",
};

function at(plan: FloorPlan, x: number, y: number): PlanCell {
  return plan.rows[y]?.[x] ?? " ";
}

function isRoom(cell: PlanCell): cell is RoomKind {
  return cell === "L" || cell === "B" || cell === "K" || cell === "T" || cell === "H";
}

function isBoundary(cell: PlanCell): boolean {
  return cell === "#" || cell === "+";
}

function axisAt(plan: FloorPlan, x: number, y: number): Axis {
  const north = isRoom(at(plan, x, y - 1));
  const south = isRoom(at(plan, x, y + 1));
  const west = isRoom(at(plan, x - 1, y));
  const east = isRoom(at(plan, x + 1, y));
  if (north || south) return "horizontal";
  if (west || east) return "vertical";
  const horizontal =
    Number(isBoundary(at(plan, x - 1, y))) + Number(isBoundary(at(plan, x + 1, y)));
  const vertical = Number(isBoundary(at(plan, x, y - 1))) + Number(isBoundary(at(plan, x, y + 1)));
  return horizontal >= vertical ? "horizontal" : "vertical";
}

function boundaryOnAxis(plan: FloorPlan, x: number, y: number, axis: Axis): boolean {
  return isBoundary(at(plan, x, y)) && axisAt(plan, x, y) === axis;
}

function wall(col: number, row: number): string {
  return `room-builder/3d-walls/c${String(col).padStart(2, "0")}-r${String(row).padStart(2, "0")}`;
}

function put(
  map: LayeredInteriorMap,
  layer: "floor" | "wall" | "foreground",
  x: number,
  y: number,
  key: string,
  cropHeight?: number,
): void {
  placeInteriorTile(map, layer, x, y, { key, ...(cropHeight ? { cropHeight } : {}) });
}

function roomBeside(plan: FloorPlan, x: number, y: number): RoomKind | null {
  for (const dy of [0, -1, 1]) {
    const cell = at(plan, x, y + dy);
    if (isRoom(cell)) return cell;
  }
  return null;
}

function doorwayFloor(plan: FloorPlan, x: number, y: number): RoomKind {
  const axis = axisAt(plan, x, y);
  const candidates =
    axis === "horizontal"
      ? [at(plan, x, y - 1), at(plan, x, y + 1)]
      : [at(plan, x - 1, y), at(plan, x + 1, y)];
  const room = candidates.find(isRoom);
  if (!room) throw new Error(`Passage at ${x},${y} has no floor`);
  return room;
}

function frontEdge(plan: FloorPlan, x: number, y: number): boolean {
  let left = x;
  let right = x;
  while (boundaryOnAxis(plan, left - 1, y, "horizontal")) left--;
  while (boundaryOnAxis(plan, right + 1, y, "horizontal")) right++;
  let floorAbove = false;
  for (let px = left; px <= right; px++) {
    floorAbove ||= isRoom(at(plan, px, y - 1));
    if (at(plan, px, y + 1) !== " ") return false;
  }
  return floorAbove;
}

function placeHorizontalWall(map: LayeredInteriorMap, plan: FloorPlan, x: number, y: number): void {
  const ox = x * SCALE;
  const oy = y * SCALE;
  const leftDoor = at(plan, x - 1, y) === "+" && boundaryOnAxis(plan, x - 1, y, "horizontal");
  const rightDoor = at(plan, x + 1, y) === "+" && boundaryOnAxis(plan, x + 1, y, "horizontal");
  const leftEnd = !boundaryOnAxis(plan, x - 1, y, "horizontal");
  const rightEnd = !boundaryOnAxis(plan, x + 1, y, "horizontal");
  const divider = isRoom(at(plan, x, y - 1)) && isRoom(at(plan, x, y + 1));
  if (frontEdge(plan, x, y)) {
    put(map, "foreground", ox, oy, wall(leftEnd ? 10 : 11, 5), 6);
    put(map, "foreground", ox + 1, oy, wall(rightEnd ? 13 : 11, 5), 6);
    return;
  }
  for (let dy = 0; dy < SCALE; dy++) {
    const top = dy === 0;
    const left = leftDoor
      ? wall(8, top ? 0 : 1)
      : leftEnd
        ? wall(divider ? (top ? 11 : 10) : 10, top ? 0 : 1)
        : wall(11, top ? 2 : 3);
    const right = rightDoor
      ? wall(8, top ? 3 : 4)
      : rightEnd
        ? wall(divider ? 12 : 13, top ? 0 : 1)
        : wall(11, top ? 2 : 3);
    put(map, "wall", ox, oy + dy, left);
    put(map, "wall", ox + 1, oy + dy, right);
  }
}

function verticalRunAboveDoor(plan: FloorPlan, x: number, y: number): number {
  let count = 0;
  for (
    let row = y - 1;
    boundaryOnAxis(plan, x, row, "vertical") && at(plan, x, row) === "#";
    row--
  ) {
    count++;
  }
  return count;
}

function validateSidePassages(plan: FloorPlan): void {
  for (let y = 0; y < plan.height; y++) {
    for (let x = 0; x < plan.width; x++) {
      if (at(plan, x, y) !== "+" || axisAt(plan, x, y) !== "vertical") continue;
      if (verticalRunAboveDoor(plan, x, y) < 2) {
        throw new Error(`Side passage at ${x},${y} needs two wall cells above it`);
      }
    }
  }
}

function placeVerticalWall(map: LayeredInteriorMap, plan: FloorPlan, x: number, y: number): void {
  const ox = x * SCALE;
  const oy = y * SCALE;
  const west = roomBeside(plan, x - 1, y);
  const east = roomBeside(plan, x + 1, y);
  const beforeDoor = at(plan, x, y + 1) === "+" && boundaryOnAxis(plan, x, y + 1, "vertical");
  const afterDoor = at(plan, x, y - 1) === "+" && boundaryOnAxis(plan, x, y - 1, "vertical");
  for (let dy = 0; dy < SCALE; dy++) {
    const row = beforeDoor ? 3 + dy : 2;
    const leftCol = west ? 13 : 10;
    const rightCol = east ? 10 : west ? 13 : 15;
    if (afterDoor && dy === 0) {
      if (west) {
        put(map, "floor", ox, oy, FLOOR_TILES[west]);
        put(map, "foreground", ox, oy, wall(14, 4));
      } else put(map, "wall", ox, oy, wall(leftCol, row));
      if (east) {
        put(map, "floor", ox + 1, oy, FLOOR_TILES[east]);
        put(map, "foreground", ox + 1, oy, wall(9, 4));
      } else put(map, "wall", ox + 1, oy, wall(rightCol, row));
    } else {
      put(map, "wall", ox, oy + dy, wall(leftCol, row));
      put(map, "wall", ox + 1, oy + dy, wall(rightCol, row));
    }
  }
}

function semanticOf(cell: PlanCell): string {
  return cell === "#" ? "wall" : cell === "+" ? "opening" : cell === " " ? "void" : cell;
}

/** Compiles an editable floor/wall/door sketch into independent visual layers. */
export function buildLayeredApartmentPlan(plan: FloorPlan): LayeredInteriorMap {
  validateSidePassages(plan);
  const map = createLayeredInteriorMap(plan.width * SCALE, plan.height * SCALE);
  for (let y = 0; y < plan.height; y++) {
    for (let x = 0; x < plan.width; x++) {
      const source = at(plan, x, y);
      const semantic = semanticOf(source);
      const floorRoom = isRoom(source) ? source : source === "+" ? doorwayFloor(plan, x, y) : null;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const cell = map.cells[y * SCALE + dy]?.[x * SCALE + dx];
          if (!cell) throw new Error(`Expanded apartment cell ${x},${y} is missing`);
          cell.semantic = semantic;
          if (floorRoom) put(map, "floor", x * SCALE + dx, y * SCALE + dy, FLOOR_TILES[floorRoom]);
        }
      }
    }
  }
  for (let y = 0; y < plan.height; y++) {
    for (let x = 0; x < plan.width; x++) {
      if (at(plan, x, y) !== "#") continue;
      if (axisAt(plan, x, y) === "horizontal") placeHorizontalWall(map, plan, x, y);
      else placeVerticalWall(map, plan, x, y);
    }
  }
  if (
    !plan.rows[plan.height - 1]?.some(isRoom) &&
    Array.from({ length: plan.width }, (_, x) => x).some(
      (x) => at(plan, x, plan.height - 1) === "#" && frontEdge(plan, x, plan.height - 1),
    )
  ) {
    map.pixelHeight -= 16 * SCALE - 6;
  }
  return map;
}
