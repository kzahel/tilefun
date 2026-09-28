import { APARTMENT_EXAMPLES, type PlanCell } from "../ApartmentFloorPlan.js";

export const REVIEW_STAGES = [
  "Tiny rooms",
  "Doorways",
  "Dividers",
  "Corners",
  "Junctions",
  "Apartments",
] as const;
export interface ReviewCase {
  id: string;
  name: string;
  stage: number;
  sketch: string;
}
type Grid = PlanCell[][];
const rectangle = (w: number, h: number, floor: PlanCell = "L"): Grid =>
  Array.from({ length: h + 2 }, (_, y) =>
    Array.from({ length: w + 2 }, (_, x) =>
      x === 0 || y === 0 || x === w + 1 || y === h + 1 ? "#" : floor,
    ),
  );
const rotate = (g: Grid): Grid =>
  (g[0] ?? []).map((_, x) => g.map((row) => row[x] ?? " ").reverse());
function shell(floors: Grid): Grid {
  return floors.map((row, y) =>
    row.map((cell, x) =>
      cell !== " "
        ? cell
        : [-1, 0, 1].some((dy) =>
              [-1, 0, 1].some((dx) => "LK".includes(floors[y + dy]?.[x + dx] ?? "!")),
            )
          ? "#"
          : " ",
    ),
  );
}

/** Fixed, reproducible coverage ladder. Rotations change plans, never atlas sprites. */
export function reviewCases(): ReviewCase[] {
  const result: ReviewCase[] = [];
  const seen = new Set<string>();
  function add(stage: number, name: string, grid: Grid | string): void {
    const sketch = typeof grid === "string" ? grid : grid.map((row) => row.join("")).join("\n");
    // Review geometry once: floor palette swaps do not make a new wall or
    // doorway case. Keep the original sketch/ID so existing verdicts survive.
    const geometry = sketch.replace(/[BKTH]/g, "L");
    if (seen.has(geometry)) return;
    seen.add(geometry);
    let hash = 2166136261;
    for (const char of sketch) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    result.push({ id: `review-${stage}-${(hash >>> 0).toString(16)}`, name, stage, sketch });
  }
  for (const [w, h] of [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2],
    [3, 2],
    [2, 3],
    [4, 3],
    [3, 4],
  ] as const) {
    for (const floor of ["L", "K"] as const)
      add(0, `${w} × ${h} · ${floor === "L" ? "wood" : "tile"}`, rectangle(w, h, floor));
  }
  for (const size of [3, 4, 5]) {
    for (const side of ["north", "south", "west", "east"]) {
      for (let pos = 1; pos <= size; pos++) {
        // Side openings require two complete wall cells above the doorway.
        if ((side === "west" || side === "east") && pos < 3) continue;
        for (const floor of ["L", "K"] as const) {
          const g = rectangle(size, size, floor);
          const x = side === "west" ? 0 : side === "east" ? size + 1 : pos;
          const y = side === "north" ? 0 : side === "south" ? size + 1 : pos;
          (g[y] as PlanCell[])[x] = "+";
          add(1, `${size} × ${size} · ${side} door ${pos} · ${floor === "L" ? "wood" : "tile"}`, g);
        }
      }
    }
  }
  for (const orientation of ["horizontal", "vertical"]) {
    for (const sameFloor of [true, false]) {
      for (const size of [3, 5]) {
        for (let pos = orientation === "vertical" ? 3 : 1; pos <= size; pos++) {
          const g = rectangle(
            orientation === "vertical" ? 5 : size,
            orientation === "vertical" ? size : 5,
          );
          for (let y = 1; y < g.length - 1; y++)
            for (let x = 1; x < (g[0]?.length ?? 0) - 1; x++) {
              const axis = orientation === "vertical" ? x : y;
              (g[y] as PlanCell[])[x] = axis === 3 ? "#" : axis > 3 && !sameFloor ? "K" : "L";
            }
          (g[orientation === "vertical" ? pos : 3] as PlanCell[])[
            orientation === "vertical" ? 3 : pos
          ] = "+";
          add(
            2,
            `${orientation} divider · door ${pos} · ${sameFloor ? "same floor" : "floor transition"}`,
            g,
          );
        }
      }
    }
  }
  for (const size of [5, 7])
    for (const cut of [2, 3]) {
      let g: Grid = Array.from({ length: size + 2 }, (_, y) =>
        Array.from({ length: size + 2 }, (_, x) =>
          x > 0 && y > 0 && x <= size && y <= size && !(x > size - cut && y > size - cut)
            ? "L"
            : " ",
        ),
      );
      g = shell(g);
      for (let turn = 0; turn < 4; turn++) {
        add(3, `${size} × ${size} · inset ${cut} · turn ${turn + 1}`, g);
        g = rotate(g);
      }
    }
  for (const size of [5, 7])
    for (const cross of [false, true]) {
      let g = rectangle(size, size);
      const middle = Math.ceil(size / 2);
      for (let y = 1; y <= size; y++)
        for (let x = 1; x <= size; x++) {
          (g[y] as PlanCell[])[x] =
            y === middle || (x === middle && (cross || y < middle))
              ? "#"
              : y > middle || x > middle
                ? "K"
                : "L";
        }
      // These isolate wall junctions; enclosed rooms intentionally have no exterior entrance.
      for (let turn = 0; turn < 4; turn++) {
        add(4, `${cross ? "Cross" : "T"} junction · ${size} × ${size} · turn ${turn + 1}`, g);
        g = rotate(g);
      }
    }
  for (const item of APARTMENT_EXAMPLES) add(5, item.name, item.sketch);
  return result;
}
