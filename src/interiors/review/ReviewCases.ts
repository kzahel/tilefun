import { APARTMENT_EXAMPLES, type PlanCell } from "../ApartmentFloorPlan.js";
import { APARTMENT_JOIN_FIXTURES, WIDE_WALL_FIXTURES } from "../ApartmentJoinFixtures.js";
import type { WallProfileOptions } from "../ApartmentWallProfiles.js";
import type { FurniturePlacement } from "../FurnitureCatalog.js";
import type { InteriorIdentity } from "../GameplayInterior.js";
import { boundaryReviewCases } from "./BoundaryReviewCases.js";
import { buildingLayoutReviewCases } from "./BuildingLayoutReviewCases.js";
import { connectionReviewCases } from "./ConnectionReviewCases.js";
import { furnitureReviewCases } from "./FurnitureReviewCases.js";
import { generatedReviewCases } from "./GeneratedReviewCases.js";
import { interactionReviewCases } from "./InteractionReviewCases.js";
import { nearbyReviewCases } from "./NearbyReviewCases.js";
import { profileReviewCases } from "./ProfileReviewCases.js";

export const REVIEW_STAGES = [
  "Tiny rooms",
  "Doorways",
  "Dividers",
  "Corners",
  "Junctions",
  "Apartments",
  "Small stress cases",
  "Wall heights & arches",
  "Thickness & end joins",
  "Small profile interactions",
  "Mixed heights & thickness",
  "Connected room layouts",
  "North & south attachments",
  "Nearby doors & junctions",
  "Generated small counterexamples",
  "Furniture catalog",
  "Playable building layouts",
] as const;
export interface ReviewCase {
  id: string;
  name: string;
  stage: number;
  sketch: string;
  relatedCaseId?: string;
  profiles?: WallProfileOptions;
  furniture?: FurniturePlacement[];
  building?: InteriorIdentity;
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
  function add(stage: number, name: string, grid: Grid | string, relatedCaseId?: string): void {
    const sketch = typeof grid === "string" ? grid : grid.map((row) => row.join("")).join("\n");
    // Review geometry once: floor palette swaps do not make a new wall or
    // doorway case. Keep the original sketch/ID so existing verdicts survive.
    const geometry = sketch.replace(/[BKTH]/g, "L");
    if (seen.has(geometry)) return;
    seen.add(geometry);
    let hash = 2166136261;
    for (const char of sketch) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    result.push({
      id: `review-${stage}-${(hash >>> 0).toString(16)}`,
      name,
      stage,
      sketch,
      ...(relatedCaseId ? { relatedCaseId } : {}),
    });
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
  // Keep the original category indexes and IDs stable. These deliberately
  // combine nearby features rather than adding more floor palettes or rooms.
  // Focus the next small-case round on reductions of the actual pinned
  // apartment joins, before the broader motif permutations.
  for (const fixture of APARTMENT_JOIN_FIXTURES) {
    for (const mirror of [false, true]) {
      const sketch = mirror
        ? fixture.sketch
            .split("\n")
            .map((row) => [...row].reverse().join(""))
            .join("\n")
        : fixture.sketch;
      add(6, `Reported join · ${fixture.name}${mirror ? " · mirror" : ""}`, sketch);
    }
  }
  for (const fixture of WIDE_WALL_FIXTURES) {
    const width = Math.max(...fixture.sketch.split("\n").map((row) => row.length));
    for (const mirror of [false, true]) {
      const sketch = fixture.sketch
        .split("\n")
        .map((row) => {
          const padded = row.padEnd(width);
          return mirror ? [...padded].reverse().join("") : padded;
        })
        .join("\n");
      add(
        6,
        `Wide wall · ${fixture.name}${mirror ? " · mirror" : ""}`,
        sketch,
        fixture.relatedCaseId,
      );
    }
  }
  const stressStart = result.length;
  function stressVariants(name: string, original: Grid): void {
    for (const mirrored of [false, true]) {
      let grid = original.map((row) => (mirrored ? [...row].reverse() : [...row]));
      for (let turn = 0; turn < 4; turn++) {
        add(6, `${name} · ${mirrored ? "mirror · " : ""}turn ${turn + 1}`, grid);
        grid = rotate(grid);
      }
    }
  }
  for (const gap of [1, 2]) {
    for (const opposite of [false, true]) {
      const grid = rectangle(5, 5 + gap);
      for (let y = 1; y <= 5 + gap; y++) (grid[y] as PlanCell[])[3] = "#";
      for (let x = 1; x <= 2; x++) {
        (grid[2] as PlanCell[])[x] = "#";
        (grid[3 + gap] as PlanCell[])[opposite ? 6 - x : x] = "#";
      }
      stressVariants(
        `Nearby T junctions · ${opposite ? "opposite" : "same"} sides · gap ${gap}`,
        grid,
      );
    }
  }
  for (const offset of [1, 2]) {
    const grid = rectangle(5, 5);
    for (let y = 1; y <= 3; y++) (grid[y] as PlanCell[])[2] = "#";
    for (let x = 2; x <= 2 + offset; x++) (grid[3] as PlanCell[])[x] = "#";
    for (let y = 3; y <= 5; y++) (grid[y] as PlanCell[])[2 + offset] = "#";
    stressVariants(`Short stepped divider · offset ${offset}`, grid);
  }
  for (const length of [1, 2, 3]) {
    const grid = rectangle(3, 4);
    for (let y = 1; y <= length; y++) (grid[y] as PlanCell[])[2] = "#";
    stressVariants(`Wall end · return ${length}`, grid);
  }
  // Mix families so a short session does not consist only of rotations of
  // one motif. The broader coverage-driven scheduler is a later increment.
  const stress = result.splice(stressStart);
  const families = ["Wall end", "Short stepped divider", "Nearby T junctions"].map((prefix) =>
    stress.filter((c) => c.name.startsWith(prefix)),
  );
  for (let i = 0; i < Math.max(...families.map((family) => family.length)); i++)
    for (const family of families) {
      const candidate = family[i];
      if (candidate) result.push(candidate);
    }
  // Smaller reductions of the reported end/step failures. Retain the existing
  // queue and IDs; these also stress a single straight cell between junctions.
  for (const [name, sketch] of [
    ["Compact wall end", "#####\n#L#L#\n#LLL#\n#####"],
    ["Compact stepped divider", "######\n#L#LL#\n#L##L#\n#LL#L#\n######"],
  ] as const) {
    for (const mirror of [false, true])
      add(
        6,
        `${name}${mirror ? " · mirror" : ""}`,
        mirror
          ? sketch
              .split("\n")
              .map((row) => [...row].reverse().join(""))
              .join("\n")
          : sketch,
      );
  }
  for (const item of APARTMENT_EXAMPLES) add(5, item.name, item.sketch);
  return [
    ...result,
    ...profileReviewCases(),
    ...connectionReviewCases(),
    ...interactionReviewCases(),
    ...boundaryReviewCases(),
    ...nearbyReviewCases(),
    ...generatedReviewCases(),
    ...furnitureReviewCases(),
    ...buildingLayoutReviewCases(),
  ];
}
