import type { GrassItem } from "./SceneItem.js";

const EMPTY = new Float64Array(0);
const NO_INDEX = new Int32Array(0);
// Bounds the neighbour grid; a larger view uses coarser cells instead of more.
const MAX_GRID_CELLS = 16384;
// The 0.1× desktop overview contains ~30k blades. The old 8k cap allocated
// its overflow every frame. Retain a bounded overview working set on demand;
// ordinary views allocate only what they use and shrink after sustained underuse.
const MAX_RETAINED_ITEMS = 65536;
const MAX_RETAINED_ENTITIES = 1024;
const SHRINK_AFTER_FRAMES = 60;
const positionCapacity = (count: number) => 2 ** Math.ceil(Math.log2(Math.max(32, count)));

/** Per-consumer scratch. Items are borrowed until the next collection or clear.
 * Keep the pool separate from the sorted scene list. Only scalars are retained;
 * oversized frames still draw fully, but excess storage is not kept afterward.
 */
export class GrassFrameBuffer {
  x = EMPTY;
  y = EMPTY;
  private items: GrassItem[] = [];
  private used = 0;
  private entityCount = 0;
  private smallItemFrames = 0;
  private smallEntityFrames = 0;
  private createdItems = 0;
  private createdPositionBuffers = 0;
  // Neighbour grid over the entities near the collected area (`index`): a
  // counting sort of entity indices by cell, ascending within each cell.
  private cellOf = NO_INDEX;
  private order = NO_INDEX;
  private cellStart = NO_INDEX;
  private cols = 0;
  private rows = 0;
  private originX = 0;
  private originY = 0;
  private perCell = 0;

  begin(entities: readonly { position: { wx: number; wy: number } }[]): void {
    this.used = 0;
    this.entityCount = entities.length;
    if (this.x.length < entities.length) this.resizePositions(positionCapacity(entities.length));
    for (let i = 0; i < entities.length; i++) {
      const position = entities[i]?.position;
      this.x[i] = position?.wx ?? 0;
      this.y[i] = position?.wy ?? 0;
    }
  }

  /**
   * Group this frame's entities inside the bounds by grid cell, so `closest`
   * reads a blade's neighbours instead of every entity. `cell` must exceed the
   * largest distance later asked of `closest`, and the bounds must reach that
   * far beyond every queried point.
   */
  index(minWx: number, minWy: number, maxWx: number, maxWy: number, cell: number): void {
    const count = this.entityCount;
    let size = cell;
    let cols = Math.max(1, Math.ceil((maxWx - minWx) / size));
    let rows = Math.max(1, Math.ceil((maxWy - minWy) / size));
    if (Number.isFinite(cols * rows)) {
      while (cols * rows > MAX_GRID_CELLS) {
        size *= 2;
        cols = Math.max(1, Math.ceil((maxWx - minWx) / size));
        rows = Math.max(1, Math.ceil((maxWy - minWy) / size));
      }
      this.originX = minWx;
      this.originY = minWy;
      this.perCell = 1 / size;
    } else {
      // Unbounded area: one cell holding every entity.
      cols = rows = 1;
      this.originX = this.originY = this.perCell = 0;
    }
    this.cols = cols;
    this.rows = rows;
    const cells = cols * rows;
    if (this.cellStart.length <= cells) {
      this.cellStart = new Int32Array(2 ** Math.ceil(Math.log2(cells + 1)));
    }
    if (this.cellOf.length < count) {
      this.cellOf = new Int32Array(this.x.length);
      this.order = new Int32Array(this.x.length);
    }
    const { x, y, cellOf, order, cellStart, originX, originY, perCell } = this;
    cellStart.fill(0, 0, cells + 1);
    for (let e = 0; e < count; e++) {
      const col = Math.floor(((x[e] ?? 0) - originX) * perCell);
      const row = Math.floor(((y[e] ?? 0) - originY) * perCell);
      // Written so a NaN position is left out, as it is by a distance test.
      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        const at = row * cols + col;
        cellOf[e] = at;
        cellStart[at] = (cellStart[at] ?? 0) + 1;
      } else cellOf[e] = -1;
    }
    let total = 0;
    for (let at = 0; at < cells; at++) {
      total += cellStart[at] ?? 0;
      cellStart[at] = total;
    }
    cellStart[cells] = total;
    // Backwards, so each cell's entities end up in ascending order.
    for (let e = count - 1; e >= 0; e--) {
      const at = cellOf[e] ?? -1;
      if (at < 0) continue;
      const slot = (cellStart[at] ?? 0) - 1;
      cellStart[at] = slot;
      order[slot] = e;
    }
  }

  /**
   * The indexed entity nearest a point, with squared distance above
   * `minDistSq` and below `maxDistSq`, or -1. Equal distances go to the earlier
   * entity, as a scan of the whole list in order would choose.
   */
  closest(wx: number, wy: number, minDistSq: number, maxDistSq: number): number {
    const { cols, cellStart } = this;
    if (cellStart[cols * this.rows] === 0) return -1;
    const col = Math.floor((wx - this.originX) * this.perCell);
    const row = Math.floor((wy - this.originY) * this.perCell);
    const firstCol = Math.max(col - 1, 0);
    const lastCol = Math.min(col + 1, cols - 1);
    const lastRow = Math.min(row + 1, this.rows - 1);
    if (!(firstCol <= lastCol)) return -1;
    const { x, y, order } = this;
    let best = -1;
    let bestDistSq = maxDistSq;
    for (let r = Math.max(row - 1, 0); r <= lastRow; r++) {
      // A row's neighbouring cells are one run of the sorted list.
      const end = cellStart[r * cols + lastCol + 1] ?? 0;
      for (let k = cellStart[r * cols + firstCol] ?? 0; k < end; k++) {
        const e = order[k] ?? 0;
        const dx = wx - (x[e] ?? 0);
        const dy = wy - (y[e] ?? 0);
        const distSq = dx * dx + dy * dy;
        if (distSq > minDistSq && (distSq < bestDistSq || (distSq === bestDistSq && e < best))) {
          bestDistSq = distSq;
          best = e;
        }
      }
    }
    return best;
  }

  next(wx: number, wy: number, variant: number, angle: number, alpha?: number): GrassItem {
    const index = this.used++;
    let item = this.items[index];
    if (!item) {
      item = { kind: "grass", sortKey: wy, wx, wy, variant, angle };
      if (index < MAX_RETAINED_ITEMS) this.items[index] = item;
      this.createdItems++;
    } else {
      item.sortKey = wy;
      item.wx = wx;
      item.wy = wy;
      item.variant = variant;
      item.angle = angle;
    }
    item.alpha = alpha;
    return item;
  }

  end(): void {
    this.smallItemFrames =
      this.items.length > Math.max(256, this.used * 4) ? this.smallItemFrames + 1 : 0;
    if (this.smallItemFrames >= SHRINK_AFTER_FRAMES) {
      this.items.length = Math.max(256, this.used);
      this.smallItemFrames = 0;
    }
    this.smallEntityFrames =
      this.x.length > Math.max(32, this.entityCount * 4) ? this.smallEntityFrames + 1 : 0;
    if (this.x.length > MAX_RETAINED_ENTITIES) {
      this.x = this.y = EMPTY;
      this.cellOf = this.order = NO_INDEX;
    } else if (this.smallEntityFrames >= SHRINK_AFTER_FRAMES) {
      this.resizePositions(positionCapacity(this.entityCount));
      this.smallEntityFrames = 0;
    }
  }

  clear(): void {
    if (this.items.length) this.items = [];
    this.x = this.y = EMPTY;
    this.cellOf = this.order = this.cellStart = NO_INDEX;
    this.cols = this.rows = 0;
    this.used = this.entityCount = this.smallItemFrames = this.smallEntityFrames = 0;
  }

  getDiagnostics() {
    return {
      retainedItems: this.items.length,
      positionCapacity: this.x.length,
      activeItems: this.used,
      createdItems: this.createdItems,
      createdPositionBuffers: this.createdPositionBuffers,
    };
  }

  private resizePositions(capacity: number): void {
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.cellOf = this.order = NO_INDEX;
    this.createdPositionBuffers += 2;
  }
}
