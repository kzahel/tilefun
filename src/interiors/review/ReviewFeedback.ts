import type { WallProfileOptions } from "../ApartmentWallProfiles.js";

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
      y % size !== 0 ||
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
        (w) => !w || !at(w.x, w.y, "#") || !["low", "normal", "tall"].includes(w.height),
      ) ||
      (p.arch !== undefined && (!p.arch || !at(p.arch.x, p.arch.y, "+")))
    )
      throw new Error("Invalid wall profiles");
    profiles = {
      walls: p.walls.map(({ x, y, height }) => ({ x, y, height })),
      ...(p.arch ? { arch: { x: p.arch.x, y: p.arch.y } } : {}),
    };
  }
  return {
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
  const latest = [...records].reverse().find((r) => r.caseId === caseId);
  return latest?.fingerprint === fingerprint && latest.verdict !== "clear" ? latest : undefined;
}
