import * as THREE from "three";
import { type RasterSurface, rasterRevision } from "./RasterSurface.js";

type Rect = { x: number; y: number; width: number; height: number };
type State = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  globalAlpha: number;
  fillStyle: string | CanvasGradient | CanvasPattern;
  clips: Rect[] | null;
};
interface Page {
  image: CanvasImageSource;
  x: number;
  y: number;
  width: number;
  height: number;
  texture: THREE.Texture;
  source: HTMLCanvasElement;
  revision: number;
  used: number;
}
const PAGE = 1024;
const QUADS = 2048;
const size = (image: CanvasImageSource) => {
  const source = image as HTMLImageElement;
  return {
    width: Number(source.naturalWidth || source.width),
    height: Number(source.naturalHeight || source.height),
  };
};

/** GPU triangle sink for the shared raster rules. No world, entity or simulation reads. */
export class GpuRasterSurface implements RasterSurface {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1);
  private readonly scene = new THREE.Scene();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly vertices = new Float32Array(QUADS * 6 * 8);
  private readonly buffer = new THREE.InterleavedBuffer(this.vertices, 8).setUsage(
    THREE.DynamicDrawUsage,
  );
  private readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly white: THREE.DataTexture;
  private texture: THREE.Texture | null = null;
  private count = 0;
  private frame = 0;
  private readonly pages = new Map<CanvasImageSource, Page[]>();
  private readonly scratch = document.createElement("canvas");
  private readonly colorContext: CanvasRenderingContext2D;
  private readonly colors = new Map<string, readonly number[]>();
  private readonly ellipses = new Map<string, HTMLCanvasElement>();
  private readonly stack: State[] = [];
  private depth = 0;
  private path: Rect[] = [];
  private ellipsePath: number[] | null = null;
  private clips: Rect[] | null = null;
  private a = 1;
  private b = 0;
  private c = 0;
  private d = 1;
  private e = 0;
  private f = 0;
  globalAlpha = 1;
  fillStyle: string | CanvasGradient | CanvasPattern = "#000";
  imageSmoothingEnabled = false;
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
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0, 0);
    this.white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this.white.needsUpdate = true;
    // Raw sampled bytes are already display sRGB; no lighting or tone mapping.
    this.material = new THREE.ShaderMaterial({
      uniforms: { image: { value: this.white } },
      vertexShader: `attribute vec2 point; attribute vec2 tex; attribute vec4 tint;
        varying vec2 uv0; varying vec4 color0;
        void main(){uv0=tex;color0=tint;gl_Position=projectionMatrix*vec4(point,0.,1.);}`,
      fragmentShader: `uniform sampler2D image; varying vec2 uv0; varying vec4 color0;
        void main(){vec4 c=texture2D(image,uv0)*color0;gl_FragColor=vec4(c.rgb*c.a,c.a);}`,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.geometry.setAttribute("point", new THREE.InterleavedBufferAttribute(this.buffer, 2, 0));
    this.geometry.setAttribute("tex", new THREE.InterleavedBufferAttribute(this.buffer, 2, 2));
    this.geometry.setAttribute("tint", new THREE.InterleavedBufferAttribute(this.buffer, 4, 4));
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.scratch.width = this.scratch.height = 1;
    const ctx = this.scratch.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw Error("Color parser unavailable");
    this.colorContext = ctx;
    this.resize(canvas.width, canvas.height);
  }
  resize(width: number, height: number) {
    this.flush();
    this.renderer.setSize(width, height, false);
    this.camera.right = width;
    this.camera.bottom = height;
    this.camera.updateProjectionMatrix();
  }
  beginFrame() {
    this.frame++;
    this.stats.frames++;
    this.count = 0;
    this.texture = null;
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    // LRU cache has both an age limit and a byte budget. Current-frame textures
    // are never retired mid-command; excess residency is collected next frame.
    const cold: Page[] = [];
    for (const pages of this.pages.values()) for (const page of pages) cold.push(page);
    cold.sort((a, b) => a.used - b.used);
    for (const page of cold) {
      if (this.frame - page.used < 2) continue;
      if (this.frame - page.used <= 120 && this.stats.textureBytes <= 64 * 1024 * 1024) continue;
      this.remove(page);
    }
  }
  private remove(page: Page) {
    page.texture.dispose();
    this.stats.textureBytes -= page.width * page.height * 4;
    this.stats.textures--;
    const list = this.pages.get(page.image);
    if (list) {
      list.splice(list.indexOf(page), 1);
      if (!list.length) this.pages.delete(page.image);
    }
  }
  clearResources() {
    this.count = 0;
    this.texture = null;
    for (const pages of this.pages.values()) for (const p of pages) p.texture.dispose();
    this.pages.clear();
    this.ellipses.clear();
    this.stats.textureBytes = 0;
    this.stats.textures = 0;
  }
  recover() {
    this.clearResources();
    this.white.needsUpdate = true;
    this.stats.recoveries++;
  }
  dispose() {
    if (this.disposed) return;
    this.clearResources();
    this.geometry.dispose();
    this.material.dispose();
    this.white.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.disposed = true;
  }
  save() {
    let state = this.stack[this.depth];
    if (!state) {
      state = {} as State;
      this.stack.push(state);
    }
    Object.assign(state, {
      a: this.a,
      b: this.b,
      c: this.c,
      d: this.d,
      e: this.e,
      f: this.f,
      globalAlpha: this.globalAlpha,
      fillStyle: this.fillStyle,
      clips: this.clips,
    });
    this.depth++;
  }
  restore() {
    const s = this.stack[--this.depth];
    if (!s) throw Error("Unbalanced raster restore");
    if (s.clips !== this.clips) this.flush();
    this.a = s.a;
    this.b = s.b;
    this.c = s.c;
    this.d = s.d;
    this.e = s.e;
    this.f = s.f;
    this.globalAlpha = s.globalAlpha;
    this.fillStyle = s.fillStyle;
    this.clips = s.clips;
  }
  translate(x: number, y: number) {
    this.e += this.a * x + this.c * y;
    this.f += this.b * x + this.d * y;
  }
  scale(x: number, y: number) {
    this.a *= x;
    this.b *= x;
    this.c *= y;
    this.d *= y;
  }
  rotate(angle: number) {
    const c = Math.cos(angle),
      s = Math.sin(angle),
      a = this.a,
      b = this.b;
    this.a = a * c + this.c * s;
    this.b = b * c + this.d * s;
    this.c = this.c * c - a * s;
    this.d = this.d * c - b * s;
  }
  beginPath() {
    this.path = [];
    this.ellipsePath = null;
  }
  rect(x: number, y: number, width: number, height: number) {
    this.path.push({
      x: this.a * x + this.e,
      y: this.d * y + this.f,
      width: this.a * width,
      height: this.d * height,
    });
  }
  clip() {
    this.flush();
    this.clips = disjointRects(this.path, this.clips);
  }
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    start: number,
    end: number,
  ) {
    if (rotation || start || end !== Math.PI * 2) throw Error("Unsupported raster ellipse arc");
    this.ellipsePath = [x, y, rx, ry];
  }
  fill() {
    if (!this.ellipsePath) throw Error("Only ellipse fill is supported by the scene sink");
    const [x = 0, y = 0, rx = 0, ry = 0] = this.ellipsePath;
    if (rx <= 0 || ry <= 0) return;
    const width = Math.ceil(rx * 2) + 2,
      height = Math.ceil(ry * 2) + 2;
    const key = `${rx}:${ry}:${String(this.fillStyle)}`;
    let image = this.ellipses.get(key);
    if (!image) {
      if (this.ellipses.size >= 128) this.ellipses.delete(this.ellipses.keys().next().value ?? "");
      image = document.createElement("canvas");
      image.width = width;
      image.height = height;
      const ctx = image.getContext("2d");
      if (!ctx) throw Error("Ellipse canvas unavailable");
      ctx.fillStyle = this.fillStyle;
      ctx.beginPath();
      ctx.ellipse(rx + 1, ry + 1, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      this.ellipses.set(key, image);
    }
    this.drawImage(image, x - rx - 1, y - ry - 1);
  }
  pixelShadow = (cx: number, cy: number, rx: number, ry: number) => {
    this.save();
    this.globalAlpha = 77 / 255;
    this.fillStyle = "#000";
    for (let y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.fillRect(x, y, 1, 1);
    this.restore();
  };
  private color(): readonly number[] {
    if (typeof this.fillStyle !== "string") throw Error("Unsupported scene fill style");
    let color = this.colors.get(this.fillStyle);
    if (!color) {
      this.colorContext.clearRect(0, 0, 1, 1);
      this.colorContext.fillStyle = this.fillStyle;
      this.colorContext.fillRect(0, 0, 1, 1);
      const rgba = this.colorContext.getImageData(0, 0, 1, 1).data;
      color = [
        (rgba[0] ?? 0) / 255,
        (rgba[1] ?? 0) / 255,
        (rgba[2] ?? 0) / 255,
        (rgba[3] ?? 0) / 255,
      ];
      if (this.colors.size >= 128) this.colors.clear();
      this.colors.set(this.fillStyle, color);
    }
    return color;
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.quad(this.white, x, y, w, h, 0, 0, 1, 1, this.color());
  }
  drawImage(image: CanvasImageSource, ...v: number[]) {
    const dim = size(image);
    let sx = 0,
      sy = 0,
      sw = dim.width,
      sh = dim.height,
      dx = 0,
      dy = 0,
      dw = sw,
      dh = sh;
    if (v.length === 2) {
      [dx = 0, dy = 0] = v;
    } else if (v.length === 4) {
      [dx = 0, dy = 0, dw = 0, dh = 0] = v;
    } else if (v.length === 8) {
      [sx = 0, sy = 0, sw = 0, sh = 0, dx = 0, dy = 0, dw = 0, dh = 0] = v;
    } else throw Error("Invalid drawImage arguments");
    if (sw <= 0 || sh <= 0 || dw === 0 || dh === 0) return;
    for (
      let py = Math.floor(Math.max(0, sy) / PAGE) * PAGE;
      py < Math.min(sy + sh, dim.height);
      py += PAGE
    )
      for (
        let px = Math.floor(Math.max(0, sx) / PAGE) * PAGE;
        px < Math.min(sx + sw, dim.width);
        px += PAGE
      ) {
        const x = Math.max(px, sx),
          y = Math.max(py, sy),
          w = Math.min(px + PAGE, sx + sw, dim.width) - x,
          h = Math.min(py + PAGE, sy + sh, dim.height) - y;
        const page = this.page(image, px, py, dim);
        this.quad(
          page.texture,
          dx + ((x - sx) * dw) / sw,
          dy + ((y - sy) * dh) / sh,
          (w * dw) / sw,
          (h * dh) / sh,
          (x - px) / page.width,
          1 - (y - py) / page.height,
          w / page.width,
          -h / page.height,
          [1, 1, 1, 1],
        );
      }
  }
  private page(
    image: CanvasImageSource,
    x: number,
    y: number,
    dim: { width: number; height: number },
  ): Page {
    let pages = this.pages.get(image);
    if (!pages) {
      pages = [];
      this.pages.set(image, pages);
    }
    let page = pages.find((p) => p.x === x && p.y === y);
    if (!page) {
      const source = document.createElement("canvas");
      source.width = Math.min(PAGE, dim.width - x);
      source.height = Math.min(PAGE, dim.height - y);
      const texture = new THREE.Texture(source);
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      page = {
        image,
        x,
        y,
        width: source.width,
        height: source.height,
        texture,
        source,
        revision: -1,
        used: this.frame,
      };
      pages.push(page);
      this.stats.textureBytes += source.width * source.height * 4;
      this.stats.textures++;
    }
    const revision = rasterRevision(image);
    if (page.revision !== revision) {
      this.flush();
      const ctx = page.source.getContext("2d");
      if (!ctx) throw Error("Texture page unavailable");
      ctx.clearRect(0, 0, page.width, page.height);
      ctx.drawImage(image, x, y, page.width, page.height, 0, 0, page.width, page.height);
      page.texture.needsUpdate = true;
      page.revision = revision;
      this.stats.uploads++;
      this.stats.uploadedBytes += page.width * page.height * 4;
    }
    page.used = this.frame;
    return page;
  }
  drawTexture(texture: THREE.Texture, x: number, y: number, w: number, h: number) {
    this.quad(texture, x, y, w, h, 0, 1, 1, -1, [1, 1, 1, 1]);
  }
  private quad(
    texture: THREE.Texture,
    x: number,
    y: number,
    w: number,
    h: number,
    u: number,
    v: number,
    uw: number,
    vh: number,
    color: readonly number[],
  ) {
    if (this.lost || this.disposed) return;
    if (this.texture !== texture || this.count + 6 > QUADS * 6) this.flush();
    this.texture = texture;
    for (const corner of [0, 1, 2, 0, 2, 3]) {
      const right = corner === 1 || corner === 2,
        bottom = corner >= 2;
      const px = x + (right ? w : 0),
        py = y + (bottom ? h : 0),
        i = this.count++ * 8;
      this.vertices[i] = this.a * px + this.c * py + this.e;
      this.vertices[i + 1] = this.b * px + this.d * py + this.f;
      this.vertices[i + 2] = u + (right ? uw : 0);
      this.vertices[i + 3] = v + (bottom ? vh : 0);
      this.vertices[i + 4] = color[0] ?? 1;
      this.vertices[i + 5] = color[1] ?? 1;
      this.vertices[i + 6] = color[2] ?? 1;
      this.vertices[i + 7] = (color[3] ?? 1) * this.globalAlpha;
    }
  }
  flush() {
    if (!this.count) return;
    if (this.lost || this.disposed) {
      this.count = 0;
      return;
    }
    this.geometry.setDrawRange(0, this.count);
    this.buffer.clearUpdateRanges();
    this.buffer.addUpdateRange(0, this.count * 8);
    this.buffer.needsUpdate = true;
    const uniform = this.material.uniforms.image;
    if (uniform) uniform.value = this.texture;
    if (this.clips) {
      this.renderer.setScissorTest(true);
      for (const r of this.clips) {
        this.renderer.setScissor(r.x, this.canvas.height - r.y - r.height, r.width, r.height);
        this.renderer.render(this.scene, this.camera);
        this.stats.drawCalls++;
      }
      this.renderer.setScissorTest(false);
    } else {
      this.renderer.render(this.scene, this.camera);
      this.stats.drawCalls++;
    }
    this.count = 0;
  }
}

/** Rectangle union, partitioned into disjoint strips so translucent pixels blend once. */
export function disjointRects(
  rects: readonly Rect[],
  parent: readonly Rect[] | null = null,
): Rect[] {
  const input: Rect[] = [];
  for (const r of rects)
    for (const p of parent ?? [r]) {
      const x = Math.max(r.x, p.x),
        y = Math.max(r.y, p.y),
        right = Math.min(r.x + r.width, p.x + p.width),
        bottom = Math.min(r.y + r.height, p.y + p.height);
      if (right > x && bottom > y) input.push({ x, y, width: right - x, height: bottom - y });
    }
  const xs = [...new Set(input.flatMap((r) => [r.x, r.x + r.width]))].sort((a, b) => a - b),
    out: Rect[] = [];
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i - 1] ?? 0,
      right = xs[i] ?? 0;
    const ys = input
      .filter((r) => r.x <= x && r.x + r.width >= right)
      .map((r) => [r.y, r.y + r.height])
      .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
    let lo = 0,
      hi = 0,
      active = false;
    for (const pair of ys) {
      const a = pair[0] ?? 0,
        b = pair[1] ?? 0;
      if (active && a > hi) {
        out.push({ x, y: lo, width: right - x, height: hi - lo });
        active = false;
      }
      if (!active) {
        lo = a;
        hi = b;
        active = true;
      } else hi = Math.max(hi, b);
    }
    if (active) out.push({ x, y: lo, width: right - x, height: hi - lo });
  }
  return out;
}
