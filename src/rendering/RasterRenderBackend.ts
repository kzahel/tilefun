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

/** Canvas resources and projection helpers never escape through RenderBackend. */
export class RasterRenderBackend implements RenderBackend {
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
    camera.setViewport(view.viewportWidth, view.viewportHeight);
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
    return this.terrainFrame.collect(view, world, this.terrain, visible, options);
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
            ctx.scale(camera.scale, camera.scale);
            this.interior.draw(ctx, pass.draws, this.sheets, this.terrain);
          } finally {
            ctx.restore();
          }
        }
        break;
      case "overlay":
        this.drawOverlay(pass);
        break;
      case "clear":
        ctx.fillStyle = pass.color;
        ctx.fillRect(0, 0, view.viewportWidth, view.viewportHeight);
        break;
      case "terrain":
        for (const draw of pass.draws) {
          const image = this.terrain.resolveTerrainResource(draw.resource);
          if (image) ctx.drawImage(image, draw.x, draw.y, draw.width, draw.height);
        }
        break;
      case "scene":
        drawScenePass2D(
          ctx,
          camera,
          pass,
          this.sheets,
          this.sheets.get("grass-blades"),
          this.terrain,
        );
        break;
    }
  }

  protected drawOverlay(pass: Extract<RenderPass, { kind: "overlay" }>): void {
    drawOverlayGeometry(this.ctx as CanvasRenderingContext2D, pass.items, this.sheets);
  }

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
  }
}
