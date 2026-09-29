import type { ProfileWall, WallHeight, WallProfileOptions } from "../ApartmentWallProfiles.js";
import type { ReviewCase } from "./ReviewCases.js";

type Candidate = ReviewCase & { profiles: WallProfileOptions };
type Point = [number, number];
/** Small interactions, mixed profiles, then connected rooms. Fixed wood throughout. */
export function interactionReviewCases(): Candidate[] {
  const cases: Candidate[] = [];
  const w = (x: number, y: number, thick = false, height: WallHeight = "normal"): ProfileWall => ({
    x,
    y,
    height,
    thickness: thick ? "thick" : "thin",
  });
  function add(
    stage: number,
    id: string,
    name: string,
    walls: ProfileWall[],
    doors: Point[] = [],
    width = 8,
    height = 8,
    mirror = false,
  ) {
    const grid: string[][] = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) =>
        x === 0 || x === width - 1 || y === 0 || y === height - 1 ? "#" : "L",
      ),
    );
    const flipped = walls.map((w) => ({ ...w, x: mirror ? width - 1 - w.x : w.x }));
    const set = (x: number, y: number, value: string) => {
      const row = grid[y];
      if (!row) throw new Error("Case outside grid");
      row[x] = value;
    };
    for (const wall of flipped) set(wall.x, wall.y, "#");
    for (const [x, y] of doors) set(mirror ? width - 1 - x : x, y, "+");
    cases.push({
      id: `interaction-${id}${mirror ? "-mirror" : ""}`,
      name: `${name}${mirror ? " · mirror" : ""}`,
      stage,
      sketch: grid.map((r) => r.join("")).join("\n"),
      profiles: { walls: flipped },
    });
  }
  add(
    9,
    "bend-reverse",
    "Thick corner · opposite-facing arm",
    [w(2, 3), w(3, 3, true), w(3, 4, true), w(3, 5, true)],
    [],
    8,
    8,
    true,
  );
  add(
    9,
    "tee-reverse",
    "Thick T · opposite-facing branches",
    [w(2, 3), w(3, 3), w(4, 3), w(3, 4, true), w(3, 5, true)],
    [],
    8,
    8,
    true,
  );
  for (const mirror of [false, true]) {
    add(
      9,
      "corner-door",
      "Door immediately beside a thick corner",
      [w(2, 3, true), w(3, 3, true), w(3, 4, true), w(5, 3)],
      [[4, 3]],
      8,
      8,
      mirror,
    );
    add(
      9,
      "short-return",
      "One-cell return between width changes",
      [w(2, 3), w(3, 3, true), w(3, 4, true), w(4, 4)],
      [],
      8,
      8,
      mirror,
    );
    add(
      9,
      "thick-shell",
      "Thick partition meets the side wall",
      [w(1, 3, true), w(2, 3, true), w(3, 3)],
      [],
      8,
      8,
      mirror,
    );
  }
  for (const mirror of [false, true]) {
    add(
      10,
      "mixed-step",
      "Tall/thick meets low/thin",
      [w(2, 3, true, "tall"), w(3, 3, true, "tall"), w(4, 3, false, "low")],
      [],
      8,
      8,
      mirror,
    );
    add(
      10,
      "mixed-door",
      "Door between tall/thick and low/thin",
      [w(2, 3, true, "tall"), w(3, 3, true, "tall"), w(5, 3, false, "low")],
      [[4, 3]],
      8,
      8,
      mirror,
    );
    add(
      10,
      "mixed-tee",
      "T junction with three heights and two widths",
      [
        w(2, 3, true, "tall"),
        w(3, 3, true),
        w(4, 3, false, "low"),
        w(3, 4, false, "low"),
        w(3, 5, false, "low"),
      ],
      [],
      8,
      8,
      mirror,
    );
  }
  add(10, "mixed-north", "Thick north join with a low approach", [
    w(3, 1, true, "tall"),
    w(3, 2, true, "tall"),
    w(3, 3, false, "low"),
  ]);
  add(10, "mixed-south", "Thick south join with a low approach", [
    w(3, 4, false, "low"),
    w(3, 5, true, "tall"),
    w(3, 6, true, "tall"),
  ]);
  for (const mirror of [false, true]) {
    add(
      11,
      "two-rooms",
      "Two rooms · door between different wall profiles",
      [w(1, 3), w(2, 3), w(4, 3, true, "tall"), w(5, 3, true, "tall"), w(6, 3, true, "tall")],
      [[3, 3]],
      8,
      8,
      mirror,
    );
    add(
      11,
      "three-rooms",
      "Three rooms · two doors and a thick low stem",
      [
        w(1, 3),
        w(3, 3),
        w(4, 3),
        w(6, 3),
        w(3, 4, true, "low"),
        w(3, 5, true, "low"),
        w(3, 6, true, "low"),
      ],
      [
        [2, 3],
        [5, 3],
      ],
      8,
      8,
      mirror,
    );
    const hall: ProfileWall[] = [];
    for (let x = 1; x <= 7; x++) {
      if (x !== 2) hall.push(w(x, 3, true));
      if (x !== 6) hall.push(w(x, 5, false, "low"));
    }
    add(
      11,
      "offset-hall",
      "Three spaces · narrow hall with offset doors",
      hall,
      [
        [2, 3],
        [6, 5],
      ],
      9,
      9,
      mirror,
    );
    add(
      11,
      "room-returns",
      "Connected rooms · short returns beside two doors",
      [
        ...[1, 2, 4, 5, 7].map((x) => w(x, 4, true)),
        w(4, 2, false, "low"),
        w(4, 3, true, "tall"),
        w(4, 5, false, "low"),
        w(4, 6, false, "low"),
      ],
      [
        [3, 4],
        [6, 4],
      ],
      9,
      9,
      mirror,
    );
  }
  return cases;
}
