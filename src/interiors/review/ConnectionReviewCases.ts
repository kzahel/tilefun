import type { ProfileWall, WallHeight, WallProfileOptions } from "../ApartmentWallProfiles.js";
import type { ReviewCase } from "./ReviewCases.js";

/** Eight small experiments: width first, then each end of the room shell. */
export function connectionReviewCases(): (ReviewCase & { profiles: WallProfileOptions })[] {
  const results: (ReviewCase & { profiles: WallProfileOptions })[] = [];
  const wall = (x: number, y: number, thick = false): ProfileWall => ({
    x,
    y,
    height: "normal",
    thickness: thick ? "thick" : "thin",
  });
  function add(id: string, name: string, walls: ProfileWall[], opening?: [number, number]) {
    const grid: string[][] = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => (x === 0 || y === 0 || x === 7 || y === 7 ? "#" : "L")),
    );
    for (const w of walls) {
      const row = grid[w.y];
      if (!row) throw new Error("Connection outside grid");
      row[w.x] = "#";
    }
    if (opening) {
      const row = grid[opening[1]];
      if (!row) throw new Error("Opening outside grid");
      row[opening[0]] = "+";
    }
    results.push({
      id: `connection-${id}`,
      name,
      stage: 8,
      sketch: grid.map((r) => r.join("")).join("\n"),
      profiles: { walls },
    });
  }
  add("straight", "Thickness · thin meets thick", [wall(2, 3), wall(3, 3, true), wall(4, 3, true)]);
  add("bend", "Thickness · thin arm into thick corner", [
    wall(2, 3),
    wall(3, 3, true),
    wall(3, 4, true),
    wall(3, 5, true),
  ]);
  add("tee", "Thickness · thin branches, thick stem", [
    wall(2, 3),
    wall(3, 3),
    wall(4, 3),
    wall(3, 4, true),
    wall(3, 5, true),
  ]);
  add(
    "door",
    "Thickness · full-width opening through thick wall",
    [wall(2, 3, true), wall(3, 3, true), wall(5, 3, true)],
    [4, 3],
  );
  for (const side of ["north", "south"] as const)
    for (const height of ["low", "tall"] satisfies WallHeight[])
      add(
        `${side}-${height}`,
        `${side === "north" ? "North wall" : "South cutaway"} attachment · ${height} partition`,
        (side === "north" ? [1, 2, 3] : [4, 5, 6]).map((y) => ({ x: 3, y, height })),
      );
  return results;
}
