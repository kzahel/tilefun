import { ALL_TERRAIN_IDS, TerrainId } from "../autotile/TerrainId.js";
import { buildLayeredApartmentPlan } from "../interiors/ApartmentArchitecture.js";
import { type PlanCell, parseFloorPlan, type RoomKind } from "../interiors/ApartmentFloorPlan.js";
import { RoadType } from "../road/RoadType.js";
import { FENCED_TREES, treeRuns } from "./FencedTrees.js";
import { type GridPoint, type StrokeShape, strokeCells } from "./GridStroke.js";

export const PATTERN_FAMILIES = [
  {
    id: "rooms-v1",
    name: "Rooms",
    gridSize: 32,
    connections: ["N", "E", "S", "W"],
    dirtyHalo: 2,
    backend: "ApartmentArchitecture",
    source: "modern-interiors",
  },
  { ...FENCED_TREES, backend: "FencedTrees", source: "me-complete" },
  {
    id: "terrain-v1",
    name: "Terrain",
    gridSize: 16,
    connections: ["N", "E", "S", "W", "diagonal"],
    dirtyHalo: 1,
    backend: "TerrainEditor + Autotiler",
    source: "me15",
  },
  {
    id: "city-surfaces-v1",
    name: "City surfaces",
    gridSize: 16,
    connections: ["N", "E", "S", "W", "diagonal"],
    dirtyHalo: 1,
    backend: "TerrainEditor + DenseCitySurface",
    source: "me-complete",
  },
] as const;
export type PatternFamily = (typeof PATTERN_FAMILIES)[number]["id"];
export interface PatternCell extends GridPoint {
  value: number | string;
}
export interface PatternDocument {
  version: 1;
  family: PatternFamily;
  width: number;
  height: number;
  cells: PatternCell[];
}
export interface PatternEdit {
  path: readonly GridPoint[];
  shape: StrokeShape;
  value: number | string;
  erase: boolean;
  roomRectangle?: boolean;
}
export const familyDefinition = (id: PatternFamily) =>
  PATTERN_FAMILIES.find((f) => f.id === id) ?? PATTERN_FAMILIES[0];
export function roomSketch(doc: PatternDocument): string {
  const cells = new Map(doc.cells.map((c) => [`${c.x},${c.y}`, String(c.value)]));
  return Array.from({ length: doc.height }, (_, y) =>
    Array.from({ length: doc.width }, (_, x) => cells.get(`${x},${y}`) ?? " ").join(""),
  ).join("\n");
}
export function validatePatternDocument(doc: PatternDocument): void {
  if (doc.family === "rooms-v1")
    buildLayeredApartmentPlan(parseFloorPlan(roomSketch(doc), { preserveBounds: true }));
  if (doc.family === "fenced-trees-v1") treeRuns(doc.cells);
}
export function parsePatternDocument(raw: unknown): PatternDocument {
  if (!raw || typeof raw !== "object") throw new Error("Invalid pattern document");
  const d = raw as PatternDocument;
  if (
    d.version !== 1 ||
    !PATTERN_FAMILIES.some((f) => f.id === d.family) ||
    !Number.isInteger(d.width) ||
    !Number.isInteger(d.height) ||
    d.width < 8 ||
    d.width > 48 ||
    d.height < 8 ||
    d.height > 32 ||
    !Array.isArray(d.cells) ||
    d.cells.length > d.width * d.height
  )
    throw new Error("Unsupported document version, family or bounds (8–48 by 8–32)");
  const seen = new Set<string>();
  const cells = d.cells.map((c) => {
    if (
      !c ||
      !Number.isInteger(c.x) ||
      !Number.isInteger(c.y) ||
      c.x < 0 ||
      c.y < 0 ||
      c.x >= d.width ||
      c.y >= d.height
    )
      throw new Error("Cell outside document");
    const key = `${c.x},${c.y}`;
    if (seen.has(key)) throw new Error("Duplicate semantic cell");
    seen.add(key);
    const valid =
      d.family === "rooms-v1"
        ? typeof c.value === "string" && "LBKTH#+".includes(c.value) && c.value.length === 1
        : d.family === "terrain-v1"
          ? ALL_TERRAIN_IDS.includes(c.value as TerrainId)
          : d.family === "city-surfaces-v1"
            ? [RoadType.CityAsphalt, RoadType.CityPavement].includes(c.value as number)
            : c.value === 1;
    if (!valid) throw new Error("Unsupported family cell value");
    return { x: c.x, y: c.y, value: c.value };
  });
  const result: PatternDocument = {
    version: 1,
    family: d.family,
    width: d.width,
    height: d.height,
    cells,
  };
  validatePatternDocument(result);
  return result;
}
export function applyPatternEdit(doc: PatternDocument, edit: PatternEdit): PatternDocument {
  const shape = doc.family === "fenced-trees-v1" ? "horizontal" : edit.shape;
  const points = strokeCells(edit.path, shape);
  if (points.some((p) => p.x < 0 || p.y < 0 || p.x >= doc.width || p.y >= doc.height))
    throw new Error("Stroke extends outside the document");
  const cells = new Map(doc.cells.map((c) => [`${c.x},${c.y}`, c]));
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  if (edit.roomRectangle && !edit.erase && (right - left < 2 || bottom - top < 2))
    throw new Error("Room rectangle needs at least 3×3 cells (walls and floor)");
  for (const p of points) {
    const key = `${p.x},${p.y}`;
    if (edit.erase) cells.delete(key);
    else
      cells.set(key, {
        ...p,
        value:
          edit.roomRectangle && (p.x === left || p.x === right || p.y === top || p.y === bottom)
            ? "#"
            : edit.value,
      });
  }
  return parsePatternDocument({
    ...doc,
    cells: [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x),
  });
}
export function exampleDocument(family: PatternFamily): PatternDocument {
  let d: PatternDocument = { version: 1, family, width: 24, height: 16, cells: [] };
  if (family === "rooms-v1") {
    d = applyPatternEdit(d, {
      path: [
        { x: 2, y: 2 },
        { x: 10, y: 10 },
      ],
      shape: "rectangle",
      roomRectangle: true,
      value: "L" satisfies RoomKind,
      erase: false,
    });
    d = applyPatternEdit(d, {
      path: [{ x: 6, y: 10 }],
      shape: "free",
      value: "+" satisfies PlanCell,
      erase: false,
    });
  } else if (family === "fenced-trees-v1") {
    d = applyPatternEdit(d, {
      path: [
        { x: 3, y: 6 },
        { x: 15, y: 6 },
      ],
      shape: "horizontal",
      value: 1,
      erase: false,
    });
  } else if (family === "city-surfaces-v1") {
    d = applyPatternEdit(d, {
      path: [
        { x: 0, y: 4 },
        { x: 23, y: 11 },
      ],
      shape: "rectangle",
      value: RoadType.CityPavement,
      erase: false,
    });
    d = applyPatternEdit(d, {
      path: [
        { x: 0, y: 6 },
        { x: 23, y: 9 },
      ],
      shape: "rectangle",
      value: RoadType.CityAsphalt,
      erase: false,
    });
  } else
    d = applyPatternEdit(d, {
      path: [
        { x: 5, y: 4 },
        { x: 17, y: 11 },
      ],
      shape: "rectangle",
      value: TerrainId.DirtWarm,
      erase: false,
    });
  return d;
}
