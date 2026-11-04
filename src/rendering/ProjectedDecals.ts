import type { Entity } from "../entities/Entity.js";
import { type BodyRotation, rotateBodyVector, yawRotation } from "../physics/BodyRotation.js";
import { physicsBodyDimensions } from "../physics/PhysicsBodies.js";
import type { Camera } from "./Camera.js";
import { projectWorld } from "./Projection.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { DecalItem } from "./SceneItem.js";
import {
  type Point3,
  planeZ,
  polygonBounds,
  type SurfaceFragment,
  type SurfaceMesh,
  type SurfaceReceivers,
  type SurfaceVertex,
  upwardSurfaceFace,
} from "./SurfaceReceivers.js";
import { WORLD_DEPTH_RANGE } from "./WorldDepth.js";

export interface DecalVertex {
  x: number;
  y: number;
  u: number;
  v: number;
}
export type DecalMask = "oval" | "vehicle" | "ring";
const masks = new Map<DecalMask, HTMLCanvasElement>();
/** Small retained masks, never a pose-specific canvas or a per-frame upload. */
function maskImage(kind: DecalMask) {
  let image = masks.get(kind);
  if (image) return image;
  image = document.createElement("canvas");
  image.width = image.height = 64;
  const ctx = image.getContext("2d");
  if (!ctx) throw Error("Decal mask unavailable");
  const data = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const xx = (x + 0.5) / 32 - 1,
        yy = (y + 0.5) / 32 - 1,
        r = Math.hypot(xx, yy);
      const a =
        kind === "oval"
          ? (1 - r) / 0.2
          : kind === "ring"
            ? (0.12 - Math.abs(r - 0.72)) / 0.08
            : (0.18 -
                Math.hypot(Math.max(0, Math.abs(xx) - 0.72), Math.max(0, Math.abs(yy) - 0.72))) /
              0.12;
      const i = (y * 64 + x) * 4;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = 255;
      data.data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  ctx.putImageData(data, 0, 0);
  masks.set(kind, image);
  return image;
}
export function shadowFootprint(
  entity: Entity,
  x: number,
  y: number,
  mesh?: SurfaceMesh,
  rotation?: BodyRotation,
): SurfaceVertex[] {
  const d = physicsBodyDimensions(entity);
  if (!entity.type.startsWith("vehicle-v1:")) {
    const rx = d.width / 2,
      ry = Math.max(d.depth * 0.4, d.width * 0.175),
      cx = x + d.offsetX,
      cy = y + d.offsetY;
    return [
      { x: cx - rx, y: cy - ry, u: 0, v: 0 },
      { x: cx + rx, y: cy - ry, u: 1, v: 0 },
      { x: cx + rx, y: cy + ry, u: 1, v: 1 },
      { x: cx - rx, y: cy + ry, u: 0, v: 1 },
    ];
  }
  const q = rotation ?? entity.bodyRotation ?? yawRotation(d.yaw),
    heading = entity.vehicleHeading ?? d.yaw,
    c = Math.cos(heading),
    s = Math.sin(heading);
  const min = mesh?.min ?? [-d.width / 2, -d.depth / 2, 0],
    max = mesh?.max ?? [d.width / 2, d.depth / 2, d.height];
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const xx of [min[0], max[0]])
    for (const yy of [min[1], max[1]])
      for (const zz of [min[2], max[2]]) {
        const p = rotateBodyVector(q, xx ?? 0, yy ?? 0, zz ?? 0),
          forward = p.x * c + p.y * s,
          side = -p.x * s + p.y * c;
        left = Math.min(left, forward);
        right = Math.max(right, forward);
        top = Math.min(top, side);
        bottom = Math.max(bottom, side);
      }
  return [
    [left, top, 0, 0],
    [right, top, 1, 0],
    [right, bottom, 1, 1],
    [left, bottom, 0, 1],
  ].map(([f = 0, r = 0, u = 0, v = 0]) => ({ x: x + f * c - r * s, y: y + f * s + r * c, u, v }));
}
/** Cast downward from the displayed box's upper envelope, rather than its root.
 * A pitched/rolled root can be below the receiving ramp. Each upward box face
 * supplies its own finite ceiling, so a taller exposed end cannot cast onto a
 * bridge above the lower end. At most three disjoint quads share one mask UVs. */
export function projectShadow(
  receivers: SurfaceReceivers,
  entity: Entity,
  x: number,
  y: number,
  z: number,
  mesh?: SurfaceMesh,
  rotation?: BodyRotation,
): SurfaceFragment[] {
  const footprint = shadowFootprint(entity, x, y, mesh, rotation);
  if (!entity.type.startsWith("vehicle-v1:")) return receivers.project(footprint, z, entity.id);
  const d = physicsBodyDimensions(entity),
    q = rotation ?? entity.bodyRotation ?? yawRotation(d.yaw),
    min = mesh?.min ?? [-d.width / 2, -d.depth / 2, 0],
    max = mesh?.max ?? [d.width / 2, d.depth / 2, d.height];
  const p0 = footprint[0],
    p1 = footprint[1],
    p3 = footprint[3];
  if (!p0 || !p1 || !p3) return [];
  const ax = p1.x - p0.x,
    ay = p1.y - p0.y,
    bx = p3.x - p0.x,
    by = p3.y - p0.y,
    det = ax * by - ay * bx;
  if (Math.abs(det) < 1e-8) return [];
  const result: SurfaceFragment[] = [];
  for (const axis of [0, 1, 2])
    for (const side of [0, 1]) {
      const a = (axis + 1) % 3,
        b = (axis + 2) % 3;
      const points: Point3[] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ].map(([aa, bb]) => {
        const local = [0, 0, 0];
        local[axis] = (side ? max[axis] : min[axis]) ?? 0;
        local[a] = (aa ? max[a] : min[a]) ?? 0;
        local[b] = (bb ? max[b] : min[b]) ?? 0;
        const p = rotateBodyVector(q, local[0] ?? 0, local[1] ?? 0, local[2] ?? 0);
        return [x + p.x, y + p.y, z + p.z];
      });
      if (!side) points.reverse();
      const face = upwardSurfaceFace("caster", points);
      if (!face) continue;
      const polygon = face.polygon.map((p) => ({
        x: p.x,
        y: p.y,
        u: ((p.x - p0.x) * by - (p.y - p0.y) * bx) / det,
        v: (ax * (p.y - p0.y) - ay * (p.x - p0.x)) / det,
      }));
      result.push(...receivers.project(polygon, face.plane, entity.id));
    }
  return result;
}
/** Group coplanar pieces so native Canvas can clip their union without diagonal seams. */
export function surfaceDecals(
  fragments: readonly SurfaceFragment[],
  mask: DecalMask,
  alpha: number,
  color = "#000",
  meshAssetId?: string,
  meshCasterId?: number,
): DecalItem[] {
  const groups = new Map<string, DecalItem>();
  for (const { face, vertices } of fragments) {
    const key = `${face.owner?.id ?? "static"}:${face.plane.map((n) => n.toFixed(6)).join(":")}`;
    let item = groups.get(key);
    if (!item) {
      const b = polygonBounds(vertices),
        wx = (b.left + b.right) / 2,
        wy = (b.top + b.bottom) / 2,
        z = planeZ(face.plane, wx, wy);
      item = {
        kind: "decal",
        wx,
        wy,
        z,
        sortKey: wy + z - 0.1,
        receiverId: face.id,
        plane: face.plane,
        polygons: [],
        mask,
        alpha,
        color,
        ...(meshAssetId ? { meshAssetId } : {}),
        ...(meshCasterId === undefined ? {} : { meshCasterId }),
      };
      groups.set(key, item);
    }
    item.polygons.push(vertices);
  }
  return [...groups.values()];
}
export function drawSurfaceDecal(ctx: RasterSurface, camera: Camera, item: DecalItem) {
  if (item.meshAssetId && !ctx.meshReady?.has(item.meshAssetId)) return;
  const image = maskImage(item.mask),
    origin = projectWorld(camera, 0, 0),
    [a, b, c] = item.plane;
  // z=ax+by+c, screen y=y-z. Edge-on top faces have no drawable area.
  if (Math.abs(1 - b) < 1e-5) return;
  const dx = (2 * a) / (1 - b),
    dy = (1 + b) / (1 - b),
    s = camera.scale,
    r = WORLD_DEPTH_RANGE;
  const plane: [number, number, number] = [
    -dx / s / r,
    -dy / s / r,
    0.5 - ((2 * c) / (1 - b) - camera.y - (dx * origin.sx) / s - (dy * origin.sy) / s + 0.03) / r,
  ];
  const polygons = item.polygons.map((p) =>
    p.map((v) => {
      const point = projectWorld(camera, v.x, v.y, planeZ(item.plane, v.x, v.y));
      return { x: point.sx, y: point.sy, u: v.u, v: v.v };
    }),
  );
  if (ctx.projectedDecal) {
    ctx.projectedDecal(image, polygons, plane, item.alpha, item.color, item.meshCasterId);
    return;
  }
  const native = ctx as CanvasRenderingContext2D;
  const p = polygons.find((p) => p.length >= 3),
    p0 = p?.[0];
  if (!p || !p0) return;
  let basis: DecalVertex[] | undefined;
  for (let i = 1; i < p.length - 1; i++) {
    const b = p[i],
      c = p[i + 1];
    if (b && c && Math.abs((b.u - p0.u) * (c.v - p0.v) - (c.u - p0.u) * (b.v - p0.v)) > 1e-8) {
      basis = [p0, b, c];
      break;
    }
  }
  if (!basis) return;
  const [v0, v1, v2] = basis;
  if (!v0 || !v1 || !v2) return;
  const u1 = v1.u - v0.u,
    w1 = v1.v - v0.v,
    u2 = v2.u - v0.u,
    w2 = v2.v - v0.v,
    det = u1 * w2 - u2 * w1;
  const ax = ((v1.x - v0.x) * w2 - (v2.x - v0.x) * w1) / det,
    ay = ((v1.y - v0.y) * w2 - (v2.y - v0.y) * w1) / det;
  const bx = ((v2.x - v0.x) * u1 - (v1.x - v0.x) * u2) / det,
    by = ((v2.y - v0.y) * u1 - (v1.y - v0.y) * u2) / det;
  native.save();
  native.globalAlpha = item.alpha;
  native.beginPath();
  for (const polygon of polygons) {
    const start = polygon[0];
    if (!start) continue;
    native.moveTo(start.x, start.y);
    for (const v of polygon.slice(1)) native.lineTo(v.x, v.y);
    native.closePath();
  }
  native.clip();
  native.transform(
    ax / 64,
    ay / 64,
    bx / 64,
    by / 64,
    v0.x - ax * v0.u - bx * v0.v,
    v0.y - ay * v0.u - by * v0.v,
  );
  // Masks are white; tint once with source-in in a bounded reusable image.
  native.drawImage(tintedMask(item.mask, item.color), 0, 0);
  native.restore();
}
const tints = new Map<string, HTMLCanvasElement>();
export function tintedMask(kind: DecalMask, color: string) {
  const key = `${kind}:${color}`;
  let image = tints.get(key);
  if (image) return image;
  image = document.createElement("canvas");
  image.width = image.height = 64;
  const c = image.getContext("2d");
  if (!c) throw Error("Decal tint unavailable");
  c.drawImage(maskImage(kind), 0, 0);
  c.globalCompositeOperation = "source-in";
  c.fillStyle = color;
  c.fillRect(0, 0, 64, 64);
  if (tints.size >= 16) tints.clear();
  tints.set(key, image);
  return image;
}
