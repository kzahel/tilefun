import { drawOverlayGeometry } from "./CanvasOverlayRenderer.js";
import { GpuMeshBodies } from "./GpuMeshBodies.js";
import { GpuRasterSurface } from "./GpuRasterSurface.js";
import { RasterRenderBackend } from "./RasterRenderBackend.js";
import { touchRaster } from "./RasterSurface.js";
import type { RenderPass, RenderView } from "./RenderFrame.js";

/** GPU draw adapter with shared terrain, interior and scene preparation. */
export class GpuRenderBackend extends RasterRenderBackend {
  readonly surface: GpuRasterSurface;
  readonly meshes: GpuMeshBodies;
  private readonly overlay = document.createElement("canvas");
  private readonly overlayContext: CanvasRenderingContext2D;
  constructor(canvas: HTMLCanvasElement) {
    const surface = new GpuRasterSurface(canvas);
    super(surface, new Map());
    this.surface = surface;
    this.meshes = new GpuMeshBodies(surface);
    surface.meshBody = (camera, item) => this.meshes.draw(camera, item);
    const ctx = this.overlay.getContext("2d");
    if (!ctx) throw Error("Overlay surface unavailable");
    this.overlayContext = ctx;
  }
  beginFrame() {
    this.surface.beginFrame();
    this.meshes.beginFrame();
  }
  override submit(view: RenderView, pass: RenderPass) {
    if (this.surface.lost) return;
    super.submit(view, pass);
    this.surface.flush();
  }
  protected override drawOverlay(pass: Extract<RenderPass, { kind: "overlay" }>) {
    if (!pass.items.length) return;
    const ctx = this.overlayContext;
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    drawOverlayGeometry(ctx, pass.items, this.sheets);
    touchRaster(this.overlay);
    this.surface.drawImage(this.overlay, 0, 0);
  }
  override resize(width: number, height: number) {
    super.resize(width, height);
    this.surface.resize(width, height);
    if (this.overlay.width !== width) this.overlay.width = width;
    if (this.overlay.height !== height) this.overlay.height = height;
  }
  override getDiagnostics() {
    return {
      ...super.getDiagnostics(),
      gpu: {
        ...this.surface.stats,
        meshDraws: this.meshes.draws,
        meshState: this.meshes.car.state,
        targetBytes: this.meshes.targetBytes,
      },
    };
  }
  override invalidateAssets() {
    super.invalidateAssets();
    this.surface.clearResources();
  }
  override clear() {
    super.clear();
    this.surface.clearResources();
  }
  override recover() {
    super.recover();
    this.surface.recover();
    this.meshes.recover();
  }
  override dispose() {
    super.dispose();
    this.meshes.dispose();
    this.surface.dispose();
  }
}
