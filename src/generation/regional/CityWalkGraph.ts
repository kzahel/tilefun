import type { ActorPlacement } from "../Generator.js";
import type { CityPlacesPlan } from "./CityPlacesPlanner.js";
import type { Bounds } from "./RegionalPlanner.js";

export interface WalkNode {
  id: string;
  wx: number;
  wy: number;
  destination?: "home" | "shop" | "park-seat" | "square-seat";
  waitSeconds?: number;
}
export interface WalkEdge {
  a: string;
  b: string;
  crossingId?: string;
}
export interface CityWalkGraph {
  nodes: WalkNode[];
  edges: WalkEdge[];
}
/** Bounded planning-time BFS. Simulation follows the resulting waypoints, with
 * no per-frame graph search or unbounded retries when edits obstruct a trip. */
export function walkTrip(graph: CityWalkGraph, from: string, to: string): WalkNode[] {
  if (graph.nodes.length > 64 || graph.edges.length > 96)
    throw Error("City walk graph exceeds budget");
  const previous = new Map<string, string | null>([[from, null]]),
    queue = [from];
  while (queue.length && !previous.has(to)) {
    const current = queue.shift();
    if (!current) break;
    for (const edge of graph.edges) {
      const next = edge.a === current ? edge.b : edge.b === current ? edge.a : null;
      if (next && !previous.has(next)) {
        previous.set(next, current);
        queue.push(next);
      }
    }
  }
  if (!previous.has(to)) throw Error("Disconnected city destination");
  const route: WalkNode[] = [];
  for (let cursor: string | null = to; cursor !== null; cursor = previous.get(cursor) ?? null) {
    const node = graph.nodes.find((n) => n.id === cursor);
    if (!node) throw Error("Missing walk node");
    route.unshift(node);
  }
  return route;
}
const segmentBounds = (a: WalkNode, b: WalkNode): Bounds => ({
  minX: Math.min(a.wx, b.wx) / 16 - 1,
  minY: Math.min(a.wy, b.wy) / 16 - 1,
  maxX: Math.max(a.wx, b.wx) / 16 + 1,
  maxY: Math.max(a.wy, b.wy) / 16 + 1,
});

/** Two admitted crossing components: homes -> park, shops -> square. Until
 * east/west crossings across the central vertical street are audited, no trip
 * fabricates that connection. Nodes and access stubs are owned by this plan. */
export function pedestrianDistrict(base: CityPlacesPlan, seed: number): CityPlacesPlan {
  const id = base.id.replace(":city-places-v9", ":city-places-v10"),
    { x, y } = base.center;
  const graph: CityWalkGraph = { nodes: [], edges: [] };
  const node = (
    suffix: string,
    tx: number,
    ty: number,
    destination?: WalkNode["destination"],
    waitSeconds?: number,
  ) => {
    const n: WalkNode = {
      id: `${id}:walk:${suffix}`,
      wx: tx * 16,
      wy: ty * 16,
      ...(destination ? { destination, waitSeconds: waitSeconds ?? 5 } : {}),
    };
    graph.nodes.push(n);
    return n;
  };
  const connect = (a: WalkNode, b: WalkNode, crossingId?: string) =>
    graph.edges.push({ a: a.id, b: b.id, ...(crossingId ? { crossingId } : {}) });
  const places = base.places.map((p) => ({
    ...p,
    id: p.id.replace(":city-places-v9:", ":city-places-v10:"),
    paths: [...p.paths],
    furniture: p.furniture.map((f) => ({
      ...f,
      featureId: f.featureId.replace(":city-places-v9:", ":city-places-v10:"),
    })),
  }));
  const destinations: { start: WalkNode; ends: WalkNode[] }[] = [];
  for (const [side, kind] of [
    ["west", "neighborhood-park"],
    ["east", "square"],
  ] as const) {
    const crossing = base.commercial.crossings[side === "west" ? 0 : 1];
    if (!crossing) throw Error("Missing admitted crossing");
    const crossX = crossing.bounds.minX + 1;
    const north = node(`${side}:north`, crossX, y - 9),
      south = node(`${side}:south`, crossX, y + 9);
    connect(north, south, crossing.id);
    const lots = base.blocks
      .flatMap((b) => b.lots)
      .filter((l) => (side === "west" ? l.anchor.x < x : l.anchor.x > x));
    const starts = lots.map((l) => {
      const n = node(
        `door:${l.id}`,
        l.entrance.x,
        y - 9,
        side === "west" ? "home" : "shop",
        4 + ((seed + graph.nodes.length) % 5),
      );
      connect(n, north);
      return n;
    });
    const place = places.find((p) => p.kind === kind);
    if (!place) throw Error("Missing public destination");
    const cx = Math.floor((place.bounds.minX + place.bounds.maxX) / 2),
      cy = Math.floor((place.bounds.minY + place.bounds.maxY) / 2);
    const entry = node(`${side}:entry`, cx, y + 9),
      center = node(`${side}:center`, cx, cy);
    connect(south, entry);
    connect(entry, center);
    const ends: WalkNode[] = [];
    for (const furniture of place.furniture.filter((f) => f.propType === "prop-bench")) {
      const bx = furniture.wx / 16,
        by = furniture.wy / 16 + 1;
      let prior = center;
      const corners =
        side === "west"
          ? [
              [bx + 3, cy],
              [bx + 3, by],
              [bx, by],
            ]
          : [
              [cx, by],
              [bx, by],
            ];
      for (const [i, p] of corners.entries()) {
        if (!p) throw Error("Missing seating approach");
        const n = node(
          `${furniture.featureId}:approach:${i}`,
          p[0] ?? 0,
          p[1] ?? 0,
          i === corners.length - 1 ? (side === "west" ? "park-seat" : "square-seat") : undefined,
          7 + ((seed + i) % 4),
        );
        connect(prior, n);
        if (side === "west") place.paths.push(segmentBounds(prior, n));
        prior = n;
      }
      ends.push(prior);
    }
    for (const start of starts) destinations.push({ start, ends });
  }
  const visitors: ActorPlacement[] = [];
  for (let i = 0; i < 8; i++) {
    const pair = destinations[i % destinations.length];
    if (!pair) throw Error("Missing city trip");
    const end = pair.ends[Math.floor(i / destinations.length) % pair.ends.length];
    if (!end) throw Error("Missing seat destination");
    const outbound = walkTrip(graph, pair.start.id, end.id),
      trip = [...outbound, ...outbound.slice(1, -1).reverse()];
    const offset = (i * 2) % trip.length,
      rotated = [...trip.slice(offset), ...trip.slice(0, offset)];
    const route = rotated.map((n) => ({
      wx: n.wx,
      wy: n.wy,
      waitSeconds: n.waitSeconds ?? 0,
      ...(n.destination ? { destinationId: n.id } : {}),
    }));
    const first = route[0];
    if (!first) throw Error("Empty city trip");
    visitors.push({
      featureId: `${id}:visitor:${i}`,
      type: `person${1 + ((seed + i * 3) % 20)}`,
      wx: first.wx,
      wy: first.wy,
      route,
    });
  }
  return {
    ...base,
    id,
    recipe: "city-places-v10",
    places,
    walkGraph: graph,
    actors: [...base.actors.filter((a) => !a.featureId.includes(":crossing:")), ...visitors],
  };
}
