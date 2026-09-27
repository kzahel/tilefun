import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";
import {
  createLayeredInteriorMap,
  drawLayeredInteriorMap,
  type LayeredInteriorMap,
  placeInteriorTile,
} from "./LayeredInteriorMap.js";

type Material = "wood" | "tile";
type WallPart =
  | "back-top"
  | "back-bottom"
  | "divider-top"
  | "divider-bottom"
  | "left-side"
  | "right-side"
  | "front"
  | "taper-right"
  | "wing-front";
type Passage = "north" | "divider" | "south";

export interface ConnectedRoomCell {
  floor: Material | null;
  wall: WallPart | null;
  passage: Passage | null;
}

export interface ConnectedRoomPlan {
  width: number;
  height: number;
  cells: ConnectedRoomCell[][];
  dividerY: number;
  lowerRight: number;
  upperRight: number;
  northOpeningX: number;
  dividerOpeningX: number;
  southOpeningX: number;
}

export interface ConnectedRoomSpec {
  /** Interior width of the lower room, in tiles. */
  lowerWidth: number;
  /** Extra width of the upper room's right wing, in tiles. */
  upperRightWing: number;
  upperHeight: number;
  lowerHeight: number;
  northOpeningX: number;
  dividerOpeningX: number;
  southOpeningX: number;
}

const WOOD = "room-builder/floors/c01-r31";

function wall(col: number, row: number): string {
  return `room-builder/3d-walls/c${String(col).padStart(2, "0")}-r${String(row).padStart(2, "0")}`;
}

function requireSpec(spec: ConnectedRoomSpec): void {
  const { lowerWidth, upperRightWing, upperHeight, lowerHeight } = spec;
  const right = lowerWidth;
  if (
    !Number.isInteger(lowerWidth) ||
    lowerWidth < 8 ||
    lowerWidth > 20 ||
    !Number.isInteger(upperRightWing) ||
    (upperRightWing !== 0 && upperRightWing < 2) ||
    upperRightWing > 5 ||
    !Number.isInteger(upperHeight) ||
    upperHeight < 5 ||
    !Number.isInteger(lowerHeight) ||
    lowerHeight < 3 ||
    ![spec.northOpeningX, spec.dividerOpeningX, spec.southOpeningX].every(Number.isInteger) ||
    spec.northOpeningX < 2 ||
    spec.northOpeningX > right + upperRightWing - 1 ||
    spec.dividerOpeningX < 2 ||
    spec.dividerOpeningX > right - 1 ||
    spec.southOpeningX < 2 ||
    spec.southOpeningX > right - 1
  ) {
    throw new Error("Connected-room dimensions and passages must fit inside both rooms");
  }
}

/** A semantic sketch with independent floor, wall and passage channels. */
export function buildConnectedRoomPlan(spec: ConnectedRoomSpec): ConnectedRoomPlan {
  requireSpec(spec);
  const dividerY = spec.upperHeight + 2;
  const lowerRight = spec.lowerWidth;
  const upperRight = lowerRight + spec.upperRightWing;
  const width = upperRight + 2;
  const height = dividerY + spec.lowerHeight + 3;
  const cells: ConnectedRoomCell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ floor: null, wall: null, passage: null })),
  );
  const cell = (x: number, y: number): ConnectedRoomCell => cells[y]?.[x] as ConnectedRoomCell;
  const floor = (x: number, y: number, material: Material): void => {
    cell(x, y).floor = material;
  };
  const wallPart = (x: number, y: number, part: WallPart): void => {
    cell(x, y).wall = part;
  };
  const passage = (x: number, y: number, kind: Passage, material: Material | null): void => {
    cell(x, y).passage = kind;
    if (material) floor(x, y, material);
  };

  for (let x = 0; x <= upperRight + 1; x++) {
    for (const y of [0, 1]) {
      if (x === spec.northOpeningX) passage(x, y, "north", "wood");
      else wallPart(x, y, y === 0 ? "back-top" : "back-bottom");
    }
  }
  for (let y = 2; y < dividerY - 2; y++) {
    wallPart(0, y, "left-side");
    wallPart(upperRight + 1, y, "right-side");
    for (let x = 1; x <= upperRight; x++) floor(x, y, "wood");
  }
  const shoulderY = dividerY - 2;
  wallPart(0, shoulderY, "left-side");
  for (let x = 1; x <= lowerRight; x++) floor(x, shoulderY, "wood");
  if (spec.upperRightWing > 0) {
    // The source's taper is an opaque/transparent wall piece over wood floor.
    floor(lowerRight + 1, shoulderY, "wood");
    wallPart(lowerRight + 1, shoulderY, "taper-right");
    for (let x = lowerRight + 2; x <= upperRight + 1; x++) {
      wallPart(x, shoulderY, "wing-front");
    }
  } else {
    wallPart(lowerRight + 1, shoulderY, "right-side");
  }
  wallPart(0, dividerY - 1, "left-side");
  wallPart(lowerRight + 1, dividerY - 1, "right-side");
  for (let x = 1; x <= lowerRight; x++) floor(x, dividerY - 1, "wood");

  for (let x = 0; x <= lowerRight + 1; x++) {
    for (const y of [dividerY, dividerY + 1]) {
      if (x === spec.dividerOpeningX) passage(x, y, "divider", "wood");
      else wallPart(x, y, y === dividerY ? "divider-top" : "divider-bottom");
    }
  }
  for (let y = dividerY + 2; y < height - 1; y++) {
    wallPart(0, y, "left-side");
    wallPart(lowerRight + 1, y, "right-side");
    for (let x = 1; x <= lowerRight; x++) floor(x, y, "tile");
  }
  for (let x = 0; x <= lowerRight + 1; x++) {
    if (x === spec.southOpeningX) passage(x, height - 1, "south", null);
    else wallPart(x, height - 1, "front");
  }
  return {
    width,
    height,
    cells,
    dividerY,
    lowerRight,
    upperRight,
    northOpeningX: spec.northOpeningX,
    dividerOpeningX: spec.dividerOpeningX,
    southOpeningX: spec.southOpeningX,
  };
}

function bandTile(plan: ConnectedRoomPlan, x: number, part: WallPart): string {
  const divider = part.startsWith("divider");
  const top = part.endsWith("top");
  const openingX = divider ? plan.dividerOpeningX : plan.northOpeningX;
  const right = divider ? plan.lowerRight + 1 : plan.upperRight + 1;
  if (x === openingX - 1) return wall(8, top ? 3 : 4);
  if (x === openingX + 1) return wall(8, top ? 0 : 1);
  if (x === 0) return wall(divider ? (top ? 11 : 10) : 10, top ? 0 : 1);
  if (x === right) return wall(divider ? 12 : 13, top ? 0 : 1);
  return wall(11, top ? 2 : 3);
}

/** Selects the source's architectural tiles from semantic floor/wall parts. */
export function compileConnectedRoomPlan(plan: ConnectedRoomPlan): LayeredInteriorMap {
  const map = createLayeredInteriorMap(
    plan.width,
    plan.height,
    (plan.height - 1) * 16 + 6,
    (x, y) => {
      const item = plan.cells[y]?.[x];
      return item?.passage ?? item?.wall ?? item?.floor ?? "void";
    },
  );
  for (let y = 0; y < plan.height; y++) {
    for (let x = 0; x < plan.width; x++) {
      const item = plan.cells[y]?.[x];
      if (!item) continue;
      if (item.floor) {
        const row = item.floor === "wood" ? 31 : y === plan.dividerY + 2 ? 34 : 35;
        const col = item.floor === "wood" ? 1 : x === 1 ? 12 : x === plan.lowerRight ? 14 : 13;
        placeInteriorTile(map, "floor", x, y, {
          key:
            item.floor === "wood"
              ? WOOD
              : `room-builder/floors/c${String(col).padStart(2, "0")}-r${row}`,
        });
      }
      if (!item.wall) continue;
      const part = item.wall;
      if (part === "taper-right") {
        placeInteriorTile(map, "foreground", x, y, { key: wall(14, 4) });
      } else if (part === "wing-front" || part === "front") {
        const col = x === 0 ? 10 : x === plan.lowerRight + 1 && part === "front" ? 13 : 11;
        placeInteriorTile(map, "foreground", x, y, { key: wall(col, 5), cropHeight: 6 });
      } else {
        const key =
          part === "left-side"
            ? wall(10, 2)
            : part === "right-side"
              ? wall(13, 2)
              : bandTile(plan, x, part);
        placeInteriorTile(map, "wall", x, y, { key });
      }
    }
  }
  return map;
}

export const CONNECTED_ROOM_EXAMPLES = [
  {
    name: "A. Straight shared wall",
    note: "Centered passage; two-tile wall faces",
    spec: {
      lowerWidth: 10,
      upperRightWing: 0,
      upperHeight: 6,
      lowerHeight: 4,
      northOpeningX: 6,
      dividerOpeningX: 6,
      southOpeningX: 6,
    },
  },
  {
    name: "B. Shifted passage + offset edge",
    note: "Passage moves left; transparent taper covers floor",
    spec: {
      lowerWidth: 10,
      upperRightWing: 2,
      upperHeight: 6,
      lowerHeight: 4,
      northOpeningX: 6,
      dividerOpeningX: 4,
      southOpeningX: 6,
    },
  },
] as const;

function drawSemanticMap(
  ctx: CanvasRenderingContext2D,
  plan: ConnectedRoomPlan,
  x0: number,
  y0: number,
): void {
  const size = 16;
  const colors: Record<string, string> = {
    void: "#151b26",
    wood: "#94725f",
    tile: "#b6bbc0",
    wall: "#62748c",
    north: "#21a784",
    divider: "#21a784",
    south: "#21a784",
  };
  for (let y = 0; y < plan.height; y++) {
    for (let x = 0; x < plan.width; x++) {
      const item = plan.cells[y]?.[x];
      const role = item?.passage ?? (item?.wall ? "wall" : (item?.floor ?? "void"));
      ctx.fillStyle = colors[role] ?? "#151b26";
      ctx.fillRect(x0 + x * size, y0 + y * size, size - 1, size - 1);
    }
  }
}

export function drawConnectedRoomGrammarPreview(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
): void {
  canvas.width = 1510;
  canvas.height = 880;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0e1118";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#9bd7ff";
  ctx.font = "bold 16px monospace";
  ctx.fillText("Connected rooms: one semantic plan, layered tile rules", 20, 28);
  ctx.fillStyle = "#dbe8ff";
  ctx.font = "12px monospace";
  ctx.fillText("Source shell", 20, 58);
  const source = getModernInteriorsEntry("home-design/generic-home-designs/generic-home-1/layer-1");
  if (!source) throw new Error("Missing Generic Home 1 source shell");
  const [sx, sy, sw, sh] = source.rect;
  ctx.drawImage(image, sx, sy, sw, sh, 20, 72, sw * 2, sh * 2);

  for (const [index, example] of CONNECTED_ROOM_EXAMPLES.entries()) {
    const plan = buildConnectedRoomPlan(example.spec);
    const map = compileConnectedRoomPlan(plan);
    const x = 510 + index * 500;
    ctx.fillStyle = "#dbe8ff";
    ctx.font = "12px monospace";
    ctx.fillText(example.name, x, 58);
    const roomCanvas = document.createElement("canvas");
    roomCanvas.width = map.width * 16;
    roomCanvas.height = map.pixelHeight;
    const roomCtx = roomCanvas.getContext("2d");
    if (roomCtx) {
      drawLayeredInteriorMap(roomCtx, image, map);
      ctx.drawImage(roomCanvas, x, 72, roomCanvas.width * 2, roomCanvas.height * 2);
    }
    ctx.fillStyle = "#aab9c9";
    ctx.font = "11px monospace";
    ctx.fillText(example.note, x, 585);
    ctx.fillText("Semantic floor / wall / passage map", x, 620);
    drawSemanticMap(ctx, plan, x, 635);
  }
  ctx.fillStyle = "#aab9c9";
  ctx.font = "11px monospace";
  ctx.fillText(
    "The same wall and passage rules generate both variants. The source remains the visual control.",
    20,
    558,
  );
}
