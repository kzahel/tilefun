// Exercise the shipping body adapter with cache disabled/cold/warm, in full Chromium.
import { AUTHORED_VEHICLE_MESHES } from "../../src/rendering/AuthoredVehicleMeshes.ts";
import { Camera } from "../../src/rendering/Camera.ts";
import { GpuMeshBodies } from "../../src/rendering/GpuMeshBodies.ts";
import { GpuRasterSurface } from "../../src/rendering/GpuRasterSurface.ts";
import { vehiclePaint } from "../../src/traffic/VehiclePaint.ts";

const canvas = document.querySelector("canvas"),
  surface = new GpuRasterSurface(canvas);
const bodies = new GpuMeshBodies(surface),
  camera = new Camera();
camera.setViewport(512, 512);
bodies.setEnabled(true);
function frame(item, scale, clip) {
  camera.zoom = scale / 3;
  camera.x = 0.25;
  camera.y = -0.75;
  surface.beginFrame();
  bodies.beginFrame();
  surface.fillStyle = "#596d7d";
  surface.fillRect(0, 0, 512, 512);
  surface.fillStyle = "#c5a467";
  surface.fillRect(120.25, 170.75, 260, 32);
  surface.save();
  if (clip) {
    surface.beginPath();
    surface.rect(0, 0, 278, 512);
    surface.clip();
  }
  for (const body of Array.isArray(item) ? item : [item]) {
    if (typeof body === "function") body();
    else if (!bodies.draw(camera, body)) throw Error("Body unavailable");
  }
  surface.restore();
  surface.globalAlpha = 0.6;
  surface.fillStyle = "#3c9b7e";
  surface.fillRect(240.5, 240.25, 90, 100);
  surface.globalAlpha = 1;
  surface.flush();
  const gl = surface.renderer.getContext(),
    pixels = new Uint8Array(512 * 512 * 4);
  gl.readPixels(0, 0, 512, 512, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  if (gl.getError()) throw Error("GL error");
  return pixels;
}
window.run = async () => {
  let pairs = 0,
    totalMismatchingPixels = 0,
    maxChannelError = 0,
    cachedRenderCalls = 0;
  const rows = [];
  try {
    for (const [name, paint] of [
      ["compact-1"],
      ["fire-truck-ladder-2"],
      ["dump-truck"],
      ["beetle"],
      ["beetle", "cherry"],
      ["beetle", "teal"],
    ]) {
      const def = AUTHORED_VEHICLE_MESHES.find((d) => d.vehicle === name);
      if (!def) throw Error(name);
      const item = {
        kind: "sprite",
        wx: 0,
        wy: 0,
        zOffset: 0,
        sortKey: 0,
        mesh: {
          assetId: def.assetId,
          paintSchemeId: paint,
          radius: def.radius,
          orientation: [0, 0, 0, 1],
        },
      };
      // Let ordinary lazy publication cross a frame boundary.
      for (let i = 0; i < 2000; i++) {
        surface.beginFrame();
        bodies.beginFrame();
        if (bodies.draw(camera, item)) break;
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (i === 1999) throw Error(`Load timeout: ${name}`);
      }
      for (const yaw of [0, 0.57])
        for (const scale of [0.3, 0.75, 3])
          for (const alpha of [1, 0.65])
            for (const clip of [false, true]) {
              item.alpha = alpha;
              item.mesh.orientation = [0, 0, Math.sin(yaw / 2), Math.cos(yaw / 2)];
              item.mesh.wheelTravel = 17;
              item.mesh.bedTilt = name === "dump-truck" ? 0.4 : 0;
              item.mesh.bedGateAngle = 0.2;
              bodies.images.clear();
              bodies.images.enabled = false;
              const reference = frame(item, scale, clip);
              bodies.images.enabled = true;
              frame(item, scale, clip);
              frame(item, scale, clip);
              const before = bodies.drawCalls,
                actual = frame(item, scale, clip);
              cachedRenderCalls += bodies.drawCalls - before;
              bodies.recover();
              const recovered = frame(item, scale, clip);
              if (recovered.some((value, i) => value !== reference[i]))
                throw Error("Recovery changed pixels");
              let mismatches = 0;
              for (let i = 0; i < actual.length; i += 4) {
                let wrong = false;
                for (let c = 0; c < 4; c++) {
                  const delta = Math.abs(actual[i + c] - reference[i + c]);
                  maxChannelError = Math.max(maxChannelError, delta);
                  wrong ||= delta !== 0;
                }
                if (wrong) mismatches++;
              }
              totalMismatchingPixels += mismatches;
              pairs++;
            }
      rows.push({ name, paint, path: def.path });
      const scheme = vehiclePaint(name, paint);
      if (scheme) rows.push({ name, path: scheme.atlas });
    }
    let bypassVerified = 0;
    const compact = AUTHORED_VEHICLE_MESHES.find((d) => d.vehicle === "compact-1");
    const fire = AUTHORED_VEHICLE_MESHES.find((d) => d.vehicle === "fire-truck-ladder-2");
    const base = {
      kind: "sprite",
      wx: 0,
      wy: 0,
      zOffset: 0,
      sortKey: 0,
      mesh: { assetId: fire.assetId, radius: fire.radius, orientation: [0, 0, 0, 1] },
    };
    const child = {
      ...base,
      wx: 60,
      mesh: { assetId: compact.assetId, radius: compact.radius, orientation: [0, 0, 0, 1] },
    };
    for (const item of [
      { ...base, mesh: { ...base.mesh, emergencyEnabled: true, presentationTime: 0.3 } },
      { ...base, bedGroup: { heading: 0, contents: [] } },
      { ...base, towGroup: child },
    ]) {
      bodies.images.clear();
      bodies.images.enabled = false;
      const reference = frame(item, 0.75, true);
      bodies.images.enabled = true;
      frame(item, 0.75, true);
      frame(item, 0.75, true);
      const before = bodies.drawCalls,
        actual = frame(item, 0.75, true);
      if (
        bodies.drawCalls === before ||
        bodies.images.size !== 0 ||
        actual.some((value, i) => value !== reference[i])
      )
        throw Error("Unsafe group reuse");
      bypassVerified++;
    }
    // A queued cached image must submit before a later dirty body evicts it.
    bodies.images.clear();
    bodies.images.maxEntries = 1;
    bodies.images.enabled = false;
    surface.setBatchTextureLimit(1);
    bodies.deferCachedImages = false;
    const a = { ...base, wx: -12 },
      b = { ...child, wx: 16 };
    const reference = frame([b, a], 0.75, false);
    bodies.images.enabled = true;
    bodies.deferCachedImages = true;
    surface.setBatchTextureLimit(8);
    frame([a, b], 0.75, false);
    frame([a, b], 0.75, false);
    const hits = bodies.images.hits;
    const actual = frame([b, a], 0.75, false);
    if (
      bodies.images.hits !== hits + 1 ||
      bodies.images.size !== 1 ||
      actual.some((value, i) => value !== reference[i])
    )
      throw Error("Deferred image eviction changed pixels");
    const beforeDisable = frame([a], 0.75, false);
    const disabled = frame([a, () => bodies.setEnabled(false)], 0.75, false);
    if (bodies.images.size !== 0 || disabled.some((value, i) => value !== beforeDisable[i]))
      throw Error("Disabling meshes discarded queued car pixels");
    return {
      pairs,
      totalMismatchingPixels,
      maxChannelError,
      cachedRenderCalls,
      rows,
      cacheHits: bodies.images.hits,
      bypassVerified,
      deferredEvictionVerified: true,
      disableDrainVerified: true,
      preview: canvas.toDataURL(),
    };
  } finally {
    bodies.dispose();
    surface.dispose();
  }
};
