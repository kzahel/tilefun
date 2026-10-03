import type { Chunk } from "../world/Chunk.js";
import type { TerrainResourceId } from "./TerrainPresentation.js";

// Process-local identities are never recycled across renderers or resets.
let nextResourceId = 1;

interface TerrainSurface {
  id: TerrainResourceId;
  canvas: OffscreenCanvas;
  revision: number;
  visualRevision: number;
  assetRevision: number;
  cx: number;
  cy: number;
}

/** Completed surfaces belong to one Canvas renderer, never to the shared world. */
export class CanvasTerrainResources {
  private readonly surfaces = new Map<Chunk, TerrainSurface>();
  private readonly coordinates = new Map<string, Chunk>();
  private readonly images = new Map<TerrainResourceId, OffscreenCanvas>();
  assetRevision = 0;

  get size(): number {
    return this.surfaces.size;
  }

  get(chunk: Chunk | undefined): OffscreenCanvas | null {
    return chunk ? (this.surfaces.get(chunk)?.canvas ?? null) : null;
  }

  resourceId(chunk: Chunk): TerrainResourceId | null {
    return this.surfaces.get(chunk)?.id ?? null;
  }

  resolve(id: TerrainResourceId): OffscreenCanvas | null {
    return this.images.get(id) ?? null;
  }

  isReady(chunk: Chunk | undefined, cx?: number, cy?: number): boolean {
    if (!chunk) return false;
    const entry = this.surfaces.get(chunk);
    return (
      !!entry &&
      entry.revision === chunk.revision &&
      entry.visualRevision === chunk.visualRevision &&
      entry.assetRevision === this.assetRevision &&
      (cx === undefined || entry.cx === cx) &&
      (cy === undefined || entry.cy === cy)
    );
  }

  publish(chunk: Chunk, cx: number, cy: number, canvas: OffscreenCanvas): void {
    const key = `${cx},${cy}`;
    const previous = this.coordinates.get(key);
    if (previous && previous !== chunk) this.delete(previous);
    this.delete(chunk);
    this.coordinates.set(key, chunk);
    const id = nextResourceId++ as TerrainResourceId;
    this.images.set(id, canvas);
    this.surfaces.set(chunk, {
      id,
      canvas,
      cx,
      cy,
      revision: chunk.revision,
      visualRevision: chunk.visualRevision,
      assetRevision: this.assetRevision,
    });
  }

  delete(chunk: Chunk): void {
    const entry = this.surfaces.get(chunk);
    if (entry) {
      this.coordinates.delete(`${entry.cx},${entry.cy}`);
      this.images.delete(entry.id);
    }
    this.surfaces.delete(chunk);
  }

  retainCoordinates(wanted: Pick<ReadonlySet<string>, "has">): void {
    for (const [chunk, entry] of this.surfaces)
      if (!wanted.has(`${entry.cx},${entry.cy}`)) this.delete(chunk);
  }

  invalidateAssets(): void {
    this.assetRevision++;
  }
  clear(): void {
    this.surfaces.clear();
    this.coordinates.clear();
    this.images.clear();
  }
}
