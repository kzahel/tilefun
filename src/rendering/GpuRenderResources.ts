import type { GameAssets } from "../assets/GameAssets.js";
import { createSpriteCatalog } from "../assets/SpriteCatalog.js";
import type { Spritesheet } from "../assets/Spritesheet.js";
import type { BlendGraph } from "../autotile/BlendGraph.js";
import type { Chunk } from "../world/Chunk.js";
import { Camera } from "./Camera.js";
import { drawOverlayGeometry } from "./CanvasOverlayRenderer.js";
import { GpuMeshBodies } from "./GpuMeshBodies.js";
import { GpuSceneSurface } from "./GpuSceneSurface.js";
import { COMPACT_CAR_MESH } from "./MeshPresentation.js";
import type { OverlayDraw } from "./OverlayFrame.js";
import type { RenderResources } from "./RenderFrame.js";
import type { SpriteItem } from "./SceneItem.js";
import { TileRenderer } from "./TileRenderer.js";

/** Shared terrain rasters, atlas and vehicle images for the unified scene.
 * Fixed world drawing is retired; review rasters have their own adapter. */
export class GpuRenderResources implements RenderResources {
  readonly surface: GpuSceneSurface;
  readonly meshes: GpuMeshBodies;
  private readonly terrain = new TileRenderer();
  private sheets = new Map<string, Spritesheet>();
  assets = createSpriteCatalog(this.sheets);
  constructor(canvas: HTMLCanvasElement) {
    this.surface = new GpuSceneSurface(canvas);
    this.meshes = new GpuMeshBodies(this.surface);
  }
  meshSurfaceGeometry(assetId: string) {
    return this.meshes.surfaceGeometry(assetId);
  }
  groundImage(chunk: Chunk) {
    return this.terrain.getTerrainSurface(chunk);
  }
  bodyImage(item: SpriteItem, shows: (radius: number) => boolean) {
    return this.meshes.bodyImage(item, this.sheets, shows);
  }
  beginFrame() {
    this.surface.beginFrame();
    this.meshes.beginFrame();
  }
  configureAssets(assets: GameAssets, graph: BlendGraph) {
    this.terrain.setBlendSheets(assets.blendSheets, graph);
    this.terrain.setRoadSheets(assets.sheets);
    this.terrain.setVariants(assets.variants);
    this.sheets = assets.sheets;
    this.assets = createSpriteCatalog(this.sheets);
    this.invalidateAssets();
  }
  addSpriteAssets(sheets: Map<string, Spritesheet>) {
    for (const [key, sheet] of this.sheets)
      if (sheets.get(key) !== sheet) throw Error(`Additive asset update replaced ${key}`);
    this.sheets = sheets;
    this.assets = createSpriteCatalog(sheets);
  }
  prepareTerrain: RenderResources["prepareTerrain"] = (view, world, visible, options) => {
    const camera = new Camera();
    Object.assign(camera, view);
    if (options?.scope === "visible")
      this.terrain.prepareVisibleTerrain(camera, world, this.sheets, visible, options.rowBudget);
    else
      this.terrain.prepareTerrain(
        camera,
        world,
        this.sheets,
        visible,
        options?.timeBudgetMs,
        options?.rowBudget,
      );
  };
  prepareTerrainViews: RenderResources["prepareTerrainViews"] = (views, world, options) =>
    this.terrain.prepareTerrainViews(views, world, this.sheets, options);
  isTerrainReady(chunk: Chunk | undefined) {
    return this.terrain.isTerrainReady(chunk);
  }
  hasTerrain(chunk: Chunk | undefined) {
    return this.terrain.hasTerrain(chunk);
  }
  releaseChunk(chunk: Chunk) {
    this.terrain.releaseChunk(chunk);
  }
  drawOverlayOn(ctx: CanvasRenderingContext2D, items: readonly OverlayDraw[]) {
    drawOverlayGeometry(ctx, items, this.sheets);
  }
  resize(width: number, height: number) {
    this.surface.resize(width, height);
  }
  getDiagnostics() {
    return {
      ...this.terrain.getDiagnostics(),
      gpu: {
        ...this.surface.stats,
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

  invalidateAssets() {
    this.terrain.invalidateAssets();
    this.surface.clearResources();
    this.meshes.contents.clear();
    this.meshes.images.clear();
  }
  clear() {
    this.terrain.clear();
    this.surface.clearResources();
    this.meshes.contents.clear();
    this.meshes.images.clear();
  }
  recover() {
    this.clear();
    this.surface.recover();
    this.meshes.recover();
  }
  dispose() {
    this.terrain.clear();
    this.meshes.dispose();
    this.surface.dispose();
    this.sheets = new Map();
    this.assets = new Map();
  }
}
