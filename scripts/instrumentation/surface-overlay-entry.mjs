import { createPlayer } from "../../src/entities/Player.ts";
import { depotBridgeProp } from "../../src/generation/regional/DepotBridge.ts";
import { Camera } from "../../src/rendering/Camera.ts";
import { GpuRenderBackend } from "../../src/rendering/GpuRenderBackend.ts";
import { OverlayFrame } from "../../src/rendering/OverlayFrame.ts";
import { collectSurfacePresentation } from "../../src/rendering/SurfacePresentation.ts";

window.run = () => {
  const referenceCanvas = document.createElement("canvas"),
    canvas = document.querySelector("canvas");
  referenceCanvas.width = referenceCanvas.height = canvas.width = canvas.height = 512;
  const reference = new GpuRenderBackend(referenceCanvas),
    cached = new GpuRenderBackend(canvas);
  const freshCanvas = document.createElement("canvas");
  freshCanvas.width = freshCanvas.height = 512;
  const fresh = new GpuRenderBackend(freshCanvas);
  const readback = document.createElement("canvas");
  readback.width = readback.height = 512;
  const ctx = readback.getContext("2d", { willReadFrequently: true });
  const props = ["west", "deck", "east"].map((name) =>
    depotBridgeProp(`prop-depot-bridge-${name}`, 128, 128),
  );
  const observer = createPlayer(128, 240),
    camera = new Camera();
  camera.setViewport(512, 512);
  const frames = props.map(() => new OverlayFrame());
  let pairs = 0,
    totalMismatchingPixels = 0,
    maxChannelError = 0,
    reused = 0,
    legacyMaxChannelError = 0;
  const comparisons = [];
  const draw = (backend, useCache) => {
    backend.beginFrame();
    backend.submit(camera, { kind: "clear", color: "#365125" });
    for (let i = 0; i < props.length; i++) {
      const frame = frames[i];
      frame.begin();
      collectSurfacePresentation(frame, camera, [props[i]], observer, "all", "all");
      backend.submit(camera, {
        kind: "overlay",
        items: frame.items,
        ...(useCache ? { cacheKey: props[i].collider.surface.id } : {}),
      });
    }
  };
  const compare = (name, warm = false) => {
    const before = cached.getDiagnostics().gpu;
    draw(reference, false);
    draw(cached, true);
    ctx.clearRect(0, 0, 512, 512);
    ctx.drawImage(referenceCanvas, 0, 0);
    const a = ctx.getImageData(0, 0, 512, 512).data;
    ctx.clearRect(0, 0, 512, 512);
    ctx.drawImage(canvas, 0, 0);
    const b = ctx.getImageData(0, 0, 512, 512).data;
    let legacyMismatches = 0,
      legacyMaxError = 0;
    for (let i = 0; i < a.length; i += 4) {
      let error = 0;
      for (let c = 0; c < 4; c++) error = Math.max(error, Math.abs(a[i + c] - b[i + c]));
      if (error) legacyMismatches++;
      legacyMaxError = Math.max(legacyMaxError, error);
    }
    // Cropping can change Skia's AA rounding by 1–2 channels, already allowed
    // by the shared overlay reference contract. Cache reuse itself must be exact
    // against independently rebuilt local rasters at the same current pose.
    fresh.clear();
    draw(fresh, true);
    ctx.clearRect(0, 0, 512, 512);
    ctx.drawImage(freshCanvas, 0, 0);
    const rebuilt = ctx.getImageData(0, 0, 512, 512).data;
    let mismatches = 0,
      maxError = 0;
    for (let i = 0; i < b.length; i += 4) {
      let error = 0;
      for (let c = 0; c < 4; c++) error = Math.max(error, Math.abs(b[i + c] - rebuilt[i + c]));
      if (error) mismatches++;
      maxError = Math.max(maxError, error);
    }
    legacyMaxChannelError = Math.max(legacyMaxChannelError, legacyMaxError);
    const after = cached.getDiagnostics().gpu;
    if (warm) {
      if (
        after.uploads !== before.uploads ||
        after.overlayRasterBuilds !== before.overlayRasterBuilds
      )
        throw Error(`Warm integer pan rebuilt/uploaded ${name}`);
      reused++;
    }
    comparisons.push({ name, mismatches, maxError, legacyMismatches, legacyMaxError });
    pairs++;
    totalMismatchingPixels += mismatches;
    maxChannelError = Math.max(maxChannelError, maxError);
  };
  try {
    for (const zoom of [0.1, 0.25, 0.5, 1]) {
      camera.zoom = zoom;
      camera.pixelSnap = false;
      camera.snapTo(128, 128);
      compare(`bridge at ${zoom}`);
      camera.x += 11 / camera.scale;
      camera.y -= 7 / camera.scale;
      compare(`integer pan at ${zoom}`, true);
      camera.x += 0.25 / camera.scale;
      camera.y += 0.5 / camera.scale;
      compare(`fractional pan at ${zoom}`);
    }
    props[1].collider.surface.thickness += 3;
    compare("edited slab");
    cached.invalidateAssets();
    compare("source invalidation");
    cached.recover();
    compare("context resource recovery");
    camera.x += 10000;
    compare("offscreen culling");
    const culled = cached.getDiagnostics().gpu.overlayRasterCulls;
    camera.x -= 10000;
    compare("return to view");
    const frame = new OverlayFrame();
    frame.rect(4, 4, 16, 16, "#ffaa66");
    for (let i = 0; i < 40; i++) {
      cached.beginFrame();
      cached.submit(camera, { kind: "overlay", items: frame.items, cacheKey: `eviction:${i}` });
    }
    const d = cached.getDiagnostics().gpu;
    const bounded =
      d.overlayRasterCount <= 32 && d.overlayRasterBytes <= 8 * 1024 * 1024 && d.textures <= 32;
    cached.clear();
    if (cached.getDiagnostics().gpu.overlayRasterBytes || cached.getDiagnostics().gpu.textures)
      throw Error("Overlay resources survived realm clear");
    compare("realm reset");
    return {
      pairs,
      totalMismatchingPixels,
      maxChannelError,
      legacyMaxChannelError,
      reused,
      culled,
      bounded,
      comparisons,
      rows: [],
      preview: canvas.toDataURL(),
    };
  } finally {
    reference.dispose();
    cached.dispose();
    fresh.dispose();
  }
};
