import type { SpriteCatalog } from "../assets/SpriteCatalog.js";
import type { InteriorContent, InteriorDraw } from "../interiors/InteriorPresentation.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { OverlayDraw } from "./OverlayFrame.js";
import type { SceneItem } from "./SceneItem.js";
import type { TerrainDrawOptions } from "./TerrainFrame.js";
import type {
  TerrainPresentation,
  TerrainRenderWorld,
  TerrainResourceId,
} from "./TerrainPresentation.js";
import type { TerrainPreparationView } from "./TerrainResidency.js";

/** Snapshot-shaped camera input; no graphics objects or projection callbacks. */
export interface RenderView {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** Snap the shared world-to-screen translation; reference renders may leave this off. */
  readonly pixelSnap?: boolean;
}

/** Prepared terrain placement in screen pixels, including seam overscan. */
export interface TerrainDraw {
  resource: TerrainResourceId;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Extrude the last source texel beyond the true scaled extent; never stretch the image. */
  edgePixels?: number;
}

/** Semantic batches, consumed in submission order. All storage is borrowed
 * synchronously until submit returns. Async backends must copy or add an
 * ownership/acknowledgment protocol before retaining any part of a frame.
 */
export type RenderPass =
  | {
      readonly kind: "interior";
      readonly contentId: number;
      readonly draws: readonly InteriorDraw[];
    }
  | {
      readonly kind: "overlay";
      readonly items: readonly OverlayDraw[];
      /** Stable semantic surface identity; backends may reuse its local raster. */
      readonly cacheKey?: string;
      /** Group opacity: the items compose opaquely, then the result is blended
       * once, so overlapping strips never double-blend into seams. */
      readonly opacity?: number;
      /** Affine top/front depth equations in logical screen pixels. */
      readonly worldDepth?: {
        top: readonly [number, number, number];
        front: readonly [number, number, number];
        /** Painted outlines/strip overscan inherit finite edge depth. */
        xBounds?: readonly [number, number];
      };
    }
  | { readonly kind: "clear"; readonly color: string }
  | { readonly kind: "terrain"; readonly draws: readonly TerrainDraw[] }
  | {
      readonly kind: "scene";
      readonly items: readonly SceneItem[];
      readonly order: readonly number[];
      readonly pixelExactShadows?: boolean;
      readonly clipRects?: readonly { x: number; y: number; width: number; height: number }[];
    };

export interface TerrainPreparationOptions {
  readonly scope?: "halo" | "visible";
  readonly timeBudgetMs?: number;
  readonly rowBudget?: number;
}
export interface TerrainDiagnostics {
  resident: number;
  schedulerRecordsCreated: number;
  queuedJobs: number;
  building: number;
  pending: number;
  oldestMs: number;
  rowsLastFrame: number;
  surfaceBytes: number;
}

export interface RenderBackend extends TerrainPresentation {
  readonly assets: SpriteCatalog;
  prepareInterior(content: InteriorContent): void;
  prepareTerrain(
    view: RenderView,
    world: TerrainRenderWorld,
    visible: ChunkRange,
    options?: TerrainPreparationOptions,
  ): void;
  /** Several views of one display frame (226): prepare their union once with one
   * budget, then collect per view. Never evicts another view's chunks. */
  prepareTerrainViews(
    views: readonly TerrainPreparationView[],
    world: TerrainRenderWorld,
    options?: TerrainPreparationOptions,
  ): void;
  collectTerrain(
    view: RenderView,
    world: TerrainRenderWorld,
    visible: ChunkRange,
    options?: TerrainDrawOptions,
  ): readonly TerrainDraw[];
  submit(view: RenderView, pass: RenderPass): void;
  isTerrainReady(chunk: Chunk | undefined): boolean;
  hasTerrain(chunk: Chunk | undefined): boolean;
  releaseChunk(chunk: Chunk): void;
  getDiagnostics(): TerrainDiagnostics;
  resize(width: number, height: number): void;
  invalidateAssets(): void;
  recover(): void;
  dispose(): void;
  clear(): void;
}

/** Positive/zero entries index main items; -(index + 1) indexes a shadow.
 * Ordering is presentation policy, shared by every graphics backend. The
 * caller supplies reusable numeric storage; it retains no scene references.
 */
export function collectSceneOrder(items: readonly SceneItem[], order: number[]): number[] {
  order.length = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.kind === "decal" && item.z <= 0) order.push(i);
    if (item?.kind === "sprite" && item.hasShadow && !item.flashHidden && item.shadowTerrainZ <= 0)
      order.push(-i - 1);
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.kind === "sprite" && item.hasShadow && !item.flashHidden && item.shadowTerrainZ > 0)
      order.push(-i - 1);
    if (item?.kind !== "decal" || item.z > 0) order.push(i);
  }
  return order;
}
