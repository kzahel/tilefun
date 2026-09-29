import type { ProfileWall } from "../ApartmentWallProfiles.js";
import type { ReviewCase } from "./ReviewCases.js";

/** Nearby constraints: corner doors, short width transitions, paired Ts, loops. */
export function nearbyReviewCases(): ReviewCase[] {
  const cases: ReviewCase[] = [];
  const wall = (x: number, y: number, thick = false): ProfileWall => ({
    x,
    y,
    height: "normal",
    thickness: thick ? "thick" : "thin",
  });
  function add(id: string, name: string, sketch: string, walls?: ProfileWall[], mirror = false) {
    const width = sketch.split("\n")[0]?.length ?? 0;
    cases.push({
      id: `nearby-${id}${mirror ? "-mirror" : ""}`,
      name: `${name}${mirror ? " · mirror" : ""}`,
      stage: 13,
      sketch: mirror
        ? sketch
            .split("\n")
            .map((r) => [...r].reverse().join(""))
            .join("\n")
        : sketch,
      ...(walls
        ? { profiles: { walls: walls.map((w) => ({ ...w, x: mirror ? width - 1 - w.x : w.x })) } }
        : {}),
    });
  }
  function profile(
    id: string,
    name: string,
    walls: ProfileWall[],
    doors: [number, number][] = [],
    mirror = false,
  ) {
    const grid: string[][] = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => (x === 0 || y === 0 || x === 7 || y === 7 ? "#" : "L")),
    );
    for (const [x, y, value] of [
      ...walls.map((w) => [w.x, w.y, "#"] as const),
      ...doors.map(([x, y]) => [x, y, "+"] as const),
    ]) {
      const row = grid[y];
      if (!row) throw new Error("Nearby case outside grid");
      row[x] = value;
    }
    add(id, name, grid.map((r) => r.join("")).join("\n"), walls, mirror);
  }
  for (const mirror of [false, true])
    add(
      "corner-door",
      "Door beside an outer corner · stepped room",
      "  #+###\n  #LLL#\n###LLL#\n#LLLLL#\n#LLLLL#\n#LLLLL#\n#######",
      undefined,
      mirror,
    );
  for (const mirror of [false, true])
    profile(
      "width-door",
      "Door one cell from a thickness change",
      [wall(1, 3), wall(2, 3), wall(3, 3, true), wall(5, 3, true), wall(6, 3, true)],
      [[4, 3]],
      mirror,
    );
  for (const opposite of [false, true])
    profile(
      `paired-tees-${opposite ? "opposite" : "same"}`,
      `Two T junctions · one cell apart · ${opposite ? "opposite sides" : "same side"}`,
      [
        ...[1, 2, 3, 4, 5].map((x) => wall(x, 3)),
        ...(opposite ? [wall(2, 2, true)] : [wall(2, 4, true), wall(2, 5, true)]),
        wall(4, 4),
        wall(4, 5),
      ],
    );
  for (const mirror of [false, true])
    profile(
      "loop-door",
      "Small wall loop · opening beside a corner",
      [
        ...[2, 3, 4, 5].map((x) => wall(x, 2, x === 5)),
        wall(2, 3),
        wall(2, 4),
        wall(2, 5),
        wall(4, 5),
        wall(5, 3, true),
        wall(5, 4, true),
        wall(5, 5, true),
      ],
      [[3, 5]],
      mirror,
    );
  return cases;
}
