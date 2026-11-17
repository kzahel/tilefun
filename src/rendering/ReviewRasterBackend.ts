import { RasterRenderBackend } from "./RasterRenderBackend.js";

/** Native raster restricted to fingerprinted showcases and pattern candidates.
 * Interactive worlds use the shared scene; RenderingBoundary.test enforces this. */
export class ReviewRasterBackend extends RasterRenderBackend {}
