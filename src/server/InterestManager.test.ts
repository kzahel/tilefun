import { expect, it, vi } from "vitest";
import { ChunkResidency } from "./ChunkResidency.js";
import type { Activity, ChunkDemand } from "./InterestManager.js";
import { around, InterestManager, type InterestTicket } from "./InterestManager.js";

it("keeps loading and failed-read retries live while demand values remain cached", async () => {
  const interest = new InterestManager();
  interest.set("player", [{ range: around(0, 0, 0), activity: 2, reason: "player" }]);
  let allowed = false,
    attempts = 0;
  const published: string[] = [];
  const residency = new ChunkResidency({
    canLoad: () => allowed,
    load: async (key) => {
      if (++attempts === 1) throw new Error("Temporary read failure");
      return key;
    },
    publish: (key) => {
      published.push(key);
    },
    save: async () => {},
    canRelease: () => true,
    release: () => {},
  });
  residency.reconcile(interest.demand(0));
  expect(attempts).toBe(0);
  allowed = true;
  residency.reconcile(interest.demand(1));
  await residency.settle();
  expect(residency.ready("0,0")).toBe(false);
  for (let i = 0; i < 60; i++) residency.reconcile(interest.demand(2 + i));
  await residency.settle();
  expect(attempts).toBe(2);
  expect(published).toEqual(["0,0"]);
  expect(residency.ready("0,0")).toBe(true);
  await residency.close();
});

it("validates equivalent updates before reuse and leaves prior demand intact on rejection", () => {
  const interest = new InterestManager(9);
  const ticket: InterestTicket = { range: around(0, 0, 1), activity: 2, reason: "player" };
  interest.set("player", [ticket]);
  const before = [...interest.demand(0)];
  ticket.range.maxCx = 20;
  expect(() => interest.set("player", [ticket])).toThrow("bounded chunk budget");
  expect([...interest.demand(1)]).toEqual(before);
});

it("retains empty-owner insertion order until demand prunes it, including cache hits", () => {
  const cached = new InterestManager(2),
    original = new OriginalInterestManager(2);
  for (const interest of [cached, original]) {
    interest.set("base", [{ range: around(0, 0, 0), activity: 0, reason: "observer" }]);
    interest.demand(0);
    interest.set("empty", []);
    interest.set("later", [{ range: around(1, 0, 0), activity: 0, reason: "observer" }]);
    interest.set("empty", [{ range: around(2, 0, 0), activity: 0, reason: "observer" }]);
  }
  expect([...cached.demand(1)]).toEqual([...original.demand(1)]);
  expect([...cached.demand(1).keys()]).toEqual(["0,0", "2,0"]);
  for (const interest of [cached, original]) {
    interest.set("pruned", []);
    interest.demand(2);
    interest.set("later", [{ range: around(3, 0, 0), activity: 2, reason: "player" }]);
    interest.set("pruned", [{ range: around(4, 0, 0), activity: 0, reason: "observer" }]);
  }
  expect([...cached.demand(3)]).toEqual([...original.demand(3)]);
});

it("reuses assembly after equivalent replacement, while returning independent maps and values", () => {
  const interest = new InterestManager();
  const ticket: InterestTicket = { range: around(0, 0, 2), activity: 2, reason: "player" };
  const tickets = [ticket];
  interest.set("player", tickets);
  const first = interest.demand(0);
  const expected = [...first].map(([key, value]) => [key, { ...value }]);
  const abs = vi.spyOn(Math, "abs");
  try {
    interest.set("player", [{ ...ticket, range: around(0, 0, 2) }]);
    interest.release("absent");
    interest.set("attachments", []);
    interest.set("railways", []);
    const chunk = first.get("0,0");
    if (!chunk) throw new Error("Expected player chunk");
    chunk.activity = 0;
    first.clear();
    expect([...interest.demand(1)]).toEqual(expected);
    expect(abs).not.toHaveBeenCalled();
    interest.set("attachments", []);
    expect([...interest.demand(1)]).toEqual(expected);
    expect(abs).not.toHaveBeenCalled();
    ticket.range.maxCx = 3;
    interest.set("player", tickets);
    expect(interest.demand(2).has("3,0")).toBe(true);
    expect(abs).toHaveBeenCalled();
  } finally {
    abs.mockRestore();
  }
});

it("owns input snapshots and expires partial leases exactly, including backwards clocks", () => {
  const interest = new InterestManager();
  const observer: InterestTicket = { range: around(0, 0, 0), activity: 0, reason: "observer" };
  const tickets: InterestTicket[] = [
    observer,
    { range: around(2, 0, 0), activity: 2, reason: "arrival", expires: 10 },
  ];
  interest.set("leases", tickets);
  observer.range.minCx = 5;
  expect([...interest.demand(9).keys()]).toEqual(["2,0", "0,0"]);
  expect([...interest.demand(10).keys()]).toEqual(["0,0"]);
  expect([...interest.demand(11).keys()]).toEqual(["0,0"]);
  expect([...interest.demand(9).keys()]).toEqual(["2,0", "0,0"]);
  interest.set("only-expiring", [
    { range: around(4, 0, 0), activity: 0, reason: "arrival", expires: 10 },
  ]);
  interest.demand(10);
  expect(interest.demand(9).has("4,0")).toBe(false);
});

it("matches original ordered demand through 2000 ticket, budget, expiry and owner changes", () => {
  const cached = new InterestManager(40),
    original = new OriginalInterestManager(40);
  let state = 12345;
  const random = (limit: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
  for (let step = 0; step < 2000; step++) {
    const owner = `player:${random(8)}`;
    if (step % 11 === 0) {
      const owners = new Set([owner, `player:${random(8)}`]);
      cached.retainOwners(owners, "player:");
      original.retainOwners(owners, "player:");
    } else if (step % 7 === 0) {
      cached.release(owner);
      original.release(owner);
    } else {
      const tickets = Array.from(
        { length: random(4) },
        (): InterestTicket => ({
          range: around(random(12) - 6, random(12) - 6, random(3)),
          activity: random(3) as 0 | 1 | 2,
          reason: (["player", "observer", "dependency", "arrival"] as const)[random(4)] ?? "player",
          ...(random(2) ? { expires: step + random(9) - 3 } : {}),
        }),
      );
      cached.set(owner, tickets);
      original.set(owner, tickets);
    }
    for (const now of [step, step, step + 4, step - 2])
      expect([...cached.demand(now)]).toEqual([...original.demand(now)]);
  }
});

it("caps combined observer demand while reserving room for player and arrival readiness", () => {
  const interest = new InterestManager(12);
  interest.set("camera", [{ range: around(100, 100, 1), activity: 0, reason: "observer" }]);
  interest.set("player", [{ range: around(0, 0, 1), activity: 2, reason: "player" }]);
  interest.set("arrival", [{ range: around(20, 20, 0), activity: 0, reason: "arrival" }]);
  const demand = interest.demand(0);
  expect(demand.size).toBe(12);
  expect(demand.has("20,20")).toBe(true);
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++) expect(demand.get(`${x},${y}`)?.activity).toBe(2);
});

// Frozen pre-cache implementation: compare ordered admission, not just membership.
/** The realm's sole source of requested residency and simulation activity. */
class OriginalInterestManager {
  private tickets = new Map<string, readonly InterestTicket[]>();
  constructor(readonly maxChunks = 4096) {}

  set(owner: string, tickets: readonly InterestTicket[]): void {
    for (const { range } of tickets) {
      const coordinates = Object.values(range);
      if (
        !coordinates.every(Number.isSafeInteger) ||
        range.maxCx < range.minCx ||
        range.maxCy < range.minCy ||
        (range.maxCx - range.minCx + 1) * (range.maxCy - range.minCy + 1) > this.maxChunks
      )
        throw new Error("Interest exceeds the bounded chunk budget.");
    }
    this.tickets.set(owner, tickets);
  }
  release(owner: string): void {
    this.tickets.delete(owner);
  }
  retainOwners(owners: ReadonlySet<string>, prefix: string): void {
    for (const owner of this.tickets.keys())
      if (owner.startsWith(prefix) && !owners.has(owner)) this.release(owner);
  }
  demand(now: number): Map<string, ChunkDemand> {
    const result = new Map<string, ChunkDemand>();
    const ranked: InterestTicket[] = [];
    for (const [owner, tickets] of this.tickets) {
      const live = tickets.filter((ticket) => ticket.expires === undefined || ticket.expires > now);
      if (!live.length) {
        this.tickets.delete(owner);
        continue;
      }
      ranked.push(...live);
    }
    const rank = (ticket: InterestTicket) =>
      ticket.reason === "arrival"
        ? -1000
        : ticket.activity === 2
          ? -100
          : ticket.activity === 1
            ? -50
            : ticket.reason === "dependency"
              ? -25
              : 0;
    ranked.sort((a, b) => rank(a) - rank(b));
    for (const ticket of ranked) {
      const r = ticket.range;
      const centerX = (r.minCx + r.maxCx) / 2,
        centerY = (r.minCy + r.maxCy) / 2;
      for (let cy = r.minCy; cy <= r.maxCy; cy++)
        for (let cx = r.minCx; cx <= r.maxCx; cx++) {
          const key = `${cx},${cy}`;
          const priority =
            (ticket.reason === "arrival" ? -1000 : ticket.activity === 2 ? -100 : 0) +
            Math.abs(cx - centerX) +
            Math.abs(cy - centerY);
          const previous = result.get(key);
          if (!previous && result.size >= this.maxChunks) continue;
          result.set(key, {
            cx,
            cy,
            activity: Math.max(previous?.activity ?? 0, ticket.activity) as Activity,
            priority: Math.min(previous?.priority ?? Infinity, priority),
          });
        }
    }
    return new Map([...result].sort((a, b) => a[1].priority - b[1].priority));
  }
}
