import { pathDistance } from "../generation/regional/PlanGeometry.js";
import {
  type Connection,
  connectionForOwner,
  plannedElevation,
} from "../generation/regional/RegionalPlanner.js";
import type { RegionalWorld } from "../generation/regional/WorldDescriptor.js";
import { RailAlignment, type RailPath, type RailSegment } from "./RailPath.js";
import type { RailLine, RailStation } from "./RailwayPlanner.js";

/** Convert an eligible road-free pair into a level, broad-bend link. Stations
 * retain straight approaches outside city buildings. Failed curves retain the
 * admitted straight service; accepted road bridges are never replaced. */
export function curvedCityLine(world: RegionalWorld, line: RailLine): RailLine | undefined {
  if (line.bridges.length) return;
  const [a, b] = line.stations.map((s) => s.town);
  if (!a || !b) return;
  const ay = (a.center.y + 60) * 16,
    by = (b.center.y + 60) * 16;
  const delta = by - ay,
    sign = Math.sign(delta),
    radius = 512;
  if (Math.abs(delta) < 64) return;
  const angle =
    Math.abs(delta) >= 2 * radius ? Math.PI / 2 : Math.acos(1 - Math.abs(delta) / (2 * radius));
  const width = 2 * radius * Math.sin(angle),
    gap = (b.center.x - a.center.x) * 16;
  const roads: Connection[] = [];
  for (let cy = a.owner.cy - 1; cy <= a.owner.cy + 1; cy++)
    for (let cx = a.owner.cx - 1; cx <= b.owner.cx + 1; cx++)
      for (const axis of ["east", "south"] as const) {
        const road = connectionForOwner(world, cx, cy, axis);
        if (road) roads.push(road);
      }
  for (const fraction of sign > 0 ? [0.25, 0.4, 0.6, 0.75] : [0.75, 0.6, 0.4, 0.25]) {
    const pivot = a.center.x * 16 + gap * fraction - width / 2;
    const end = pivot + width;
    if (pivot < a.center.x * 16 + 768 || end > b.center.x * 16 - 768) continue;
    const segments: RailSegment[] = [
      { kind: "line", x: (a.center.x - 20) * 16, y: ay, endX: pivot, endY: ay },
      {
        kind: "arc",
        x: pivot,
        y: ay + sign * radius,
        radius,
        angle: (-sign * Math.PI) / 2,
        sweep: sign * angle,
      },
    ];
    const y1 = ay + sign * radius * (1 - Math.cos(angle)),
      y2 = by - sign * radius * (1 - Math.cos(angle));
    if (Math.abs(y2 - y1) > 0.001)
      segments.push({
        kind: "line",
        x: pivot + width / 2,
        y: y1,
        endX: pivot + width / 2,
        endY: y2,
      });
    segments.push(
      {
        kind: "arc",
        x: end,
        y: by - sign * radius,
        radius,
        angle: sign * (Math.PI / 2 + angle),
        sweep: -sign * angle,
      },
      { kind: "line", x: end, y: by, endX: (b.center.x + 20) * 16, endY: by },
    );
    const path: RailPath = { segments, closed: false, stops: [] };
    // First stop is 320px from the alignment start; the full consist fits.
    const length = segments.reduce(
      (n, s) =>
        n +
        (s.kind === "line" ? Math.hypot(s.endX - s.x, s.endY - s.y) : s.radius * Math.abs(s.sweep)),
      0,
    );
    path.stops = [
      { distance: 320, name: a.name },
      { distance: length - 320, name: b.name },
    ];
    const alignment = new RailAlignment(path),
      samples = alignment.samples(32);
    if (
      samples.some((p) => {
        for (const ox of [-8, 0, 8])
          for (const oy of [-8, 0, 8])
            if (plannedElevation(world, p.x / 16 + ox, p.y / 16 + oy) < 0.06) return true;
        return roads.some((r) => pathDistance(r.points, p.x / 16, p.y / 16) <= 15);
      })
    )
      continue;
    const stations = line.stations.map((s): RailStation => {
      const y = s.town.center.y + 60;
      return {
        ...s,
        y,
        platform: { ...s.platform, minY: y - 6, maxY: y - 2 },
        access: { ...s.access, minY: s.town.center.y + 44, maxY: y - 2 },
      };
    }) as [RailStation, RailStation];
    const bounds = {
      minX: alignment.bounds.minX / 16,
      minY: alignment.bounds.minY / 16,
      maxX: alignment.bounds.maxX / 16,
      maxY: alignment.bounds.maxY / 16,
    };
    return { ...line, id: `${line.id}:curved-v1`, bounds, y: stations[0].y, stations, path };
  }
}
