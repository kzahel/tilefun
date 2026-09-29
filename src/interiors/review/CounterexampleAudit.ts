import { buildLayeredApartmentPlan } from "../ApartmentArchitecture.js";
import { type FloorPlan, parseFloorPlan } from "../ApartmentFloorPlan.js";
import {
  buildProfileApartmentPlan,
  type ProfileGeometry,
  type WallProfileOptions,
} from "../ApartmentWallProfiles.js";
import { compileFurniture } from "../FurnishedInterior.js";
import type { LayeredInteriorMap } from "../LayeredInteriorMap.js";
import type { ReviewCase } from "./ReviewCases.js";

export interface AuditIssue {
  code: string;
  message: string;
  at?: [number, number];
}
type AuditedMap = LayeredInteriorMap & { profileGeometry?: ProfileGeometry };
const key = (x: number, y: number) => `${x},${y}`;

/** Audits actual emitted face provenance against the solid union and shell masks. */
export function auditGeometry(map: AuditedMap): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const s of map.surfaces ?? [])
    for (const [x, rawY] of s.points) {
      const y = rawY + (map.contentOffsetY ?? 0);
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        y < 0 ||
        x >= map.width * 16 ||
        y >= map.pixelHeight
      ) {
        issues.push({ code: "bounds", message: "A surface leaves the render viewport" });
        break;
      }
    }
  const g = map.profileGeometry;
  if (!g) return issues;
  if (g.faces.length !== map.surfaces?.length)
    issues.push({ code: "provenance", message: "Face provenance does not match drawn surfaces" });
  const columns = new Map(g.columns.map((c) => [key(c.x, c.y), c.height]));
  const covered = new Map(g.covered.map((c) => [`${c.axis}:${key(c.x, c.y)}`, c.height]));
  const expected = new Set<string>();
  const faceKey = (axis: string, x: number, y: number, bottom: number, top: number) =>
    `${axis}:${x},${y}:${bottom}-${top}`;
  for (const c of g.columns) {
    expected.add(faceKey("top", c.x, c.y, c.height, c.height));
    for (const axis of ["east", "south"] as const) {
      const nx = c.x + (axis === "east" ? 1 : 0),
        ny = c.y + (axis === "south" ? 1 : 0);
      const neighbor = Math.max(
        columns.get(key(nx, ny)) ?? 0,
        covered.get(`${axis}:${key(nx, ny)}`) ?? 0,
      );
      for (let z = neighbor; z < c.height; z += 8) expected.add(faceKey(axis, c.x, c.y, z, z + 8));
    }
  }
  const seen = new Set<string>();
  for (const f of g.faces) {
    const id = faceKey(f.axis, f.x, f.y, f.bottom, f.top);
    if (seen.has(id))
      issues.push({
        code: "duplicate-face",
        message: "A physical face is emitted twice",
        at: [Math.floor(f.x / 4), Math.floor(f.y / 4)],
      });
    seen.add(id);
    if (!expected.has(id))
      issues.push({
        code: "internal-face",
        message: "A face is covered by another solid or shell, or exceeds its column",
        at: [Math.floor(f.x / 4), Math.floor(f.y / 4)],
      });
  }
  if ([...expected].some((id) => !seen.has(id)))
    issues.push({ code: "missing-face", message: "An exposed solid face was not emitted" });
  return issues;
}

/** Structural checks are not visual approval and do not rasterize or cache rooms. */
export function auditCase(c: ReviewCase): AuditIssue[] {
  try {
    const plan = parseFloorPlan(c.sketch);
    if (c.furniture) compileFurniture(plan, c.furniture);
    const map: AuditedMap = c.profiles
      ? buildProfileApartmentPlan(plan, c.profiles, true)
      : buildLayeredApartmentPlan(plan);
    const issues = auditGeometry(map);
    const floor = new Set<string>();
    plan.rows.forEach((row, y) => {
      row.forEach((v, x) => {
        if ("LBKTH+".includes(v)) floor.add(key(x, y));
      });
    });
    const start = [...floor][0],
      reached = new Set<string>(),
      queue = start ? [start] : [];
    for (let i = 0; i < queue.length; i++) {
      const value = queue[i];
      if (!value || reached.has(value)) continue;
      reached.add(value);
      const [x = 0, y = 0] = value.split(",").map(Number);
      for (const [dx = 0, dy = 0] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const next = key(x + dx, y + dy);
        if (floor.has(next) && !reached.has(next)) queue.push(next);
      }
    }
    if (!floor.size || reached.size !== floor.size)
      issues.push({
        code: "disconnected-floor",
        message: "Authored room floors are not all reachable through openings",
      });
    if (c.profiles) issues.push(...auditOpenings(plan, map, c.profiles));
    return issues;
  } catch (error) {
    return [{ code: "compile", message: error instanceof Error ? error.message : String(error) }];
  }
}

/** Checks the rendered doorway cells as well as physical wall occupancy. */
export function auditOpenings(
  plan: FloorPlan,
  map: AuditedMap,
  profiles: WallProfileOptions,
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (map.profileGeometry) {
    for (const solid of map.profileGeometry.columns) {
      const x = Math.floor(solid.x / 4),
        y = Math.floor(solid.y / 4);
      if (plan.rows[y]?.[x] === "+")
        issues.push({
          code: "blocked-opening",
          message: "A solid occupies the doorway footprint",
          at: [x, y],
        });
    }
    for (let y = 0; y < plan.height; y++)
      for (let x = 0; x < plan.width; x++) {
        if (
          plan.rows[y]?.[x] !== "+" ||
          !profiles.walls.some((w) => w.y === y && Math.abs(w.x - x) === 1)
        )
          continue;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const cell = map.cells[y * 2 + dy]?.[x * 2 + dx];
            if (!cell || cell.semantic !== "opening" || cell.wall.length || cell.foreground.length)
              issues.push({
                code: "blocked-opening",
                message: "Wall tiles remain in a profile doorway",
                at: [x, y],
              });
          }
      }
  }
  return issues;
}
