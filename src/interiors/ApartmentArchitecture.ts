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
  // A divider meeting a side wall owns the full intersection cell. Leaving
  // this classified as vertical shortens the divider by one sketch cell and
  // makes it float beside the perimeter. Rooms on both sides of the branch
  // distinguish this junction from an ordinary exterior corner.
  if (
    [-1, 1].some(
      (dx) =>
        isBoundary(at(plan, x + dx, y)) &&
        isInside(plan, x + dx, y - 1) &&
        isInside(plan, x + dx, y + 1),
    )
  ) {
    return "horizontal";
  }
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

function sharedVerticalJunction(plan: FloorPlan, x: number, y: number): boolean {
  return (
    at(plan, x, y) === "#" &&
    boundaryOnAxis(plan, x - 1, y, "horizontal") &&
    boundaryOnAxis(plan, x + 1, y, "horizontal") &&
    boundaryOnAxis(plan, x, y + 1, "vertical") &&
    isInside(plan, x - 1, y + 1) &&
    isInside(plan, x + 1, y + 1)
  );
}

function placeHorizontalWall(map: LayeredInteriorMap, plan: FloorPlan, x: number, y: number): void {
  const ox = x * SCALE;
  const oy = y * SCALE;
  const rightDoor = at(plan, x + 1, y) === "+" && boundaryOnAxis(plan, x + 1, y, "horizontal");
  const leftEnd = !boundaryOnAxis(plan, x - 1, y, "horizontal");
  const rightEnd = !boundaryOnAxis(plan, x + 1, y, "horizontal");
  // Endpoint cells have side walls above/below, so derive the divider role
  // from the whole run rather than only the cell being painted.
  const [runLeft, runRight] = horizontalBounds(plan, x, y);
  const divider = Array.from({ length: runRight - runLeft + 1 }, (_, i) => runLeft + i).some(
    (px) => isInside(plan, px, y - 1) && isInside(plan, px, y + 1),
  );
  if (frontEdge(plan, x, y)) {
    put(map, "foreground", ox, oy, wall(leftEnd ? 10 : 11, 5), 6);
    // Use the north doorway's clean jamb top at a passage, cropped to the
    // rail height. Exterior corner pieces add an unwanted square end panel.
    put(map, "foreground", ox + 1, oy, rightDoor ? wall(8, 3) : wall(rightEnd ? 13 : 11, 5), 6);
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
    if (
      rightEnd &&
      verticalAbove &&
      verticalBelow &&
      [-1, 1].every((dx) => [-1, 1].every((dy) => isInside(plan, x + dx, y + dy)))
    ) {
      // A west-facing branch meets a continuing partition. Keep its vertical
      // face straight and extend the west arm into the spare atlas column;
      // an east-facing elbow would project a false jamb into the open room.
      for (let dy = 0; dy < SCALE; dy++) {
        put(map, "wall", ox, oy + dy, wall(11, 2 + dy));
        put(map, "wall", ox + 1, oy + dy, wall(10, 2));
      }
      // Join just the exposed outline to the incoming rail; the vertical
      // white strip and shaded side remain continuous through the junction.
      placeInteriorTile(map, "wall", ox + 1, oy, { key: wall(10, 3), cropWidth: 1, cropHeight: 6 });
      return;
    }
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
  if (sharedVerticalJunction(plan, x, y)) {
    // Match the back wall's two-row exterior corner. The c09 sequence has a
    // taller three-row face and makes this partition appear too high.
    for (let dy = 0; dy < SCALE; dy++) {
      const cell = map.cells[oy + dy]?.[ox + 1];
      // At a cross, retain the incoming vertical rail above the intersection.
      if (cell) cell.wall = [{ key: wall(dy === 0 && verticalAbove ? 11 : 10, dy) }];
    }
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
      // Match the opposite jamb to the north door, keeping only its trim.
      if (dy === 0) put(map, "foreground", ox + 1, oy, wall(8, 0), 6);
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
  const shared = isInside(plan, x - 1, y) && isInside(plan, x + 1, y);
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
      if (beforeDoor && shared) {
        // The corner-return tiles intentionally connect to a horizontal wall
        // on their left. A freestanding partition has no such wall: close
        // that exposed end with the one-pixel outline from a doorway jamb.
        placeInteriorTile(map, "wall", wallX, oy + dy, { key: wall(8, dy), cropWidth: 1 });
      }
    }
  }
}

function semanticOf(cell: PlanCell): string {
  return cell === "#" ? "wall" : cell === "+" ? "opening" : cell === " " ? "void" : cell;
}

function placeInteriorJunctionCap(
  map: LayeredInteriorMap,
  plan: FloorPlan,
  x: number,
  y: number,
): void {
  // Interior T/cross intersections have room floor in all four quadrants.
  // Count actual wall arms: openings and simple two-arm bends keep their
  // existing trim, including the preferred plain north/south doorway edges.
  if (
    at(plan, x, y) !== "#" ||
    ![-1, 1].every((dx) => [-1, 1].every((dy) => isInside(plan, x + dx, y + dy)))
  )
    return;
  const arms =
    Number(at(plan, x - 1, y) === "#") +
    Number(at(plan, x + 1, y) === "#") +
    Number(at(plan, x, y - 1) === "#") +
    Number(at(plan, x, y + 1) === "#");
  if (arms < 3) return;
  // All shared partitions use the left-edged gray face in the right atlas
  // column. Copy only its 7×6 outlined top square, not the surrounding rail
  // or shaded wall face, so this is a trim-only change.
  placeInteriorTile(map, "foreground", x * SCALE + 1, y * SCALE, {
    key: wall(10, 5),
    cropWidth: 7,
    cropHeight: 6,
  });
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
      placeInteriorJunctionCap(map, plan, x, y);
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
