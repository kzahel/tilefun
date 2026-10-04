import { drawOverlayGeometry } from "./CanvasOverlayRenderer.js";
import { GpuMeshBodies } from "./GpuMeshBodies.js";
import { GpuRasterSurface } from "./GpuRasterSurface.js";
import type { OverlayDraw } from "./OverlayFrame.js";
import { RasterRenderBackend } from "./RasterRenderBackend.js";
import { touchRaster } from "./RasterSurface.js";
import type { RenderPass, RenderView } from "./RenderFrame.js";

/** GPU draw adapter with shared terrain, interior and scene preparation. */
const overlayFields: (keyof OverlayDraw)[] = [
  "kind",
  "x",
  "y",
  "width",
  "height",
  "fill",
  "stroke",
  "lineWidth",
  "text",
  "font",
  "centered",
  "sheetKey",
  "srcX",
  "srcY",
  "srcWidth",
  "srcHeight",
  "alpha",
];
export class GpuRenderBackend extends RasterRenderBackend {
  readonly surface: GpuRasterSurface;
  readonly meshes: GpuMeshBodies;
  private readonly overlay = document.createElement("canvas");
  private readonly overlayItems: OverlayDraw[] = [];
  private overlayValid = false;
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
    this.overlay.width = canvas.width;
    this.overlay.height = canvas.height;
  }
  beginFrame() {
    this.surface.beginFrame();
    this.meshes.beginFrame();
  }
  override submit(view: RenderView, pass: RenderPass) {
    if (this.surface.disposed) throw Error("Renderer is disposed");
    if (this.surface.lost) return;
    super.submit(view, pass);
    this.surface.flush();
  }
  protected override drawOverlay(pass: Extract<RenderPass, { kind: "overlay" }>) {
    if (!pass.items.length) return;
    const ctx = this.overlayContext;
    const unchanged =
      this.overlayValid &&
      this.overlayItems.length === pass.items.length &&
      pass.items.every((item, i) =>
        overlayFields.every((key) => item[key] === this.overlayItems[i]?.[key]),
      );
    if (!unchanged) {
      ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
      drawOverlayGeometry(ctx, pass.items, this.sheets);
      touchRaster(this.overlay);
      // Keep only the current bounded frame, never references to borrowed commands.
      this.overlayItems.length = pass.items.length;
      pass.items.forEach((item, i) => {
        const previous = this.overlayItems[i];
        if (previous) Object.assign(previous, item);
        else this.overlayItems[i] = { ...item };
      });
      this.overlayValid = true;
    }
    this.surface.drawImage(this.overlay, 0, 0);
  }
  override resize(width: number, height: number) {
    super.resize(width, height);
    this.surface.resize(width, height);
    this.overlayValid = false;
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
    this.overlayValid = false;
    this.overlayItems.length = 0;
    this.surface.clearResources();
  }
  override clear() {
    super.clear();
    this.overlayValid = false;
    this.overlayItems.length = 0;
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
