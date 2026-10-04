import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CAR_PROXY, carProxyPatches, type Point3, sourceUV } from "./CarProxy.js";

export type ProxyView = "source" | "orbit" | "back" | "low";
export interface ProxyOptions {
  view: ProxyView;
  collision: boolean;
  wire: boolean;
  missing: boolean;
}
export interface SourceComparison {
  covered: number;
  sourcePixels: number;
  matching: number;
  extra: number;
}
const toThree = ([x, y, z]: Point3) => new THREE.Vector3(x, z, y);

/** Standalone graphics adapter for neutral proxy geometry. No world/simulation ownership. */
export class CarProxyScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly perspective = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  private readonly sourceCamera = new THREE.OrthographicCamera(
    -32,
    32,
    20 / Math.SQRT2,
    -20 / Math.SQRT2,
    0.1,
    1000,
  );
  private readonly controls: OrbitControls;
  private readonly textured = new THREE.Group();
  private readonly unseen = new THREE.Group();
  private readonly wires = new THREE.Group();
  private readonly collision: THREE.LineSegments;
  private readonly floor: THREE.GridHelper;
  private readonly resources: { dispose(): void }[] = [];
  private readonly observer: ResizeObserver;
  private options: ProxyOptions = { view: "orbit", collision: false, wire: false, missing: true };
  private disposed = false;
  private lost = false;
  private recoveryCount = 0;
  private width = 1;
  private height = 1;
  private readonly texture: THREE.CanvasTexture;
  readonly sourceCanvas: HTMLCanvasElement;
  private readonly onChange = () => this.render();
  private readonly onLost = (event: Event) => {
    event.preventDefault();
    this.lost = true;
    this.canvas.dataset.device = "lost";
  };
  private readonly onRestored = () => {
    if (this.disposed) return;
    this.lost = false;
    this.recoveryCount++;
    this.texture.needsUpdate = true;
    this.renderer.setClearColor(0x111c29, 1);
    this.canvas.dataset.device = "ready";
    this.resize();
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    image: HTMLImageElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x111c29, 1);
    const source = document.createElement("canvas");
    source.width = 64;
    source.height = 40;
    const ctx = source.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw Error("Source canvas unavailable");
    ctx.drawImage(image, ...CAR_PROXY.rect, 0, 0, 64, 40);
    this.sourceCanvas = source;
    this.texture = new THREE.CanvasTexture(source);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.resources.push(this.texture);
    const paint = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: 0.01,
      side: THREE.FrontSide,
    });
    // Diagnostic faces never borrow source pixels from the wrong side of the car.
    const checker = new THREE.DataTexture(
      new Uint8Array([238, 161, 67, 255, 77, 57, 43, 255, 77, 57, 43, 255, 238, 161, 67, 255]),
      2,
      2,
    );
    checker.colorSpace = THREE.SRGBColorSpace;
    checker.magFilter = checker.minFilter = THREE.NearestFilter;
    checker.wrapS = checker.wrapT = THREE.RepeatWrapping;
    checker.needsUpdate = true;
    const missing = new THREE.MeshBasicMaterial({ map: checker, side: THREE.FrontSide });
    const line = new THREE.LineBasicMaterial({
      color: 0x98e4ff,
      depthTest: false,
      transparent: true,
      opacity: 0.7,
    });
    this.resources.push(paint, checker, missing, line);
    for (const patch of carProxyPatches()) {
      const geometry = new THREE.BufferGeometry();
      const positions = patch.vertices.flatMap((p) => [p[0], p[2], p[1]]);
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          patch.vertices.flatMap((p) =>
            patch.textured ? [...sourceUV(p)] : [p[0] / 8, (p[2] + p[1]) / 8],
          ),
          2,
        ),
      );
      // Game Y/Z swap reverses handedness. Quads are wound toward the source.
      geometry.setIndex([0, 2, 1, 0, 3, 2]);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, patch.textured ? paint : missing);
      mesh.name = patch.name;
      (patch.textured ? this.textured : this.unseen).add(mesh);
      const edges = new THREE.EdgesGeometry(geometry);
      const wire = new THREE.LineSegments(edges, line);
      wire.renderOrder = 3;
      this.wires.add(wire);
      this.resources.push(geometry, edges);
    }
    const box = new THREE.BoxGeometry(
      CAR_PROXY.collision.width,
      CAR_PROXY.collision.height,
      CAR_PROXY.collision.depth,
    );
    const boxEdges = new THREE.EdgesGeometry(box);
    box.dispose();
    const boxMaterial = new THREE.LineBasicMaterial({ color: 0xff65c5, depthTest: false });
    this.collision = new THREE.LineSegments(boxEdges, boxMaterial);
    this.collision.position.y = CAR_PROXY.collision.height / 2;
    this.collision.renderOrder = 4;
    this.resources.push(boxEdges, boxMaterial);
    this.floor = new THREE.GridHelper(160, 16, 0x526c81, 0x293d4e);
    this.floor.position.y = -0.5;
    this.resources.push(
      this.floor.geometry,
      ...(Array.isArray(this.floor.material) ? this.floor.material : [this.floor.material]),
    );
    this.scene.add(this.textured, this.unseen, this.wires, this.collision, this.floor);
    this.controls = new OrbitControls(this.perspective, canvas);
    this.controls.target.set(0, 12, 0);
    this.controls.minDistance = 45;
    this.controls.maxDistance = 320;
    this.controls.maxPolarAngle = Math.PI * 0.95;
    this.controls.addEventListener("change", this.onChange);
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    canvas.dataset.device = "ready";
    canvas.dataset.ready = "true";
    this.setOptions(this.options);
    this.resize();
  }
  setOptions(options: ProxyOptions, resetView = false): void {
    if (this.disposed) return;
    const changed = options.view !== this.options.view;
    const initial = this.perspective.position.length() === 0;
    this.options = { ...options };
    this.controls.enabled = options.view !== "source";
    if (changed || initial || resetView) {
      this.controls.target.set(0, 12, 0);
      this.perspective.position.copy(
        toThree(
          options.view === "back"
            ? [70, -100, 65]
            : options.view === "low"
              ? [-90, 90, 16]
              : [-85, 110, 85],
        ),
      );
      this.controls.update();
    }
    this.unseen.visible = options.missing;
    this.wires.visible = options.wire;
    this.collision.visible = options.collision;
    this.floor.visible = options.view !== "source";
    this.canvas.dataset.view = options.view;
    this.render();
  }
  private resize(): void {
    if (this.disposed || this.lost) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.round(bounds.width));
    this.height = Math.max(1, Math.round(bounds.height));
    this.renderer.setSize(this.width, this.height, false);
    this.perspective.aspect = this.width / this.height;
    this.perspective.updateProjectionMatrix();
    const scale = Math.min(this.width / 88, this.height / 66);
    this.setSourceCamera(this.width / scale, this.height / scale);
    this.render();
  }
  private setSourceCamera(width: number, height: number): void {
    const c = this.sourceCamera;
    c.left = -width / 2;
    c.right = width / 2;
    c.top = height / 2 / Math.SQRT2;
    c.bottom = -c.top;
    c.position.set(0, 111, 100);
    c.lookAt(0, 11, 0);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }
  render(): void {
    if (this.disposed || this.lost) return;
    this.renderer.render(
      this.scene,
      this.options.view === "source" ? this.sourceCamera : this.perspective,
    );
    this.canvas.dataset.draws = String(this.renderer.info.render.calls);
    this.canvas.dataset.recoveries = String(this.recoveryCount);
  }
  /** Native-size measurement of textured patches only, without diagnostic surfaces.
   * Captures actual GPU output; the original source is never overlaid as a billboard. */
  compareSource(): SourceComparison {
    const target = new THREE.WebGLRenderTarget(64, 40, { depthBuffer: true });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const pixels = new Uint8Array(64 * 40 * 4);
    const original = this.sourceCanvas.getContext("2d")?.getImageData(0, 0, 64, 40).data;
    if (!original) throw Error("Source pixels unavailable");
    const saved = [
      this.unseen.visible,
      this.wires.visible,
      this.collision.visible,
      this.floor.visible,
    ];
    const oldTarget = this.renderer.getRenderTarget();
    try {
      this.unseen.visible =
        this.wires.visible =
        this.collision.visible =
        this.floor.visible =
          false;
      this.setSourceCamera(64, 40);
      this.renderer.setRenderTarget(target);
      this.renderer.setClearColor(0, 0);
      this.renderer.render(this.scene, this.sourceCamera);
      this.renderer.readRenderTargetPixels(target, 0, 0, 64, 40, pixels);
      let sourcePixels = 0,
        covered = 0,
        matching = 0,
        extra = 0;
      for (let y = 0; y < 40; y++)
        for (let x = 0; x < 64; x++) {
          const s = (y * 64 + x) * 4,
            d = ((39 - y) * 64 + x) * 4;
          if ((original[s + 3] ?? 0) > 0) {
            sourcePixels++;
            if ((pixels[d + 3] ?? 0) > 0) covered++;
            if (
              [0, 1, 2, 3].every(
                (k) => Math.abs((original[s + k] ?? 0) - (pixels[d + k] ?? 0)) <= 1,
              )
            )
              matching++;
          } else if ((pixels[d + 3] ?? 0) > 0) extra++;
        }
      return { sourcePixels, covered, matching, extra };
    } finally {
      this.renderer.setRenderTarget(oldTarget);
      this.renderer.setClearColor(0x111c29, 1);
      target.dispose();
      [this.unseen.visible, this.wires.visible, this.collision.visible, this.floor.visible] =
        saved as [boolean, boolean, boolean, boolean];
      this.resize();
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.controls.removeEventListener("change", this.onChange);
    this.controls.dispose();
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    for (const resource of this.resources) resource.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.dataset.ready = "false";
  }
}
