import { buildLayeredApartmentPlan } from "./ApartmentArchitecture.js";
import { type FloorPlan, parseFloorPlan } from "./ApartmentFloorPlan.js";
import type { InteriorSurface, LayeredInteriorMap } from "./LayeredInteriorMap.js";

export type WallHeight = "low" | "normal" | "tall";
export const WALL_HEIGHTS: Record<WallHeight, number> = { low: 8, normal: 24, tall: 40 };
export interface ProfileWall {
  x: number;
  y: number;
  height: WallHeight;
}
export interface WallProfileOptions {
  walls: ProfileWall[];
  arch?: { x: number; y: number };
}
type Point = [number, number];
const wall = (col: number, row: number) =>
  `room-builder/3d-walls/c${String(col).padStart(2, "0")}-r${String(row).padStart(2, "0")}`;
const key = (x: number, y: number) => `${x},${y}`;

/** Opt-in profile experiments. Height is independent of footprint and cutaway.
 * An 8px occupancy grid forms the union of connected wall bands. Only exposed
 * faces are emitted, and coplanar edges cancel before the atlas colors are drawn.
 * Legacy plans continue through their existing renderer without this pass.
 */
export function buildProfileApartmentPlan(
  plan: FloorPlan,
  options: WallProfileOptions,
): LayeredInteriorMap & { surfaces: InteriorSurface[] } {
  const selected = new Map(options.walls.map((w) => [key(w.x, w.y), w]));
  if (selected.size !== options.walls.length) throw new Error("Duplicate profile wall");
  const profileOpening = (x: number, y: number) =>
    plan.rows[y]?.[x] === "+" && (selected.has(key(x - 1, y)) || selected.has(key(x + 1, y)));
  // The legacy renderer owns the surrounding room, not the replaced branches.
  // Otherwise its junction face survives outside the selected profile cells.
  const roomPlan = selected.size
    ? parseFloorPlan(
        plan.rows
          .map((row, y) =>
            row
              .map((cell, x) => (selected.has(key(x, y)) || profileOpening(x, y) ? "L" : cell))
              .join(""),
          )
          .join("\n"),
      )
    : plan;
  const map = buildLayeredApartmentPlan(roomPlan);
  const cellAt = (x: number, y: number) => {
    const cell = map.cells[y]?.[x];
    if (!cell) throw new Error(`Profile cell ${x},${y} outside map`);
    return cell;
  };
  const columns = new Map<string, { x: number; y: number; height: number }>();
  for (let y = 0; y < plan.height; y++)
    for (let x = 0; x < plan.width; x++) {
      if (
        plan.rows[y]?.[x] !== "+" ||
        !(selected.has(key(x - 1, y)) || selected.has(key(x + 1, y)))
      )
        continue;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const cell = cellAt(x * 2 + dx, y * 2 + dy);
          cell.wall = [];
          cell.foreground = [];
          cell.semantic = "opening";
        }
    }
  for (const w of options.walls) {
    if (plan.rows[w.y]?.[w.x] !== "#" || !WALL_HEIGHTS[w.height])
      throw new Error("Profile requires a wall and supported height");
    if (w.x < 1 || w.y < 2 || w.x >= plan.width - 1 || w.y >= plan.height - 1)
      throw new Error("Profile sampler requires interior walls with projection clearance");
    // Restore the floor under the slimmer footprint, including where a low wall
    // reveals more floor than the legacy full-height cell assembly.
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const cell = cellAt(w.x * 2 + dx, w.y * 2 + dy);
        cell.wall = [];
        cell.foreground = [];
        cell.floor = [{ key: "room-builder/floors/c01-r31" }];
        cell.semantic = "wall";
      }
    const n = selected.has(key(w.x, w.y - 1));
    const verticalShell = (x: number) => [-1, 0, 1].every((dy) => plan.rows[w.y + dy]?.[x] === "#");
    const attachWest = w.x === 1 && verticalShell(0);
    const attachEast = w.x === plan.width - 2 && verticalShell(plan.width - 1);
    const e = selected.has(key(w.x + 1, w.y)) || attachEast,
      west = selected.has(key(w.x - 1, w.y)) || attachWest;
    for (let gy = 0; gy < 4; gy++)
      for (let gx = 0; gx < 4; gx++) {
        if (!((gx === 2 && (gy === 3 || n)) || (gy === 3 && ((west && gx <= 2) || (e && gx >= 2)))))
          continue;
        const x = w.x * 4 + gx,
          y = w.y * 4 + gy;
        columns.set(key(x, y), { x, y, height: WALL_HEIGHTS[w.height] });
      }
    // Extend the physical band to the room-facing shell, rather than leaving
    // half a sketch cell of floor between the two rendering systems.
    const bridgeY = w.y * 4 + 3;
    for (const x of attachWest
      ? [2, 3]
      : attachEast
        ? [plan.width * 4 - 4, plan.width * 4 - 3, plan.width * 4 - 2]
        : [])
      columns.set(key(x, bridgeY), { x, y: bridgeY, height: WALL_HEIGHTS[w.height] });
  }
  const surfaces: InteriorSurface[] = [];
  const project = (x: number, y: number, h: number): Point => [x * 8 - h / 4, y * 8 - h];
  function face(points: Point[], plane: string, kind: "top" | "south" | "east") {
    surfaces.push({
      points,
      plane,
      key: kind === "top" ? wall(10, 2) : kind === "south" ? wall(11, 3) : wall(10, 2),
      sampleX: kind === "top" ? 2 : 12,
      sampleY: 8,
      edges: [],
    });
  }
  for (const c of [...columns.values()].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const { x, y, height: h } = c;
    face(
      [project(x, y, h), project(x + 1, y, h), project(x + 1, y + 1, h), project(x, y + 1, h)],
      `top:${h}`,
      "top",
    );
    const south = columns.get(key(x, y + 1))?.height ?? 0;
    for (let z = Math.min(south, h); z < h; z += 8)
      face(
        [
          project(x, y + 1, z + 8),
          project(x + 1, y + 1, z + 8),
          project(x + 1, y + 1, z),
          project(x, y + 1, z),
        ],
        `south:${y + 1}`,
        "south",
      );
    const east = columns.get(key(x + 1, y))?.height ?? 0;
    for (let z = Math.min(east, h); z < h; z += 8)
      face(
        [
          project(x + 1, y, z + 8),
          project(x + 1, y + 1, z + 8),
          project(x + 1, y + 1, z),
          project(x + 1, y, z),
        ],
        `east:${x + 1}`,
        "east",
      );
  }
  const edgeId = (s: InteriorSurface, a: Point, b: Point) =>
    `${s.plane}:${[a.join(","), b.join(",")].sort().join("/")}`;
  const nextPoint = (s: InteriorSurface, i: number): Point => {
    const point = s.points[(i + 1) % s.points.length];
    if (!point) throw new Error("Empty surface");
    return point;
  };
  const counts = new Map<string, number>();
  for (const s of surfaces)
    s.points.forEach((a, i) => {
      const id = edgeId(s, a, nextPoint(s, i));
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
  for (const s of surfaces)
    s.edges = s.points.map((a, i) => counts.get(edgeId(s, a, nextPoint(s, i))) === 1);
  map.surfaces = surfaces;
  if (options.arch) {
    const { x, y } = options.arch;
    if (plan.rows[y]?.[x] !== "+") throw new Error("Arch requires an opening");
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const cell = cellAt(x * 2 + dx, y * 2 + dy);
        cell.wall = [];
        cell.foreground = [];
      }
    // Native standalone stone arch, kept at its authored size. Its feet sit at
    // the bottom of the opening; this is an appearance candidate, not collision.
    cellAt(x * 2, (y - 1) * 2).objects.push({
      key: "room-builder-sheet/arched-entryways",
      cropWidth: 32,
      cropHeight: 55,
      offsetY: 17,
    });
  }
  return { ...map, surfaces };
}
