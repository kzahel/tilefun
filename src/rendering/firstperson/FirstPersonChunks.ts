import { CHUNK_SIZE_PX } from "../../config/constants.js";
import type { Prop } from "../../entities/Prop.js";
import { forestRowDefinition } from "../../patterns/ForestThicket.js";
import { forestRenderBounds } from "./FirstPersonForest.js";
import type { WorldRect } from "./ObliqueCamera.js";

interface ChunkCoord {
  key: string;
  cx: number;
  cy: number;
}

export type PropViewBounds = WorldRect | { x: number; y: number; reach: number };

/** The normal bucket owns each prop once. Wide forest rows also record their
 * drawn extent so they can survive even when only their ends reach the view. */
export class ChunkPropIndex {
  private readonly byKey = new Map<string, { props: Prop[]; signature: string }>();
  private readonly forest: (ChunkCoord & { bounds: WorldRect })[] = [];

  replace(props: readonly Prop[]): void {
    this.byKey.clear();
    this.forest.length = 0;
    for (const prop of props) {
      const { wx, wy } = prop.position;
      const cx = Math.floor(wx / CHUNK_SIZE_PX);
      const cy = Math.floor(wy / CHUNK_SIZE_PX);
      const key = chunkKey(cx, cy);
      let chunk = this.byKey.get(key);
      if (!chunk) {
        chunk = { props: [], signature: "" };
        this.byKey.set(key, chunk);
      }
      chunk.props.push(prop);
      chunk.signature += `${prop.id}@${wx},${wy}:${prop.type}|`;
      if (forestRowDefinition(prop.type))
        this.forest.push({ key, cx, cy, bounds: forestRenderBounds(prop) });
    }
  }

  get(key: string) {
    return this.byKey.get(key);
  }

  *overhanging(view: PropViewBounds, keep: ReadonlySet<string>): Iterable<ChunkCoord> {
    for (const owner of this.forest)
      if (!keep.has(owner.key) && touchesView(owner.bounds, view)) yield owner;
  }
}

function touchesView(bounds: WorldRect, view: PropViewBounds): boolean {
  if ("reach" in view)
    return (
      Math.hypot(
        Math.max(bounds.left - view.x, view.x - bounds.right, 0),
        Math.max(bounds.top - view.y, view.y - bounds.bottom, 0),
      ) <= view.reach
    );
  return (
    bounds.left < view.right &&
    bounds.right > view.left &&
    bounds.top < view.bottom &&
    bounds.bottom > view.top
  );
}

/** What a chunk's ground was built from. */
export interface TerrainEntry {
  readonly chunk: object;
  readonly key: string;
}

/** Ground rebuilds for a replaced chunk object as well as for edited content. */
export function terrainStale(
  cached: TerrainEntry | undefined,
  chunk: { revision: number; visualRevision: number },
): boolean {
  return cached?.chunk !== chunk || cached.key !== `${chunk.revision}:${chunk.visualRevision}`;
}

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Chunk coordinates within `reach` of the eye, nearest first. */
export function chunksInReach(
  x: number,
  y: number,
  reach: number,
): { cx: number; cy: number; key: string; distance: number }[] {
  const wanted: { cx: number; cy: number; key: string; distance: number }[] = [];
  const min = (v: number) => Math.floor((v - reach) / CHUNK_SIZE_PX);
  const max = (v: number) => Math.floor((v + reach) / CHUNK_SIZE_PX);
  for (let cy = min(y); cy <= max(y); cy++)
    for (let cx = min(x); cx <= max(x); cx++) {
      const nx = Math.max(cx * CHUNK_SIZE_PX, Math.min(x, (cx + 1) * CHUNK_SIZE_PX));
      const ny = Math.max(cy * CHUNK_SIZE_PX, Math.min(y, (cy + 1) * CHUNK_SIZE_PX));
      const distance = Math.hypot(nx - x, ny - y);
      if (distance <= reach) wanted.push({ cx, cy, key: chunkKey(cx, cy), distance });
    }
  return wanted.sort((a, b) => a.distance - b.distance);
}
