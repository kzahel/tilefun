import type { ProfileWall, WallHeight, WallProfileOptions } from "../ApartmentWallProfiles.js";
import type { ReviewCase } from "./ReviewCases.js";

/** First compare one profile at a time; then exercise nearby height changes. */
type ProfileCase = ReviewCase & { profiles: WallProfileOptions };
type Point = [number, number];
export function profileReviewCases(): ProfileCase[] {
  const results: ProfileCase[] = [];
  const horizontal: Point[] = [
    [2, 3],
    [3, 3],
    [4, 3],
  ];
  function add(
    id: string,
    name: string,
    cells: Point[],
    heights: WallHeight[],
    arch = false,
    opening = false,
  ) {
    const grid: string[][] = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => (x === 0 || y === 0 || x === 7 || y === 7 ? "#" : "L")),
    );
    const walls: ProfileWall[] = cells.map(([x, y], i) => {
      const height = heights[i % heights.length];
      if (!height) throw new Error("Missing sampler height");
      return { x, y, height };
    });
    const set = (x: number, y: number, value: string) => {
      const row = grid[y];
      if (!row) throw new Error("Sampler row outside grid");
      row[x] = value;
    };
    for (const w of walls) set(w.x, w.y, "#");
    if (opening) set(3, 3, "+");
    if (arch) {
      for (let x = 0; x < 8; x++) set(x, 3, "#");
      set(3, 3, "+");
    }
    results.push({
      id: `profile-${id}`,
      name,
      stage: 7,
      sketch: grid.map((r) => r.join("")).join("\n"),
      profiles: { walls, ...(arch ? { arch: { x: 3, y: 3 } } : {}) },
    });
  }
  for (const height of ["normal", "low", "tall"] as const)
    add(`straight-${height}`, `Height sampler · ${height} partition`, horizontal, [height]);
  add("arch", "Opening sampler · native stone arch", [], [], true);
  for (const mirror of [false, true]) {
    const suffix = mirror ? " · mirror" : "";
    const flip = (points: Point[]): Point[] => points.map(([x, y]) => [mirror ? 6 - x : x, y]);
    add(`step-${mirror}`, `Height change · low meets normal${suffix}`, flip(horizontal), [
      "low",
      "low",
      "normal",
    ]);
    add(
      `bend-${mirror}`,
      `Height change · low corner into tall${suffix}`,
      flip([
        [2, 3],
        [3, 3],
        [3, 4],
        [3, 5],
      ]),
      ["low", "low", "tall", "tall"],
    );
    add(
      `tee-${mirror}`,
      `Height change · low branch at normal/tall T${suffix}`,
      flip([
        [2, 3],
        [3, 3],
        [4, 3],
        [3, 4],
        [3, 5],
      ]),
      ["tall", "normal", "normal", "low", "low"],
    );
    add(
      `door-${mirror}`,
      `Opening beside a height change${suffix}`,
      flip([
        [1, 3],
        [2, 3],
        [4, 3],
        [5, 3],
      ]),
      ["low", "low", "normal", "tall"],
      false,
      true,
    );
  }
  for (const [sourceId, height] of [
    ["profile-door-false", "low"],
    ["profile-door-true", "tall"],
  ]) {
    const source = results.find((c) => c.id === sourceId);
    if (!source) throw new Error("Missing attachment source");
    results.push({
      ...source,
      id: `profile-door-east-${height}`,
      name: `East wall attachment · ${height} wall beside opening`,
      sketch: source.sketch
        .split("\n")
        .map((row) => [...row].reverse().join(""))
        .join("\n"),
      profiles: { walls: source.profiles.walls.map((w) => ({ ...w, x: 7 - w.x })) },
    });
  }
  return results;
}
