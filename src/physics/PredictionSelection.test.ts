import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { MAX_PREDICTION_BODIES, type PhysicsBodyState } from "./PhysicsState.js";
import { selectAround } from "./PredictionSelection.js";

// Multi-anchor prediction selection (226 slice 4b-ii): one anchor per local seat.

function body(id: number, wx: number, wy = 0, state: Partial<PhysicsBodyState> = {}) {
  const entity = createPlayer(wx, wy);
  entity.id = id;
  return { entity, state: { id, x: wx, y: wy, ...state } as PhysicsBodyState };
}

function scene(...entries: ReturnType<typeof body>[]) {
  return new Map(entries.map((entry) => [entry.entity.id, entry]));
}

const all = (bodies: ReadonlyMap<number, unknown>) => new Set(bodies.keys());

it("keeps every anchor's contact graph, then bodies near any anchor, nearest anchor first", () => {
  const bodies = scene(
    body(1, 0, 0, { supportId: 7 }), // seat 0, standing on a distant support
    body(2, 1000), // seat 1, far from seat 0
    body(3, 40), // near seat 0
    body(4, 1060), // near seat 1, a little farther from it
    body(5, 500), // between the seats, near neither
    body(6, 3000), // touching seat 1 through a solved contact
    body(7, -2000),
  );
  const contacts = new Map([
    [2, new Set([6])],
    [6, new Set([2])],
  ]);

  const one = selectAround(bodies, contacts, [1], all(bodies));
  expect([...one.selected.keys()]).toEqual([1, 7, 3]);
  expect(one.omitted).toBe(0);

  const both = selectAround(bodies, contacts, [1, 2], all(bodies));
  // Required bodies first (by distance to the nearest anchor), then the rest the same way.
  expect([...both.selected.keys()]).toEqual([1, 2, 6, 7, 3, 4]);
  expect(both.omitted).toBe(0);

  // An invisible body is never selected but still counts as omitted.
  const hidden = selectAround(bodies, contacts, [1, 2], new Set([1, 2, 3, 6, 7]));
  expect([...hidden.selected.keys()]).toEqual([1, 2, 6, 7, 3]);
  expect(hidden.omitted).toBe(1);
});

it("keeps a whole consist when any of its cars is near any anchor", () => {
  const car = (id: number, wx: number) => {
    const entry = body(id, wx);
    entry.entity.physicsGroupId = 9;
    return entry;
  };
  // Body 6 touches seat 0 from 4,500 px away; car 4 is 4,000 px from seat 1, its nearest.
  const bodies = scene(
    body(1, 0),
    body(2, 1000),
    car(3, 1050),
    car(4, 5000),
    body(5, 4990),
    body(6, -4500),
  );
  const contacts = new Map([
    [1, new Set([6])],
    [6, new Set([1])],
  ]);
  const both = selectAround(bodies, contacts, [1, 2], all(bodies));
  expect([...both.selected.keys()]).toEqual([1, 2, 3, 4, 6]);
  expect([...selectAround(bodies, contacts, [1], all(bodies)).selected.keys()]).toEqual([1, 6]);
});

it("shares one body limit between anchors and skips anchors that are not in the scene", () => {
  const entries = [body(1, 0), body(2, 10_000)];
  // Crowds around both seats: the nearest to either seat win the limit.
  for (let i = 0; i < 100; i++)
    entries.push(body(10 + i, 1 + i), body(200 + i, 10_000 + 1.5 * (1 + i)));
  const bodies = scene(...entries);
  const both = selectAround(bodies, new Map(), [1, 2, 999], all(bodies));
  expect(both.selected.size).toBe(MAX_PREDICTION_BODIES);
  expect(both.omitted).toBe(202 - MAX_PREDICTION_BODIES);
  const distance = (id: number) => {
    const wx = bodies.get(id)?.entity.position.wx ?? Infinity;
    return Math.min(Math.abs(wx), Math.abs(wx - 10_000));
  };
  const chosen = [...both.selected.keys()].filter((id) => id > 2).map(distance);
  const left = [...bodies.keys()].filter((id) => !both.selected.has(id)).map(distance);
  expect(Math.max(...chosen)).toBeLessThanOrEqual(Math.min(...left));
  expect(both.selected.has(1) && both.selected.has(2)).toBe(true);

  expect(selectAround(bodies, new Map(), [999], all(bodies))).toEqual({
    selected: new Map(),
    omitted: 0,
  });
});
