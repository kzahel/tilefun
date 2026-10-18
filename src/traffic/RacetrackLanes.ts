import { required } from "../art/ArtCatalog.js";
import type { Racetrack } from "../generation/regional/RacetrackPlanner.js";
import { type Lane, type LaneGraph, path, samplePath } from "./LaneGraph.js";

/** Each quarter has a shared tangent endpoint. Both rings travel clockwise;
 * ordinary road cars have no graph edge into this dedicated racing circuit. */
export function addRacetrackLanes(graph: LaneGraph, tracks: readonly Racetrack[]): void {
  for (const track of tracks)
    for (let ring = 0; ring < 2; ring++) {
      const radius = ring ? 31 : 25;
      for (let quarter = 0; quarter < 4; quarter++) {
        const points = [];
        // One half-straight plus a quarter-circle, alternating their order.
        const right = quarter < 2;
        const start = -Math.PI / 2 + (quarter * Math.PI) / 2;
        const arc = Array.from({ length: 25 }, (_, i) => {
          const angle = start + ((i / 24) * Math.PI) / 2;
          return {
            x: (track.center.x + (right ? 24 : -24) + Math.cos(angle) * radius) * 16,
            y: (track.center.y + Math.sin(angle) * radius) * 16,
          };
        });
        if (quarter % 2 === 0) {
          points.push({
            x: track.center.x * 16,
            y: (track.center.y + (quarter === 0 ? -radius : radius)) * 16,
          });
          points.push(...arc);
        } else {
          points.push(...arc);
          points.push({
            x: track.center.x * 16,
            y: (track.center.y + (quarter === 1 ? radius : -radius)) * 16,
          });
        }
        const route = path(points);
        const nodes = [
          [track.center.x, track.center.y - radius],
          [track.center.x + 24 + radius, track.center.y],
          [track.center.x, track.center.y + radius],
          [track.center.x - 24 - radius, track.center.y],
        ];
        const node = (q: number) => required(nodes[q % 4]).join(",");
        const lane: Lane = {
          id: `${track.id}:ring:${ring}:quarter:${quarter}`,
          from: node(quarter),
          to: node(quarter + 1),
          a: required(points[0]),
          b: required(points.at(-1)),
          path: route,
          width: 96,
          intercity: false,
          direction: samplePath(route, 0).direction,
          race: { model: `car-${21 + ((quarter + ring * 3) % 6)}`, speed: ring ? 150 : 126 },
        };
        graph.lanes.set(lane.id, lane);
        graph.outgoing.set(lane.from, [lane]);
      }
    }
}
