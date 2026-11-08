import { CHUNK_SIZE, RENDER_DISTANCE, TILE_SIZE } from "../config/constants.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { TerrainRenderWorld } from "./TerrainPresentation.js";

const CHUNK_NATIVE_PX = CHUNK_SIZE * TILE_SIZE;

/** One view's camera centre and visible chunks, for shared terrain preparation. */
export interface TerrainPreparationView {
  readonly view: { readonly x: number; readonly y: number };
  readonly visible: ChunkRange;
}

export interface TerrainResident {
  readonly key: string;
  readonly cx: number;
  readonly cy: number;
  chunk: Chunk;
  pendingSince: number | null;
  visited: boolean;
  priority: number;
  distance: number;
  /** World y of the camera that ranked it, for the focal row of a partial build. */
  focalY: number;
}

/** What residency needs from the chunk surfaces it schedules. */
export interface TerrainSurfaces {
  isReady(chunk: Chunk, cx: number, cy: number): boolean;
  /** An older image stays on screen while its replacement builds. */
  hasImage(chunk: Chunk): boolean;
  /** Drop a chunk's images and partial build: no view needs it, or it was replaced. */
  drop(chunk: Chunk, key: string): void;
}

function compareJobs(a: TerrainResident, b: TerrainResident): number {
  return a.priority - b.priority || a.distance - b.distance || a.cy - b.cy || a.cx - b.cx;
}

/**
 * Which loaded chunks stay resident, and the order pending ones are built, for
 * every view of one display frame (226). Each view keeps its visible range plus
 * a halo of RENDER_DISTANCE chunks. Any view's on-screen gap outranks a stale
 * on-screen image, which outranks the halo; ties go to the chunk nearest that
 * view's look-ahead point. Chunks no view needs are dropped, so views never
 * evict each other's terrain. Residency is bounded by the views' halos.
 */
export class TerrainResidency {
  readonly resident = new Map<string, TerrainResident>();
  /** Borrowed resident records, sorted by `scan` and valid until `release()`. */
  readonly jobs: TerrainResident[] = [];
  recordsCreated = 0;
  /** Previous camera per view (keyed by its camera object, so views joining or
   * leaving never hand one view's motion to another): each looks ahead along its own. */
  private readonly previous = new Map<object, { x: number; y: number; seen: boolean }>();
  // Per-scan state: the visit stamp, the scan time and the current view's look-ahead.
  private visited = false;
  private now = 0;
  private aheadX = 0;
  private aheadY = 0;

  scan(
    views: readonly TerrainPreparationView[],
    world: TerrainRenderWorld,
    surfaces: TerrainSurfaces,
    now: number,
  ): readonly TerrainResident[] {
    this.visited = !this.visited;
    this.now = now;
    for (const last of this.previous.values()) last.seen = false;
    for (let index = 0; index < views.length; index++) {
      const view = views[index];
      if (!view) continue;
      this.lookAhead(view.view);
      const { visible } = view;
      for (let cy = visible.minCy - RENDER_DISTANCE; cy <= visible.maxCy + RENDER_DISTANCE; cy++)
        for (
          let cx = visible.minCx - RENDER_DISTANCE;
          cx <= visible.maxCx + RENDER_DISTANCE;
          cx++
        ) {
          const chunk = world.getChunkIfLoaded(cx, cy);
          const onScreen =
            cx >= visible.minCx &&
            cx <= visible.maxCx &&
            cy >= visible.minCy &&
            cy <= visible.maxCy;
          if (chunk) this.visit(chunk, cx, cy, onScreen, view.view.y, surfaces);
        }
    }
    for (const [key, last] of this.previous) if (!last.seen) this.previous.delete(key);
    for (const entry of this.resident.values()) {
      if (entry.visited === this.visited) continue;
      surfaces.drop(entry.chunk, entry.key);
      this.resident.delete(entry.key);
    }
    this.jobs.sort(compareJobs);
    return this.jobs;
  }

  /** One chunk-native step ahead of the view along its motion since last frame. */
  private lookAhead(view: TerrainPreparationView["view"]) {
    const last = this.previous.get(view);
    const dx = last ? view.x - last.x : 0,
      dy = last ? view.y - last.y : 0;
    const length = Math.hypot(dx, dy);
    this.aheadX = view.x + (length ? (dx / length) * CHUNK_NATIVE_PX : 0);
    this.aheadY = view.y + (length ? (dy / length) * CHUNK_NATIVE_PX : 0);
    if (last) {
      last.x = view.x;
      last.y = view.y;
      last.seen = true;
    } else this.previous.set(view, { x: view.x, y: view.y, seen: true });
  }

  private visit(
    chunk: Chunk,
    cx: number,
    cy: number,
    onScreen: boolean,
    focalY: number,
    surfaces: TerrainSurfaces,
  ) {
    const key = `${cx},${cy}`;
    const existing = this.resident.get(key);
    // An earlier view already visited this chunk this frame.
    const repeat = existing?.visited === this.visited && existing.chunk === chunk;
    const entry = this.residentFor(existing, key, cx, cy, chunk, focalY, surfaces);
    if (!repeat) {
      const pending = !surfaces.isReady(chunk, cx, cy);
      entry.pendingSince = pending ? (entry.pendingSince ?? this.now) : null;
    }
    if (entry.pendingSince === null) return;
    const priority = onScreen ? (surfaces.hasImage(chunk) ? 1 : 0) : 2;
    const distance = Math.hypot(
      (cx + 0.5) * CHUNK_NATIVE_PX - this.aheadX,
      (cy + 0.5) * CHUNK_NATIVE_PX - this.aheadY,
    );
    // A chunk two views share keeps the better of their two rankings.
    const better =
      priority < entry.priority || (priority === entry.priority && distance < entry.distance);
    if (repeat && !better) return;
    if (!repeat) this.jobs.push(entry);
    entry.priority = priority;
    entry.distance = distance;
    entry.focalY = focalY;
  }

  /** The chunk's resident record, created or rebound to a replacement chunk. */
  private residentFor(
    entry: TerrainResident | undefined,
    key: string,
    cx: number,
    cy: number,
    chunk: Chunk,
    focalY: number,
    surfaces: TerrainSurfaces,
  ): TerrainResident {
    const visited = this.visited;
    if (!entry) {
      const created = {
        key,
        cx,
        cy,
        chunk,
        pendingSince: null,
        visited,
        priority: 0,
        distance: 0,
        focalY,
      };
      this.resident.set(key, created);
      this.recordsCreated++;
      return created;
    }
    if (entry.chunk !== chunk) {
      surfaces.drop(entry.chunk, key);
      entry.chunk = chunk;
      entry.pendingSince = null;
    }
    entry.visited = visited;
    return entry;
  }

  /** Drop the borrowed job list after building. */
  release(): void {
    this.jobs.length = 0;
  }

  /** Forget a chunk the world released. */
  forget(chunk: Chunk): void {
    for (const [key, entry] of this.resident) if (entry.chunk === chunk) this.resident.delete(key);
  }

  clear(): void {
    this.resident.clear();
    this.jobs.length = 0;
    this.previous.clear();
  }
}
