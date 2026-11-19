import type * as THREE from "three";
import type { VehiclePaintScheme } from "../traffic/VehiclePaint.js";
import type { Chunk } from "../world/Chunk.js";
import type { CarMeshAsset } from "./CarMeshAsset.js";
import type { SpriteItem } from "./SceneItem.js";
import type { RenderRegion } from "./ViewLayout.js";

/**
 * A vehicle body as the fixed view draws it: an outlined image at one texel per
 * world pixel, square, covering `radius` world pixels each way from the body's
 * anchor, seen through the fixed view's camera (east to the right, north and
 * height up). `depth` holds each texel's nearness along that camera's view ray:
 * 0.5 at the anchor, one unit across 8 × `radius` world pixels of north minus
 * height, smaller is nearer.
 */
export interface BodyImage {
  readonly texture: THREE.Texture;
  readonly depth: THREE.Texture | null | undefined;
  readonly radius: number;
}

/** The host's loaded vehicle and train meshes and paint atlases: one copy for the
 * fixed view and every 3D view (249). A view poses a shared asset for each draw
 * and must leave its materials as it found them. */
export interface SharedMeshAssets {
  /** Asset IDs whose meshes can be drawn in this display frame. */
  readonly ready: ReadonlySet<string>;
  /** The asset if it is ready; otherwise starts its load on first sight. */
  asset(assetId: string): CarMeshAsset | undefined;
  /** The model has been requested and will be published at a frame boundary. */
  pending?(assetId: string): boolean;
  /** A paint scheme's atlas once loaded; starts its load on first sight. */
  paint(paint: VehiclePaintScheme): THREE.Texture | undefined;
  /** Put a paint atlas on an asset's own materials; call the result to restore them. */
  bindPaint(object: THREE.Object3D, texture: THREE.Texture): () => void;
  /**
   * The fixed view's finished image of a vehicle body, with the car it tows and
   * what stands in its bed, valid until the next display frame. `shows(radius)`
   * says whether a square of that many world pixels each way from the body's
   * anchor is in view: null when it is not, and there is nothing to draw.
   * Undefined when there is no image to give (assets or paint loading, or too
   * many this frame); the view then draws the meshes itself. Call it before
   * drawing to the view's target: making an image renders offscreen.
   */
  bodyImage?(item: SpriteItem, shows: (radius: number) => boolean): BodyImage | null | undefined;
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

/** A headset session's immersive output (252): both eyes, through the head pose. */
export interface ImmersiveOutput {
  /** The room's reference space: poses are read in it. */
  readonly space: XRReferenceSpace;
  /**
   * Draw this headset frame; call only inside the session's frame callback.
   * `draw` renders with a camera parented to the room's place in the world: the
   * renderer replaces it with the eyes' cameras. The target's size is one eye's.
   * Returns false, without calling `draw`, while graphics are lost.
   */
  draw(draw: (target: View3dTarget) => void): boolean;
}

/** A headset session's screen output (252): the host's canvas on a flat panel
 * in the room. The page draws its frame as usual; the host copies it across. */
export interface ScreenOutput {
  readonly space: XRReferenceSpace;
}

/** Where a headset screen hangs when the session starts: in front of the head,
 * the way it faces, its centre a little below it. Metres. */
export interface ScreenPlacement {
  readonly below: number;
  readonly distance: number;
  readonly width: number;
}

/**
 * Headset sessions on the render host's WebGL context (252). Either output
 * calls `frame` once per headset frame, for as long as the session lasts; the
 * caller ends the session, and the host gives its renderer back when it ends.
 */
export interface View3dXr {
  immersive(session: XRSession, frame: XRFrameRequestCallback): Promise<ImmersiveOutput>;
  screen(
    session: XRSession,
    frame: XRFrameRequestCallback,
    placement: ScreenPlacement,
  ): Promise<ScreenOutput>;
}

/**
 * 3D views of a display frame on the render host's own WebGL context (248): the
 * fixed view and 3D views share one renderer, so they share loaded GPU assets and
 * can sit side by side in one canvas.
 */
export interface View3dHost {
  readonly available?: boolean;
  /**
   * Draw a 3D view into `region` of the canvas (the whole canvas when omitted).
   * `draw` clears and renders through the given renderer; the host restores its own
   * render state afterwards. Returns false, without calling `draw`, while graphics
   * are lost or the region keeps only part of its rectangle (a diagonal mask).
   */
  draw(region: RenderRegion | undefined, draw: (target: View3dTarget) => void): boolean;
  /** Headset sessions on the same context. */
  readonly xr: View3dXr;
}
