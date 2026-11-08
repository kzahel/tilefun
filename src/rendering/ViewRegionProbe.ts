import { Spritesheet } from "../assets/Spritesheet.js";
import { Camera } from "./Camera.js";
import { createCanvasRenderHost } from "./CanvasRenderHost.js";
import { createGpuRenderHost } from "./GpuRenderHost.js";
import type { RasterRenderBackend } from "./RasterRenderBackend.js";
import type { RenderHost } from "./RenderHost.js";
import type { SpriteItem } from "./SceneItem.js";
import { type LayoutView, layoutViews, type RenderRegion, type ViewLayout } from "./ViewLayout.js";

const COLORS = ["#184c18", "#4c1818", "#18184c", "#4c4c18"];
const LAYOUTS: readonly ViewLayout[] = ["2", "4", "diagonal"];

/**
 * Split views on the real Canvas and GPU hosts (226): every view composed into
 * its region must show exactly what a single view of that size shows (same
 * camera, same sub-pixel offset), with no neighbour bleed at region edges or
 * across the diagonal, and changing regions must not create GL objects.
 * Deliberately a browser/GPU contract; the region maths have Node tests.
 */
export function probeViewRegions() {
  const width = 321,
    height = 201;
  const output = document.createElement("canvas");
  // Attached, so the GPU host places its world canvas beside it (counted below).
  output.style.cssText = "position:fixed;left:-10000px;top:0;";
  document.body.append(output);
  const readback = document.createElement("canvas");
  const read = readback.getContext("2d", { willReadFrequently: true });
  if (!read) throw Error("Region readback unavailable");
  const sheets = probeSheets();
  const pixels = (host: RenderHost, w: number, h: number) => {
    readback.width = w;
    readback.height = h;
    read.clearRect(0, 0, w, h);
    read.drawImage(host.captureFrame?.() ?? output, 0, 0);
    return read.getImageData(0, 0, w, h).data;
  };
  const reports = [];
  for (const mode of ["canvas", "gpu"] as const) {
    const host =
      mode === "canvas"
        ? createCanvasRenderHost(output)
        : createGpuRenderHost(output, { meshes: false });
    if (mode === "gpu" && output.dataset.renderer !== "gpu")
      throw Error("Region probe requires real WebGL");
    (host.renderer as RasterRenderBackend).setAssets(sheets);
    const camera = new Camera();
    try {
      for (const layout of LAYOUTS) {
        const views = layoutViews(layout, width, height);
        // References: each view alone on a canvas of its region's size.
        const references = views.map((view, i) => {
          host.resize(view.region.width, view.region.height);
          host.beginFrame();
          draw(host, camera, view, i, false);
          return pixels(host, view.region.width, view.region.height);
        });
        host.resize(width, height);
        host.beginFrame();
        for (const [i, view] of views.entries()) draw(host, camera, view, i, true);
        const frame = pixels(host, width, height);
        let compared = 0,
          mismatches = 0,
          worst = 0;
        for (const [i, { region }] of views.entries()) {
          const reference = references[i];
          if (!reference) throw Error("Missing reference view");
          const result = compareRegion(frame, width, reference, region);
          compared += result.compared;
          mismatches += result.mismatches;
          worst = Math.max(worst, result.worst);
        }
        reports.push({ mode, layout, compared, mismatches, worst });
      }
      // Changing regions in a running frame loop creates no textures or framebuffers.
      const created = countGlCreation(output, mode);
      for (const layout of [...LAYOUTS, ...LAYOUTS]) {
        host.beginFrame();
        for (const [i, view] of layoutViews(layout, width, height).entries())
          draw(host, camera, view, i, true);
      }
      reports.push({ mode, layout: "resizing regions", glObjects: created() });
    } finally {
      host.dispose();
    }
  }
  output.remove();
  return reports;
}

function probeSheets() {
  const image = new OffscreenCanvas(16, 16),
    paint = image.getContext("2d");
  if (!paint) throw Error("Probe sprite unavailable");
  paint.fillStyle = "#2040ff";
  paint.fillRect(0, 0, 16, 16);
  paint.fillStyle = "#ffd020";
  paint.fillRect(0, 0, 5, 5); // An asymmetric corner catches flips.
  return new Map([["actor", new Spritesheet(image, 16, 16)]]);
}

const actor = (wx: number, wy: number): SpriteItem => ({
  kind: "sprite",
  sortKey: wy,
  wx,
  wy,
  zOffset: 0,
  drawOffsetY: 0,
  sheetKey: "actor",
  frameCol: 0,
  frameRow: 0,
  spriteWidth: 16,
  spriteHeight: 16,
  flipX: false,
  hasShadow: false,
  shadowFeetWy: 0,
  shadowWidth: 0,
  shadowTerrainZ: 0,
  flashHidden: false,
  subpixel: true,
});

/** View i: its camera puts its actor at the view's focus, off the pixel grid, over
 * its own clear colour; drawn alone (`beginWorld`) or as a split view. */
function draw(host: RenderHost, camera: Camera, view: LayoutView, i: number, split: boolean) {
  camera.zoom = 0.8;
  camera.setViewport(view.region.width, view.region.height);
  const ax = 400 * i + 0.37,
    ay = 300 * i + 0.61;
  camera.snapTo(
    ax + (view.region.width / 2 - view.focusX) / camera.scale,
    ay + (view.region.height / 2 - view.focusY) / camera.scale,
  );
  if (split) host.beginView(camera, view.region);
  else host.beginWorld(camera);
  host.renderer.submit(camera, { kind: "clear", color: COLORS[i] ?? "#000" });
  host.renderer.submit(camera, { kind: "scene", items: [actor(ax, ay + 8)], order: [0] });
  if (split) host.endView();
  else host.endWorld();
}

/** Compare a region of the split frame with its single-view reference. Diagonal
 * edges are antialiased on Canvas, so pixels within 1.5 px of the split line are
 * skipped. */
function compareRegion(
  frame: Uint8ClampedArray,
  width: number,
  reference: Uint8ClampedArray,
  r: RenderRegion,
) {
  const [a, b, c] = r.mask ?? [0, 0, 1];
  const norm = Math.hypot(a, b) || 1;
  let compared = 0,
    mismatches = 0,
    worst = 0;
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++) {
      if (r.mask && (a * (r.x + x + 0.5) + b * (r.y + y + 0.5) + c) / norm < 1.5) continue;
      const p = ((r.y + y) * width + r.x + x) * 4,
        q = (y * r.width + x) * 4;
      let error = 0;
      for (let k = 0; k < 4; k++)
        error = Math.max(error, Math.abs((frame[p + k] ?? 0) - (reference[q + k] ?? 0)));
      worst = Math.max(worst, error);
      compared++;
      if (error > 2) mismatches++;
    }
  return { compared, mismatches, worst };
}

/** Count GL object creation on the GPU host's world canvas (none for Canvas). */
function countGlCreation(output: HTMLCanvasElement, mode: "canvas" | "gpu"): () => number {
  if (mode === "canvas") return () => 0;
  const world = output.previousElementSibling;
  const gl =
    world instanceof HTMLCanvasElement && world.dataset.renderer === "gpu"
      ? (world.getContext("webgl2") as WebGL2RenderingContext | null)
      : null;
  if (!gl) throw Error("GPU world context unavailable for counting");
  let count = 0;
  const restore: (() => void)[] = [];
  for (const name of ["createTexture", "createFramebuffer", "createRenderbuffer"] as const) {
    const original = gl[name];
    gl[name] = ((...args: never[]) => {
      count++;
      return (original as (...args: never[]) => unknown).apply(gl, args);
    }) as never;
    restore.push(() => {
      gl[name] = original as never;
    });
  }
  return () => {
    for (const undo of restore) undo();
    return count;
  };
}
