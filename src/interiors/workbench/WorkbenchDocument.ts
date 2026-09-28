import { getModernInteriorsEntry } from "../../assets/ModernInteriorsAtlasIndex.js";
import { buildLayeredApartmentPlan } from "../ApartmentArchitecture.js";
import { APARTMENT_EXAMPLES, type PlanCell, parseFloorPlan } from "../ApartmentFloorPlan.js";
import {
  INTERIOR_DRAW_ORDER,
  type InteriorLayer,
  type LayeredInteriorMap,
} from "../LayeredInteriorMap.js";

export const WORKBENCH_STORAGE_KEY = "tilefun.indoor-workbench.v1";
export const PLAN_BRUSHES = ["L", "B", "K", "T", "H", "#", "+", " "] as const;

export interface TileOverride {
  x: number;
  y: number;
  layer: InteriorLayer;
  key: string;
}

export interface InteriorIssue {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  category: "wrong-tile" | "bad-join" | "wrong-zone" | "other";
  reason: string;
  snapshot: {
    planCell: string;
    semantic: string;
    tiles: Record<InteriorLayer, string[]>;
  };
}

export interface WorkbenchDocument {
  version: 1;
  id: string;
  name: string;
  sketch: string;
  overrides: TileOverride[];
  issues: InteriorIssue[];
}

export function builtInDocuments(): WorkbenchDocument[] {
  return APARTMENT_EXAMPLES.map(({ id, name, sketch }) => ({
    version: 1,
    id,
    name,
    sketch,
    overrides: [],
    issues: [],
  }));
}

export function sketchRows(sketch: string): string[] {
  const rows = sketch.replace(/\r/g, "").split("\n");
  while (rows[0]?.trim() === "") rows.shift();
  while (rows.at(-1)?.trim() === "") rows.pop();
  return rows;
}

export function paintPlanRectangle(
  sketch: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  brush: PlanCell,
): string {
  if (!PLAN_BRUSHES.includes(brush)) throw new Error(`Unknown plan brush: ${brush}`);
  const source = sketchRows(sketch);
  const width = Math.max(0, ...source.map((row) => row.length));
  if (!source.length || !width) return sketch;
  const rows = source.map((row) => [...row.padEnd(width)]);
  const left = Math.max(0, Math.min(x1, x2));
  const right = Math.min(width - 1, Math.max(x1, x2));
  const top = Math.max(0, Math.min(y1, y2));
  const bottom = Math.min(rows.length - 1, Math.max(y1, y2));
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const row = rows[y];
      if (row) row[x] = brush;
    }
  }
  return rows.map((row) => row.join("")).join("\n");
}

export function setTileOverride(
  document: WorkbenchDocument,
  override: TileOverride,
): WorkbenchDocument {
  if (!INTERIOR_DRAW_ORDER.includes(override.layer)) throw new Error("Unknown tile layer");
  if (!getModernInteriorsEntry(override.key))
    throw new Error(`Unknown atlas tile: ${override.key}`);
  return {
    ...document,
    overrides: [
      ...document.overrides.filter(
        (item) => item.x !== override.x || item.y !== override.y || item.layer !== override.layer,
      ),
      override,
    ],
  };
}

export function eraseTileOverride(
  document: WorkbenchDocument,
  x: number,
  y: number,
  layer: InteriorLayer,
): WorkbenchDocument {
  return {
    ...document,
    overrides: document.overrides.filter(
      (item) => item.x !== x || item.y !== y || item.layer !== layer,
    ),
  };
}

export function compileWorkbenchDocument(document: WorkbenchDocument): {
  generated: LayeredInteriorMap;
  rendered: LayeredInteriorMap;
} {
  const generated = buildLayeredApartmentPlan(parseFloorPlan(document.sketch));
  const rendered: LayeredInteriorMap = {
    ...generated,
    cells: generated.cells.map((row) =>
      row.map((cell) => ({
        semantic: cell.semantic,
        floor: [...cell.floor],
        wall: [...cell.wall],
        foreground: [...cell.foreground],
        objects: [...cell.objects],
      })),
    ),
  };
  for (const item of document.overrides) {
    const cell = rendered.cells[item.y]?.[item.x];
    if (cell && getModernInteriorsEntry(item.key)) cell[item.layer] = [{ key: item.key }];
  }
  return { generated, rendered };
}

export function issueSnapshot(
  sketch: string,
  map: LayeredInteriorMap,
  x: number,
  y: number,
): InteriorIssue["snapshot"] {
  const cell = map.cells[y]?.[x];
  if (!cell) throw new Error(`Tile ${x},${y} is outside the rendering`);
  const planCell = sketchRows(sketch)[Math.floor(y / 2)]?.[Math.floor(x / 2)] ?? " ";
  return {
    planCell,
    semantic: cell.semantic,
    tiles: {
      floor: cell.floor.map((tile) => tile.key),
      wall: cell.wall.map((tile) => tile.key),
      foreground: cell.foreground.map((tile) => tile.key),
      objects: cell.objects.map((tile) => tile.key),
    },
  };
}

export function parseWorkbenchDocument(raw: unknown): WorkbenchDocument {
  if (!raw || typeof raw !== "object") throw new Error("Invalid workbench file");
  const value = raw as Partial<WorkbenchDocument>;
  if (
    value.version !== 1 ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.sketch !== "string" ||
    !Array.isArray(value.overrides) ||
    !Array.isArray(value.issues)
  ) {
    throw new Error("Workbench file needs version, name, sketch, overrides, and issues");
  }
  const overrides = value.overrides.map((item) => {
    if (
      !item ||
      !Number.isInteger(item.x) ||
      !Number.isInteger(item.y) ||
      !INTERIOR_DRAW_ORDER.includes(item.layer) ||
      typeof item.key !== "string"
    ) {
      throw new Error("Workbench file has an invalid tile override");
    }
    return item;
  });
  const issues = value.issues.map((item) => {
    if (
      !item ||
      typeof item.id !== "string" ||
      !Number.isInteger(item.x) ||
      !Number.isInteger(item.y) ||
      !Number.isInteger(item.width) ||
      !Number.isInteger(item.height) ||
      typeof item.reason !== "string" ||
      !item.snapshot
    ) {
      throw new Error("Workbench file has an invalid issue");
    }
    return item;
  });
  return { version: 1, id: value.id, name: value.name, sketch: value.sketch, overrides, issues };
}
