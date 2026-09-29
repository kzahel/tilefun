import { type GameAssets, loadTerrainAssets } from "../assets/GameAssets.js";
import { computeChunkSubgridBlend } from "../autotile/Autotiler.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { CHUNK_SIZE, PIXEL_SCALE, TILE_SIZE } from "../config/constants.js";
import { descriptorKey, type GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import { Camera } from "../rendering/Camera.js";
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
        chunk.renderCache = null;
        this.chunks.delete(coordinateKey);
      }
    }
    this.updateStats();
    return missing;
  }
  accept(chunks: { cx: number; cy: number; data: ChunkData }[]): void {
    if (!this.active || this.disposed) return;
    for (const item of chunks) {
      const key = `${item.cx},${item.cy}`;
      if (this.wanted.has(key)) this.chunks.set(key, hydrateChunk(item.data));
    }
    const start = performance.now();
    for (let cy = this.visible.minCy; cy <= this.visible.maxCy; cy++) {
      for (let cx = this.visible.minCx; cx <= this.visible.maxCx; cx++) {
        const chunk = this.chunks.get(`${cx},${cy}`);
        if (chunk && !chunk.autotileComputed) {
          computeChunkSubgridBlend(chunk, this.graph);
          chunk.autotileComputed = true;
          chunk.dirty = true;
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
    this.renderer.drawTerrain(
      ctx,
      this.camera,
      {
        getChunkIfLoaded: (cx, cy) => this.chunks.get(`${cx},${cy}`),
        getRoadAt: (tx, ty) =>
          this.chunks
            .get(`${Math.floor(tx / CHUNK_SIZE)},${Math.floor(ty / CHUNK_SIZE)}`)
            ?.getRoad(
              ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
              ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
            ) ?? 0,
      },
      this.assets.sheets,
      this.visible,
      true,
      32,
    );
    let pending = false;
    this.stats.ready = 0;
    for (let cy = this.visible.minCy; cy <= this.visible.maxCy; cy++) {
      for (let cx = this.visible.minCx; cx <= this.visible.maxCx; cx++) {
        const chunk = this.chunks.get(`${cx},${cy}`);
        const ready = !!chunk?.renderCache && !chunk.dirty;
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
    this.updateStats();
    ctx.restore();
    return pending;
  }
  private loadAssets(): void {
    if (this.assets || this.loading) return;
    const start = performance.now();
    this.loading = loadTerrainAssets(this.graph)
      .then((assets) => {
        if (this.disposed) return;
        this.assets = assets;
        this.renderer.setBlendSheets(assets.blendSheets, this.graph);
        this.renderer.setVariants(assets.variants);
        this.renderer.setRoadSheets(assets.sheets);
        this.stats.assetsMs = performance.now() - start;
        this.changed();
      })
      .catch((error) => {
        this.stats.error = String(error);
        this.loading = null;
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
        chunk.collision.byteLength +
        chunk.roadGrid.byteLength +
        chunk.heightGrid.byteLength +
        chunk.blendLayers.byteLength +
        (chunk.renderCache ? (CHUNK_SIZE * TILE_SIZE) ** 2 * 4 : 0),
      0,
    );
  }
  private releaseChunks(): void {
    for (const chunk of this.chunks.values()) chunk.renderCache = null;
    this.chunks.clear();
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
  dispose(): void {
    this.disposed = true;
    this.releaseChunks();
    this.assets = null;
  }
}
