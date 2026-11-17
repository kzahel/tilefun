import * as THREE from "three";
import { GpuPages } from "./GpuPages.js";

/** The unified scene's WebGL context and shared page atlas. No 2D world passes. */
export class GpuSceneSurface {
  readonly renderer: THREE.WebGLRenderer;
  readonly pages: GpuPages;
  lost = false;
  disposed = false;
  readonly stats = {
    uploads: 0,
    uploadedBytes: 0,
    drawCalls: 0,
    frames: 0,
    textureBytes: 0,
    textures: 0,
    recoveries: 0,
    atlasLayers: 0,
    atlasBytes: 0,
    atlasMisses: 0,
    stagingBytes: 0,
  };
  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0, 0);
    this.pages = new GpuPages(this.renderer, this.stats, () => {});
    this.resize(canvas.width, canvas.height);
  }
  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
  }
  beginFrame() {
    if (this.disposed) throw Error("Renderer is disposed");
    if (this.lost) return;
    this.stats.frames++;
    this.renderer.setScissorTest(false);
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.pages.beginFrame();
  }
  /** Immediate Three rendering has no queued raster commands. */
  flush() {}
  clearResources() {
    this.pages.clear();
  }
  recover() {
    this.clearResources();
    this.stats.recoveries++;
  }
  dispose() {
    if (this.disposed) return;
    this.clearResources();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.disposed = true;
  }
}
