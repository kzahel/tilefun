import type { ChunkDemand } from "./InterestManager.js";

/** Demand never shed under pressure: a player's simulated neighborhood plus a
 * normal-zoom view fit comfortably, so only zoomed-out views are ever trimmed. */
export const MIN_ADMITTED_CHUNKS = 256;
/** Usage fraction at which demand is trimmed and new loads wait. */
export const SHED_ABOVE = 0.9;
const TARGET_USAGE = 0.75;
const GROW_BELOW = 0.6;
const GROW_INTERVAL_MS = 1000;

/**
 * Wide overview interest can demand more resident actors/props than the authority
 * admits. Instead of failing every later load (including the player's own chunks),
 * shed the lowest-priority demand — the edge of the farthest view — until usage
 * returns to a target, then grow back slowly once there is room again.
 */
export class DemandAdmission {
  limit = Infinity;
  private changedAt = -Infinity;
  /** `usage` is the larger of actor/prop budget fractions; `resident` counts held chunks. */
  update(usage: number, resident: number, demanded: number, now: number): number {
    if (usage >= SHED_ABOVE && resident > 0) {
      const fit = Math.max(MIN_ADMITTED_CHUNKS, Math.floor((TARGET_USAGE * resident) / usage));
      if (fit < this.limit) {
        this.limit = fit;
        this.changedAt = now;
      }
    } else if (
      usage < GROW_BELOW &&
      this.limit !== Infinity &&
      now - this.changedAt >= GROW_INTERVAL_MS
    ) {
      this.limit += Math.max(16, Math.ceil(this.limit * 0.1));
      this.changedAt = now;
    }
    if (this.limit >= demanded && usage < SHED_ABOVE) this.limit = Infinity;
    return this.limit;
  }
}

/** Keep demand in priority order up to `limit`; simulated chunks are never shed. */
export function admitDemand(
  demand: Map<string, ChunkDemand>,
  limit: number,
): Map<string, ChunkDemand> {
  if (demand.size <= limit) return demand;
  const admitted = new Map<string, ChunkDemand>();
  for (const [key, chunk] of demand)
    if (admitted.size < limit || chunk.activity > 0) admitted.set(key, chunk);
  return admitted;
}
