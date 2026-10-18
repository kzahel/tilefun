import { Spritesheet } from "../assets/Spritesheet.js";
import { Camera } from "./Camera.js";
import { CanvasRenderBackend } from "./CanvasRenderBackend.js";
import { GpuRenderBackend } from "./GpuRenderBackend.js";
import type { SpriteItem } from "./SceneItem.js";

/** Compare retained groups against independent original draws, including texels,
 * fractional scales, height, camera movement, edits and resource lifecycle. */
export function probeStaticSprites() {
  const make = () => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 240;
    return c;
  };
  const source = make(),
    paint = source.getContext("2d");
  if (!paint) throw Error("Missing test canvas");
  paint.fillStyle = "#483b54";
  paint.fillRect(0, 0, 16, 16);
  for (let x = 0; x < 16; x++) {
    paint.fillStyle = x % 2 ? "#eabd65" : "#719d84";
    paint.fillRect(x, 0, 1, 16);
  }
  paint.fillStyle = "#bbd8f0";
  paint.fillRect(16, 0, 8, 16);
  const sheets = new Map([["test", new Spritesheet(source, 16, 16)]]);
  const camera = new Camera();
  camera.pixelSnap = true;
  camera.setViewport(320, 240);
  const parts = Array.from({ length: 64 }, (_, i) => ({
    frameCol: 0,
    frameRow: 0,
    spriteWidth: 16,
    spriteHeight: 16,
    dx: (i % 8) * 16 - 56,
    dy: Math.floor(i / 8) * 16 - 112,
  }));
  // Transparent paint layered over a fully opaque pavement crop.
  parts.push({ frameCol: 1, frameRow: 0, spriteWidth: 16, spriteHeight: 16, dx: 8, dy: -48 });
  const item: SpriteItem = {
    kind: "sprite",
    wx: -23.5,
    wy: 41.25,
    zOffset: 8,
    drawOffsetY: 3,
    sheetKey: "test",
    frameCol: 0,
    frameRow: 0,
    spriteWidth: 128,
    spriteHeight: 128,
    sortKey: 0,
    flipX: false,
    hasShadow: false,
    shadowFeetWy: 0,
    shadowWidth: 0,
    shadowTerrainZ: 0,
    flashHidden: false,
    parts,
  };
  const reports = [];
  for (const mode of ["canvas", "gpu"] as const) {
    const reference = make(),
      target = make(),
      readback = make().getContext("2d", { willReadFrequently: true });
    const referenceContext = reference.getContext("2d", { willReadFrequently: true });
    const targetContext = mode === "canvas" ? target.getContext("2d") : null;
    if (!referenceContext || !readback) throw Error("Missing test canvas");
    const plain = new CanvasRenderBackend(referenceContext, new Map());
    const backend =
      mode === "gpu"
        ? new GpuRenderBackend(target)
        : new CanvasRenderBackend(targetContext as CanvasRenderingContext2D, new Map());
    plain.setAssets(sheets);
    backend.setAssets(sheets);
    const draw = (advance = true) => {
      if (advance && backend instanceof GpuRenderBackend) backend.beginFrame();
      for (const b of advance ? [plain, backend] : [])
        b.submit(camera, { kind: "clear", color: "#2b3345" });
      const expanded = parts.map((p) => ({
        ...item,
        ...p,
        parts: undefined,
        wx: item.wx + p.dx,
        wy: item.wy + p.dy,
      }));
      plain.submit(camera, { kind: "scene", items: expanded, order: expanded.map((_, i) => i) });
      backend.submit(camera, { kind: "scene", items: [item], order: [0] });
      readback.clearRect(0, 0, 320, 240);
      readback.drawImage(target, 0, 0);
      const actual = readback.getImageData(0, 0, 320, 240).data;
      const expected = referenceContext.getImageData(0, 0, 320, 240).data;
      let mismatches = 0;
      for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) mismatches++;
      return mismatches;
    };
    try {
      for (const zoom of [0.24, 0.33, 0.5, 0.8]) {
        camera.zoom = zoom;
        for (const phase of [0, 0.21, -0.37, 12]) {
          camera.x = phase;
          camera.y = phase;
          draw();
          reports.push({ mode, zoom, phase, mismatches: draw() });
        }
      }
      const before = backend.getDiagnostics().staticSprites;
      backend.resize(320, 240);
      draw();
      const warm = backend.getDiagnostics().staticSprites;
      item.wx += 20;
      draw();
      const sharedPlacement = backend.getDiagnostics().staticSprites;
      item.wx -= 20;
      draw();
      const sharedReuse =
        backend.getDiagnostics().staticSprites?.builds === sharedPlacement?.builds;
      camera.x += 20;
      const beforeMove = backend.getDiagnostics().staticSprites?.builds;
      draw();
      const movingReuse = backend.getDiagnostics().staticSprites?.builds === beforeMove;
      draw();
      // Replace the array just as replicated/editor sprite changes do.
      item.parts = parts.map((p) => ({ ...p, frameCol: 1 }));
      // Use the changed source for the independent reference as well.
      const old = parts.map((p) => ({ ...p }));
      for (const p of parts) p.frameCol = 1;
      const editedMismatch = draw();
      parts.splice(0, parts.length, ...old);
      item.parts = parts;
      const edited = backend.getDiagnostics().staticSprites;
      camera.zoom = 0.05;
      draw();
      draw();
      for (let i = 0; i < 140; i++) {
        item.parts = parts.map((p) => ({ ...p }));
        draw(false);
      }
      const bounded = backend.getDiagnostics().staticSprites;
      item.parts = parts;
      backend.setAssets(sheets);
      const invalidated = backend.getDiagnostics().staticSprites;
      draw();
      draw();
      backend.recover();
      const recovered = backend.getDiagnostics().staticSprites;
      draw();
      draw();
      for (let i = 0; i < 121; i++) backend.submit(camera, { kind: "clear", color: "#000" });
      const evicted = backend.getDiagnostics().staticSprites;
      backend.dispose();
      const disposed = backend.getDiagnostics().staticSprites;
      reports.push({
        mode,
        before,
        warm,
        sharedReuse,
        movingReuse,
        editedMismatch,
        edited,
        bounded,
        invalidated,
        recovered,
        evicted,
        disposed,
      });
    } finally {
      plain.dispose();
      backend.dispose();
    }
  }
  return reports;
}
