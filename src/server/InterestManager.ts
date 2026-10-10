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
  private cached: Map<string, ChunkDemand> | undefined;
  private validFrom = -Infinity;
  private validUntil = Infinity;
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
    const previous = this.tickets.get(owner);
    if (
      previous?.length === tickets.length &&
      tickets.every((ticket, i) => {
        const old = previous[i];
        return (
          old !== undefined &&
          old.activity === ticket.activity &&
          old.reason === ticket.reason &&
          old.expires === ticket.expires &&
          old.range.minCx === ticket.range.minCx &&
          old.range.maxCx === ticket.range.maxCx &&
          old.range.minCy === ticket.range.minCy &&
          old.range.maxCy === ticket.range.maxCy
        );
      })
    )
      return;
    // Own the values: callers may reuse or mutate their ticket/range objects.
    this.tickets.set(
      owner,
      tickets.map((ticket) => ({ ...ticket, range: { ...ticket.range } })),
    );
    if (tickets.length || previous?.length) this.cached = undefined;
  }
  release(owner: string): void {
    if (this.tickets.delete(owner)) this.cached = undefined;
  }
  retainOwners(owners: ReadonlySet<string>, prefix: string): void {
    for (const owner of this.tickets.keys())
      if (owner.startsWith(prefix) && !owners.has(owner)) this.release(owner);
  }
  demand(now: number): Map<string, ChunkDemand> {
    // Empty owners affect insertion order until the next demand, but never its
    // contents. Prune them even on hits, as the uncached assembly does.
    for (const [owner, tickets] of this.tickets) if (!tickets.length) this.tickets.delete(owner);
    if (this.cached && now >= this.validFrom && now < this.validUntil)
      return this.copyDemand(this.cached);
    const result = new Map<string, ChunkDemand>();
    const ranked: InterestTicket[] = [];
    this.validFrom = -Infinity;
    this.validUntil = Infinity;
    for (const [owner, tickets] of this.tickets) {
      const live = tickets.filter((ticket) => ticket.expires === undefined || ticket.expires > now);
      if (!live.length) {
        this.tickets.delete(owner);
        continue;
      }
      for (const ticket of tickets) {
        if (ticket.expires === undefined) continue;
        if (ticket.expires > now) this.validUntil = Math.min(this.validUntil, ticket.expires);
        else this.validFrom = Math.max(this.validFrom, ticket.expires);
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
    this.cached = new Map([...result].sort((a, b) => a[1].priority - b[1].priority));
    return this.copyDemand(this.cached);
  }
  private copyDemand(demand: Map<string, ChunkDemand>): Map<string, ChunkDemand> {
    // Preserve the public fresh-map/value contract; consumers cannot poison reuse.
    return new Map(Array.from(demand, ([key, chunk]) => [key, { ...chunk }]));
  }
}

export function around(cx: number, cy: number, radius: number): ChunkRange {
  return { minCx: cx - radius, minCy: cy - radius, maxCx: cx + radius, maxCy: cy + radius };
}
