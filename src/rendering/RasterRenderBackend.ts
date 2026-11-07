import type { GameAssets } from "../assets/GameAssets.js";
import { createSpriteCatalog, type SpriteCatalog } from "../assets/SpriteCatalog.js";
import type { Spritesheet } from "../assets/Spritesheet.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import type { InteriorContent } from "../interiors/InteriorPresentation.js";
import type { Chunk } from "../world/Chunk.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { Camera } from "./Camera.js";
import { drawScenePass2D } from "./Canvas2DRenderer.js";
import { CanvasInteriorResources } from "./CanvasInteriorResources.js";
import { drawOverlayGeometry } from "./CanvasOverlayRenderer.js";
import type { RasterSurface } from "./RasterSurface.js";
import type {
  RenderBackend,
  RenderPass,
  RenderView,
  TerrainPreparationOptions,
} from "./RenderFrame.js";
import { type TerrainDrawOptions, TerrainFrame } from "./TerrainFrame.js";
import type { TerrainRenderWorld } from "./TerrainPresentation.js";
import { TileRenderer } from "./TileRenderer.js";
import { WORLD_RASTER_PAD } from "./WorldRasterFrame.js";

/** Canvas resources and projection helpers never escape through RenderBackend. */
export class RasterRenderBackend implements RenderBackend {
  /** Hosts enable this; immutable reference adapters retain their original pixels. */
  worldRaster = false;
  protected readonly camera = new Camera();
  private readonly terrainFrame = new TerrainFrame();
  assets: SpriteCatalog;
  private disposed = false;
  private interior: CanvasInteriorResources | null = null;

  constructor(
    protected readonly ctx: RasterSurface,
    protected sheets: Map<string, Spritesheet>,
    protected readonly terrain = new TileRenderer(),
  ) {
    this.sheets = new Map(sheets);
    this.assets = createSpriteCatalog(sheets);
  }

  setAssets(sheets: Map<string, Spritesheet>): void {
    this.assertLive();
    this.sheets = new Map(sheets);
    this.assets = createSpriteCatalog(sheets);
    this.invalidateAssets();
  }

  /** Add decoded sprite sources without invalidating unchanged terrain. Replacement
   * must use setAssets/configureAssets so dependent static resources are rebuilt. */
  addSpriteAssets(sheets: Map<string, Spritesheet>): void {
    this.assertLive();
    for (const [key, sheet] of this.sheets) {
      if (sheets.get(key) !== sheet) throw Error(`Additive asset update replaced ${key}`);
    }
    if (sheets.size === this.sheets.size) return;
    this.sheets = new Map(sheets);
    this.assets = createSpriteCatalog(sheets);
  }

  prepareInterior(content: InteriorContent): void {
    this.assertLive();
    if (this.interior?.contentId === content.id) return;
    const atlas = this.sheets.get("modern-interiors");
    this.interior = atlas ? new CanvasInteriorResources(atlas.image, content) : null;
  }

  protected setView(view: RenderView): Camera {
    const camera = this.camera;
    camera.x = view.x;
    camera.y = view.y;
    camera.zoom = view.zoom;
    camera.pixelSnap = view.pixelSnap ?? false;
    camera.worldRaster = this.worldRaster;
    const pad = this.worldRaster ? WORLD_RASTER_PAD * 2 : 0;
    camera.setViewport(view.viewportWidth + pad, view.viewportHeight + pad);
    return camera;
  }

  prepareTerrain(
    view: RenderView,
    world: TerrainRenderWorld,
    visible: ChunkRange,
    options?: TerrainPreparationOptions,
  ): void {
    this.assertLive();
    if (options?.scope === "visible") {
      this.terrain.prepareVisibleTerrain(
        this.setView(view),
        world,
        this.sheets,
        visible,
        options.rowBudget,
      );
      return;
    }
    this.terrain.prepareTerrain(
      this.setView(view),
      world,
      this.sheets,
      visible,
      options?.timeBudgetMs,
      options?.rowBudget,
    );
  }

  collectTerrain(
    view: RenderView,
    world: TerrainRenderWorld,
    visible: ChunkRange,
    options?: TerrainDrawOptions,
  ) {
    this.assertLive();
    const draws = this.terrainFrame.collect(
      this.setView(view),
      world,
      this.terrain,
      visible,
      options,
    );
    if (this.worldRaster) {
      const edge = options?.overscanPixels ?? 1;
      for (const draw of draws) {
        draw.width -= edge;
        draw.height -= edge;
        draw.edgePixels = edge;
      }
    }
    return draws;
  }

  collectElevationItems(world: TerrainRenderWorld, visible: ChunkRange) {
    this.assertLive();
    return this.terrain.collectElevationItems(world, visible);
  }

  submit(view: RenderView, pass: RenderPass): void {
    this.assertLive();
    const ctx = this.ctx;
    const camera = this.setView(view);
    ctx.imageSmoothingEnabled = false;
    switch (pass.kind) {
      case "interior":
        if (this.interior?.contentId === pass.contentId) {
          const origin = camera.worldToScreen(0, 0);
          ctx.save();
          try {
            ctx.translate(origin.sx, origin.sy);
            if (!this.worldRaster) ctx.scale(camera.scale, camera.scale);
            this.interior.draw(
              ctx,
              pass.draws,
              this.sheets,
              this.terrain,
              this.worldRaster ? camera.scale : undefined,
            );
          } finally {
            ctx.restore();
          }
        }
        break;
      case "overlay":
        ctx.save();
        if (this.worldRaster) ctx.translate(WORLD_RASTER_PAD, WORLD_RASTER_PAD);
        this.drawOverlay(pass);
        ctx.restore();
        break;
      case "clear":
        ctx.fillStyle = pass.color;
        ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
        break;
      case "terrain":
        for (const draw of pass.draws) {
          const image = this.terrain.resolveTerrainResource(draw.resource);
          if (image) {
            if (this.worldRaster && ctx.drawStableImage) {
              const raster = image as OffscreenCanvas;
              ctx.drawStableImage(
                image,
                0,
                0,
                raster.width,
                raster.height,
                draw.x,
                draw.y,
                draw.width,
                draw.height,
              );
            } else ctx.drawImage(image, draw.x, draw.y, draw.width, draw.height);
            const edge = draw.edgePixels ?? 0;
            if (edge) {
              const w = (image as OffscreenCanvas).width,
                h = (image as OffscreenCanvas).height;
              ctx.drawImage(image, w - 1, 0, 1, h, draw.x + draw.width, draw.y, edge, draw.height);
              ctx.drawImage(image, 0, h - 1, w, 1, draw.x, draw.y + draw.height, draw.width, edge);
              ctx.drawImage(
                image,
                w - 1,
                h - 1,
                1,
                1,
                draw.x + draw.width,
                draw.y + draw.height,
                edge,
                edge,
              );
            }
          }
        }
        break;
      case "scene":
        ctx.save();
        // Clip rectangles are already projected in the logical aligned viewport.
        // Bodies use the padded backend camera; translate clips without moving bodies twice.
        if (this.worldRaster && pass.clipRects) {
          ctx.beginPath();
          for (const r of pass.clipRects)
            ctx.rect(r.x + WORLD_RASTER_PAD, r.y + WORLD_RASTER_PAD, r.width, r.height);
          ctx.clip();
        }
        drawScenePass2D(
          ctx,
          camera,
          this.worldRaster && pass.clipRects
            ? {
                kind: "scene",
                items: pass.items,
                order: pass.order,
                pixelExactShadows: pass.pixelExactShadows ?? false,
              }
            : pass,
          this.sheets,
          this.sheets.get("grass-blades"),
          this.terrain,
        );
        ctx.restore();
        break;
    }
  }

  protected drawOverlay(pass: Extract<RenderPass, { kind: "overlay" }>): void {
    const ctx = this.ctx as CanvasRenderingContext2D;
    if (pass.opacity === undefined || pass.opacity >= 1) {
      drawOverlayGeometry(ctx, pass.items, this.sheets);
      return;
    }
    // Group opacity: compose opaquely with the same transform, then blend once.
    const { width, height } = ctx.canvas;
    this.fadeScratch ??= new OffscreenCanvas(width, height);
    const scratch = this.fadeScratch;
    if (scratch.width !== width) scratch.width = width;
    if (scratch.height !== height) scratch.height = height;
    const layer = scratch.getContext("2d");
    if (!layer) throw Error("Overlay fade surface unavailable");
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.clearRect(0, 0, width, height);
    layer.setTransform(ctx.getTransform());
    layer.imageSmoothingEnabled = ctx.imageSmoothingEnabled;
    drawOverlayGeometry(layer as unknown as CanvasRenderingContext2D, pass.items, this.sheets);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha *= pass.opacity;
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
  }
  private fadeScratch: OffscreenCanvas | undefined;

  /** Source decoding/configuration belongs to platform composition. */
  configureAssets(assets: GameAssets, graph: BlendGraph): void {
    this.assertLive();
    this.terrain.setBlendSheets(assets.blendSheets, graph);
    this.terrain.setRoadSheets(assets.sheets);
    this.terrain.setVariants(assets.variants);
    this.setAssets(assets.sheets);
  }

  isTerrainReady(chunk: Chunk | undefined): boolean {
    return this.terrain.isTerrainReady(chunk);
  }
  hasTerrain(chunk: Chunk | undefined): boolean {
    return this.terrain.hasTerrain(chunk);
  }
  releaseChunk(chunk: Chunk): void {
    this.terrain.releaseChunk(chunk);
  }
  getDiagnostics() {
    return this.terrain.getDiagnostics();
  }

  resize(width: number, height: number): void {
    this.assertLive();
    const canvas = this.ctx.canvas;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    // Native terrain/room resources are independent of viewport size.
  }

  invalidateAssets(): void {
    this.assertLive();
    this.terrain.invalidateAssets();
    this.interior = null;
  }

  recover(): void {
    this.assertLive();
    this.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    // Decoded sources are borrowed from the host and may still serve UI/other
    // backends. Release references, never close another owner's shared bitmap.
    this.sheets = new Map();
    this.assets = new Map();
    this.disposed = true;
  }

  private assertLive(): void {
    if (this.disposed) throw Error("Renderer is disposed");
  }

  clear(): void {
    this.terrain.clear();
    this.terrainFrame.clear();
    this.interior = null;
    this.fadeScratch = undefined;
  }
}
