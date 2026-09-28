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
  B: "room-builder/floors/c01-r31",
  K: "room-builder/floors/c13-r35",
  T: "room-builder/floors/c13-r35",
  H: "room-builder/floors/c01-r31",
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

function isInside(plan: FloorPlan, x: number, y: number): boolean {
  return plan.inside[y]?.[x] ?? false;
}

function axisAt(plan: FloorPlan, x: number, y: number): Axis {
  const north = isInside(plan, x, y - 1);
  const south = isInside(plan, x, y + 1);
  const west = isInside(plan, x - 1, y);
  const east = isInside(plan, x + 1, y);
  if (north || south) return "horizontal";
  // Include the elbow cell in a front wall when a horizontal face turns into
  // a side wall below it. Otherwise its face shifts by one atlas column.
  if (
    isBoundary(at(plan, x, y + 1)) &&
    ((east && isBoundary(at(plan, x - 1, y))) || (west && isBoundary(at(plan, x + 1, y))))
  ) {
    return "horizontal";
  }
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

function sideFace(
  plan: FloorPlan,
  x: number,
  y: number,
): { dx: number; col: number; floor: RoomKind | null } {
  const west = roomBeside(plan, x - 1, y);
  const east = roomBeside(plan, x + 1, y);
  const westInside = [0, -1, 1].some((dy) => isInside(plan, x - 1, y + dy));
  const eastInside = [0, -1, 1].some((dy) => isInside(plan, x + 1, y + dy));
  return {
    dx: westInside ? 1 : 0,
    col: eastInside ? 10 : westInside ? 13 : 10,
    floor: west ?? east,
  };
}

function doorwayFloor(plan: FloorPlan, x: number, y: number): RoomKind {
  const axis = axisAt(plan, x, y);
  const candidates =
    axis === "horizontal"
      ? [at(plan, x, y - 1), at(plan, x, y + 1)]
      : [at(plan, x - 1, y), at(plan, x + 1, y)];
  // Keep wood through a mixed-material passage, then change material on the
  // room floor beyond it, as in the validated Generic Home divider.
  const rooms = candidates.filter(isRoom);
  const room = rooms.find((cell) => FLOOR_TILES[cell] === FLOOR_TILES.L) ?? rooms[0];
  if (!room) throw new Error(`Passage at ${x},${y} has no floor`);
  return room;
}

function horizontalBounds(plan: FloorPlan, x: number, y: number): [number, number] {
  let left = x;
  let right = x;
  while (boundaryOnAxis(plan, left - 1, y, "horizontal")) left--;
  while (boundaryOnAxis(plan, right + 1, y, "horizontal")) right++;
  return [left, right];
}

function frontEdge(plan: FloorPlan, x: number, y: number): boolean {
  const [left, right] = horizontalBounds(plan, x, y);
  let insideAbove = false;
  for (let px = left; px <= right; px++) {
    insideAbove ||= isInside(plan, px, y - 1);
    if (at(plan, px, y + 1) !== " ") return false;
  }
  return insideAbove;
}

function bayFrontEdge(plan: FloorPlan, x: number, y: number): boolean {
  const [left, right] = horizontalBounds(plan, x, y);
  if (right - left < 2) return false;
  let floorAbove = false;
  let sideBelow = false;
  for (let px = left; px <= right; px++) {
    floorAbove ||= isRoom(at(plan, px, y - 1));
    const below = at(plan, px, y + 1);
    if (below === " ") continue;
    if ((px === left || px === right) && boundaryOnAxis(plan, px, y + 1, "vertical")) {
      sideBelow = true;
      continue;
    }
    return false;
  }
  return floorAbove && sideBelow;
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
    put(map, "foreground", ox, oy, wall(leftDoor ? 11 : leftEnd ? 10 : 11, 5), 6);
    put(map, "foreground", ox + 1, oy, wall(rightDoor ? 11 : rightEnd ? 13 : 11, 5), 6);
    return;
  }
  if (bayFrontEdge(plan, x, y)) {
    const above = at(plan, x, y - 1);
    const sideBelow = boundaryOnAxis(plan, x, y + 1, "vertical");
    const face = sideBelow ? sideFace(plan, x, y + 1) : null;
    const room = isRoom(above) ? above : (face?.floor ?? roomBeside(plan, x, y - 1));
    if (!room) throw new Error(`Bay front at ${x},${y} has no floor above it`);
    for (let dx = 0; dx < SCALE; dx++) {
      put(map, "floor", ox + dx, oy, FLOOR_TILES[room]);
    }
    for (let dx = 0; dx < SCALE; dx++) {
      if (face && dx === face.dx) {
        put(map, "floor", ox + dx, oy + 1, FLOOR_TILES[room]);
        put(map, "foreground", ox + dx, oy + 1, wall(face.col === 10 ? 9 : 14, 4));
      } else if (face) {
        // The other half of this expanded endpoint is room floor beside the
        // side-wall taper, not a dangling piece of trim over the void.
        put(map, "floor", ox + dx, oy + 1, FLOOR_TILES[room]);
      } else {
        put(map, "foreground", ox + dx, oy + 1, wall(11, 5), 6);
      }
    }
    return;
  }
  const openSide = rightEnd ? at(plan, x + 1, y) : leftEnd ? at(plan, x - 1, y) : " ";
  const verticalAbove = boundaryOnAxis(plan, x, y - 1, "vertical");
  const verticalBelow = boundaryOnAxis(plan, x, y + 1, "vertical");
  if (isRoom(openSide) && (verticalAbove || verticalBelow)) {
    // At a T-junction the downward side wall owns the continuing corner.
    const fromAbove = verticalAbove && !verticalBelow;
    const face = sideFace(plan, x, fromAbove ? y - 1 : y + 1);
    for (let dy = 0; dy < SCALE; dy++) {
      put(map, "wall", ox + face.dx, oy + dy, wall(face.col, fromAbove ? 3 + dy : dy));
      put(map, "floor", ox + 1 - face.dx, oy + dy, FLOOR_TILES[openSide]);
    }
    return;
  }
  for (let dy = 0; dy < SCALE; dy++) {
    const top = dy === 0;
    const left = leftEnd
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

function placeHorizontalDoor(map: LayeredInteriorMap, plan: FloorPlan, x: number, y: number): void {
  const ox = x * SCALE;
  const oy = y * SCALE;
  // A sketch cell spans two atlas columns. Keep the passage in its left
  // column and use the right column for the source's one-tile jamb. The
  // approved room has a one-tile passage through a two-row divider.
  const frontEntrance = isRoom(at(plan, x, y - 1)) && at(plan, x, y + 1) === " ";
  for (let dy = 0; dy < SCALE; dy++) {
    const cell = map.cells[oy + dy]?.[ox + 1];
    if (!cell) throw new Error(`Expanded passage cell ${x},${y} is missing`);
    cell.semantic = "wall";
    if (frontEntrance) {
      if (dy === 0) put(map, "foreground", ox + 1, oy, wall(11, 5), 6);
    } else {
      put(map, "wall", ox + 1, oy + dy, wall(8, dy));
    }
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
  const face = sideFace(plan, x, y);
  const beforeDoor = at(plan, x, y + 1) === "+" && boundaryOnAxis(plan, x, y + 1, "vertical");
  const afterDoor = at(plan, x, y - 1) === "+" && boundaryOnAxis(plan, x, y - 1, "vertical");
  // A shared wall has one visible side-wall face. The other half of the sketch
  // cell continues the neighboring floor, so it does not create two rails.
  for (let dy = 0; dy < SCALE; dy++) {
    const row = beforeDoor ? 3 + dy : 2;
    const wallX = ox + face.dx;
    const floorX = ox + 1 - face.dx;
    if (face.floor) put(map, "floor", floorX, oy + dy, FLOOR_TILES[face.floor]);
    if (afterDoor && dy === 0 && face.floor) {
      put(map, "floor", wallX, oy, FLOOR_TILES[face.floor]);
      put(map, "foreground", wallX, oy, wall(face.col === 10 ? 9 : 14, 4));
    } else {
      put(map, "wall", wallX, oy + dy, wall(face.col, row));
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
  for (let y = 0; y < plan.height; y++) {
    for (let x = 0; x < plan.width; x++) {
      if (at(plan, x, y) === "+" && axisAt(plan, x, y) === "horizontal") {
        placeHorizontalDoor(map, plan, x, y);
      }
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
