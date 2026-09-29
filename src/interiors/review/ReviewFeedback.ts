import type { WallProfileOptions } from "../ApartmentWallProfiles.js";
import { type FurniturePlacement, parseFurniturePlacements } from "../FurnitureCatalog.js";
import { type FurnitureBodies, parseFurnitureBodies } from "../FurniturePhysics.js";

/** Pixel coordinates in the original render; emoji cells span 32px. */
export interface ReviewPin {
  x: number;
  y: number;
  size: 16 | 32;
}
export function parseReviewPins(value: unknown, sketch: string): ReviewPin[] {
  const rows = sketch.split("\n");
  const width = Math.max(...rows.map((row) => row.length)) * 32;
  if (!Array.isArray(value) || value.length > 20) throw new Error("Invalid pins");
  return value.map((pin) => {
    if (!pin || typeof pin !== "object") throw new Error("Invalid pin");
    const { x, y, size } = pin;
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      (size !== 16 && size !== 32) ||
      x < 0 ||
      y < 0 ||
      x % size !== 0 ||
      // North overhang padding shifts a plan-sized pin by half a cell.
      y % 16 !== 0 ||
      x >= width ||
      y >= rows.length * 32
    )
      throw new Error("Invalid pin");
    return { x, y, size };
  });
}

export interface ReviewFeedback {
  id: string;
  caseId: string;
  fingerprint: string;
  verdict: "good" | "wrong" | "clear";
  note: string;
  sketch: string;
  name: string;
  createdAt: string;
  screenshot?: string;
  pins?: ReviewPin[];
  profiles?: WallProfileOptions;
  furniture?: FurniturePlacement[];
  furnitureCatalogVersion?: number;
  /** Runtime movement report, separate from static catalog approval. */
  playtest?: {
    playerX: number;
    playerY: number;
    playerZ?: number;
    groundZ?: number;
    jumpVZ?: number;
    gravityScale?: number;
    bodies?: FurnitureBodies;
    physicsVersion?: number;
    sceneSignature?: string;
    facing: number;
    selected: string;
    mode: "walk" | "place";
  };
}
export function parseReviewFeedback(value: unknown): ReviewFeedback {
  if (!value || typeof value !== "object") throw new Error("Invalid feedback");
  const v = value as Record<string, unknown>;
  for (const [key, limit] of Object.entries({
    id: 100,
    caseId: 100,
    fingerprint: 64,
    note: 2000,
    sketch: 6000,
    name: 200,
    createdAt: 40,
  })) {
    if (typeof v[key] !== "string" || (v[key] as string).length > limit)
      throw new Error(`Invalid ${key}`);
  }
  if (
    !/^[a-zA-Z0-9-]+$/.test(v.id as string) ||
    !/^[a-zA-Z0-9-]+$/.test(v.caseId as string) ||
    !/^[a-f0-9]{64}$/.test(v.fingerprint as string)
  )
    throw new Error("Invalid feedback identity");
  if (!["good", "wrong", "clear"].includes(v.verdict as string)) throw new Error("Invalid verdict");
  if (
    v.screenshot !== undefined &&
    (typeof v.screenshot !== "string" ||
      v.screenshot.length > 700_000 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v.screenshot))
  )
    throw new Error("Invalid screenshot");
  let profiles: WallProfileOptions | undefined;
  if (v.profiles !== undefined) {
    const p = v.profiles as WallProfileOptions;
    const rows = (v.sketch as string).split("\n");
    const at = (x: number, y: number, char: string) =>
      Number.isInteger(x) && Number.isInteger(y) && rows[y]?.[x] === char;
    if (
      !p ||
      !Array.isArray(p.walls) ||
      p.walls.length > 4800 ||
      p.walls.some(
        (w) =>
          !w ||
          !at(w.x, w.y, "#") ||
          !["low", "normal", "tall"].includes(w.height) ||
          (w.thickness !== undefined && !["thin", "thick"].includes(w.thickness)),
      ) ||
      (p.arch !== undefined && (!p.arch || !at(p.arch.x, p.arch.y, "+")))
    )
      throw new Error("Invalid wall profiles");
    profiles = {
      walls: p.walls.map(({ x, y, height, thickness }) => ({
        x,
        y,
        height,
        ...(thickness !== undefined ? { thickness } : {}),
      })),
      ...(p.arch ? { arch: { x: p.arch.x, y: p.arch.y } } : {}),
    };
  }
  if (
    v.furniture !== undefined &&
    (!Number.isInteger(v.furnitureCatalogVersion) || Number(v.furnitureCatalogVersion) < 1)
  )
    throw new Error("Invalid furniture catalog version");
  let playtest: ReviewFeedback["playtest"];
  if (v.playtest !== undefined) {
    const p = v.playtest as NonNullable<ReviewFeedback["playtest"]>;
    if (
      !p ||
      !v.furniture ||
      ![p.playerX, p.playerY].every((n) => Number.isFinite(n) && n >= 0 && n <= 2560) ||
      !Number.isInteger(p.facing) ||
      p.facing < 0 ||
      p.facing > 3 ||
      typeof p.selected !== "string" ||
      !/^[a-z0-9-]{1,80}$/.test(p.selected) ||
      !["walk", "place"].includes(p.mode)
    )
      throw new Error("Invalid playtest context");
    if (
      [p.playerZ, p.groundZ].some(
        (n) => n !== undefined && (!Number.isFinite(n) || n < 0 || n > 4096),
      ) ||
      (p.jumpVZ !== undefined && (!Number.isFinite(p.jumpVZ) || Math.abs(p.jumpVZ) > 4096)) ||
      (p.gravityScale !== undefined &&
        (!Number.isFinite(p.gravityScale) || p.gravityScale < 0.1 || p.gravityScale > 2)) ||
      (p.physicsVersion !== undefined &&
        (!Number.isInteger(p.physicsVersion) || p.physicsVersion < 1)) ||
      (p.sceneSignature !== undefined &&
        (typeof p.sceneSignature !== "string" || p.sceneSignature.length > 50000))
    )
      throw new Error("Invalid playtest physics");
    playtest = {
      ...(p.playerZ !== undefined ? { playerZ: p.playerZ } : {}),
      ...(p.groundZ !== undefined ? { groundZ: p.groundZ } : {}),
      ...(p.jumpVZ !== undefined ? { jumpVZ: p.jumpVZ } : {}),
      ...(p.gravityScale !== undefined ? { gravityScale: p.gravityScale } : {}),
      ...(p.bodies !== undefined ? { bodies: parseFurnitureBodies(p.bodies) } : {}),
      ...(p.physicsVersion !== undefined ? { physicsVersion: p.physicsVersion } : {}),
      ...(p.sceneSignature !== undefined ? { sceneSignature: p.sceneSignature } : {}),
      playerX: p.playerX,
      playerY: p.playerY,
      facing: p.facing,
      selected: p.selected,
      mode: p.mode,
    };
  }
  return {
    ...(playtest ? { playtest } : {}),
    ...(v.furniture !== undefined
      ? {
          furniture: parseFurniturePlacements(v.furniture),
          furnitureCatalogVersion: v.furnitureCatalogVersion as number,
        }
      : {}),
    id: v.id as string,
    caseId: v.caseId as string,
    fingerprint: v.fingerprint as string,
    verdict: v.verdict as ReviewFeedback["verdict"],
    note: v.note as string,
    sketch: v.sketch as string,
    name: v.name as string,
    createdAt: v.createdAt as string,
    ...(v.pins !== undefined ? { pins: parseReviewPins(v.pins, v.sketch as string) } : {}),
    ...(profiles ? { profiles } : {}),
    ...(typeof v.screenshot === "string" ? { screenshot: v.screenshot } : {}),
  };
}
/** Only judgments of these exact pixels and this exact plan remain current. */
export function currentVerdict(
  records: ReviewFeedback[],
  caseId: string,
  fingerprint: string,
): ReviewFeedback | undefined {
  for (let i = records.length - 1; i >= 0; i--) {
    const latest = records[i];
    if (latest?.caseId === caseId)
      return latest.fingerprint === fingerprint && latest.verdict !== "clear" ? latest : undefined;
  }
  return undefined;
}
