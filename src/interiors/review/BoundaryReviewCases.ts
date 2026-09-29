import type { WallHeight, WallProfileOptions, WallThickness } from "../ApartmentWallProfiles.js";
import type { ReviewCase } from "./ReviewCases.js";

/** Complete the north/south matrix; low/tall thin joins were reviewed earlier. */
export function boundaryReviewCases(): (ReviewCase & { profiles: WallProfileOptions })[] {
  const cases: (ReviewCase & { profiles: WallProfileOptions })[] = [];
  const profiles: [WallHeight, WallThickness][] = [
    ["normal", "thin"],
    ["normal", "thick"],
    ["low", "thick"],
    ["tall", "thick"],
  ];
  for (const side of ["north", "south"] as const)
    for (const [height, thickness] of profiles) {
      const grid: string[][] = Array.from({ length: 7 }, (_, y) =>
        Array.from({ length: 7 }, (_, x) => (x === 0 || y === 0 || x === 6 || y === 6 ? "#" : "L")),
      );
      const walls = (side === "north" ? [1, 2, 3] : [3, 4, 5]).map((y) => ({
        x: 3,
        y,
        height,
        thickness,
      }));
      for (const w of walls) {
        const row = grid[w.y];
        if (!row) throw new Error("Attachment outside review grid");
        row[w.x] = "#";
      }
      cases.push({
        id: `boundary-${side}-${height}-${thickness}`,
        name: `${side === "north" ? "North wall" : "South cutaway"} · ${height}, ${thickness} partition`,
        stage: 12,
        sketch: grid.map((row) => row.join("")).join("\n"),
        profiles: { walls },
      });
    }
  return cases;
}
