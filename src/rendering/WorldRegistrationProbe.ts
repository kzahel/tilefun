import { Spritesheet } from "../assets/Spritesheet.js";
import { createLayeredInteriorMap } from "../interiors/LayeredInteriorMap.js";
import { Chunk } from "../world/Chunk.js";
import { Camera } from "./Camera.js";
import { createCanvasRenderHost } from "./CanvasRenderHost.js";
import { createGpuRenderHost } from "./GpuRenderHost.js";
import type { RasterRenderBackend } from "./RasterRenderBackend.js";
import { touchRaster } from "./RasterSurface.js";
import type { ElevationItem, SpriteItem } from "./SceneItem.js";
import type { TileRenderer } from "./TileRenderer.js";

/** Actual host composition, paired stationary registration and followed-actor pixels.
 * Solid landmarks separate placement from animation/sampling ties. A hostile atlas
 * neighbor catches crop bleed. This is deliberately a browser/GPU contract. */
export function probeWorldRegistration() {
  const width = 720,
    height = 480;
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const readback = document.createElement("canvas");
  readback.width = width;
  readback.height = height;
  const read = readback.getContext("2d", { willReadFrequently: true });
  if (!read) throw Error("Registration readback unavailable");
  const sheet = (color: string, crossing = false) => {
    const image = new OffscreenCanvas(crossing ? 1056 : 32, 16),
      paint = image.getContext("2d");
    if (!paint) throw Error("Probe sprite unavailable");
    paint.fillStyle = "#ff0000";
    paint.fillRect(0, 0, image.width, 16);
    paint.fillStyle = color;
    paint.fillRect(crossing ? 1008 : 0, 0, crossing ? 31 : 16, 16);
    return new Spritesheet(image, 16, 16);
  };
  const sheets = new Map([
    ["prop", sheet("#fa7345")],
    ["actor", sheet("#2040ff", true)],
    ["modern-interiors", sheet("#184c18")],
  ]);
  const camera = new Camera();
  camera.setViewport(width, height);
  const reports = [];
  const canvasPixels = new Map<string, Uint8ClampedArray>();
  for (const mode of ["canvas", "gpu"] as const) {
    const host =
      mode === "canvas"
        ? createCanvasRenderHost(output)
        : createGpuRenderHost(output, { meshes: false });
    host.resize(width, height);
    const backend = host.renderer as RasterRenderBackend;
    if (!backend.worldRaster)
      throw Error("Registration requires composed host, including real WebGL");
    backend.setAssets(sheets);
    backend.prepareInterior({ id: 123456, map: createLayeredInteriorMap(1, 1), editable: false });
    try {
      for (const cx of [-1, 0]) {
        const base = cx * 256,
          chunk = new Chunk();
        const range = { minCx: cx, maxCx: cx, minCy: cx, maxCy: cx };
        const world = {
          getChunkIfLoaded: (x: number, y: number) => (x === cx && y === cx ? chunk : undefined),
          getRoadAt: () => 0,
        };
        camera.snapTo(base + 128.13, base + 128.29);
        backend.prepareTerrain(camera, world, range, { scope: "visible", rowBudget: 16 });
        // Lab-only access to the same prepared surface as CameraStabilityProbe.
        const ground = (backend as unknown as { terrain: TileRenderer }).terrain.getTerrainSurface(
          chunk,
        );
        if (!ground) throw Error("Probe terrain unavailable");
        const paint = ground.getContext("2d");
        if (!paint) throw Error("Probe terrain context unavailable");
        paint.fillStyle = "#184c18";
        paint.fillRect(0, 0, 256, 256);
        paint.fillStyle = "#ff0000";
        paint.fillRect(80, 112, 7, 11);
        touchRaster(ground);
        const prop: SpriteItem = {
          kind: "sprite",
          sortKey: 106,
          wx: base + 88.13,
          wy: base + 106.29,
          zOffset: 0,
          drawOffsetY: 0,
          sheetKey: "prop",
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
        };
        const actor = { ...prop, sheetKey: "actor", subpixel: true, frameCol: 63, spriteWidth: 31 };
        for (const zoom of [0.4, 0.5, 0.8, 1, 1.3]) {
          camera.zoom = zoom;
          const interior = cx === -1 && zoom === 0.5;
          const positions = [];
          let actorParityError = 0;
          for (const phase of [0, 0.2, 0.4, 0.6, 0.8, 1.2, 2.4]) {
            camera.x = base + 128.13 + phase / camera.scale;
            camera.y = base + 128.29 - phase / camera.scale;
            actor.wx = camera.x + 100 / camera.scale;
            actor.wy = camera.y + 80 / camera.scale;
            host.beginFrame();
            host.beginWorld(camera);
            backend.submit(camera, { kind: "clear", color: "#184c18" });
            const terrainDraws = backend.collectTerrain(camera, world, range);
            backend.submit(camera, { kind: "terrain", draws: terrainDraws });
            const resource = terrainDraws[0]?.resource;
            if (resource === undefined) throw Error("Missing terrain resource");
            const elevation: ElevationItem = {
              kind: "elevation",
              sortKey: 128,
              phase: "surface",
              wx: base + 180,
              wy: base + 128,
              terrainResource: resource,
              srcX: 80,
              srcY: 112,
              height: 1,
            };
            backend.submit(camera, {
              kind: "scene",
              items: [prop, actor, elevation],
              order: interior ? [2, 0] : [2, 0, 1],
            });
            if (interior)
              backend.submit(camera, {
                kind: "interior",
                contentId: 123456,
                draws: [{ kind: "scene", item: actor, shadow: false, offsetY: 0 }],
              });
            host.endWorld();
            host.uiContext.fillStyle = "#fff";
            host.uiContext.fillRect(1, 1, 2, 2);
            if (camera.pixelSnap) throw Error("World scope leaked into picking/HUD");
            read.clearRect(0, 0, width, height);
            read.drawImage(host.captureFrame?.() ?? output, 0, 0);
            const pixels = read.getImageData(0, 0, width, height).data;
            const ui = (width + 1) * 4;
            if ([0, 1, 2, 3].some((channel) => pixels[ui + channel] !== 255))
              throw Error("HUD/capture moved with the world frame");
            const crop = read.getImageData(
              Math.floor(width / 2 + 100 - 16 * camera.scale) - 3,
              Math.floor(height / 2 + 80 - 16 * camera.scale) - 3,
              Math.ceil(32 * camera.scale) + 7,
              Math.ceil(16 * camera.scale) + 7,
            ).data;
            const key = `${cx}:${zoom}:${phase}`;
            if (mode === "canvas") canvasPixels.set(key, crop);
            else {
              const expected = canvasPixels.get(key);
              if (!expected) throw Error("Missing Canvas actor reference");
              for (let i = 0; i < crop.length; i++)
                actorParityError = Math.max(
                  actorParityError,
                  Math.abs((crop[i] ?? 0) - (expected[i] ?? 0)),
                );
            }
            let propMass = 0,
              propX = 0,
              terrainMass = 0,
              terrainX = 0,
              actorMass = 0,
              actorX = 0,
              actorY = 0,
              elevationMass = 0,
              elevationX = 0,
              bleed = 0;
            for (let y = 8; y < height - 8; y++)
              for (let x = 8; x < width - 8; x++) {
                const i = (y * width + x) * 4,
                  r = pixels[i] ?? 0,
                  g = pixels[i + 1] ?? 0,
                  b = pixels[i + 2] ?? 0;
                if (x < width / 2) {
                  const orange = Math.max(0, b - 24);
                  propMass += orange;
                  propX += orange * (x + 0.5);
                  // Red and orange occupy separate vertical bands.
                  const red =
                    y > height / 2 - 17 * camera.scale + phase - 3 ? Math.max(0, 76 - g) : 0;
                  terrainMass += red;
                  terrainX += red * (x + 0.5);
                } else {
                  const blue = Math.max(0, b - 24);
                  actorMass += blue;
                  actorX += blue * (x + 0.5);
                  actorY += blue * (y + 0.5);
                  if (y > height / 2 + 80 - 16 * camera.scale - 3) bleed = Math.max(bleed, r - 32);
                  else {
                    // Reject both ordinary and darkened green, so a crop through
                    // the slab's darkened background cannot move the red centroid.
                    const raised = Math.max(0, r * 76 - 24 * g);
                    elevationMass += raised;
                    elevationX += raised * (x + 0.5);
                  }
                }
              }
            if (!propMass || !terrainMass || !actorMass || !elevationMass)
              throw Error("Missing registration landmark");
            positions.push({
              phase,
              relativeX: propX / propMass - terrainX / terrainMass,
              elevationX: elevationX / elevationMass - terrainX / terrainMass,
              actorX: actorX / actorMass,
              actorY: actorY / actorMass,
              bleed,
            });
          }
          const span = (values: number[]) => Math.max(...values) - Math.min(...values);
          reports.push({
            mode,
            interior,
            cx,
            zoom,
            relativeRange: span(positions.map((p) => p.relativeX)),
            elevationRange: span(positions.map((p) => p.elevationX)),
            actorXRange: span(positions.map((p) => p.actorX)),
            actorYRange: span(positions.map((p) => p.actorY)),
            bleed: Math.max(...positions.map((p) => p.bleed)),
            actorParityError,
            positions,
          });
        }
        backend.releaseChunk(chunk);
      }
    } finally {
      host.endWorld();
      host.dispose();
    }
  }
  return reports;
}
