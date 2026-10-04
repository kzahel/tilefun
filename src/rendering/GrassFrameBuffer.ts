import type { GrassItem } from "./SceneItem.js";

const EMPTY = new Float64Array(0);
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
    } else if (this.smallEntityFrames >= SHRINK_AFTER_FRAMES) {
      this.resizePositions(positionCapacity(this.entityCount));
      this.smallEntityFrames = 0;
    }
  }

  clear(): void {
    if (this.items.length) this.items = [];
    this.x = this.y = EMPTY;
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
    this.createdPositionBuffers += 2;
  }
}
