import { buildGenericHomeLayeredMap } from "./GenericHomeGeometry.js";
import {
  createLayeredInteriorMap,
  drawLayeredInteriorMap,
  INTERIOR_DRAW_ORDER,
  type LayeredInteriorMap,
  placeInteriorTile,
} from "./LayeredInteriorMap.js";

export interface AdvancedSuiteSpec {
  westWidth: number;
  westTop: number;
  westBottom: number;
  eastWidth: number;
  eastTop: number;
  eastBottom: number;
  southRoom: boolean;
}

export const ADVANCED_SUITE_EXAMPLES = [
  {
    id: "cross",
    name: "Four-room cross plan",
    note: "Rooms branch west and east from the source hall.",
    spec: {
      westWidth: 9,
      westTop: 1,
      westBottom: 10,
      eastWidth: 10,
      eastTop: 2,
      eastBottom: 12,
      southRoom: false,
    },
  },
  {
    id: "offset",
    name: "Offset five-room plan",
    note: "Unequal side wings and a lower room connect at three branches.",
    spec: {
      westWidth: 7,
      westTop: 0,
      westBottom: 9,
      eastWidth: 13,
      eastTop: 3,
      eastBottom: 13,
      southRoom: true,
    },
  },
] as const;

type Material = "wood" | "tile";

function wall(col: number, row: number): string {
  return `room-builder/3d-walls/c${String(col).padStart(2, "0")}-r${String(row).padStart(2, "0")}`;
}

function floor(
  material: Material,
  x: number,
  left: number,
  right: number,
  firstRow: boolean,
): string {
  if (material === "wood") return "room-builder/floors/c01-r31";
  const col = x === left ? 12 : x === right ? 14 : 13;
  return `room-builder/floors/c${String(col).padStart(2, "0")}-r${firstRow ? 34 : 35}`;
}

function mark(map: LayeredInteriorMap, x: number, y: number, semantic: string): void {
  const cell = map.cells[y]?.[x];
  if (!cell) throw new Error(`Suite cell ${x},${y} is outside the map`);
  if (cell.semantic !== "void") throw new Error(`Suite rooms overlap at ${x},${y}`);
  cell.semantic = semantic;
}

function stampSideRoom(
  map: LayeredInteriorMap,
  bounds: { left: number; right: number; top: number; bottom: number },
  material: Material,
  doorwaySide: "left" | "right",
  doorwayRows: readonly number[],
): void {
  const { left, right, top, bottom } = bounds;
  const doorwayX = doorwaySide === "left" ? left : right;
  for (let x = left; x <= right; x++) {
    for (const y of [top, top + 1]) {
      mark(map, x, y, "wall");
      const col = x === left ? 10 : x === right ? 13 : 11;
      placeInteriorTile(map, "wall", x, y, {
        key: wall(col, x === left || x === right ? y - top : y - top + 2),
      });
    }
  }
  for (let y = top + 2; y < bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (x === doorwayX && doorwayRows.includes(y)) {
        mark(map, x, y, "opening");
        placeInteriorTile(map, "floor", x, y, {
          key: floor(material, x, left + 1, right - 1, y === top + 2),
        });
      } else if (x === left || x === right) {
        mark(map, x, y, "wall");
        placeInteriorTile(map, "wall", x, y, { key: wall(x === left ? 10 : 13, 2) });
      } else {
        mark(map, x, y, material);
        placeInteriorTile(map, "floor", x, y, {
          key: floor(material, x, left + 1, right - 1, y === top + 2),
        });
      }
    }
  }
  for (let x = left; x <= right; x++) {
    mark(map, x, bottom, "wall");
    placeInteriorTile(map, "foreground", x, bottom, {
      key: wall(x === left ? 10 : x === right ? 13 : 11, 5),
      cropHeight: 6,
    });
  }
}

function stampSouthRoom(map: LayeredInteriorMap, mainX: number): void {
  const left = mainX + 2;
  const right = mainX + 12;
  const openingX = mainX + 7;
  const top = 14;
  const bottom = 21;
  // The source shell's south portal is transparent. Floor now continues
  // beneath it, into a two-row passage in the new room's back wall.
  const sourcePortal = map.cells[13]?.[openingX];
  if (!sourcePortal || sourcePortal.semantic !== "opening") {
    throw new Error("Missing south portal in source shell");
  }
  placeInteriorTile(map, "floor", openingX, 13, { key: "room-builder/floors/c13-r35" });
  for (let x = left; x <= right; x++) {
    for (const y of [top, top + 1]) {
      if (x === openingX) {
        mark(map, x, y, "opening");
        placeInteriorTile(map, "floor", x, y, { key: "room-builder/floors/c13-r35" });
        continue;
      }
      mark(map, x, y, "wall");
      const isTop = y === top;
      const col =
        x === openingX - 1 ? 8 : x === openingX + 1 ? 8 : x === left ? 10 : x === right ? 13 : 11;
      const row =
        x === openingX - 1
          ? isTop
            ? 3
            : 4
          : x === openingX + 1
            ? isTop
              ? 0
              : 1
            : x === left || x === right
              ? isTop
                ? 0
                : 1
              : isTop
                ? 2
                : 3;
      placeInteriorTile(map, "wall", x, y, { key: wall(col, row) });
    }
  }
  for (let y = top + 2; y < bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (x === left || x === right) {
        mark(map, x, y, "wall");
        placeInteriorTile(map, "wall", x, y, { key: wall(x === left ? 10 : 13, 2) });
      } else {
        mark(map, x, y, "tile");
        placeInteriorTile(map, "floor", x, y, {
          key: floor("tile", x, left + 1, right - 1, y === top + 2),
        });
      }
    }
  }
  for (let x = left; x <= right; x++) {
    mark(map, x, bottom, "wall");
    placeInteriorTile(map, "foreground", x, bottom, {
      key: wall(x === left ? 10 : x === right ? 13 : 11, 5),
      cropHeight: 6,
    });
  }
}

export function buildAdvancedSuite(spec: AdvancedSuiteSpec): LayeredInteriorMap {
  if (
    !Number.isInteger(spec.westWidth) ||
    !Number.isInteger(spec.eastWidth) ||
    spec.westWidth < 6 ||
    spec.eastWidth < 6 ||
    !Number.isInteger(spec.westTop) ||
    !Number.isInteger(spec.eastTop) ||
    !Number.isInteger(spec.westBottom) ||
    !Number.isInteger(spec.eastBottom) ||
    spec.westTop < 0 ||
    spec.eastTop < 0 ||
    spec.westBottom - spec.westTop < 6 ||
    spec.eastBottom - spec.eastTop < 6 ||
    spec.westBottom > 13 ||
    spec.eastBottom > 13 ||
    spec.westTop > 2 ||
    spec.eastTop > 3
  ) {
    throw new Error("Side rooms must contain their source-shell openings");
  }
  const width = spec.westWidth + 14 + spec.eastWidth;
  const height = spec.southRoom ? 22 : 14;
  const map = createLayeredInteriorMap(width, height, (height - 1) * 16 + 6);
  const mainX = spec.westWidth;
  const source = buildGenericHomeLayeredMap();
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const original = source.cells[y]?.[x];
      const target = map.cells[y]?.[x + mainX];
      if (!original || !target) continue;
      target.semantic = original.semantic;
      for (const layer of INTERIOR_DRAW_ORDER) target[layer].push(...original[layer]);
    }
  }
  stampSideRoom(
    map,
    { left: 0, right: mainX - 1, top: spec.westTop, bottom: spec.westBottom },
    "wood",
    "right",
    [4, 5],
  );
  stampSideRoom(
    map,
    {
      left: mainX + 14,
      right: width - 1,
      top: spec.eastTop,
      bottom: spec.eastBottom,
    },
    "tile",
    "left",
    [5],
  );
  if (spec.southRoom) stampSouthRoom(map, mainX);
  return map;
}

export function reachableSuiteCells(
  map: LayeredInteriorMap,
  startX: number,
  startY: number,
): number {
  const passable = (x: number, y: number): boolean => {
    const role = map.cells[y]?.[x]?.semantic;
    return role === "wood" || role === "tile" || role === "opening";
  };
  const visited = new Set<string>();
  const queue: [number, number][] = [[startX, startY]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i] as [number, number];
    const key = `${x},${y}`;
    if (visited.has(key) || !passable(x, y)) continue;
    visited.add(key);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      if (passable(x + dx, y + dy)) queue.push([x + dx, y + dy]);
    }
  }
  return visited.size;
}

export function suiteWalkableCellCount(map: LayeredInteriorMap): number {
  return map.cells.flat().filter((cell) => ["wood", "tile", "opening"].includes(cell.semantic))
    .length;
}

function drawSemanticMap(
  ctx: CanvasRenderingContext2D,
  map: LayeredInteriorMap,
  x0: number,
  y0: number,
): void {
  const colors: Record<string, string> = {
    void: "#151b26",
    wall: "#62748c",
    wood: "#94725f",
    tile: "#b6bbc0",
    opening: "#21a784",
  };
  const size = 16;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const role = map.cells[y]?.[x]?.semantic ?? "void";
      ctx.fillStyle = colors[role] ?? colors.void ?? "#151b26";
      ctx.fillRect(x0 + x * size, y0 + y * size, size - 1, size - 1);
    }
  }
}

export function drawAdvancedSuitePreview(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  example: (typeof ADVANCED_SUITE_EXAMPLES)[number],
): number {
  const map = buildAdvancedSuite(example.spec);
  const renderScale = 2;
  const renderX = 20;
  const renderY = 72;
  const mapX = renderX + map.width * 16 * renderScale + 40;
  const mapY = 100;
  canvas.width = mapX + map.width * 16 + 30;
  canvas.height = Math.max(
    renderY + map.pixelHeight * renderScale + 40,
    mapY + map.height * 16 + 50,
  );
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0e1118";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#9bd7ff";
  ctx.font = "bold 16px monospace";
  ctx.fillText(example.name, 20, 28);
  ctx.fillStyle = "#aab9c9";
  ctx.font = "12px monospace";
  ctx.fillText(example.note, 20, 50);
  ctx.fillText("Semantic floor / wall / opening map", mapX, 82);
  const roomCanvas = document.createElement("canvas");
  roomCanvas.width = map.width * 16;
  roomCanvas.height = map.pixelHeight;
  const roomCtx = roomCanvas.getContext("2d");
  if (!roomCtx) return 0;
  drawLayeredInteriorMap(roomCtx, image, map);
  ctx.drawImage(
    roomCanvas,
    renderX,
    renderY,
    roomCanvas.width * renderScale,
    roomCanvas.height * renderScale,
  );
  drawSemanticMap(ctx, map, mapX, mapY);
  const reached = reachableSuiteCells(map, example.spec.westWidth + 7, 0);
  ctx.fillStyle = "#a8dcb9";
  ctx.font = "11px monospace";
  ctx.fillText(
    `${reached}/${suiteWalkableCellCount(map)} walkable cells connected`,
    mapX,
    mapY + map.height * 16 + 26,
  );
  return reached;
}
