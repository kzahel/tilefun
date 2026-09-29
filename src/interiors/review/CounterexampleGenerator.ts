import type { ProfileWall, WallHeight, WallProfileOptions } from "../ApartmentWallProfiles.js";
import type { ReviewCase } from "./ReviewCases.js";

export type Probe = ReviewCase & { profiles: WallProfileOptions; seed: number; family: number };
export const PROBE_COUNT = 4 * 3 * 3 * 4 * 4 * 2;

/** Versioned mixed-radix seeds: no randomness, renderer work, or search in the page. */
export function generateProbe(seed: number): Probe {
  if (!Number.isInteger(seed) || seed < 0 || seed >= PROBE_COUNT)
    throw new Error("Invalid probe seed");
  let n = seed;
  const digit = (radix: number) => {
    const value = n % radix;
    n = Math.floor(n / radix);
    return value;
  };
  const family = digit(4),
    size = 7 + digit(3),
    gap = 1 + digit(3),
    elevation = digit(4),
    widths = digit(4),
    mirror = digit(2) === 1;
  const grid: string[][] = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) =>
      x === 0 || y === 0 || x === size - 1 || y === size - 1 ? "#" : "L",
    ),
  );
  const walls = new Map<string, ProfileWall>();
  const put = (x: number, y: number, value: string) => {
    const row = grid[y];
    if (!row || x < 0 || x >= size) throw new Error("Probe outside grid");
    row[x] = value;
  };
  const wall = (x: number, y: number, branch = false) => {
    const height: WallHeight =
      elevation === 1 && branch
        ? "low"
        : elevation >= 2 && branch
          ? "tall"
          : elevation === 3
            ? "low"
            : "normal";
    walls.set(`${x},${y}`, {
      x,
      y,
      height,
      thickness: widths & (branch ? 2 : 1) ? "thick" : "thin",
    });
    put(x, y, "#");
  };
  const door = (x: number, y: number) => {
    walls.delete(`${x},${y}`);
    put(x, y, "+");
  };
  if (family === 0) {
    const second = Math.min(size - 3, 3 + gap);
    for (let x = 1; x <= second + 1; x++) wall(x, 3);
    for (let y = 4; y <= Math.min(size - 2, 5); y++) wall(2, y, true);
    if (gap % 2) wall(second, 2, true);
    else for (let y = 4; y <= Math.min(size - 2, 5); y++) wall(second, y, true);
  } else if (family === 1) {
    const right = Math.min(size - 2, 4 + gap),
      bottom = Math.min(size - 3, 4 + (gap % 2));
    for (let x = 2; x <= right; x++) {
      wall(x, 2);
      wall(x, bottom);
    }
    for (let y = 2; y <= bottom; y++) {
      wall(2, y, true);
      wall(right, y, true);
    }
    door(3 + ((gap - 1) % (right - 3)), bottom);
  } else if (family === 2) {
    const bottom = Math.min(size - 3, 3 + gap);
    for (let x = 1; x < size - 1; x++) {
      wall(x, 2);
      wall(x, bottom, true);
    }
    door(2, 2);
    door(size - 3, bottom);
  } else {
    const opening = Math.min(size - 3, 2 + gap);
    for (let x = 1; x < size - 1; x++) wall(x, 3);
    for (let y = 4; y <= Math.min(size - 3, 4 + (gap % 2)); y++) wall(opening - 1, y, true);
    wall(opening + 1, 2, true);
    door(opening, 3);
  }
  const names = [
    "Paired junctions",
    "Loop with offset opening",
    "Closely spaced room doors",
    "Door between short returns",
  ];
  return {
    id: `probe-v1-${seed}`,
    seed,
    family,
    stage: 14,
    name: `${names[family]} · ${size}×${size}${mirror ? " · mirror" : ""}`,
    sketch: grid.map((row) => (mirror ? [...row].reverse() : row).join("")).join("\n"),
    profiles: {
      walls: [...walls.values()].map((w) => ({ ...w, x: mirror ? size - 1 - w.x : w.x })),
    },
  };
}

/** Ignore floor palettes and profile list ordering; retain handedness. */
export function caseIdentity(c: ReviewCase): string {
  return JSON.stringify([
    c.sketch.replace(/[BKTH]/g, "L"),
    c.profiles?.walls
      .map((w) => [w.x, w.y, w.height, w.thickness ?? "thin"])
      .sort((a, b) => String(a).localeCompare(String(b))),
    c.profiles?.arch,
  ]);
}

/** Source-local neighborhoods and event spacing, independent of case IDs/names. */
export function interactionFeatures(c: ReviewCase): Set<string> {
  const rows = c.sketch.split("\n");
  const profiles = new Map(c.profiles?.walls.map((w) => [`${w.x},${w.y}`, w]) ?? []);
  const token = (x: number, y: number) => {
    const cell = rows[y]?.[x] ?? " ";
    if (cell !== "#") return cell === "+" ? "+" : cell === " " ? " " : ".";
    const w = profiles.get(`${x},${y}`);
    return `${w?.height ?? "normal"}/${w?.thickness ?? "thin"}`;
  };
  const events: { x: number; y: number; kind: string }[] = [];
  const features = new Set<string>();
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < (rows[y]?.length ?? 0); x++) {
      if (!"#+".includes(rows[y]?.[x] ?? " ")) continue;
      const ports = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ].map(([dx = 0, dy = 0]) => "#+".includes(rows[y + dy]?.[x + dx] ?? " "));
      const degree = ports.filter(Boolean).length;
      if (
        rows[y]?.[x] !== "+" &&
        degree === 2 &&
        ((ports[0] && ports[2]) || (ports[1] && ports[3]))
      )
        continue;
      const kind = rows[y]?.[x] === "+" ? "door" : `node${degree}`;
      events.push({ x, y, kind });
      features.add(
        `${kind}:${[-1, 0, 1].map((dy) => [-1, 0, 1].map((dx) => token(x + dx, y + dy)).join(",")).join("/")}`,
      );
    }
  for (const a of events)
    for (const b of events) {
      const dx = b.x - a.x,
        dy = b.y - a.y;
      if (Math.abs(dx) + Math.abs(dy) >= 1 && Math.abs(dx) + Math.abs(dy) <= 4)
        features.add(`${a.kind}:${token(a.x, a.y)}>${b.kind}:${token(b.x, b.y)}@${dx},${dy}`);
    }
  return features;
}
