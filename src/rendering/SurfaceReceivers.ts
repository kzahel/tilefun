import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import { type AABB, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { rotateBodyVector, yawRotation } from "../physics/BodyRotation.js";
import { physicsBodyDimensions } from "../physics/PhysicsBodies.js";
import type { World } from "../world/World.js";
import { interpolatePosition, interpolateWz } from "./EntityInterpolation.js";
import { meshAssetFor } from "./EntityMeshPose.js";
import { SurfaceMeshIndex } from "./SurfaceMeshIndex.js";
import {
  type ClippedReceiver,
  clipPlane,
  contains,
  intersect,
  partitionReceivers,
  polygonBounds,
  rectangle,
  subtract,
} from "./SurfacePartition.js";
import { type SurfaceVisibility, surfaceDisplay } from "./SurfacePresentation.js";

export type Point3 = readonly [number, number, number];
export type Plane = readonly [number, number, number]; // z = ax + by + c
export interface SurfaceVertex {
  x: number;
  y: number;
  u: number;
  v: number;
}
export interface SurfaceMesh {
  readonly triangles: readonly (readonly [Point3, Point3, Point3])[];
  readonly min: Point3;
  readonly max: Point3;
}
export interface SurfaceFace {
  id: string;
  bounds: AABB;
  polygon: readonly SurfaceVertex[];
  plane: Plane;
  owner?: Entity;
  position?: Point3 | undefined;
}
export interface SurfaceContact {
  face: SurfaceFace;
  point: Point3;
  normal: Point3;
  velocity: Point3;
}
export interface SurfaceFragment {
  face: SurfaceFace;
  vertices: SurfaceVertex[];
}
export interface SurfaceAttachment {
  ownerId?: number;
  faceId: string;
  point: Point3;
}
interface Source {
  bounds: AABB;
  ownerId?: number;
  faces(bounds: AABB, maxZ: number): readonly SurfaceFace[];
  /** Query that last visited this source: dedupes sources spanning cells. */
  seen?: number;
}
const EPS = 1e-6,
  CELL = 128;

export { polygonArea, polygonBounds, rectangle } from "./SurfacePartition.js";
export const planeZ = (p: Plane, x: number, y: number) => p[0] * x + p[1] * y + p[2];
export function upwardSurfaceFace(
  id: string,
  points: readonly Point3[],
  owner?: Entity,
  position?: Point3,
): SurfaceFace | undefined {
  const [a, b, c] = points;
  if (!a || !b || !c) return;
  const ux = b[0] - a[0],
    uy = b[1] - a[1],
    uz = b[2] - a[2],
    vx = c[0] - a[0],
    vy = c[1] - a[1],
    vz = c[2] - a[2];
  const nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  if (nz <= EPS) return; // Only upward-facing receiver faces, never walls or undersides.
  const plane: Plane = [-nx / nz, -ny / nz, a[2] + (nx * a[0] + ny * a[1]) / nz];
  const polygon = points.map(([x, y]) => ({ x, y, u: 0, v: 0 }));
  return {
    id,
    plane,
    polygon,
    bounds: polygonBounds(polygon),
    ...(owner ? { owner, position } : {}),
  };
}
function flatFace(id: string, b: AABB, z: number): SurfaceFace {
  return { id, bounds: b, polygon: rectangle(b), plane: [0, 0, z] };
}
export interface ReceiverOptions {
  observer?: Entity;
  visibility?: SurfaceVisibility;
  mesh?: ((assetId: string) => SurfaceMesh | undefined) | undefined;
}
/** Read-only, frame-scoped presentation geometry. No physics step or GPU readback.
 * Broadphase sources are local; detailed moving mesh faces are built lazily once. */
export class SurfaceReceivers {
  readonly diagnostics = { sources: 0, meshTriangles: 0, queries: 0, fragments: 0 };
  private grid = new Map<number, Map<number, Source[]>>();
  private query = 0;
  private broad: Source[] = [];
  private cuts: AABB[] = [];
  private owners = new Map<number, { entity: Entity; position: Point3 }>();
  constructor(
    private readonly world: Pick<World, "getHeightAt">,
    props: readonly Prop[],
    entities: readonly Entity[],
    alpha = 1,
    options: ReceiverOptions = {},
  ) {
    for (const prop of props)
      for (const [i, c] of (prop.walls ?? (prop.collider ? [prop.collider] : [])).entries()) {
        const bounds = getEntityAABB(prop.position, c),
          patch = c.surface;
        if (patch?.excavation) this.cuts.push(bounds);
        if (
          patch &&
          options.observer &&
          surfaceDisplay(patch, bounds, options.observer, options.visibility ?? "auto", alpha) ===
            "hidden"
        )
          continue;
        if (c.passable && !patch && !c.walkableTop) continue;
        if (!patch && c.zHeight === undefined) continue; // Unbounded walls have no usable roof.
        const p: Plane = patch
          ? [
              patch.riseX / c.width,
              patch.riseY / c.height,
              patch.z -
                (patch.riseX / c.width) * bounds.left -
                (patch.riseY / c.height) * bounds.top,
            ]
          : [0, 0, (c.zBase ?? 0) + (c.zHeight ?? 0)];
        const f: SurfaceFace = {
          id: patch?.id ?? `prop:${prop.id}:${i}`,
          bounds,
          polygon: rectangle(bounds),
          plane: p,
        };
        this.add({ bounds, faces: () => [f] });
      }
    for (const entity of entities) {
      if (!entity.collider || entity.parentId !== undefined) continue;
      const pos = interpolatePosition(entity.position, entity.prevPosition, alpha),
        z = interpolateWz(entity, alpha) ?? 0;
      const position: Point3 = [pos.wx, pos.wy, z];
      this.owners.set(entity.id, { entity, position });
      const asset = meshAssetFor(entity),
        mesh = asset ? options.mesh?.(asset) : undefined;
      const d = physicsBodyDimensions(entity),
        q = entity.bodyRotation ?? yawRotation(d.yaw);
      const min = mesh?.min ?? [-d.width / 2 + d.offsetX, -d.depth / 2 + d.offsetY, 0];
      const max = mesh?.max ?? [d.width / 2 + d.offsetX, d.depth / 2 + d.offsetY, d.height];
      const toWorld = ([x, y, z]: Point3): Point3 => {
        const v = rotateBodyVector(q, x, y, z);
        return [v.x + position[0], v.y + position[1], v.z + position[2]];
      };
      const corners: Point3[] = [];
      for (const x of [min[0], max[0]])
        for (const y of [min[1], max[1]])
          for (const zz of [min[2], max[2]]) corners.push(toWorld([x ?? 0, y ?? 0, zz ?? 0]));
      const bounds = polygonBounds(corners.map(([x, y]) => ({ x, y })));
      const worldMinZ = Math.min(...corners.map((p) => p[2])),
        worldMaxZ = Math.max(...corners.map((p) => p[2]));
      const inverse = [-q[0], -q[1], -q[2], q[3]] as const;
      const cached = new Map<number, SurfaceFace | null>();
      this.add({
        bounds,
        ownerId: entity.id,
        faces: (query, maxZ) => {
          let indices: number[];
          if (mesh) {
            const low: [number, number, number] = [Infinity, Infinity, Infinity],
              high: [number, number, number] = [-Infinity, -Infinity, -Infinity];
            const topZ = Math.min(worldMaxZ, maxZ);
            if (topZ < worldMinZ - 1e-6) return [];
            for (const x of [query.left, query.right])
              for (const y of [query.top, query.bottom])
                for (const z of [worldMinZ, topZ]) {
                  const v = rotateBodyVector(
                    inverse,
                    x - position[0],
                    y - position[1],
                    z - position[2],
                  );
                  low[0] = Math.min(low[0], v.x);
                  low[1] = Math.min(low[1], v.y);
                  low[2] = Math.min(low[2], v.z);
                  high[0] = Math.max(high[0], v.x);
                  high[1] = Math.max(high[1], v.y);
                  high[2] = Math.max(high[2], v.z);
                }
            indices = SurfaceMeshIndex.for(mesh).query(low, high);
          } else indices = [0];
          const result: SurfaceFace[] = [];
          for (const i of indices) {
            let f = cached.get(i);
            if (f === undefined) {
              const t =
                mesh?.triangles[i] ??
                ([
                  [min[0], min[1], max[2]],
                  [max[0], min[1], max[2]],
                  [max[0], max[1], max[2]],
                  [min[0], max[1], max[2]],
                ] as readonly Point3[]);
              f =
                upwardSurfaceFace(`body:${entity.id}:${i}`, t.map(toWorld), entity, position) ??
                null;
              cached.set(i, f);
              if (mesh) this.diagnostics.meshTriangles++;
            }
            if (f) result.push(f);
          }
          return result;
        },
      });
    }
  }
  private add(source: Source) {
    this.diagnostics.sources++;
    const b = source.bounds,
      x0 = Math.floor(b.left / CELL),
      x1 = Math.floor(b.right / CELL),
      y0 = Math.floor(b.top / CELL),
      y1 = Math.floor(b.bottom / CELL);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 256) {
      this.broad.push(source);
      return;
    }
    for (let x = x0; x <= x1; x++) {
      let column = this.grid.get(x);
      if (!column) {
        column = new Map();
        this.grid.set(x, column);
      }
      for (let y = y0; y <= y1; y++) {
        const items = column.get(y);
        if (items) items.push(source);
        else column.set(y, [source]);
      }
    }
  }
  private candidates(b: AABB, exclude: number | undefined, maxZ: number): SurfaceFace[] {
    this.diagnostics.queries++;
    const query = ++this.query,
      out: SurfaceFace[] = [];
    // Broad sources first, then cells in x-major order: each source once, in
    // first-visit order (face order decides coplanar ties and decal sort keys).
    const visit = (sources: readonly Source[]) => {
      for (const s of sources) {
        if (s.seen === query) continue;
        s.seen = query;
        if ((exclude === undefined || s.ownerId !== exclude) && aabbsOverlap(b, s.bounds))
          for (const f of s.faces(b, maxZ)) if (aabbsOverlap(b, f.bounds)) out.push(f);
      }
    };
    visit(this.broad);
    for (let x = Math.floor(b.left / CELL); x <= Math.floor(b.right / CELL); x++) {
      const column = this.grid.get(x);
      if (column)
        for (let y = Math.floor(b.top / CELL); y <= Math.floor(b.bottom / CELL); y++)
          visit(column.get(y) ?? []);
    }
    for (let x = Math.floor(b.left / TILE_SIZE); x <= Math.floor(b.right / TILE_SIZE); x++)
      for (let y = Math.floor(b.top / TILE_SIZE); y <= Math.floor(b.bottom / TILE_SIZE); y++) {
        const bounds = {
          left: x * TILE_SIZE,
          right: (x + 1) * TILE_SIZE,
          top: y * TILE_SIZE,
          bottom: (y + 1) * TILE_SIZE,
        };
        let pieces = [rectangle(bounds)];
        for (const cut of this.cuts)
          if (aabbsOverlap(bounds, cut))
            pieces = pieces.flatMap((p) => subtract(p, rectangle(cut)));
        for (const [i, polygon] of pieces.entries())
          out.push({
            ...flatFace(
              `terrain:${x}:${y}:${i}`,
              bounds,
              this.world.getHeightAt(x, y) * ELEVATION_PX,
            ),
            polygon,
          });
      }
    return out;
  }
  hit(x: number, y: number, maxZ: number, exclude?: number): SurfaceContact | undefined {
    let best: SurfaceFace | undefined,
      z = -Infinity;
    for (const f of this.candidates(
      { left: x - 0.001, right: x + 0.001, top: y - 0.001, bottom: y + 0.001 },
      exclude,
      maxZ,
    )) {
      const h = planeZ(f.plane, x, y);
      if (h <= maxZ + EPS && h > z + EPS && contains(f.polygon, x, y)) {
        best = f;
        z = h;
      }
    }
    if (!best) return;
    const [a, b] = best.plane,
      length = Math.hypot(a, b, 1);
    return {
      face: best,
      point: [x, y, z],
      normal: [-a / length, -b / length, 1 / length],
      velocity: this.velocity(best),
    };
  }
  private velocity(f: SurfaceFace): Point3 {
    const e = f.owner;
    if (!e) return [0, 0, 0];
    return [e.velocity?.vx ?? 0, e.velocity?.vy ?? 0, e.jumpVZ ?? 0];
  }
  project(
    polygon: readonly SurfaceVertex[],
    maxZ: number | Plane,
    exclude?: number,
  ): SurfaceFragment[] {
    const b = polygonBounds(polygon),
      cx = (b.left + b.right) / 2,
      cy = (b.top + b.bottom) / 2;
    const support = typeof maxZ === "number" ? this.hit(cx, cy, maxZ + 1, exclude) : undefined;
    const ceiling: Plane =
      typeof maxZ !== "number"
        ? [maxZ[0], maxZ[1], maxZ[2] + 1]
        : support && Math.abs(maxZ - support.point[2]) < 4
          ? [
              support.face.plane[0],
              support.face.plane[1],
              support.face.plane[2] + Math.max(0, maxZ - support.point[2]) + 1,
            ]
          : [0, 0, maxZ + 1];
    // A tilted caster face is not axis aligned: extrapolating its plane to an
    // AABB corner can invent a huge height outside that finite face.
    const maxCeiling = Math.max(...polygon.map((v) => planeZ(ceiling, v.x, v.y)));
    const faces = this.candidates(b, exclude, maxCeiling),
      valid: ClippedReceiver[] = [];
    for (const f of faces) {
      let clipped = intersect(polygon, f.polygon);
      clipped = clipPlane(
        clipped,
        ceiling[0] - f.plane[0],
        ceiling[1] - f.plane[1],
        ceiling[2] - f.plane[2],
      );
      if (!clipped.length) continue;
      valid.push({ face: f, polygon: clipped, bounds: polygonBounds(clipped) });
    }
    const pieces = partitionReceivers(valid, exclude);
    const out: SurfaceFragment[] = [];
    for (const { index, vertices } of pieces) {
      const face = valid[index]?.face;
      if (face) out.push({ face, vertices });
    }
    this.diagnostics.fragments += out.length;
    return out;
  }
  attach(contact: SurfaceContact): SurfaceAttachment {
    const e = contact.face.owner,
      p = contact.point,
      origin = contact.face.position;
    if (!e || !origin) return { faceId: contact.face.id, point: p };
    const q = e.bodyRotation ?? yawRotation(physicsBodyDimensions(e).yaw),
      v = rotateBodyVector(
        [-q[0], -q[1], -q[2], q[3]],
        p[0] - origin[0],
        p[1] - origin[1],
        p[2] - origin[2],
      );
    return { ownerId: e.id, faceId: contact.face.id, point: [v.x, v.y, v.z] };
  }
  locate(attachment: SurfaceAttachment): Point3 | undefined {
    if (attachment.ownerId === undefined) return attachment.point;
    const owner = this.owners.get(attachment.ownerId);
    if (!owner) return;
    const q = owner.entity.bodyRotation ?? yawRotation(physicsBodyDimensions(owner.entity).yaw),
      p = rotateBodyVector(q, ...attachment.point);
    return [p.x + owner.position[0], p.y + owner.position[1], p.z + owner.position[2]];
  }
}

/** Contact timing follows the physical hull; placement follows visible geometry.
 * They can differ (e.g. a 24px car proxy over a 20px authored roof). */
export function physicalSupportPlane(contact: SurfaceContact): Plane {
  const e = contact.face.owner,
    position = contact.face.position;
  if (!e?.collider || !position) return contact.face.plane;
  const d = physicsBodyDimensions(e),
    q = e.bodyRotation ?? yawRotation(d.yaw),
    inverse = [-q[0], -q[1], -q[2], q[3]] as const;
  const p = rotateBodyVector(
    inverse,
    contact.point[0] - position[0],
    contact.point[1] - position[1],
    -position[2],
  );
  const dir = rotateBodyVector(inverse, 0, 0, 1),
    origin = [p.x, p.y, p.z],
    direction = [dir.x, dir.y, dir.z];
  const clearance = e.type.startsWith("vehicle-v1:") ? Math.min(4, d.height * 0.22) : 0;
  const min = [-d.width / 2 + d.offsetX, -d.depth / 2 + d.offsetY, clearance],
    max = [d.width / 2 + d.offsetX, d.depth / 2 + d.offsetY, d.height];
  let low = -Infinity,
    high = Infinity,
    axis = 2,
    sign = 1;
  for (let i = 0; i < 3; i++) {
    const v = origin[i] ?? 0,
      directionI = direction[i] ?? 0,
      a = min[i] ?? 0,
      b = max[i] ?? 0;
    if (Math.abs(directionI) < 1e-8) {
      if (v < a - 0.01 || v > b + 0.01) return contact.face.plane;
      continue;
    }
    const first = (a - v) / directionI,
      last = (b - v) / directionI;
    low = Math.max(low, Math.min(first, last));
    const exit = Math.max(first, last);
    if (exit < high) {
      high = exit;
      axis = i;
      sign = directionI > 0 ? 1 : -1;
    }
  }
  if (high < low || !Number.isFinite(high)) return contact.face.plane;
  const n = rotateBodyVector(
    q,
    axis === 0 ? sign : 0,
    axis === 1 ? sign : 0,
    axis === 2 ? sign : 0,
  );
  if (n.z < 1e-5) return contact.face.plane;
  const a = -n.x / n.z,
    b = -n.y / n.z;
  return [a, b, high - a * contact.point[0] - b * contact.point[1]];
}
