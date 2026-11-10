import { drawOverlayGeometry } from "./CanvasOverlayRenderer.js";
import { GpuDeferredShadows } from "./GpuDeferredShadows.js";
import { GpuMeshBodies } from "./GpuMeshBodies.js";
import { GpuOverlayResources } from "./GpuOverlayResources.js";
import { GpuRasterSurface } from "./GpuRasterSurface.js";
import { COMPACT_CAR_MESH } from "./MeshPresentation.js";
import type { OverlayDraw } from "./OverlayFrame.js";
import { RasterRenderBackend } from "./RasterRenderBackend.js";
import { type RasterSurface, touchRaster } from "./RasterSurface.js";
import type { RenderPass, RenderView } from "./RenderFrame.js";
import type { RenderRegion } from "./ViewLayout.js";
import { WORLD_RASTER_PAD } from "./WorldRasterFrame.js";

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
  meshSurfaceGeometry(assetId: string) {
    return this.meshes.surfaceGeometry(assetId);
  }
  readonly surface: GpuRasterSurface;
  readonly meshes: GpuMeshBodies;
  private readonly surfaceOverlays: GpuOverlayResources;
  private readonly overlay = document.createElement("canvas");
  private readonly overlayItems: OverlayDraw[] = [];
  private overlayValid = false;
  private views = 0;
  /** Actor ovals for the depth shadow pass (236, `?shadows=gpu`). */
  private readonly shadows = new GpuDeferredShadows();
  private sceneClipped = false;
  private readonly overlayContext: CanvasRenderingContext2D;
  constructor(canvas: HTMLCanvasElement) {
    const surface = new GpuRasterSurface(canvas);
    super(surface, new Map());
    this.surface = surface;
    this.surfaceOverlays = new GpuOverlayResources((image) => surface.releaseImage(image));
    this.meshes = new GpuMeshBodies(surface);
    surface.meshBody = (camera, item) => this.meshes.draw(camera, item, this.sheets);
    surface.meshReady = this.meshes.ready;
    // Outdoor scene passes draw with the padded camera and no other transform.
    // Rooms (no world depth) and clipped passes keep the plain ground shadow.
    const sink: RasterSurface = surface;
    sink.deferredShadow = (camera, shadow, gate) => {
      const target = surface.worldTarget;
      return (
        !!target &&
        surface.worldDepth &&
        !this.sceneClipped &&
        this.shadows.queue(target, camera, shadow, gate)
      );
    };
    const ctx = this.overlay.getContext("2d");
    if (!ctx) throw Error("Overlay surface unavailable");
    this.overlayContext = ctx;
    this.overlay.width = canvas.width;
    this.overlay.height = canvas.height;
  }
  beginFrame() {
    this.shadows.clear();
    this.shadows.prepare(this.surface.worldTarget);
    this.surface.beginFrame();
    this.meshes.beginFrame(this.views); // the last display frame's layout
    this.views = 0;
  }
  /** Start another view of this display frame (`RenderHost.beginView`). */
  beginView() {
    this.views++;
    this.shadows.clear();
    // Bodies drawn in one view say nothing about the next view's fallbacks.
    this.meshes.shadowCasters.clear();
    this.surface.beginView();
  }
  override submit(view: RenderView, pass: RenderPass) {
    if (this.surface.disposed) throw Error("Renderer is disposed");
    if (this.surface.lost) return;
    // Cached room walls/furniture retain their explicit painter ordering; they
    // do not yet publish world-depth surfaces. Their decals draw in that order.
    this.surface.worldDepth = this.worldRaster && pass.kind !== "interior";
    if (pass.kind === "overlay" && !pass.worldDepth) {
      this.drawShadows();
      this.surface.finishDecals();
    }
    this.surface.setDepthPlane();
    this.sceneClipped = pass.kind === "scene" && !!pass.clipRects;
    super.submit(view, pass);
    this.surface.flush();
    this.surface.setDepthPlane();
  }
  /** Blend queued actor shadows over the world drawn so far (before late decals
   * and any overlay that must stay above them). */
  private drawShadows() {
    const target = this.surface.worldTarget;
    if (!target || !this.shadows.pending) return;
    this.surface.flush();
    this.shadows.draw(this.surface.renderer, target, this.meshes.shadowCasters);
    this.surface.renderer.setRenderTarget(target);
  }
  /** Ovals drawn by the last depth shadow pass (diagnostics). */
  get deferredShadowsDrawn() {
    return this.shadows.drawn;
  }
  /** Finish the view's world (shadows, late decals) and compose it into `region`. */
  presentWorld(x: number, y: number, region?: RenderRegion) {
    this.drawShadows();
    this.surface.presentWorld(x, y, region);
  }
  protected override drawOverlay(pass: Extract<RenderPass, { kind: "overlay" }>) {
    if (!pass.items.length) return;
    if (pass.worldDepth) {
      const pad = this.worldRaster ? WORLD_RASTER_PAD : 0;
      const shifted = (p: readonly [number, number, number]) => [
        p[0],
        p[1],
        p[2] - pad * (p[0] + p[1]),
      ];
      this.surface.setDepthSurface(
        shifted(pass.worldDepth.top),
        shifted(pass.worldDepth.front),
        pass.worldDepth.xBounds?.map((x) => x + pad),
      );
    }
    if (pass.cacheKey) {
      const image = this.surfaceOverlays.get(
        pass.cacheKey,
        pass.items,
        this.surface.canvas.width,
        this.surface.canvas.height,
        this.sheets,
      );
      if (image !== undefined) {
        if (image) this.drawFaded(pass.opacity, image.image, image.x, image.y);
        return;
      }
    }
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
    this.drawFaded(pass.opacity, this.overlay, 0, 0);
  }
  /** Overlay images are composed opaquely first; group opacity blends them once. */
  private drawFaded(opacity: number | undefined, image: HTMLCanvasElement, x: number, y: number) {
    if (opacity === undefined || opacity >= 1) {
      this.surface.drawImage(image, x, y);
      return;
    }
    this.surface.save();
    this.surface.globalAlpha *= opacity;
    this.surface.drawImage(image, x, y);
    this.surface.restore();
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
        overlayRasterBuilds: this.surfaceOverlays.builds,
        overlayRasterHits: this.surfaceOverlays.hits,
        overlayRasterCulls: this.surfaceOverlays.culled,
        overlayRasterBytes: this.surfaceOverlays.bytes,
        overlayRasterCount: this.surfaceOverlays.size,
        meshDraws: this.meshes.draws,
        vehicleBedDraws: this.meshes.bedDraws,
        meshDrawCalls: this.meshes.drawCalls,
        meshImageHits: this.meshes.images.hits,
        meshImageMisses: this.meshes.images.misses,
        meshImageFrameHits: this.meshes.images.frameHits,
        meshImageCount: this.meshes.images.size,
        meshImageBytes: this.meshes.images.bytes,
        meshState: this.meshes.car.state,
        meshAsset: this.meshes.car.value ? COMPACT_CAR_MESH : null,
        meshParts: this.meshes.car.value?.meshCount ?? 0,
        ambulanceState: this.meshes.ambulance.state,
        ambulanceParts: this.meshes.ambulance.value?.meshCount ?? 0,
        fireTruckState: this.meshes.fireTruck.state,
        fireTruckParts: this.meshes.fireTruck.value?.meshCount ?? 0,
        vehicleAssets: this.meshes.assetStates,
        vehiclePaints: this.meshes.paints.states,
        vehiclePaintDraws: this.meshes.paintDraws,
        vehiclePaintFallbacks: this.meshes.paintFallbacks,
        targetBytes: this.meshes.targetBytes,
        meshTargetPool: this.meshes.targets.diagnostics,
      },
    };
  }
  override invalidateAssets() {
    super.invalidateAssets();
    this.surfaceOverlays.clear();
    this.overlayValid = false;
    this.overlayItems.length = 0;
    this.surface.clearResources();
    this.meshes.contents.clear();
    this.meshes.images.clear();
  }
  override clear() {
    super.clear();
    this.surfaceOverlays.clear();
    this.overlayValid = false;
    this.overlayItems.length = 0;
    this.surface.clearResources();
    this.meshes.contents.clear();
    this.meshes.images.clear();
  }
  override recover() {
    super.recover();
    this.shadows.reset();
    this.surface.recover();
    this.meshes.recover();
  }
  override dispose() {
    super.dispose();
    this.surfaceOverlays.clear();
    this.meshes.dispose();
    this.surface.dispose();
  }
}
