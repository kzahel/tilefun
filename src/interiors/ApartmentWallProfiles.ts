import { buildLayeredApartmentPlan } from "./ApartmentArchitecture.js";
import { type FloorPlan, parseFloorPlan } from "./ApartmentFloorPlan.js";
import { verticalWallProfile } from "./ApartmentWallAlignment.js";
import type { InteriorSurface, LayeredInteriorMap } from "./LayeredInteriorMap.js";

export type WallHeight = "low" | "normal" | "tall";
export type WallThickness = "thin" | "thick";
export const WALL_HEIGHTS: Record<WallHeight, number> = { low: 8, normal: 24, tall: 40 };
export const WALL_THICKNESSES: Record<WallThickness, number> = { thin: 8, thick: 16 };
export interface ProfileWall {
  x: number;
  y: number;
  height: WallHeight;
  thickness?: WallThickness;
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
  const eastPorts = new Map<string, { height: number; faceX: number; railX: number }>();
  const westPorts = new Map<string, { height: number; faceX: number; railX: number }>();
  const northPorts = new Map<string, { height: number; lift: number }>();
  const southPorts = new Set<string>();
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
    if (
      plan.rows[w.y]?.[w.x] !== "#" ||
      !WALL_HEIGHTS[w.height] ||
      !WALL_THICKNESSES[w.thickness ?? "thin"]
    )
      throw new Error("Profile requires a wall and supported height/thickness");
    const attachNorth = w.y === 1 && [-1, 0, 1].every((dx) => plan.rows[0]?.[w.x + dx] === "#");
    if (
      w.x < 1 ||
      w.y < 1 ||
      (w.y === 1 && !attachNorth) ||
      w.x >= plan.width - 1 ||
      w.y >= plan.height - 1
    )
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
    const n = selected.has(key(w.x, w.y - 1)) || attachNorth;
    // Keep the south/east face anchored as a band thickens north/west.
    const width = WALL_THICKNESSES[w.thickness ?? "thin"] / 8;
    const minX = 3 - width,
      minY = 4 - width;
    const attachSouth =
      w.y === plan.height - 2 &&
      [-1, 0, 1].every((dx) => plan.rows[plan.height - 1]?.[w.x + dx] === "#");
    if (attachSouth) {
      const endY = (plan.height - 1) * 4;
      // The shallow trim represents a normal-height wall under cutaway policy.
      // Only elevation above that physical wall exposes an end at this join.
      for (let x = w.x * 4 + minX; x <= w.x * 4 + 3; x++) southPorts.add(key(x, endY));
      const capX = (w.x * 4 + minX) * 8 - Math.min(WALL_HEIGHTS[w.height], WALL_HEIGHTS.normal) / 4;
      // Write within each owning tile so the next trim tile cannot cover a
      // connection that crosses a 16px boundary.
      for (let x = capX + 1; x < capX + width * 8; x++)
        cellAt(Math.floor(x / 16), endY / 2).foreground.push({
          key: wall(10, 2),
          cropX: 2,
          cropWidth: 1,
          cropHeight: 1,
          offsetX: (x % 16) - 2,
        });
    }
    const verticalShell = (x: number) => [-1, 0, 1].every((dy) => plan.rows[w.y + dy]?.[x] === "#");
    const attachWest = w.x === 1 && verticalShell(0);
    const attachEast = w.x === plan.width - 2 && verticalShell(plan.width - 1);
    // Explicit footprints reach the edge of an adjacent opening, leaving one
    // full sketch cell clear. Omitted widths retain the approved old door ends.
    const e =
        selected.has(key(w.x + 1, w.y)) ||
        attachEast ||
        (w.thickness !== undefined && profileOpening(w.x + 1, w.y)),
      west =
        selected.has(key(w.x - 1, w.y)) ||
        attachWest ||
        (w.thickness !== undefined && profileOpening(w.x - 1, w.y));
    for (let gy = 0; gy < 4; gy++)
      for (let gx = 0; gx < 4; gx++) {
        if (
          !(
            (gx >= minX && gx <= 2 && (gy >= minY || n)) ||
            (gy >= minY && ((west && gx <= 2) || (e && gx >= minX)))
          )
        )
          continue;
        const x = w.x * 4 + gx,
          y = w.y * 4 + gy;
        columns.set(key(x, y), { x, y, height: WALL_HEIGHTS[w.height] });
      }
    // Extend the physical band to the room-facing shell, rather than leaving
    // half a sketch cell of floor between the two rendering systems.
    const bridgeY = w.y * 4 + minY;
    for (const x of attachWest
      ? [2, 3]
      : attachEast
        ? [plan.width * 4 - 4, plan.width * 4 - 3, plan.width * 4 - 2]
        : [])
      for (let y = bridgeY; y < bridgeY + width; y++)
        columns.set(key(x, y), { x, y, height: WALL_HEIGHTS[w.height] });
    if (attachWest) {
      const h = WALL_HEIGHTS[w.height];
      const railX = verticalWallProfile(roomPlan, 0, w.y).railX + 6;
      const faceX = railX + 10;
      // The shell is normal height. Taller partitions project above its rail
      // instead of treating that rail as their own top elevation.
      if (h > WALL_HEIGHTS.low) {
        const port = { height: WALL_HEIGHTS.normal, faceX, railX };
        for (let y = bridgeY; y <= bridgeY + width; y++) westPorts.set(key(2, y), port);
        const topY = bridgeY * 8 - h;
        if (h === WALL_HEIGHTS.normal)
          cellAt(Math.floor(railX / 16), Math.floor(topY / 16)).foreground.push({
            key: wall(10, 2),
            cropX: 2,
            cropWidth: 1,
            cropHeight: width * 8 - 1,
            offsetX: (railX % 16) - 2,
            offsetY: (topY % 16) + 1,
          });
      }
    }
    if (attachEast) {
      const h = WALL_HEIGHTS[w.height];
      const end = plan.width * 4 - 1;
      const railX =
        (plan.width - 1) * 32 + verticalWallProfile(roomPlan, plan.width - 1, w.y).railX;
      const faceX = railX - 9;
      // All heights share the shell's elevation reference. A low cap ends in
      // its face; a tall cap rises beyond its rail and exposes only the excess.
      {
        const port = { height: WALL_HEIGHTS.normal, faceX, railX };
        for (let y = bridgeY; y <= bridgeY + width; y++) eastPorts.set(key(end, y), port);
        const topY = bridgeY * 8 - h;
        if (h === WALL_HEIGHTS.normal)
          cellAt(Math.floor(railX / 16), Math.floor(topY / 16)).foreground.push({
            key: wall(10, 2),
            cropX: 2,
            cropWidth: 1,
            cropHeight: width * 8 - 1,
            offsetX: (railX % 16) - 2,
            offsetY: (topY % 16) + 1,
          });
      }
    }
    if (attachNorth) {
      const h = WALL_HEIGHTS[w.height];
      const lift = h >= WALL_HEIGHTS.normal ? 5 - (32 - WALL_HEIGHTS.normal) : 0;
      if (lift) {
        // The native north cap ends at y=5. Blend its connection back into the
        // ordinary projection over the first cell, keeping every segment monotone.
        for (let y = 4; y <= 8; y++)
          for (let x = w.x * 4 + minX; x <= w.x * 4 + 3; x++)
            northPorts.set(key(x, y), { height: h, lift: (lift * (8 - y)) / 4 });
        const capX = (w.x * 4 + minX) * 8 - h / 4;
        if (h === WALL_HEIGHTS.normal)
          cellAt(Math.floor(capX / 16), 0).foreground.push({
            key: wall(10, 2),
            cropX: 2,
            cropWidth: 1,
            drawWidth: width * 8 - 1,
            cropHeight: 1,
            offsetX: (capX % 16) - 1,
            offsetY: 5,
          });
      }
    }
  }
  const surfaces: InteriorSurface[] = [];
  const project = (x: number, y: number, h: number): Point => {
    const port = eastPorts.get(key(x, y)) ?? westPorts.get(key(x, y));
    const north = northPorts.get(key(x, y));
    return [
      port
        ? port.faceX +
          Math.round(((port.railX - port.faceX) * Math.min(h, port.height)) / port.height) +
          (Math.sign(port.railX - port.faceX) * Math.max(0, h - port.height)) / 4
        : x * 8 - h / 4,
      southPorts.has(key(x, y))
        ? y * 8 - Math.max(0, h - WALL_HEIGHTS.normal)
        : y * 8 - h + (north ? Math.round((north.lift * h) / north.height) : 0),
    ];
  };
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
    const south = southPorts.has(key(x, y + 1))
      ? WALL_HEIGHTS.normal
      : (columns.get(key(x, y + 1))?.height ?? 0);
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
    const east = eastPorts.get(key(x + 1, y))?.height ?? columns.get(key(x + 1, y))?.height ?? 0;
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
  // Preserve tall overhangs above the north wall. Round the viewport padding to
  // a half-cell so review pins remain aligned with their 16px pixel grid.
  const minY = Math.min(0, ...surfaces.flatMap((s) => s.points.map(([, y]) => y)));
  if (minY < 0) {
    map.contentOffsetY = Math.ceil(-minY / 16) * 16;
    map.pixelHeight += map.contentOffsetY;
  }
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
