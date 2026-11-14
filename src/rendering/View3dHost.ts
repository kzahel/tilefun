import type * as THREE from "three";
import type { VehiclePaintScheme } from "../traffic/VehiclePaint.js";
import type { Chunk } from "../world/Chunk.js";
import type { CarMeshAsset } from "./CarMeshAsset.js";
import type { RenderRegion } from "./ViewLayout.js";

/** The host's loaded vehicle and train meshes and paint atlases: one copy for the
 * fixed view and every 3D view (249). A view poses a shared asset for each draw
 * and must leave its materials as it found them. */
export interface SharedMeshAssets {
  /** Asset IDs whose meshes can be drawn in this display frame. */
  readonly ready: ReadonlySet<string>;
  /** The asset if it is ready; otherwise starts its load on first sight. */
  asset(assetId: string): CarMeshAsset | undefined;
  /** A paint scheme's atlas once loaded; starts its load on first sight. */
  paint(paint: VehiclePaintScheme): THREE.Texture | undefined;
  /** Put a paint atlas on an asset's own materials; call the result to restore them. */
  bindPaint(object: THREE.Object3D, texture: THREE.Texture): () => void;
}

/** A rectangle of one layer of the page atlas, in texels. The object lasts as long
 * as its page stays resident: a page that was evicted and uploaded again, or an
 * atlas that forgot its pages (restored context, changed assets), gives a new one. */
export interface PageRegion {
  readonly layer: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The fixed view's page atlas, lent to 3D views (250): one GPU copy of each
 * image for every view. Pages store their rows bottom first. */
export interface SharedPages {
  /** The atlas texture array, or null while nothing is resident. It is replaced
   * when the atlas grows, so read it after the frame's page requests. */
  readonly atlas: THREE.Texture | null;
  /**
   * The page of a loaded chunk's prepared ground image, kept resident for this
   * display frame. Undefined while the image is not prepared, while its upload
   * waits for a later frame (uploads are paced), or when the atlas is full.
   */
  ground(chunk: Chunk): PageRegion | undefined;
  /** Images are split into pages of at most this many texels a side. */
  readonly pageSize: number;
  /**
   * The page of `image` whose top-left corner is at (x, y), both multiples of
   * `pageSize`, kept resident for this display frame and uploaded on first use.
   * Undefined when the atlas is full.
   */
  page(image: CanvasImageSource, x: number, y: number): PageRegion | undefined;
}

/** What a 3D view draws into: the host's renderer, already bound to the view's
 * region of the canvas (viewport and scissor), and the region's size. */
export interface View3dTarget {
  readonly renderer: THREE.WebGLRenderer;
  readonly width: number;
  readonly height: number;
  /** Counts restored graphics contexts. three.js re-uploads scene resources by
   * itself; a view rebuilds anything it tracks beyond that (cached render targets). */
  readonly generation: number;
  readonly meshes: SharedMeshAssets;
  readonly pages: SharedPages;
}

/**
 * 3D views of a display frame on the render host's own WebGL context (248): the
 * fixed view and 3D views share one renderer, so they share loaded GPU assets and
 * can sit side by side in one canvas.
 */
export interface View3dHost {
  /**
   * Draw a 3D view into `region` of the canvas (the whole canvas when omitted).
   * `draw` clears and renders through the given renderer; the host restores its own
   * render state afterwards. Returns false, without calling `draw`, while graphics
   * are lost or the region keeps only part of its rectangle (a diagonal mask).
   */
  draw(region: RenderRegion | undefined, draw: (target: View3dTarget) => void): boolean;
}
