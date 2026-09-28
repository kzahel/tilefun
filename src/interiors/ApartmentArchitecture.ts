import type { FloorPlan, PlanCell, RoomKind } from "./ApartmentFloorPlan.js";
import { verticalWallProfile } from "./ApartmentWallAlignment.js";
import { horizontalWallSurface } from "./ApartmentWallSurfaces.js";
import { wallPorts } from "./ApartmentWallTopology.js";
import { placeTwoSidedWalls, placeWallMassSurfaces } from "./ApartmentWideWalls.js";
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
): { dx: number; col: number; floor: RoomKind | null; offsetX: number; railX: number } {
  const profile = verticalWallProfile(plan, x, y);
  return {
    dx: profile.column,
    col: profile.facing === "east" ? 10 : 13,
    floor: roomBeside(plan, x - 1, y) ?? roomBeside(plan, x + 1, y),
    offsetX: profile.tileOffsetX,
    railX: profile.railX,
  };
}

function shiftedWall(
  map: LayeredInteriorMap,
  layer: "wall" | "foreground",
  x: number,
  y: number,
  key: string,
  offsetX: number,
  cropWidth?: number,
): void {
  placeInteriorTile(map, layer, x, y, {
    key,
    ...(offsetX ? { offsetX } : {}),
    ...(cropWidth ? { cropWidth } : {}),
  });
}

/** Fill only the room-owned side of a shifted rail, never the exterior side. */
function shiftedSideFloor(
  map: LayeredInteriorMap,
  plan: FloorPlan,
  x: number,
  y: number,
  railX: number,
): void {
  for (const side of [-1, 1]) {
    const room = at(plan, x + side, y);
    if (!isRoom(room)) continue;
    const left = side < 0 ? 0 : railX + 7;
    const right = side < 0 ? railX : 32;
    for (let dx = 0; dx < SCALE; dx++) {
      const cropX = Math.max(0, left - dx * 16);
      const width = Math.min(16, right - dx * 16) - cropX;
      if (width <= 0) continue;
      for (let dy = 0; dy < SCALE; dy++)
        placeInteriorTile(map, "floor", x * SCALE + dx, y * SCALE + dy, {
          key: FLOOR_TILES[room],
          cropX,
          cropWidth: width,
        });
    }
  }
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
  return horizontalWallSurface(plan, x, y) === "cutaway";
}

function sharedVerticalJunction(plan: FloorPlan, x: number, y: number): boolean {
  return (
    at(plan, x, y) === "#" &&
    boundaryOnAxis(plan, x - 1, y, "horizontal") &&
    boundaryOnAxis(plan, x + 1, y, "horizontal") &&
    isBoundary(at(plan, x, y + 1)) &&
    isInside(plan, x - 1, y + 1) &&
    isInside(plan, x + 1, y + 1)
  );
}

function placeHorizontalWall(map: LayeredInteriorMap, plan: FloorPlan, x: number, y: number): void {
  const ox = x * SCALE;
  const oy = y * SCALE;
  const rightDoor = at(plan, x + 1, y) === "+" && boundaryOnAxis(plan, x + 1, y, "horizontal");
  const cutaway = frontEdge(plan, x, y);
  const leftEnd =
    !boundaryOnAxis(plan, x - 1, y, "horizontal") || (!cutaway && frontEdge(plan, x - 1, y));
  const rightEnd =
    !boundaryOnAxis(plan, x + 1, y, "horizontal") || (!cutaway && frontEdge(plan, x + 1, y));
  // Endpoint cells have side walls above/below, so derive the divider role
  // from the whole run rather than only the cell being painted.
  const [runLeft, runRight] = horizontalBounds(plan, x, y);
  const divider = Array.from({ length: runRight - runLeft + 1 }, (_, i) => runLeft + i).some(
    (px) => isInside(plan, px, y - 1) && isInside(plan, px, y + 1),
  );
  if (cutaway) {
    // A one-cell link can end at another horizontal junction immediately
    // below. Its structural connection still needs a vertical face.
    const continues = isBoundary(at(plan, x, y + 1));
    const face = leftEnd || rightEnd ? sideFace(plan, x, y) : null;
    if (face && continues) {
      // A recessed south edge joins a continuing side wall at the same
      // height as every other south rail. Keep its vertical face below it.
      const adjacent = at(plan, x + (face.dx === 1 ? -1 : 1), y);
      const starts = !isBoundary(at(plan, x, y - 1));
      for (let dy = 0; dy < SCALE; dy++) {
        if (starts && dy === 0 && isRoom(adjacent)) {
          // The low front rail meets the start of a tall side face. Its
          // projection tapers into the room, just like a free vertical start.
          put(map, "floor", ox + face.dx, oy, FLOOR_TILES[adjacent]);
          shiftedWall(
            map,
            "wall",
            ox + face.dx,
            oy,
            wall(face.col === 10 ? 9 : 14, 4),
            face.offsetX,
          );
        } else shiftedWall(map, "wall", ox + face.dx, oy + dy, wall(face.col, 2), face.offsetX);
        if (!face.offsetX && isRoom(adjacent))
          put(map, "floor", ox + 1 - face.dx, oy + dy, FLOOR_TILES[adjacent]);
      }
    }
    if (face?.offsetX) {
      if (continues) shiftedSideFloor(map, plan, x, y, face.railX);
      const left = leftEnd ? face.railX : 0;
      const right = rightEnd ? face.railX + 7 : 32;
      for (let dx = 0; dx < SCALE; dx++) {
        const cropX = Math.max(0, left - dx * 16);
        const width = Math.min(16, right - dx * 16) - cropX;
        if (width > 0)
          placeInteriorTile(map, "foreground", ox + dx, oy, {
            key: rightDoor && dx === 1 ? wall(8, 3) : wall(11, 5),
            cropX,
            cropWidth: width,
            cropHeight: 6,
          });
      }
      placeInteriorTile(map, "foreground", ox + face.dx, oy, {
        key: wall(face.col, 5),
        cropX: face.col === 13 ? 9 : 0,
        cropWidth: 7,
        cropHeight: 6,
        offsetX: face.offsetX,
      });
      return;
    }
    for (let dx = 0; dx < SCALE; dx++) {
      if (face && dx !== face.dx && ((leftEnd && dx < face.dx) || (rightEnd && dx > face.dx)))
        continue;
      const key =
        rightDoor && dx === 1
          ? wall(8, 3)
          : face && dx === face.dx
            ? wall(face.col, 5)
            : wall(11, 5);
      if (face && dx === face.dx && !(rightDoor && dx === 1)) {
        // The rail extends only toward the horizontal arm. Cropping the
        // unused arm avoids a white spur projecting into room floor.
        const joinsShift =
          isBoundary(at(plan, x, y - 1)) && sideFace(plan, x, y - 1).railX !== face.railX;
        const cropX = !joinsShift && leftEnd && face.col === 13 ? 9 : 0;
        const cropWidth =
          !joinsShift && ((leftEnd && face.col === 13) || (rightEnd && face.col === 10)) ? 7 : 16;
        if (cropWidth === 16) put(map, "foreground", ox + dx, oy, key, 6);
        else
          placeInteriorTile(map, "foreground", ox + dx, oy, {
            key,
            ...(cropX ? { cropX } : {}),
            cropWidth,
            cropHeight: 6,
          });
      } else put(map, "foreground", ox + dx, oy, key, 6);
    }
    return;
  }
  const openSide = rightEnd ? at(plan, x + 1, y) : leftEnd ? at(plan, x - 1, y) : " ";
  const ports = wallPorts(plan, x, y);
  const bend = ports.count === 2 && (ports.north || ports.south) && (ports.east || ports.west);
  // Two bends can touch directly. Their connection survives even when both
  // nodes use horizontal atlas assemblies and no straight cell lies between.
  const verticalAbove = boundaryOnAxis(plan, x, y - 1, "vertical") || (bend && ports.north);
  const verticalBelow = boundaryOnAxis(plan, x, y + 1, "vertical") || (bend && ports.south);
  if (isRoom(openSide) && (verticalAbove || verticalBelow)) {
    const continuingFace = sideFace(plan, x, y + 1);
    if (leftEnd && verticalAbove && verticalBelow && continuingFace.col === 13) {
      // A west-facing partition meeting an east branch has no inward elbow
      // on its west side. Keep that face straight; the branch joins its rail
      // from the east, with a small cap at the actual intersection.
      for (let dy = 0; dy < SCALE; dy++) {
        put(map, "wall", ox + continuingFace.dx, oy + dy, wall(13, 2));
        put(map, "floor", ox + 1 - continuingFace.dx, oy + dy, FLOOR_TILES[openSide]);
      }
      placeInteriorTile(map, "foreground", ox + continuingFace.dx, oy, {
        key: wall(13, 5),
        cropX: 9,
        cropWidth: 7,
        cropHeight: 6,
      });
      return;
    }
    if (
      rightEnd &&
      verticalAbove &&
      verticalBelow &&
      continuingFace.col === 10 &&
      !continuingFace.offsetX
    ) {
      // A west-facing branch meets a continuing partition. Keep its vertical
      // face straight and extend the west arm into the spare atlas column;
      // an east-facing elbow would project a false jamb into the open room.
      for (let dy = 0; dy < SCALE; dy++) {
        if (continuingFace.dx === 1) put(map, "wall", ox, oy + dy, wall(11, 2 + dy));
        else put(map, "floor", ox + 1, oy + dy, FLOOR_TILES[openSide]);
        put(map, "wall", ox + continuingFace.dx, oy + dy, wall(10, 2));
      }
      // Join just the exposed outline to the incoming rail; the vertical
      // white strip and shaded side remain continuous through the junction.
      placeInteriorTile(map, "wall", ox + continuingFace.dx, oy, {
        key: wall(10, 3),
        cropWidth: 1,
        cropHeight: 6,
      });
      return;
    }
    // At a T-junction the downward side wall owns the continuing corner.
    const fromAbove = verticalAbove && !verticalBelow;
    const face = sideFace(plan, x, fromAbove ? y - 1 : y + 1);
    for (let dy = 0; dy < SCALE; dy++) {
      shiftedWall(
        map,
        face.offsetX ? "foreground" : "wall",
        ox + face.dx,
        oy + dy,
        wall(face.col, fromAbove ? 3 + dy : dy),
        face.offsetX,
      );
      if (!face.offsetX) {
        const armInSpareColumn = face.dx === 1 ? ports.west : ports.east;
        if (armInSpareColumn) put(map, "wall", ox + 1 - face.dx, oy + dy, wall(11, 2 + dy));
        else put(map, "floor", ox + 1 - face.dx, oy + dy, FLOOR_TILES[openSide]);
      }
    }
    if (face.offsetX) shiftedSideFloor(map, plan, x, y, face.railX);
    return;
  }
  for (let dy = 0; dy < SCALE; dy++) {
    const top = dy === 0;
    const left = leftEnd
      ? wall(divider && !(verticalBelow && !verticalAbove) ? (top ? 11 : 10) : 10, top ? 0 : 1)
      : wall(11, top ? 2 : 3);
    const right = rightDoor
      ? wall(8, top ? 3 : 4)
      : rightEnd
        ? wall(
            divider && !(verticalBelow && !verticalAbove)
              ? 12
              : sideFace(plan, x, y + (verticalBelow ? 1 : 0)).col,
            top ? 0 : 1,
          )
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
      const face = sideFace(plan, x, y + 1);
      const key = wall(dy === 0 && verticalAbove ? (face.col === 13 ? 12 : 11) : face.col, dy);
      if (face.offsetX) shiftedWall(map, "foreground", ox + 1, oy + dy, key, face.offsetX);
      else if (cell) cell.wall = [{ key }];
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

function placeHorizontalEnd(
  map: LayeredInteriorMap,
  x: number,
  y: number,
  extendsEast: boolean,
): void {
  // A freestanding horizontal end is a flat wall face with a closed edge,
  // not a pair of inside corners enclosing a miniature room.
  for (let dy = 0; dy < SCALE; dy++) {
    for (let dx = 0; dx < SCALE; dx++)
      put(
        map,
        "wall",
        x * SCALE + dx,
        y * SCALE + dy,
        extendsEast && dx === 0 ? wall(8, dy) : wall(11, 2 + dy),
      );
    if (!extendsEast)
      placeInteriorTile(map, "wall", x * SCALE + 1, y * SCALE + dy, {
        key: wall(8, dy),
        cropWidth: 1,
        offsetX: 15,
      });
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
  const ports = wallPorts(plan, x, y);
  const freeEnd = ports.count === 1 && ports.north;
  const freeStart = ports.count === 1 && ports.south;
  const afterDoor = at(plan, x, y - 1) === "+" && boundaryOnAxis(plan, x, y - 1, "vertical");
  const shared = isInside(plan, x - 1, y) && isInside(plan, x + 1, y);
  if (face.offsetX) shiftedSideFloor(map, plan, x, y, face.railX);
  // A shared wall has one visible side-wall face. The other half of the sketch
  // cell continues the neighboring floor, so it does not create two rails.
  for (let dy = 0; dy < SCALE; dy++) {
    const row = beforeDoor || freeEnd ? 3 + dy : 2;
    const wallX = ox + face.dx;
    const floorX = ox + 1 - face.dx;
    const spareRoom = at(plan, x + (face.dx === 1 ? -1 : 1), y);
    if (isRoom(spareRoom) && !face.offsetX)
      put(map, "floor", floorX, oy + dy, FLOOR_TILES[spareRoom]);
    if ((afterDoor || freeStart) && dy === 0 && face.floor) {
      put(map, "floor", wallX, oy, FLOOR_TILES[face.floor]);
      shiftedWall(map, "foreground", wallX, oy, wall(face.col === 10 ? 9 : 14, 4), face.offsetX);
    } else {
      shiftedWall(map, "wall", wallX, oy + dy, wall(face.col, row), face.offsetX);
      if ((beforeDoor || freeEnd) && shared) {
        // The corner-return tiles intentionally connect to a horizontal wall
        // on their left. A freestanding partition has no such wall: close
        // that exposed end with the one-pixel outline from a doorway jamb.
        shiftedWall(
          map,
          "wall",
          wallX,
          oy + dy,
          wall(8, dy),
          face.offsetX + (face.col === 13 ? 15 : 0),
          1,
        );
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
  const offsetX = verticalWallProfile(plan, x, y).railX - 16;
  placeInteriorTile(map, "foreground", x * SCALE + 1, y * SCALE, {
    key: wall(10, 5),
    cropWidth: 7,
    cropHeight: 6,
    ...(offsetX ? { offsetX } : {}),
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
      const ports = wallPorts(plan, x, y);
      if (ports.count === 1 && (ports.north || ports.south)) placeVerticalWall(map, plan, x, y);
      else if (ports.count === 1 && (ports.east || ports.west))
        placeHorizontalEnd(map, x, y, ports.east);
      else if (axisAt(plan, x, y) === "horizontal") placeHorizontalWall(map, plan, x, y);
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
  placeTwoSidedWalls(map, plan);
  placeWallMassSurfaces(map, plan);
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
