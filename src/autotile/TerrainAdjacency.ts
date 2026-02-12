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

    // Dedicated pairs imply valid adjacency in both directions:
    // if A→B has pixel-art transition, B can appear next to A without a bridge.
    for (const a of ALL_TERRAIN_IDS) {
      for (const b of ALL_TERRAIN_IDS) {
        if (a === b) continue;
        if (this.dedicated[a * n + b]) {
          this.any[b * n + a] = true;
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

  /** True if a→b has a dedicated (non-alpha) blend sheet. */
  hasDedicatedSheet(a: TerrainId, b: TerrainId): boolean {
    if (a === b) return true;
    return this.dedicated[a * TERRAIN_COUNT + b] === true;
  }

  /** Next terrain on shortest Tier 1 path from `from` to `to`, or undefined if unreachable. */
  getBridgeStep(from: TerrainId, to: TerrainId): TerrainId | undefined {
    if (from === to) return undefined;
    const next = this.bridgeNext[from * TERRAIN_COUNT + to] ?? -1;
    return next >= 0 ? (next as TerrainId) : undefined;
  }

  /**
   * Full bridge path from `from` to `to`.
   * Returns the intermediate terrains (not including `from` or `to`).
   * Returns empty array if directly adjacent or same.
   * Returns undefined if no path exists within maxSteps.
   */
  getBridgePath(from: TerrainId, to: TerrainId, maxSteps = 3): TerrainId[] | undefined {
    if (from === to) return [];
    if (this.isValidAdjacency(from, to)) return [];

    const path: TerrainId[] = [];
    let current = from;
    for (let i = 0; i < maxSteps; i++) {
      const next = this.getBridgeStep(current, to);
      if (next === undefined) return undefined;
      if (this.isValidAdjacency(next, to)) {
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

  /** All-pairs BFS on valid adjacency edges to precompute bridgeNext. */
  private computeBridges(): void {
    const n = TERRAIN_COUNT;

    // BFS from each source terrain using bidirectional valid-adjacency edges
    for (const source of ALL_TERRAIN_IDS) {
      const dist = new Int8Array(n).fill(-1);
      const next = new Int8Array(n).fill(-1);
      dist[source] = 0;

      const queue: TerrainId[] = [];

      // Initialize with direct valid-adjacent neighbors
      for (const neighbor of ALL_TERRAIN_IDS) {
        if (neighbor === source) continue;
        if (this.any[source * n + neighbor] && this.any[neighbor * n + source]) {
          dist[neighbor] = 1;
          next[neighbor] = neighbor;
          queue.push(neighbor);
        }
      }

      // BFS
      let head = 0;
      while (head < queue.length) {
        const current = queue[head] as number;
        head++;
        for (const neighbor of ALL_TERRAIN_IDS) {
          if (neighbor === source) continue;
          if ((dist[neighbor] ?? -1) >= 0) continue;
          if (!this.any[current * n + neighbor] || !this.any[neighbor * n + current]) continue;
          dist[neighbor] = (dist[current] ?? 0) + 1;
          next[neighbor] = next[current] ?? -1;
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
