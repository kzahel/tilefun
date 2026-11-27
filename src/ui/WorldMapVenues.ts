import type { OverviewResult } from "../generation/Overview.js";
import type { Point } from "../generation/regional/RegionalPlanner.js";

export function venueButtons(
  result: OverviewResult,
  place: (
    name: string,
    p: Point,
    travel: boolean,
    data: Record<string, string>,
  ) => HTMLButtonElement,
) {
  return [
    ...(result.racetracks ?? []).map((p) =>
      place(p.name, p.center, false, { testid: "world-map-racetrack", trackId: p.id }),
    ),
    ...(result.motocross ?? []).map((p) =>
      place(p.name, p.arrival, true, { testid: "world-map-motocross", parkId: p.id }),
    ),
    ...(result.outings ?? []).map((p) =>
      place(p.name, p.arrival, true, { testid: "world-map-outing", outingId: p.id }),
    ),
  ];
}
