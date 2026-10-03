import type { ChunkRange } from "../world/ChunkManager.js";

export type Activity = 0 | 1 | 2; // resident, reduced decisions, full decisions
export interface InterestTicket {
  range: ChunkRange;
  activity: Activity;
  reason: "player" | "observer" | "dependency" | "arrival";
  expires?: number;
}
export interface ChunkDemand {
  cx: number;
  cy: number;
  activity: Activity;
  priority: number;
}

/** The realm's sole source of requested residency and simulation activity. */
export class InterestManager {
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
    for (const [owner, tickets] of this.tickets) {
      const live = tickets.filter((ticket) => ticket.expires === undefined || ticket.expires > now);
      if (!live.length) {
        this.tickets.delete(owner);
        continue;
      }
      for (const ticket of live) {
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
            result.set(key, {
              cx,
              cy,
              activity: Math.max(previous?.activity ?? 0, ticket.activity) as Activity,
              priority: Math.min(previous?.priority ?? Infinity, priority),
            });
            if (result.size > this.maxChunks)
              throw new Error("Combined interest exceeds the chunk budget.");
          }
      }
    }
    return new Map([...result].sort((a, b) => a[1].priority - b[1].priority));
  }
}

export function around(cx: number, cy: number, radius: number): ChunkRange {
  return { minCx: cx - radius, minCy: cy - radius, maxCx: cx + radius, maxCy: cy + radius };
}
