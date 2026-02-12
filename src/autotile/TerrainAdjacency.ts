import type { BlendGraph } from "./BlendGraph.js";
import { ALL_TERRAIN_IDS, TERRAIN_COUNT, type TerrainId } from "./TerrainId.js";

/**
 * Precomputed terrain adjacency graph derived from BlendGraph.
 *
 * - Tier 1 (dedicated): non-alpha BlendEntry pairs — high-quality pixel-art transitions.
 * - Tier 2 (alpha): alpha overlay BlendEntry pairs — semi-transparent fallback.
 *
 * Bridge insertion routes through Tier 1 edges only via all-pairs BFS.
 */
export class TerrainAdjacency {
  /** dedicated[a * TERRAIN_COUNT + b] = true if Tier 1 edge exists. */
  private readonly dedicated: boolean[];

  /** any[a * TERRAIN_COUNT + b] = true if Tier 1 OR Tier 2 edge exists. */
  private readonly any: boolean[];

  /**
   * bridgeNext[from * TERRAIN_COUNT + to] = next terrain on shortest Tier 1 path.
   * -1 if no path exists (or from === to).
   */
  private readonly bridgeNext: Int8Array;

  constructor(blendGraph: BlendGraph) {
    const n = TERRAIN_COUNT;
    this.dedicated = new Array<boolean>(n * n).fill(false);
    this.any = new Array<boolean>(n * n).fill(false);
    this.bridgeNext = new Int8Array(n * n).fill(-1);

    // Scan BlendGraph for all (a, b) entries
    for (const a of ALL_TERRAIN_IDS) {
      for (const b of ALL_TERRAIN_IDS) {
        if (a === b) continue;
        const entry = blendGraph.getBlend(a, b);
        if (!entry) continue;
        const idx = a * n + b;
        this.any[idx] = true;
        if (!entry.isAlpha) {
          this.dedicated[idx] = true;
        }
      }
    }

    this.computeBridges();
  }

  /** True if both directions (a→b and b→a) have blend entries. */
  isValidAdjacency(a: TerrainId, b: TerrainId): boolean {
    if (a === b) return true;
    return this.any[a * TERRAIN_COUNT + b] === true && this.any[b * TERRAIN_COUNT + a] === true;
  }

  /** True only for Tier 1 (dedicated sheet) edges (bidirectional). */
  isDedicatedAdjacency(a: TerrainId, b: TerrainId): boolean {
    if (a === b) return true;
    return (
      this.dedicated[a * TERRAIN_COUNT + b] === true &&
      this.dedicated[b * TERRAIN_COUNT + a] === true
    );
  }

  /** Next terrain on shortest Tier 1 path from `from` to `to`, or undefined if unreachable. */
  getBridgeStep(from: TerrainId, to: TerrainId): TerrainId | undefined {
    if (from === to) return undefined;
    const next = this.bridgeNext[from * TERRAIN_COUNT + to] ?? -1;
    return next >= 0 ? (next as TerrainId) : undefined;
  }

  /**
   * Full bridge path from `from` to `to` using Tier 1 edges only.
   * Returns the intermediate terrains (not including `from` or `to`).
   * Returns empty array if directly adjacent (Tier 1) or same.
   * Returns undefined if no Tier 1 path exists within maxSteps.
   */
  getBridgePath(from: TerrainId, to: TerrainId, maxSteps = 3): TerrainId[] | undefined {
    if (from === to) return [];
    if (this.isDedicatedAdjacency(from, to)) return [];

    const path: TerrainId[] = [];
    let current = from;
    for (let i = 0; i < maxSteps; i++) {
      const next = this.getBridgeStep(current, to);
      if (next === undefined) return undefined;
      if (this.isDedicatedAdjacency(next, to)) {
        // next connects directly to target — path complete
        path.push(next);
        return path;
      }
      path.push(next);
      current = next;
    }
    // Didn't reach target within maxSteps
    return undefined;
  }

  /** All-pairs BFS on Tier 1 edges to precompute bridgeNext. */
  private computeBridges(): void {
    const n = TERRAIN_COUNT;

    // BFS from each source terrain
    for (const source of ALL_TERRAIN_IDS) {
      const dist = new Int8Array(n).fill(-1);
      const next = new Int8Array(n).fill(-1);
      dist[source] = 0;

      const queue: TerrainId[] = [];

      // Initialize with direct Tier 1 neighbors
      for (const neighbor of ALL_TERRAIN_IDS) {
        if (neighbor === source) continue;
        if (this.dedicated[source * n + neighbor]) {
          dist[neighbor] = 1;
          next[neighbor] = neighbor; // First step from source → neighbor
          queue.push(neighbor);
        }
      }

      // BFS
      let head = 0;
      while (head < queue.length) {
        const current = queue[head++]!;
        for (const neighbor of ALL_TERRAIN_IDS) {
          if (neighbor === source) continue;
          if ((dist[neighbor] ?? -1) >= 0) continue;
          if (!this.dedicated[current * n + neighbor]) continue;
          dist[neighbor] = (dist[current] ?? 0) + 1;
          next[neighbor] = next[current] ?? -1; // First step is same as current's first step
          queue.push(neighbor);
        }
      }

      // Store results
      for (const target of ALL_TERRAIN_IDS) {
        if (target === source) continue;
        if ((next[target] ?? -1) >= 0) {
          this.bridgeNext[source * n + target] = next[target] ?? -1;
        }
      }
    }
  }
}
