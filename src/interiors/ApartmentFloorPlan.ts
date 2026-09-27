import { getModernInteriorsEntry } from "../assets/ModernInteriorsAtlasIndex.js";

export type RoomKind = "L" | "B" | "K" | "T" | "H";
export type PlanCell = RoomKind | "#" | "+" | " ";

export interface FloorPlan {
  width: number;
  height: number;
  rows: PlanCell[][];
  rooms: RoomKind[];
  entrances: { x: number; y: number }[];
}

const ROOM_NAMES: Record<RoomKind, string> = {
  L: "Living",
  B: "Bedroom",
  K: "Kitchen",
  T: "Bath",
  H: "Hall",
};

const FLOOR_TILES: Record<RoomKind, string> = {
  L: "room-builder/floors/c01-r31",
  B: "room-builder/floors/c04-r29",
  K: "room-builder/floors/c13-r29",
  T: "room-builder/floors/c13-r20",
  H: "room-builder/floors/c01-r05",
};

const DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

function isRoom(cell: PlanCell): cell is RoomKind {
  return cell in ROOM_NAMES;
}

function at(rows: PlanCell[][], x: number, y: number): PlanCell {
  return rows[y]?.[x] ?? " ";
}

export function parseFloorPlan(source: string): FloorPlan {
  const lines = source.replace(/\r/g, "").split("\n");
  while (lines[0]?.trim() === "") lines.shift();
  while (lines.at(-1)?.trim() === "") lines.pop();
  const width = Math.max(0, ...lines.map((line) => line.length));
  if (width < 3 || lines.length < 3 || width > 80 || lines.length > 60) {
    throw new Error("Plan must be between 3×3 and 80×60 cells");
  }
  const rows = lines.map((line, y) =>
    [...line.padEnd(width)].map((cell, x) => {
      if (!"LBKTH#+ ".includes(cell)) throw new Error(`Unknown symbol '${cell}' at ${x},${y}`);
      return cell as PlanCell;
    }),
  );
  const rooms = new Set<RoomKind>();
  const entrances: { x: number; y: number }[] = [];
  let firstFloor: { x: number; y: number } | null = null;
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < width; x++) {
      const cell = at(rows, x, y);
      if (isRoom(cell)) {
        rooms.add(cell);
        firstFloor ??= { x, y };
      }
      if (cell !== "+") continue;
      const adjacent = DIRECTIONS.map(([dx, dy]) => at(rows, x + dx, y + dy));
      const northSouth = isRoom(adjacent[0] ?? " ") && isRoom(adjacent[2] ?? " ");
      const eastWest = isRoom(adjacent[1] ?? " ") && isRoom(adjacent[3] ?? " ");
      const floorCount = adjacent.filter(isRoom).length;
      if (!northSouth && !eastWest && (floorCount !== 1 || !adjacent.includes(" "))) {
        throw new Error(`Passage at ${x},${y} must touch a room on one or two opposite sides`);
      }
      if (floorCount === 1 && adjacent.includes(" ")) entrances.push({ x, y });
    }
  }
  if (!firstFloor) throw new Error("Plan needs at least one room cell");
  if (entrances.length === 0) throw new Error("Plan needs an exterior + entrance");

  const visited = new Set<string>();
  const queue = [...entrances];
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i] as { x: number; y: number };
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const [dx, dy] of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      const neighbor = at(rows, nx, ny);
      if (isRoom(neighbor) || neighbor === "+") queue.push({ x: nx, y: ny });
    }
  }
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < width; x++) {
      if (isRoom(at(rows, x, y)) && !visited.has(`${x},${y}`)) {
        throw new Error(`Room floor at ${x},${y} cannot be reached from the entrance`);
      }
    }
  }
  return { width, height: rows.length, rows, rooms: [...rooms], entrances };
}

type Draft = { grid: PlanCell[][]; width: number; height: number };

function draft(width: number, height: number): Draft {
  return { width, height, grid: Array.from({ length: height }, () => Array(width).fill(" ")) };
}

function paint(d: Draft, room: RoomKind, x1: number, y1: number, x2: number, y2: number): void {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) (d.grid[y] as PlanCell[])[x] = room;
  }
}

function outline(d: Draft): void {
  const floors = d.grid.map((row) => [...row]);
  for (let y = 0; y < d.height; y++) {
    for (let x = 0; x < d.width; x++) {
      if (floors[y]?.[x] !== " ") continue;
      if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => isRoom(at(floors, x + dx, y + dy))))) {
        (d.grid[y] as PlanCell[])[x] = "#";
      }
    }
  }
}

function door(d: Draft, x: number, y: number): void {
  if (d.grid[y]?.[x] !== "#") throw new Error(`Sample doorway ${x},${y} misses a wall`);
  (d.grid[y] as PlanCell[])[x] = "+";
}

function finish(d: Draft): string {
  return d.grid.map((row) => row.join("").trimEnd()).join("\n");
}

function smallApartment(): string {
  const d = draft(21, 16);
  paint(d, "B", 1, 1, 8, 5);
  paint(d, "H", 10, 1, 12, 5);
  paint(d, "T", 14, 1, 19, 5);
  paint(d, "L", 1, 7, 12, 13);
  paint(d, "K", 14, 7, 19, 13);
  outline(d);
  for (const [x, y] of [
    [9, 3],
    [13, 3],
    [11, 6],
    [13, 10],
    [6, 14],
  ] as const)
    door(d, x, y);
  return finish(d);
}

function largeApartment(): string {
  const d = draft(33, 23);
  paint(d, "B", 1, 1, 10, 7);
  paint(d, "H", 12, 1, 19, 7);
  paint(d, "B", 21, 1, 31, 7);
  paint(d, "L", 1, 9, 19, 14);
  paint(d, "K", 21, 9, 31, 14);
  paint(d, "H", 1, 16, 9, 21);
  paint(d, "T", 11, 16, 19, 21);
  paint(d, "B", 21, 16, 31, 21);
  outline(d);
  for (const [x, y] of [
    [11, 4],
    [20, 4],
    [15, 8],
    [20, 11],
    [5, 15],
    [15, 15],
    [25, 15],
    [5, 22],
  ] as const)
    door(d, x, y);
  return finish(d);
}

function strangeApartment(): string {
  const d = draft(31, 22);
  paint(d, "B", 10, 1, 22, 6);
  paint(d, "L", 3, 8, 15, 15);
  paint(d, "L", 1, 11, 6, 19);
  paint(d, "H", 17, 8, 19, 18);
  paint(d, "K", 21, 9, 28, 14);
  paint(d, "T", 21, 16, 27, 19);
  outline(d);
  for (const [x, y] of [
    [18, 7],
    [16, 11],
    [20, 11],
    [24, 15],
    [4, 20],
  ] as const)
    door(d, x, y);
  return finish(d);
}

export const APARTMENT_EXAMPLES = [
  { id: "small", name: "Small apartment", sketch: smallApartment() },
  { id: "large", name: "Large apartment", sketch: largeApartment() },
  { id: "strange", name: "Strange floor plan", sketch: strangeApartment() },
] as const;

function drawAtlasTile(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  key: string,
  x: number,
  y: number,
): void {
  const entry = getModernInteriorsEntry(key);
  if (!entry) throw new Error(`Missing apartment tile: ${key}`);
  const [sx, sy, sw, sh] = entry.rect;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, 16, 16);
}

function wallKey(plan: FloorPlan, x: number, y: number): string {
  const north = at(plan.rows, x, y - 1);
  const south = at(plan.rows, x, y + 1);
  const west = at(plan.rows, x - 1, y);
  const east = at(plan.rows, x + 1, y);
  // Horizontal wall faces use the gray wall band's top and base. Vertical
  // faces use its left/right jambs. Every branch is a tile from one family.
  if (isRoom(south) || south === "+") return "room-builder/3d-walls/c11-r02";
  if (isRoom(north) || north === "+") return "room-builder/3d-walls/c11-r03";
  if (isRoom(east) || east === "+") return "room-builder/3d-walls/c10-r02";
  if (isRoom(west) || west === "+") return "room-builder/3d-walls/c13-r02";
  return "room-builder/3d-walls/c11-r02";
}

export function drawApartmentPlan(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  plan: FloorPlan,
): void {
  const scale = 2;
  const tile = 16 * scale;
  canvas.width = (plan.width + 2) * tile;
  canvas.height = (plan.height + 2) * tile;
  canvas.style.width = "min(100%, 480px)";
  canvas.style.height = "auto";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#171b26";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(16, 16);
  for (let y = 0; y < plan.height; y++) {
    for (let x = 0; x < plan.width; x++) {
      const cell = at(plan.rows, x, y);
      if (isRoom(cell)) drawAtlasTile(ctx, image, FLOOR_TILES[cell], x * 16, y * 16);
    }
  }
  for (let y = 0; y < plan.height; y++) {
    for (let x = 0; x < plan.width; x++) {
      const cell = at(plan.rows, x, y);
      if (cell === "#") drawAtlasTile(ctx, image, wallKey(plan, x, y), x * 16, y * 16);
      if (cell === "+") {
        const neighboringFloor = DIRECTIONS.map(([dx, dy]) => at(plan.rows, x + dx, y + dy)).find(
          isRoom,
        );
        if (neighboringFloor)
          drawAtlasTile(ctx, image, FLOOR_TILES[neighboringFloor], x * 16, y * 16);
        const verticalWall = isRoom(at(plan.rows, x - 1, y)) || isRoom(at(plan.rows, x + 1, y));
        if (verticalWall) {
          ctx.fillStyle = "#373a4a";
          ctx.fillRect(x * 16 + 6, y * 16, 4, 16);
          ctx.fillStyle = "#d6bd80";
          ctx.fillRect(x * 16 + 7, y * 16 + 2, 2, 12);
        } else {
          ctx.fillStyle = "#373a4a";
          ctx.fillRect(x * 16, y * 16 + 6, 16, 4);
          ctx.fillStyle = "#d6bd80";
          ctx.fillRect(x * 16 + 2, y * 16 + 7, 12, 2);
        }
      }
    }
  }
  ctx.restore();
}

export function describeFloorPlan(plan: FloorPlan): string {
  return `${plan.width}×${plan.height} cells · ${plan.rooms.map((room) => ROOM_NAMES[room]).join(", ")} · ${plan.entrances.length} entrance${plan.entrances.length === 1 ? "" : "s"} · all floors reachable`;
}
