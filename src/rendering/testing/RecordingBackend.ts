import type { SpriteCatalog } from "../../assets/SpriteCatalog.js";
import type { InteriorContent } from "../../interiors/InteriorPresentation.js";
import type { Chunk } from "../../world/Chunk.js";
import type { ChunkRange } from "../../world/ChunkManager.js";
import { ElevationDescriptorCache } from "../ElevationDescriptorCache.js";
import type { RenderBackend, RenderPass, RenderView } from "../RenderFrame.js";
import { type TerrainDrawOptions, TerrainFrame } from "../TerrainFrame.js";
import type { TerrainRenderWorld, TerrainResourceId } from "../TerrainPresentation.js";

let nextId = 1;
interface Resource {
  id: TerrainResourceId;
  revision: number;
  visual: number;
  assets: number;
  cx: number;
  cy: number;
}
/** Contract test implementation: no DOM, image, draw callback or raster dependency.
 * Copies borrowed submissions immediately, as a retaining backend must do. */
export class RecordingBackend implements RenderBackend {
  readonly passes: RenderPass[] = [];
  readonly views: RenderView[] = [];
  readonly contents = new Map<number, InteriorContent>();
  readonly terrain = new TerrainFrame();
  readonly elevation = new ElevationDescriptorCache();
  readonly resources = new Map<Chunk, Resource>();
  uploads = 0;
  assetRevision = 0;
  disposed = false;
  constructor(readonly assets: SpriteCatalog) {}
  private live() {
    if (this.disposed) throw Error("disposed");
  }
  prepareTerrain(_view: RenderView, world: TerrainRenderWorld, visible: ChunkRange) {
    this.live();
    const wanted = new Set<Chunk>();
    for (let cy = visible.minCy; cy <= visible.maxCy; cy++)
      for (let cx = visible.minCx; cx <= visible.maxCx; cx++) {
        const chunk = world.getChunkIfLoaded(cx, cy);
        if (!chunk) continue;
        wanted.add(chunk);
        const old = this.resources.get(chunk);
        if (this.isTerrainReady(chunk) && old?.cx === cx && old.cy === cy) continue;
        this.resources.set(chunk, {
          id: nextId++ as TerrainResourceId,
          revision: chunk.revision,
          visual: chunk.visualRevision,
          assets: this.assetRevision,
          cx,
          cy,
        });
        this.uploads++;
      }
    for (const chunk of this.resources.keys()) if (!wanted.has(chunk)) this.releaseChunk(chunk);
  }
  resourceId(chunk: Chunk, cx: number, cy: number) {
    const r = this.resources.get(chunk);
    return r?.cx === cx && r.cy === cy ? r.id : null;
  }
  groundResourceId(chunk: Chunk, cx: number, cy: number) {
    return this.resourceId(chunk, cx, cy);
  }
  collectTerrain(
    view: RenderView,
    world: TerrainRenderWorld,
    visible: ChunkRange,
    options?: TerrainDrawOptions,
  ) {
    this.live();
    return this.terrain.collect(view, world, this, visible, options);
  }
  collectElevationItems(world: TerrainRenderWorld, visible: ChunkRange) {
    return this.elevation.collect(world, visible, this);
  }
  prepareInterior(content: InteriorContent) {
    this.live();
    assertData(content);
    if (!this.contents.has(content.id)) this.contents.set(content.id, structuredClone(content));
  }
  submit(view: RenderView, pass: RenderPass) {
    this.live();
    assertData(pass);
    if (pass.kind === "interior" && !this.contents.has(pass.contentId)) throw Error("stale room");
    this.views.push({
      x: view.x,
      y: view.y,
      zoom: view.zoom,
      viewportWidth: view.viewportWidth,
      viewportHeight: view.viewportHeight,
      ...(view.pixelSnap !== undefined ? { pixelSnap: view.pixelSnap } : {}),
    });
    this.passes.push(structuredClone(pass));
  }
  isTerrainReady(chunk: Chunk | undefined) {
    const r = chunk && this.resources.get(chunk);
    return (
      !!r &&
      r.revision === chunk?.revision &&
      r.visual === chunk.visualRevision &&
      r.assets === this.assetRevision
    );
  }
  hasTerrain(chunk: Chunk | undefined) {
    return !!chunk && this.resources.has(chunk);
  }
  releaseChunk(chunk: Chunk) {
    this.resources.delete(chunk);
  }
  getDiagnostics() {
    return {
      resident: this.resources.size,
      schedulerRecordsCreated: 0,
      queuedJobs: 0,
      building: 0,
      pending: 0,
      oldestMs: 0,
      rowsLastFrame: 0,
      surfaceBytes: 0,
    };
  }
  resize(_width: number, _height: number) {
    this.live();
  }
  invalidateAssets() {
    this.live();
    this.assetRevision++;
    this.contents.clear();
  }
  recover() {
    this.live();
    this.clear();
  }
  clear() {
    this.resources.clear();
    this.contents.clear();
    this.elevation.clear();
    this.terrain.clear();
  }
  dispose() {
    this.clear();
    this.disposed = true;
  }
}
function assertData(value: unknown): void {
  if (typeof value === "function") throw Error("draw callback crossed boundary");
  if (!value || typeof value !== "object") return;
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    throw Error("graphics/class instance crossed boundary");
  for (const child of Object.values(value)) assertData(child);
}
