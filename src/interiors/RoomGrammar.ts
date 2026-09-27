import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";

const TILE_SIZE = 16;
const WALLS = "room-builder/3d-walls";
const FLOOR = "room-builder/floors/c01-r31";

function wall(col: number, row: number): string {
  return `${WALLS}/c${String(col).padStart(2, "0")}-r${String(row).padStart(2, "0")}`;
}

export type RoomTileRole = "floor" | "back-wall" | "side-wall" | "front-wall" | "divider-wall";

export interface PlacedRoomTile {
  key: string;
  x: number;
  y: number;
  role: RoomTileRole;
  blocksMovement: boolean;
}

export interface RoomSpec {
  width: number;
  height: number;
  /** Two adjacent walkable tiles in the front boundary. */
  frontOpeningX?: number;
  /** A two-tile-high wall with a two-tile passage. */
  divider?: { y: number; openingX: number };
}

/**
 * A small, curated grammar for the gray 3D-wall family. Its back and side tiles
 * occur in Generic Home 1's shell. This is a cutaway room, so the front edge is
 * a low rail rather than another back wall.
 */
export function buildRoomTiles(spec: RoomSpec): PlacedRoomTile[] {
  const { width, height, frontOpeningX, divider } = spec;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 6 || height < 6) {
    throw new Error("Room must be at least 6 by 6 whole tiles");
  }
  if (
    frontOpeningX !== undefined &&
    (!Number.isInteger(frontOpeningX) || frontOpeningX < 2 || frontOpeningX > width - 4)
  ) {
    throw new Error("Front opening must leave at least two wall tiles on each side");
  }
  if (
    divider &&
    (!Number.isInteger(divider.y) ||
      !Number.isInteger(divider.openingX) ||
      divider.y < 3 ||
      divider.y > height - 4 ||
      divider.openingX < 2 ||
      divider.openingX > width - 4)
  ) {
    throw new Error("Divider and passage must fit inside the room");
  }

  const tiles: PlacedRoomTile[] = [];
  const put = (key: string, x: number, y: number, role: RoomTileRole): void => {
    tiles.push({ key, x, y, role, blocksMovement: role !== "floor" });
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) put(FLOOR, x, y, "floor");
  }

  // The source pack provides top corners, a repeating horizontal face, and
  // repeating side faces. Use those independently of the room dimensions.
  for (let x = 0; x < width; x++) {
    const col = x === 0 ? 10 : x === width - 1 ? 13 : 11;
    put(wall(col, x === 0 || x === width - 1 ? 0 : 2), x, 0, "back-wall");
    put(wall(col, x === 0 || x === width - 1 ? 1 : 3), x, 1, "back-wall");
  }
  for (let y = 2; y < height - 2; y++) {
    put(wall(10, 2), 0, y, "side-wall");
    put(wall(13, 2), width - 1, y, "side-wall");
  }
  put(wall(10, 4), 0, height - 2, "side-wall");
  put(wall(13, 4), width - 1, height - 2, "side-wall");

  for (let x = 0; x < width; x++) {
    if (frontOpeningX !== undefined && x >= frontOpeningX && x < frontOpeningX + 2) continue;
    put(wall(11, 5), x, height - 1, "front-wall");
  }

  if (divider) {
    for (let x = 1; x < width - 1; x++) {
      if (x >= divider.openingX && x < divider.openingX + 2) continue;
      // These four edge tiles frame the same passage in Generic Home 1.
      const isLeftDoorEdge = x === divider.openingX - 1;
      const isRightDoorEdge = x === divider.openingX + 2;
      const col = isLeftDoorEdge || isRightDoorEdge ? 8 : 11;
      const topRow = isLeftDoorEdge ? 3 : isRightDoorEdge ? 0 : 2;
      const bottomRow = isLeftDoorEdge ? 4 : isRightDoorEdge ? 1 : 3;
      put(wall(col, topRow), x, divider.y, "divider-wall");
      put(wall(col, bottomRow), x, divider.y + 1, "divider-wall");
    }
  }

  return tiles;
}

function drawRoom(
  ctx: CanvasRenderingContext2D,
  atlasImage: CanvasImageSource,
  spec: RoomSpec,
  x: number,
  y: number,
  scale: number,
): void {
  for (const tile of buildRoomTiles(spec)) {
    const entry = getModernInteriorsEntry(tile.key);
    if (!entry) throw new Error(`Missing room grammar tile: ${tile.key}`);
    const [sx, sy, sw, sh] = entry.rect;
    ctx.drawImage(
      atlasImage,
      sx,
      sy,
      sw,
      sh,
      x + tile.x * TILE_SIZE * scale,
      y + tile.y * TILE_SIZE * scale,
      sw * scale,
      sh * scale,
    );
  }
}

export function drawRoomGrammarPreview(
  canvas: HTMLCanvasElement,
  atlasImage: CanvasImageSource,
): void {
  const scale = 2;
  canvas.width = 496;
  canvas.height = 1100;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0e1118";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#9bd7ff";
  ctx.font = "bold 14px monospace";
  ctx.fillText("Room grammar: gray wall family", 20, 24);

  const examples: { title: string; note: string; y: number; spec: RoomSpec }[] = [
    {
      title: "A. Compact room, front passage",
      note: "8 x 8 tiles; back/side/front rules",
      y: 62,
      spec: { width: 8, height: 8, frontOpeningX: 3 },
    },
    {
      title: "B. Same rules, wider room",
      note: "12 x 8 tiles; horizontal pieces repeat",
      y: 380,
      spec: { width: 12, height: 8, frontOpeningX: 5 },
    },
    {
      title: "C. Divider with a two-tile passage",
      note: "12 x 10 tiles; matching doorway edge pieces",
      y: 700,
      spec: { width: 12, height: 10, frontOpeningX: 5, divider: { y: 5, openingX: 5 } },
    },
  ];
  for (const { title, note, y, spec } of examples) {
    ctx.fillStyle = "#dbe8ff";
    ctx.font = "12px monospace";
    ctx.fillText(title, 32, y - 12);
    drawRoom(ctx, atlasImage, spec, 32, y, scale);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText(note, 32, y + spec.height * TILE_SIZE * scale + 16);
  }
}
