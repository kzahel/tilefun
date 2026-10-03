import {
  closeAssets,
  type GameAssets,
  loadSceneAssets,
  loadTerrainAssets,
} from "../assets/GameAssets.js";
import { computeChunkSubgridBlend } from "../autotile/Autotiler.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { CHUNK_SIZE, PIXEL_SCALE, TILE_SIZE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import type { Prop } from "../entities/Prop.js";
import { createProp } from "../entities/PropFactories.js";
import { descriptorKey, type GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import type { ActorPlacement } from "../generation/Generator.js";
import type { StructurePlacement } from "../generation/StructureGenerator.js";
import { Camera } from "../rendering/Camera.js";
import { drawScene2D } from "../rendering/Canvas2DRenderer.js";
import { collectScene } from "../rendering/collectScene.js";
import { TileRenderer } from "../rendering/TileRenderer.js";
import type { Chunk } from "../world/Chunk.js";
import { type ChunkData, hydrateChunk } from "../world/ChunkData.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { registerDefaultTiles } from "../world/TileRegistry.js";
import type { PreviewSettings } from "./PreviewSettings.js";
import type { ViewState } from "./ViewState.js";

/** Data residency and rendering only. This host never realizes terrain synchronously. */
export class TilePreview {
  private chunks = new Map<string, Chunk>();
  private wanted = new Set<string>();
  private props: Prop[] = [];
  private actors: Entity[] = [];
  private propsReady = false;
  private propsSerial = 0;
  private visibleKey = "";
  private key = "";
  private active = false;
  private disposed = false;
  private graph = new BlendGraph();
  private renderer = new TileRenderer();
  private assets: GameAssets | null = null;
  private loading: Promise<void> | null = null;
  private camera = new Camera();
  private visible: ChunkRange = { minCx: 0, minCy: 0, maxCx: -1, maxCy: -1 };
  stats = { assetsMs: 0, autotileMs: 0, resident: 0, ready: 0, bytes: 0, error: "" };
  constructor(private readonly changed: () => void) {
    registerDefaultTiles();
  }

  prepare(
    generation: GenerationDescriptor,
    view: ViewState,
    width: number,
    height: number,
    settings: PreviewSettings,
  ): { cx: number; cy: number }[] {
    const key = descriptorKey(generation);
    if (key !== this.key) {
      this.releaseChunks();
      this.key = key;
    }
    this.active =
      settings.mode === "tiles" ||
      settings.mode === "coverage" ||
      (settings.mode === "auto" && view.zoom >= settings.detailZoom * (this.active ? 0.85 : 1));
    if (!this.active || this.disposed) {
      this.releaseChunks();
      return [];
    }
    this.loadAssets();
    const cx = Math.floor(view.x / CHUNK_SIZE);
    const cy = Math.floor(view.y / CHUNK_SIZE);
    const r = settings.radius;
    this.visible = {
      minCx: Math.max(cx - r, Math.floor((view.x - width / (2 * view.zoom)) / CHUNK_SIZE)),
      maxCx: Math.min(cx + r, Math.floor((view.x + width / (2 * view.zoom)) / CHUNK_SIZE)),
      minCy: Math.max(cy - r, Math.floor((view.y - height / (2 * view.zoom)) / CHUNK_SIZE)),
      maxCy: Math.min(cy + r, Math.floor((view.y + height / (2 * view.zoom)) / CHUNK_SIZE)),
    };
    const visibleKey = JSON.stringify(this.visible);
    if (visibleKey !== this.visibleKey) {
      this.visibleKey = visibleKey;
      this.propsReady = false;
    }
    this.wanted.clear();
    const missing: { cx: number; cy: number }[] = [];
    // One chunk halo gives the exact autotiler and road renderer their neighbors.
    for (let y = this.visible.minCy - 1; y <= this.visible.maxCy + 1; y++) {
      for (let x = this.visible.minCx - 1; x <= this.visible.maxCx + 1; x++) {
        const coordinateKey = `${x},${y}`;
        this.wanted.add(coordinateKey);
        if (!this.chunks.has(coordinateKey)) missing.push({ cx: x, cy: y });
      }
    }
    missing.sort(
      (a, b) =>
        Math.abs(a.cx - cx) + Math.abs(a.cy - cy) - Math.abs(b.cx - cx) - Math.abs(b.cy - cy),
    );
    for (const [coordinateKey, chunk] of this.chunks) {
      if (!this.wanted.has(coordinateKey)) {
        this.renderer.releaseChunk(chunk);
        this.chunks.delete(coordinateKey);
      }
    }
    this.updateStats();
    return missing;
  }
  get featureIds(): string[] {
    return this.props.flatMap((prop) => (prop.proceduralId ? [prop.proceduralId] : []));
  }
  get footprint() {
    return this.active
      ? {
          minX: this.visible.minCx * CHUNK_SIZE - 20,
          minY: this.visible.minCy * CHUNK_SIZE - 20,
          maxX: (this.visible.maxCx + 1) * CHUNK_SIZE + 20,
          maxY: (this.visible.maxCy + 1) * CHUNK_SIZE + 20,
        }
      : undefined;
  }
  get complete(): boolean {
    return (
      this.active &&
      this.propsReady &&
      this.stats.ready ===
        (this.visible.maxCx - this.visible.minCx + 1) *
          (this.visible.maxCy - this.visible.minCy + 1)
    );
  }
  get actorIds(): string[] {
    return this.actors.flatMap((e) => (e.proceduralId ? [e.proceduralId] : []));
  }
  accept(
    chunks: { cx: number; cy: number; data: ChunkData }[],
    placements: StructurePlacement[] = [],
    actors: ActorPlacement[] = [],
  ): void {
    if (!this.active || this.disposed) return;
    for (const item of chunks) {
      const key = `${item.cx},${item.cy}`;
      if (this.wanted.has(key)) this.chunks.set(key, hydrateChunk(item.data));
    }
    this.props = placements.map((placement, index) => {
      const prop = createProp(placement.propType, placement.wx, placement.wy);
      prop.id = index + 1;
      if (placement.featureId) prop.proceduralId = placement.featureId;
      return prop;
    });
    this.actors = actors.map((p, index) => {
      const factory = ENTITY_FACTORIES[p.type];
      if (!factory) throw new Error(`Unsupported actor ${p.type}`);
      const e = factory(p.wx, p.wy);
      e.id = 100000 + index;
      e.proceduralId = p.featureId;
      return e;
    });
    this.loadProps();
    const start = performance.now();
    for (let cy = this.visible.minCy; cy <= this.visible.maxCy; cy++) {
      for (let cx = this.visible.minCx; cx <= this.visible.maxCx; cx++) {
        const chunk = this.chunks.get(`${cx},${cy}`);
        if (chunk && !chunk.autotileComputed) {
          computeChunkSubgridBlend(chunk, this.graph);
          chunk.autotileComputed = true;
          chunk.invalidateVisuals();
        }
      }
    }
    this.stats.autotileMs = performance.now() - start;
    this.updateStats();
  }
  draw(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    view: ViewState,
    coverage: boolean,
  ): boolean {
    if (!this.active || !this.assets || this.disposed) return false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const dpr = canvas.width / width;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    this.camera.x = view.x * TILE_SIZE;
    this.camera.y = view.y * TILE_SIZE;
    this.camera.zoom = view.zoom / (TILE_SIZE * PIXEL_SCALE);
    this.camera.setViewport(width, height);
    const world = {
      getChunkIfLoaded: (cx: number, cy: number) => this.chunks.get(`${cx},${cy}`),
      getRoadAt: (tx: number, ty: number) =>
        this.chunks
          .get(`${Math.floor(tx / CHUNK_SIZE)},${Math.floor(ty / CHUNK_SIZE)}`)
          ?.getRoad(
            ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
            ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
          ) ?? 0,
      getHeightAt: () => 0,
    };
    ctx.save();
    if (!this.propsReady) {
      ctx.beginPath();
      ctx.clip();
    }
    this.renderer.drawTerrain(ctx, this.camera, world, this.assets.sheets, this.visible, true, 32);
    ctx.restore();
    let pending = false;
    this.stats.ready = 0;
    for (let cy = this.visible.minCy; cy <= this.visible.maxCy; cy++) {
      for (let cx = this.visible.minCx; cx <= this.visible.maxCx; cx++) {
        const chunk = this.chunks.get(`${cx},${cy}`);
        const ready = this.renderer.isTerrainReady(chunk) && this.propsReady;
        if (ready) this.stats.ready++;
        else if (chunk) pending = true;
        if (coverage) {
          const { sx, sy } = this.camera.worldToScreen(
            cx * CHUNK_SIZE * TILE_SIZE,
            cy * CHUNK_SIZE * TILE_SIZE,
          );
          ctx.fillStyle = ready ? "#64df9630" : "#e0a14555";
          ctx.strokeStyle = ready ? "#1d744c" : "#9a5c19";
          ctx.fillRect(sx, sy, CHUNK_SIZE * view.zoom, CHUNK_SIZE * view.zoom);
          ctx.strokeRect(sx, sy, CHUNK_SIZE * view.zoom, CHUNK_SIZE * view.zoom);
        }
      }
    }
    if (this.propsReady) {
      ctx.save();
      ctx.beginPath();
      for (let cy = this.visible.minCy; cy <= this.visible.maxCy; cy++)
        for (let cx = this.visible.minCx; cx <= this.visible.maxCx; cx++) {
          const chunk = this.chunks.get(`${cx},${cy}`);
          if (this.renderer.isTerrainReady(chunk)) {
            const { sx, sy } = this.camera.worldToScreen(
              cx * CHUNK_SIZE * TILE_SIZE,
              cy * CHUNK_SIZE * TILE_SIZE,
            );
            ctx.rect(sx, sy, CHUNK_SIZE * view.zoom + 1, CHUNK_SIZE * view.zoom + 1);
          }
        }
      ctx.clip();
      const items = collectScene(
        this.actors,
        this.props,
        world,
        this.camera,
        this.visible,
        1,
        this.renderer,
        [],
        false,
      );
      drawScene2D(ctx, this.camera, items, this.assets.sheets, undefined, false, this.renderer);
      ctx.restore();
    }
    this.updateStats();
    ctx.restore();
    return pending;
  }
  private loadAssets(): void {
    if (this.assets || this.loading) return;
    const start = performance.now();
    this.loading = loadTerrainAssets(this.graph)
      .then((assets) => {
        if (this.disposed) {
          closeAssets(assets);
          return;
        }
        this.assets = assets;
        this.renderer.setBlendSheets(assets.blendSheets, this.graph);
        this.renderer.setVariants(assets.variants);
        this.renderer.setRoadSheets(assets.sheets);
        this.stats.assetsMs = performance.now() - start;
        this.loadProps();
        this.changed();
      })
      .catch((error) => {
        this.stats.error = String(error);
        this.loading = null;
        this.changed();
      });
  }
  private loadProps(): void {
    if (!this.assets) return;
    const serial = ++this.propsSerial;
    const assets = this.assets;
    const keys = new Set([
      ...this.props.map((prop) => prop.sprite.sheetKey),
      ...this.actors.flatMap((e) => (e.sprite ? [e.sprite.sheetKey] : [])),
    ]);
    this.propsReady = [...keys].every((key) => assets.sheets.has(key));
    if (this.propsReady) return;
    void loadSceneAssets(assets, keys)
      .then(() => {
        if (this.disposed) {
          closeAssets(assets);
          return;
        }
        if (serial === this.propsSerial) {
          this.propsReady = true;
          this.changed();
        }
      })
      .catch((error) => {
        this.stats.error = String(error);
        this.changed();
      });
  }
  private updateStats(): void {
    this.stats.resident = this.chunks.size;
    this.stats.bytes = [...this.chunks.values()].reduce(
      (total, chunk) =>
        total +
        chunk.subgrid.byteLength +
        chunk.terrain.byteLength +
        chunk.detail.byteLength +
        chunk.collision.byteLength +
        chunk.roadGrid.byteLength +
        chunk.heightGrid.byteLength +
        chunk.blendLayers.byteLength +
        (this.renderer.getTerrainSurface(chunk) ? (CHUNK_SIZE * TILE_SIZE) ** 2 * 4 : 0),
      0,
    );
  }
  private releaseChunks(): void {
    for (const chunk of this.chunks.values()) this.renderer.releaseChunk(chunk);
    this.chunks.clear();
    this.props = [];
    this.actors = [];
    this.propsReady = false;
    this.propsSerial++;
    this.wanted.clear();
    this.renderer = new TileRenderer();
    if (this.assets) {
      this.renderer.setBlendSheets(this.assets.blendSheets, this.graph);
      this.renderer.setVariants(this.assets.variants);
      this.renderer.setRoadSheets(this.assets.sheets);
    }
    this.stats.resident = 0;
    this.stats.ready = 0;
    this.stats.bytes = 0;
  }
  reset(): void {
    this.releaseChunks();
  }
  dispose(): void {
    this.disposed = true;
    this.releaseChunks();
    if (this.assets) closeAssets(this.assets);
    this.assets = null;
  }
}
