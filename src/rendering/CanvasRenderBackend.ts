import { createSpriteCatalog, type SpriteCatalog } from "../assets/SpriteCatalog.js";
import type { Spritesheet } from "../assets/Spritesheet.js";
import type { InteriorContent } from "../interiors/InteriorPresentation.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { Camera } from "./Camera.js";
import { drawScene2D } from "./Canvas2DRenderer.js";
import { CanvasInteriorResources } from "./CanvasInteriorResources.js";
import { drawOverlayGeometry } from "./CanvasOverlayRenderer.js";
import type { RenderBackend, RenderPass, RenderView } from "./RenderFrame.js";
import type { TerrainRenderWorld } from "./TerrainPresentation.js";
import { TileRenderer } from "./TileRenderer.js";

/** Canvas resources and projection helpers never escape through RenderBackend. */
export class CanvasRenderBackend implements RenderBackend {
  private readonly camera = new Camera();
  assets: SpriteCatalog;
  private interior: CanvasInteriorResources | null = null;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private sheets: Map<string, Spritesheet>,
    private readonly terrain = new TileRenderer(),
  ) {
    this.assets = createSpriteCatalog(sheets);
  }

  setAssets(sheets: Map<string, Spritesheet>): void {
    this.sheets = sheets;
    this.assets = createSpriteCatalog(sheets);
    this.terrain.invalidateAssets();
    this.interior = null;
  }

  prepareInterior(content: InteriorContent): void {
    if (this.interior?.contentId === content.id) return;
    const atlas = this.sheets.get("modern-interiors");
    this.interior = atlas ? new CanvasInteriorResources(atlas.image, content) : null;
  }

  private setView(view: RenderView): Camera {
    const camera = this.camera;
    camera.x = view.x;
    camera.y = view.y;
    camera.zoom = view.zoom;
    camera.setViewport(view.viewportWidth, view.viewportHeight);
    return camera;
  }

  prepareTerrain(view: RenderView, world: TerrainRenderWorld, visible: ChunkRange): void {
    this.terrain.prepareTerrain(this.setView(view), world, this.sheets, visible);
  }

  collectTerrain(view: RenderView, world: TerrainRenderWorld, visible: ChunkRange) {
    return this.terrain.collectTerrainDraws(
      this.setView(view),
      world,
      this.sheets,
      visible,
      false,
      0,
    );
  }

  collectElevationItems(world: TerrainRenderWorld, visible: ChunkRange) {
    return this.terrain.collectElevationItems(world, visible);
  }

  submit(view: RenderView, pass: RenderPass): void {
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
        drawOverlayGeometry(ctx, pass.items, this.sheets);
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
        drawScene2D(
          ctx,
          camera,
          pass.items,
          this.sheets,
          this.sheets.get("grass-blades"),
          pass.pixelExactShadows,
          this.terrain,
          pass.order,
        );
        break;
    }
  }

  clear(): void {
    this.terrain.clear();
    this.interior = null;
  }
}
