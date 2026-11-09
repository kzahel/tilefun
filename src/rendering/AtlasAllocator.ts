/** Square texture-array layers packed with power-of-two shelves. Rows within a
 * layer are a 1-D buddy system, so empty shelves merge back into whole layers;
 * new shelves prefer the lowest layer, so eviction lets the array shrink. */
export interface AtlasRegion {
  readonly layer: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly shelf: Shelf;
}
interface Shelf {
  layer: number;
  y: number;
  height: number;
  /** Free [start, end) column spans, sorted and coalesced. */
  free: [number, number][];
}
const MIN_SHELF = 16;

export class AtlasAllocator {
  private readonly shelves = new Map<number, Shelf[]>();
  /** Per layer: free row blocks by block height. */
  private rows: Map<number, Set<number>>[] = [];

  constructor(
    readonly size: number,
    layers = 0,
  ) {
    this.resize(layers);
  }
  get layers() {
    return this.rows.length;
  }
  /** Add empty layers, or drop empty trailing layers (callers check `highestUsedLayer`). */
  resize(layers: number) {
    while (this.rows.length > layers) this.rows.pop();
    while (this.rows.length < layers) this.rows.push(new Map([[this.size, new Set([0])]]));
  }
  /** -1 when every layer is empty. */
  highestUsedLayer() {
    for (let layer = this.rows.length - 1; layer >= 0; layer--)
      if (!this.rows[layer]?.get(this.size)?.has(0)) return layer;
    return -1;
  }
  allocate(width: number, height: number): AtlasRegion | null {
    if (width < 1 || height < 1 || width > this.size || height > this.size) return null;
    let shelfHeight = MIN_SHELF;
    while (shelfHeight < height) shelfHeight *= 2;
    const shelves = this.shelves.get(shelfHeight) ?? [];
    this.shelves.set(shelfHeight, shelves);
    for (const shelf of shelves) {
      const region = this.take(shelf, width, height);
      if (region) return region;
    }
    const block = this.allocateRows(shelfHeight);
    if (!block) return null;
    const shelf: Shelf = {
      layer: block.layer,
      y: block.y,
      height: shelfHeight,
      free: [[0, this.size]],
    };
    // Lowest layer first: eviction can then empty the top of the array.
    const at = shelves.findIndex(
      (s) => s.layer > shelf.layer || (s.layer === shelf.layer && s.y > shelf.y),
    );
    shelves.splice(at < 0 ? shelves.length : at, 0, shelf);
    return this.take(shelf, width, height);
  }
  free(region: AtlasRegion) {
    const { shelf } = region;
    const free = shelf.free;
    let start = region.x,
      end = region.x + region.width;
    let i = free.findIndex((span) => span[0] >= end);
    if (i < 0) i = free.length;
    const before = free[i - 1],
      after = free[i];
    if (after && after[0] === end) {
      end = after[1];
      free.splice(i, 1);
    }
    if (before && before[1] === start) {
      start = before[0];
      free.splice(--i, 1);
    }
    free.splice(i, 0, [start, end]);
    if (free.length === 1 && start === 0 && end === this.size) {
      const shelves = this.shelves.get(shelf.height) ?? [];
      const index = shelves.indexOf(shelf);
      if (index >= 0) shelves.splice(index, 1);
      this.freeRows(shelf.layer, shelf.y, shelf.height);
    }
  }
  private take(shelf: Shelf, width: number, height: number): AtlasRegion | null {
    for (let i = 0; i < shelf.free.length; i++) {
      const span = shelf.free[i];
      if (!span || span[1] - span[0] < width) continue;
      const x = span[0];
      if (span[1] - x === width) shelf.free.splice(i, 1);
      else span[0] += width;
      return { layer: shelf.layer, x, y: shelf.y, width, height, shelf };
    }
    return null;
  }
  private allocateRows(height: number): { layer: number; y: number } | null {
    for (let layer = 0; layer < this.rows.length; layer++) {
      const blocks = this.rows[layer];
      if (!blocks) continue;
      for (let size = height; size <= this.size; size *= 2) {
        const set = blocks.get(size);
        const y = set?.values().next().value;
        if (set === undefined || y === undefined) continue;
        set.delete(y);
        // Split down to the requested height: take the lower half, free the upper.
        for (let half = size / 2; half >= height; half /= 2) this.addRows(blocks, half, y + half);
        return { layer, y };
      }
    }
    return null;
  }
  private freeRows(layer: number, y: number, size: number) {
    const blocks = this.rows[layer];
    if (!blocks) return; // The layer was dropped while empty.
    while (size < this.size) {
      const buddy = y ^ size;
      const set = blocks.get(size);
      if (!set?.has(buddy)) break;
      set.delete(buddy);
      y = Math.min(y, buddy);
      size *= 2;
    }
    this.addRows(blocks, size, y);
  }
  private addRows(blocks: Map<number, Set<number>>, size: number, y: number) {
    const set = blocks.get(size);
    if (set) set.add(y);
    else blocks.set(size, new Set([y]));
  }
}
