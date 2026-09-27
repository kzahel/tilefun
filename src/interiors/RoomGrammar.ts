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
  cropHeight?: number;
}

export interface RoomSpec {
  width: number;
  height: number;
  /** One-tile exit through the six-pixel front trim. */
  frontOpeningX?: number;
  /** A two-tile-high wall with a one-tile passage. */
  divider?: { y: number; openingX: number };
}

/**
 * A small, curated grammar for the gray 3D-wall family. Its back and side tiles
 * occur in Generic Home 1's shell. The source has straight side walls and a
 * six-pixel bottom trim; its tapered corner pieces belong at shape changes.
 */
export function buildRoomTiles(spec: RoomSpec): PlacedRoomTile[] {
  const { width, height, frontOpeningX, divider } = spec;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 6 || height < 6) {
    throw new Error("Room must be at least 6 by 6 whole tiles");
  }
  if (
    frontOpeningX !== undefined &&
    (!Number.isInteger(frontOpeningX) || frontOpeningX < 2 || frontOpeningX > width - 3)
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
      divider.openingX > width - 3)
  ) {
    throw new Error("Divider and passage must fit inside the room");
  }

  const tiles: PlacedRoomTile[] = [];
  const put = (
    key: string,
    x: number,
    y: number,
    role: RoomTileRole,
    cropHeight?: number,
  ): void => {
    tiles.push({
      key,
      x,
      y,
      role,
      blocksMovement: role !== "floor",
      ...(cropHeight ? { cropHeight } : {}),
    });
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
  for (let y = 2; y < height; y++) {
    if (divider && (y === divider.y || y === divider.y + 1)) continue;
    put(wall(10, 2), 0, y, "side-wall");
    put(wall(13, 2), width - 1, y, "side-wall");
  }

  for (let x = 0; x < width; x++) {
    if (x === frontOpeningX) continue;
    put(wall(x === 0 ? 10 : x === width - 1 ? 13 : 11, 5), x, height, "front-wall", 6);
  }

  if (divider) {
    for (let x = 0; x < width; x++) {
      if (x === divider.openingX) continue;
      // Generic Home 1's divider replaces the side-wall tiles at both ends.
      // Its end caps make a continuous join from the left edge to the right.
      const isLeftDoorEdge = x === divider.openingX - 1;
      const isRightDoorEdge = x === divider.openingX + 1;
      const top =
        x === 0
          ? [11, 0]
          : x === width - 1
            ? [12, 0]
            : isLeftDoorEdge
              ? [8, 3]
              : isRightDoorEdge
                ? [8, 0]
                : [11, 2];
      const bottom =
        x === 0
          ? [10, 1]
          : x === width - 1
            ? [12, 1]
            : isLeftDoorEdge
              ? [8, 4]
              : isRightDoorEdge
                ? [8, 1]
                : [11, 3];
      put(wall(top[0] as number, top[1] as number), x, divider.y, "divider-wall");
      put(wall(bottom[0] as number, bottom[1] as number), x, divider.y + 1, "divider-wall");
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
    const [sx, sy, sw] = entry.rect;
    const sh = tile.cropHeight ?? TILE_SIZE;
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
      spec: { width: 8, height: 8, frontOpeningX: 4 },
    },
    {
      title: "B. Same rules, wider room",
      note: "12 x 8 tiles; horizontal pieces repeat",
      y: 380,
      spec: { width: 12, height: 8, frontOpeningX: 6 },
    },
    {
      title: "C. Divider with a one-tile passage",
      note: "12 x 10 tiles; matching doorway edge pieces",
      y: 700,
      spec: { width: 12, height: 10, frontOpeningX: 6, divider: { y: 5, openingX: 6 } },
    },
  ];
  for (const { title, note, y, spec } of examples) {
    ctx.fillStyle = "#dbe8ff";
    ctx.font = "12px monospace";
    ctx.fillText(title, 32, y - 12);
    drawRoom(ctx, atlasImage, spec, 32, y, scale);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText(note, 32, y + spec.height * TILE_SIZE * scale + 26);
  }
}
