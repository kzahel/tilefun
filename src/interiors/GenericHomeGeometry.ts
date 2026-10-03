import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";
import { drawLayeredInteriorMap } from "../rendering/CanvasInteriorMap.js";
import {
  createLayeredInteriorMap,
  type LayeredInteriorMap,
  placeInteriorTile,
} from "./LayeredInteriorMap.js";

const TILE = 16;
export const GENERIC_HOME_WIDTH = 14;
export const GENERIC_HOME_HEIGHT = 14;
export const GENERIC_HOME_PIXEL_HEIGHT = 214; // The last border row is only six pixels high.
const SOURCE_KEY = "home-design/generic-home-designs/generic-home-1/layer-1";

type TileRole = "wood-floor" | "tile-floor" | "back-wall" | "side-wall" | "divider" | "edge";

export interface GenericHomeTile {
  key: string;
  x: number;
  y: number;
  role: TileRole;
  cropHeight?: number;
}

export interface GenericHomePortal {
  name: "north" | "west" | "east" | "divider" | "south";
  x: number;
  y: number;
  width: number;
  height: number;
}

export const GENERIC_HOME_PORTALS: readonly GenericHomePortal[] = [
  { name: "north", x: 7, y: 0, width: 1, height: 2 },
  { name: "west", x: 0, y: 4, width: 1, height: 2 },
  { name: "east", x: 13, y: 5, width: 1, height: 1 },
  { name: "divider", x: 7, y: 8, width: 1, height: 2 },
  { name: "south", x: 7, y: 13, width: 1, height: 1 },
];

// Inclusive walkable spans measured from the unfurnished source layer. The
// north, west, east, and south spans reach the image boundary; the divider
// connects the wood-floored upper space to the tiled lower space.
const WALKABLE_SPANS: readonly (readonly [number, number])[] = [
  [7, 7],
  [7, 7],
  [3, 11],
  [3, 11],
  [0, 11],
  [0, 13],
  [3, 11],
  [3, 11],
  [7, 7],
  [7, 7],
  [3, 11],
  [3, 11],
  [3, 11],
  [7, 7],
];

const OCCUPIED_SPANS: readonly (readonly [number, number])[] = [
  [2, 12],
  [2, 12],
  [0, 12],
  [0, 13],
  [0, 13],
  [0, 13],
  [0, 13],
  [2, 12],
  [2, 12],
  [2, 12],
  [2, 12],
  [2, 12],
  [2, 12],
  [2, 12],
];

export type GenericHomeCell = "void" | "wall" | "wood" | "tile" | "opening";

export function genericHomeCellAt(x: number, y: number): GenericHomeCell {
  if (x < 0 || x >= GENERIC_HOME_WIDTH || y < 0 || y >= GENERIC_HOME_HEIGHT) return "void";
  if (
    GENERIC_HOME_PORTALS.some(
      (portal) =>
        x >= portal.x &&
        x < portal.x + portal.width &&
        y >= portal.y &&
        y < portal.y + portal.height,
    )
  ) {
    return "opening";
  }
  const walkable = WALKABLE_SPANS[y];
  if (walkable && x >= walkable[0] && x <= walkable[1]) return y >= 10 ? "tile" : "wood";
  const occupied = OCCUPIED_SPANS[y];
  return occupied && x >= occupied[0] && x <= occupied[1] ? "wall" : "void";
}

function builder(group: "3d-walls" | "floors", col: number, row: number): string {
  return `room-builder/${group}/c${String(col).padStart(2, "0")}-r${String(row).padStart(2, "0")}`;
}

/** Rebuilds the source shell from architectural tiles, without using its prefab image. */
export function buildGenericHomeTiles(): GenericHomeTile[] {
  const tiles: GenericHomeTile[] = [];
  const wall = (
    x: number,
    y: number,
    col: number,
    row: number,
    role: TileRole,
    cropHeight?: number,
  ): void => {
    tiles.push({
      key: builder("3d-walls", col, row),
      x,
      y,
      role,
      ...(cropHeight ? { cropHeight } : {}),
    });
  };
  const floor = (x: number, y: number, col: number, row: number): void => {
    tiles.push({
      key: builder("floors", col, row),
      x,
      y,
      role: row >= 34 ? "tile-floor" : "wood-floor",
    });
  };

  // Both the north wall and the interior divider are split by a one-tile
  // passage. Their end caps differ, while the jambs and repeating faces match.
  const splitWall = (y: number, divider: boolean): void => {
    for (let x = 2; x <= 12; x++) {
      if (x === 7) {
        floor(x, y, divider ? 1 : 0, 31);
        floor(x, y + 1, divider ? 0 : 2, 31);
      } else {
        const role: TileRole = divider ? "divider" : "back-wall";
        const top =
          x === 2
            ? [divider ? 11 : 10, 0]
            : x === 12
              ? [divider ? 12 : 13, 0]
              : x === 6
                ? [8, 3]
                : x === 8
                  ? [8, 0]
                  : [11, 2];
        const bottom =
          x === 2 ? [10, 1] : x === 12 ? [12, 1] : x === 6 ? [8, 4] : x === 8 ? [8, 1] : [11, 3];
        wall(x, y, top[0] as number, top[1] as number, role);
        wall(x, y + 1, bottom[0] as number, bottom[1] as number, role);
      }
    }
  };

  splitWall(0, false);

  // The upper chamber widens to the west first, then to the east. Its side
  // openings are floor continuations, not door sprites laid over a square.
  for (let x = 0; x <= 12; x++) {
    if (x < 2) wall(x, 2, 11, 2, "back-wall");
    else if (x === 2) wall(x, 2, 10, 3, "side-wall");
    else if (x === 12) wall(x, 2, 13, 2, "side-wall");
    else floor(x, 2, x === 3 ? 0 : 1, 30);
  }
  for (let x = 0; x < 14; x++) {
    if (x < 2) wall(x, 3, 11, 3, "back-wall");
    else if (x === 2) wall(x, 3, 10, 4, "side-wall");
    else if (x === 12) wall(x, 3, 13, 3, "side-wall");
    else if (x === 13) wall(x, 3, 11, 2, "back-wall");
    else floor(x, 3, x === 3 ? 0 : 1, 31);
  }
  for (let x = 0; x < 14; x++) {
    if (x < 3) floor(x, 4, 1, 30);
    else if (x === 3) floor(x, 4, 2, 30);
    else if (x === 12) wall(x, 4, 13, 4, "side-wall");
    else if (x === 13) wall(x, 4, 11, 3, "back-wall");
    else floor(x, 4, 1, 31);
    floor(x, 5, 1, x >= 12 ? 30 : 31);
  }

  // Front edges of the two side bays taper into the narrower central hall.
  for (let x = 0; x < 14; x++) {
    if (x < 2 || x === 13) wall(x, 6, 11, 5, "edge");
    else if (x === 2 || x === 12) {
      floor(x, 6, 1, 31);
      wall(x, 6, x === 2 ? 9 : 14, 4, "edge");
    } else floor(x, 6, 1, 31);
  }
  for (let x = 2; x <= 12; x++) {
    if (x === 2) wall(x, 7, 10, 2, "side-wall");
    else if (x === 12) wall(x, 7, 13, 2, "side-wall");
    else floor(x, 7, x === 3 ? 0 : 1, 31);
  }

  splitWall(8, true);

  // The lower chamber changes to a gray tiled floor, but shares the same side
  // wall family. The bottom trim is six pixels tall and leaves a central exit.
  for (let y = 10; y <= 12; y++) {
    for (let x = 2; x <= 12; x++) {
      if (x === 2) wall(x, y, 10, 2, "side-wall");
      else if (x === 12) wall(x, y, 13, 2, "side-wall");
      else floor(x, y, x === 3 ? 12 : x === 7 && y === 10 ? 14 : 13, y === 10 ? 34 : 35);
    }
  }
  for (let x = 2; x <= 12; x++) {
    if (x === 7) continue;
    wall(x, 13, x === 2 ? 10 : x === 12 ? 13 : 11, 5, "edge", 6);
  }

  return tiles;
}

function layerGenericHomeTiles(
  width: number,
  height: number,
  pixelHeight: number,
  tiles: GenericHomeTile[],
  semanticAt: (x: number, y: number) => GenericHomeCell,
): LayeredInteriorMap {
  const map = createLayeredInteriorMap(width, height, pixelHeight, semanticAt);
  for (const tile of tiles) {
    const layer =
      tile.role === "wood-floor" || tile.role === "tile-floor"
        ? "floor"
        : tile.role === "edge"
          ? "foreground"
          : "wall";
    placeInteriorTile(map, layer, tile.x, tile.y, {
      key: tile.key,
      ...(tile.cropHeight ? { cropHeight: tile.cropHeight } : {}),
    });
  }
  return map;
}

/** The shell's topology and visual layers can overlap within one tile cell. */
export function buildGenericHomeLayeredMap(): LayeredInteriorMap {
  return layerGenericHomeTiles(
    GENERIC_HOME_WIDTH,
    GENERIC_HOME_HEIGHT,
    GENERIC_HOME_PIXEL_HEIGHT,
    buildGenericHomeTiles(),
    genericHomeCellAt,
  );
}

export interface GenericHomeVariantSpec {
  /** Repeat the east-side interior column while retaining the same openings. */
  extraEastColumns: number;
  /** Repeat the wood-floored hall row above the divider. */
  extraHallRows: number;
}

function validateVariant(spec: GenericHomeVariantSpec): void {
  if (
    !Number.isInteger(spec.extraEastColumns) ||
    !Number.isInteger(spec.extraHallRows) ||
    spec.extraEastColumns < 0 ||
    spec.extraHallRows < 0 ||
    spec.extraEastColumns > 16 ||
    spec.extraHallRows > 16
  ) {
    throw new Error("Room extensions must be whole tiles between 0 and 16");
  }
}

/** The source's column 9 and row 7 are straight runs with no turns or jambs. */
export function buildGenericHomeVariantTiles(spec: GenericHomeVariantSpec): GenericHomeTile[] {
  validateVariant(spec);
  const expandedColumns: GenericHomeTile[] = [];
  for (const tile of buildGenericHomeTiles()) {
    if (tile.x === 9) {
      for (let dx = 0; dx <= spec.extraEastColumns; dx++) {
        expandedColumns.push({ ...tile, x: tile.x + dx });
      }
    } else {
      expandedColumns.push({
        ...tile,
        x: tile.x > 9 ? tile.x + spec.extraEastColumns : tile.x,
      });
    }
  }
  const expandedRows: GenericHomeTile[] = [];
  for (const tile of expandedColumns) {
    if (tile.y === 7) {
      for (let dy = 0; dy <= spec.extraHallRows; dy++) {
        expandedRows.push({ ...tile, y: tile.y + dy });
      }
    } else {
      expandedRows.push({
        ...tile,
        y: tile.y > 7 ? tile.y + spec.extraHallRows : tile.y,
      });
    }
  }
  return expandedRows;
}

export function buildGenericHomeVariantLayeredMap(
  spec: GenericHomeVariantSpec,
): LayeredInteriorMap {
  validateVariant(spec);
  return layerGenericHomeTiles(
    GENERIC_HOME_WIDTH + spec.extraEastColumns,
    GENERIC_HOME_HEIGHT + spec.extraHallRows,
    GENERIC_HOME_PIXEL_HEIGHT + spec.extraHallRows * TILE,
    buildGenericHomeVariantTiles(spec),
    (x, y) => genericHomeVariantCellAt(x, y, spec),
  );
}

export function genericHomeVariantCellAt(
  x: number,
  y: number,
  spec: GenericHomeVariantSpec,
): GenericHomeCell {
  validateVariant(spec);
  const sourceX = x < 9 ? x : x < 9 + spec.extraEastColumns ? 9 : x - spec.extraEastColumns;
  const sourceY = y < 8 ? y : y < 8 + spec.extraHallRows ? 7 : y - spec.extraHallRows;
  return genericHomeCellAt(sourceX, sourceY);
}

function portalLabel(x: number, y: number): string | null {
  const names: Record<GenericHomePortal["name"], string> = {
    north: "N",
    west: "W",
    east: "E",
    divider: "D",
    south: "S",
  };
  const portal = GENERIC_HOME_PORTALS.find((item) => item.x === x && item.y === y);
  return portal ? names[portal.name] : null;
}

export function drawGenericHomeGeometryStudy(
  canvas: HTMLCanvasElement,
  atlasImage: CanvasImageSource,
): number {
  const source = getModernInteriorsEntry(SOURCE_KEY);
  if (!source) throw new Error(`Missing Generic Home source: ${SOURCE_KEY}`);
  const sourceCanvas = document.createElement("canvas");
  const rebuiltCanvas = document.createElement("canvas");
  for (const item of [sourceCanvas, rebuiltCanvas]) {
    item.width = GENERIC_HOME_WIDTH * TILE;
    item.height = GENERIC_HOME_PIXEL_HEIGHT;
  }
  const sourceCtx = sourceCanvas.getContext("2d");
  const rebuiltCtx = rebuiltCanvas.getContext("2d");
  if (!sourceCtx || !rebuiltCtx) return -1;
  sourceCtx.imageSmoothingEnabled = false;
  rebuiltCtx.imageSmoothingEnabled = false;
  const [sx, sy, sw, sh] = source.rect;
  sourceCtx.drawImage(atlasImage, sx, sy, sw, sh, 0, 0, sw, sh);
  drawLayeredInteriorMap(rebuiltCtx, atlasImage, buildGenericHomeLayeredMap());

  const original = sourceCtx.getImageData(0, 0, sw, sh).data;
  const rebuilt = rebuiltCtx.getImageData(0, 0, sw, sh).data;
  let visibleDifferences = 0;
  for (let i = 0; i < original.length; i += 4) {
    if (original[i + 3] !== rebuilt[i + 3]) visibleDifferences++;
    else if (
      original[i + 3] !== 0 &&
      (original[i] !== rebuilt[i] ||
        original[i + 1] !== rebuilt[i + 1] ||
        original[i + 2] !== rebuilt[i + 2])
    ) {
      visibleDifferences++;
    }
  }

  canvas.width = 1450;
  canvas.height = 540;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return visibleDifferences;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0e1118";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#9bd7ff";
  ctx.font = "bold 16px monospace";
  ctx.fillText("Generic Home 1: original / rebuilt from tiles / topology", 20, 28);
  ctx.fillStyle = "#dbe8ff";
  ctx.font = "12px monospace";
  ctx.fillText("Source shell", 20, 58);
  ctx.fillText(
    `Tile reconstruction (${visibleDifferences} visible pixel difference${visibleDifferences === 1 ? "" : "s"})`,
    500,
    58,
  );
  ctx.fillText("Walkable geometry and passages", 980, 58);
  ctx.drawImage(sourceCanvas, 20, 72, sw * 2, sh * 2);
  ctx.drawImage(rebuiltCanvas, 500, 72, sw * 2, sh * 2);

  const mapX = 980;
  const mapY = 72;
  const mapCell = 30;
  const colors: Record<GenericHomeCell, string> = {
    void: "#151b26",
    wall: "#62748c",
    wood: "#94725f",
    tile: "#b6bbc0",
    opening: "#21a784",
  };
  for (let y = 0; y < GENERIC_HOME_HEIGHT; y++) {
    for (let x = 0; x < GENERIC_HOME_WIDTH; x++) {
      ctx.fillStyle = colors[genericHomeCellAt(x, y)];
      ctx.fillRect(mapX + x * mapCell, mapY + y * mapCell, mapCell - 1, mapCell - 1);
      const label = portalLabel(x, y);
      if (label) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 17px monospace";
        ctx.fillText(label, mapX + x * mapCell + 10, mapY + y * mapCell + 21);
      }
    }
  }
  ctx.fillStyle = "#aab9c9";
  ctx.font = "11px monospace";
  ctx.fillText("N/W/E/S: boundary openings   D: divider passage", 980, 520);
  return visibleDifferences;
}

export function drawGenericHomeLayerStudy(
  canvas: HTMLCanvasElement,
  atlasImage: CanvasImageSource,
): number {
  const map = buildGenericHomeLayeredMap();
  const layerGroups = [
    { title: "Floor underlay", layers: ["floor"] as const },
    { title: "Wall faces + transparent edges", layers: ["wall", "foreground"] as const },
    { title: "Combined source shell", layers: ["floor", "wall", "foreground"] as const },
  ];
  canvas.width = 1450;
  canvas.height = 550;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0e1118";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#9bd7ff";
  ctx.font = "bold 16px monospace";
  ctx.fillText("Generic Home 1: independent visual layers in each semantic cell", 20, 28);

  for (const [index, group] of layerGroups.entries()) {
    const layerCanvas = document.createElement("canvas");
    layerCanvas.width = map.width * TILE;
    layerCanvas.height = map.pixelHeight;
    const layerCtx = layerCanvas.getContext("2d");
    if (!layerCtx) continue;
    drawLayeredInteriorMap(layerCtx, atlasImage, map, group.layers);
    const x = 20 + index * 480;
    ctx.fillStyle = "#dbe8ff";
    ctx.font = "12px monospace";
    ctx.fillText(group.title, x, 58);
    ctx.drawImage(layerCanvas, x, 72, layerCanvas.width * 2, layerCanvas.height * 2);
  }
  const overlapCells = map.cells
    .flat()
    .filter((cell) => cell.floor.length && cell.foreground.length);
  ctx.fillStyle = "#aab9c9";
  ctx.font = "11px monospace";
  ctx.fillText(
    `${overlapCells.length} tapered corner cells contain both floor and transparent wall pieces (x=2 and 12, y=6).`,
    20,
    525,
  );
  return overlapCells.length;
}

export function drawGenericHomeVariantPreview(
  canvas: HTMLCanvasElement,
  atlasImage: CanvasImageSource,
): void {
  const spec: GenericHomeVariantSpec = { extraEastColumns: 2, extraHallRows: 2 };
  const width = GENERIC_HOME_WIDTH + spec.extraEastColumns;
  const height = GENERIC_HOME_HEIGHT + spec.extraHallRows;
  const pixelHeight = GENERIC_HOME_PIXEL_HEIGHT + spec.extraHallRows * TILE;
  const roomCanvas = document.createElement("canvas");
  roomCanvas.width = width * TILE;
  roomCanvas.height = pixelHeight;
  const roomCtx = roomCanvas.getContext("2d");
  if (!roomCtx) return;
  roomCtx.imageSmoothingEnabled = false;
  drawLayeredInteriorMap(roomCtx, atlasImage, buildGenericHomeVariantLayeredMap(spec));

  canvas.width = 970;
  canvas.height = 630;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0e1118";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#9bd7ff";
  ctx.font = "bold 16px monospace";
  ctx.fillText("Derived room: repeat only straight east and hall runs", 20, 28);
  ctx.fillStyle = "#dbe8ff";
  ctx.font = "12px monospace";
  ctx.fillText("16 columns x 16 rows; openings, corners, and floor change preserved", 20, 56);
  ctx.drawImage(roomCanvas, 20, 76, width * TILE * 2, pixelHeight * 2);

  const mapX = 570;
  const mapY = 76;
  const mapCell = 24;
  const colors: Record<GenericHomeCell, string> = {
    void: "#151b26",
    wall: "#62748c",
    wood: "#94725f",
    tile: "#b6bbc0",
    opening: "#21a784",
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      ctx.fillStyle = colors[genericHomeVariantCellAt(x, y, spec)];
      ctx.fillRect(mapX + x * mapCell, mapY + y * mapCell, mapCell - 1, mapCell - 1);
    }
  }
  ctx.fillStyle = "#aab9c9";
  ctx.font = "11px monospace";
  ctx.fillText("Repeat regions: east interior +2, hall +2", 570, 500);
}
