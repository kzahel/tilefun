import type { Spritesheet } from "../assets/Spritesheet.js";
import { bedFramePoint, bedGateAngle, DUMP_BED } from "../traffic/VehicleBed.js";
import type { Camera } from "./Camera.js";
import triangles from "./dump-truck-v2-fallback.json" with { type: "json" };
import type { RasterSurface } from "./RasterSurface.js";
import type { SpriteItem } from "./SceneItem.js";

const size = 256,
  half = size / 2;
type Surface = HTMLCanvasElement | OffscreenCanvas;
const resources = new WeakMap<object, { pixels: Uint8ClampedArray; poses: Map<string, Surface> }>();
function canvas(): Surface {
  return typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(size, size)
    : Object.assign(document.createElement("canvas"), { width: size, height: size });
}

/** Software depth raster of retained v2 triangles/UVs. Canvas, disabled WebGL
 * meshes and failed GLB loads show the same articulated parts, without WebGL.
 * Bounded pose cache belongs to the atlas image, so asset replacement retires it. */
export function drawDumpTruckFallback(
  ctx: RasterSurface,
  camera: Camera,
  item: SpriteItem,
  sheets: Map<string, Spritesheet>,
) {
  if (item.mesh?.assetId !== "dump-truck-authored-v2" || !(item.mesh.bedTilt ?? 0)) return false;
  const atlas = sheets.get("dump-truck-v2-atlas")?.image;
  if (!atlas) return false;
  let resource = resources.get(atlas);
  if (!resource) {
    const source = canvas();
    source.width = source.height = 512;
    const c = source.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
    c.drawImage(atlas, 0, 0);
    resource = { pixels: c.getImageData(0, 0, 512, 512).data, poses: new Map() };
    resources.set(atlas, resource);
  }
  const heading = 2 * Math.atan2(item.mesh.orientation[2], item.mesh.orientation[3]);
  const tilt = (Math.round(((item.mesh.bedTilt ?? 0) * 180) / Math.PI) * Math.PI) / 180;
  const key = `${Math.round((heading * 180) / Math.PI)}:${Math.round((tilt * 180) / Math.PI)}`;
  let output = resource.poses.get(key);
  if (!output) {
    output = canvas();
    const context = output.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
    const image = context.createImageData(size, size),
      pixels = image.data,
      depth = new Float32Array(size * size).fill(-Infinity);
    const pose = {
      id: 0,
      type: "vehicle-v1:dump-truck",
      vehicleBed: true as const,
      vehicleBedTilt: tilt,
      vehicleHeading: heading,
      position: { wx: 0, wy: 0 },
      collider: null,
    };
    const gate = bedGateAngle(pose),
      c = Math.cos(heading),
      s = Math.sin(heading);
    for (const row of triangles.triangles) {
      const part = row[0] ?? 0;
      const points = [];
      for (let i = 1; i < 16; i += 5) {
        let x = row[i] ?? 0,
          y = row[i + 1] ?? 0,
          z = row[i + 2] ?? 0;
        if (part === 2) {
          const dx = x - DUMP_BED.gateHinge.x,
            dz = z - DUMP_BED.gateHinge.z;
          x = DUMP_BED.gateHinge.x + Math.cos(gate) * dx + Math.sin(gate) * dz;
          z = DUMP_BED.gateHinge.z - Math.sin(gate) * dx + Math.cos(gate) * dz;
        }
        if (part === 3) {
          const scale = 400 / 23,
            baseX = 0.4 * scale,
            baseZ = 0.64 * scale,
            dx = -0.75 * scale,
            dz = 0.505 * scale;
          const end = bedFramePoint(
            { ...pose, vehicleHeading: 0 },
            -0.35 * scale,
            y,
            1.145 * scale,
          );
          const ex = end.wx - baseX,
            ez = end.wz - baseZ,
            t = ((x - baseX) * dx + (z - baseZ) * dz) / (dx * dx + dz * dz);
          const rx = x - baseX - t * dx,
            rz = z - baseZ - t * dz,
            a = Math.atan2(ez, ex) - Math.atan2(dz, dx);
          x = baseX + t * ex + Math.cos(a) * rx - Math.sin(a) * rz;
          z = baseZ + t * ez + Math.sin(a) * rx + Math.cos(a) * rz;
        }
        if (part === 1 || part === 2) {
          const p = bedFramePoint(pose, x, y, z);
          x = p.wx;
          y = p.wy;
          z = p.wz;
        } else {
          const xx = x * c - y * s;
          y = x * s + y * c;
          x = xx;
        }
        points.push({
          x: half + x,
          y: half + y - z,
          d: y + z,
          u: row[i + 3] ?? 0,
          v: row[i + 4] ?? 0,
        });
      }
      const [a, b, d] = points;
      if (!a || !b || !d) continue;
      const area = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
      if (Math.abs(area) < 1e-8) continue;
      for (
        let py = Math.max(0, Math.floor(Math.min(a.y, b.y, d.y)));
        py < Math.min(size, Math.ceil(Math.max(a.y, b.y, d.y)));
        py++
      )
        for (
          let px = Math.max(0, Math.floor(Math.min(a.x, b.x, d.x)));
          px < Math.min(size, Math.ceil(Math.max(a.x, b.x, d.x)));
          px++
        ) {
          const x = px + 0.5,
            y = py + 0.5;
          const w1 = ((b.x - x) * (d.y - y) - (b.y - y) * (d.x - x)) / area;
          const w2 = ((d.x - x) * (a.y - y) - (d.y - y) * (a.x - x)) / area,
            w3 = 1 - w1 - w2;
          if (w1 < -1e-7 || w2 < -1e-7 || w3 < -1e-7) continue;
          const z = w1 * a.d + w2 * b.d + w3 * d.d,
            index = py * size + px;
          if (z < (depth[index] ?? -Infinity)) continue;
          depth[index] = z;
          const u = Math.max(0, Math.min(511, Math.floor((w1 * a.u + w2 * b.u + w3 * d.u) * 512)));
          const v = Math.max(
            0,
            Math.min(511, Math.floor((1 - w1 * a.v - w2 * b.v - w3 * d.v) * 512)),
          );
          const src = (v * 512 + u) * 4,
            at = index * 4;
          pixels[at] = resource.pixels[src] ?? 0;
          pixels[at + 1] = resource.pixels[src + 1] ?? 0;
          pixels[at + 2] = resource.pixels[src + 2] ?? 0;
          pixels[at + 3] = 255;
        }
    }
    const alpha = new Uint8Array(size * size);
    for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3] ?? 0;
    for (let y = 1; y < size - 1; y++)
      for (let x = 1; x < size - 1; x++) {
        const i = y * size + x,
          at = i * 4;
        if (
          alpha[i] &&
          (!alpha[i - 1] || !alpha[i + 1] || !alpha[i - size] || !alpha[i + size]) &&
          (pixels[at] ?? 0) + (pixels[at + 1] ?? 0) + (pixels[at + 2] ?? 0) > 196
        ) {
          pixels[at] = 58;
          pixels[at + 1] = 58;
          pixels[at + 2] = 80;
        }
      }
    context.putImageData(image, 0, 0);
    if (resource.poses.size >= 12) resource.poses.delete(resource.poses.keys().next().value ?? "");
    resource.poses.set(key, output);
  }
  const anchor = camera.worldToScreen(item.wx, item.wy - item.zOffset);
  ctx.save();
  ctx.globalAlpha = item.alpha ?? 1;
  ctx.drawImage(
    output,
    Math.floor(anchor.sx - half * camera.scale),
    Math.floor(anchor.sy - half * camera.scale),
    size * camera.scale,
    size * camera.scale,
  );
  ctx.restore();
  return true;
}
