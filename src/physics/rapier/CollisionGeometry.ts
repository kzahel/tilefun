import RAPIER from "@dimforge/rapier3d-compat";
import { ELEVATION_PX, TILE_SIZE } from "../../config/constants.js";
import { type AABB, aabbsOverlap, getEntityAABB } from "../../entities/collision.js";
import { CollisionFlag } from "../../world/TileRegistry.js";
import type { CharacterMotionSource } from "../CharacterPhysics.js";
import { surfaceZAt } from "../SurfacePatch.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./CharacterShape.js";
import { clippedTerrainVertices } from "./ClippedTerrain.js";

const MAX_COLLIDERS = 512;
export type OneWayColliders = Map<
  number,
  { bounds: AABB; collider: import("../../entities/Prop.js").PropCollider }
>;
/** Canonical geometry used by disposable reference queries and persistent sections. */
export function compileCollisionGeometry(
  source: CharacterMotionSource,
  bounds: AABB,
  origin: RAPIER.Vector,
  low: number,
  high: number,
  add: (desc: RAPIER.ColliderDesc) => RAPIER.Collider,
) {
  const props = source
    .queryProps(bounds)
    .filter((prop) => {
      return (prop.walls ?? (prop.collider ? [prop.collider] : [])).some((c) =>
        aabbsOverlap(bounds, getEntityAABB(prop.position, c)),
      );
    })
    .sort((a, b) => a.id - b.id);
  // Partition at authored excavation edges as well as tile edges. Ground is
  // a solid base; elevated slabs retain empty space below their underside.
  const cuts = props.flatMap((prop) =>
    (prop.walls ?? (prop.collider ? [prop.collider] : [])).flatMap((c) =>
      c.surface?.excavation ? [{ patch: c.surface, bounds: getEntityAABB(prop.position, c) }] : [],
    ),
  );
  const water = new Map<number, number>();
  const oneWay = new Map<
    number,
    { bounds: AABB; collider: import("../../entities/Prop.js").PropCollider }
  >();
  const xs = new Set<number>(),
    zs = new Set<number>();
  const minX = Math.floor(bounds.left / TILE_SIZE),
    maxX = Math.floor(bounds.right / TILE_SIZE);
  const minZ = Math.floor(bounds.top / TILE_SIZE),
    maxZ = Math.floor(bounds.bottom / TILE_SIZE);
  xs.add(bounds.left);
  xs.add(bounds.right);
  zs.add(bounds.top);
  zs.add(bounds.bottom);
  for (let x = minX; x <= maxX + 1; x++)
    if (x * TILE_SIZE > bounds.left && x * TILE_SIZE < bounds.right) xs.add(x * TILE_SIZE);
  for (let z = minZ; z <= maxZ + 1; z++)
    if (z * TILE_SIZE > bounds.top && z * TILE_SIZE < bounds.bottom) zs.add(z * TILE_SIZE);
  for (const prop of props)
    for (const c of prop.walls ?? (prop.collider ? [prop.collider] : []))
      if (c.surface?.excavation) {
        const b = getEntityAABB(prop.position, c);
        for (const x of [b.left, b.right]) if (x > bounds.left && x < bounds.right) xs.add(x);
        for (const z of [b.top, b.bottom]) if (z > bounds.top && z < bounds.bottom) zs.add(z);
      }
  const xx = [...xs].sort((a, b) => a - b),
    zz = [...zs].sort((a, b) => a - b);
  const box = (b: AABB, bottom: number, top: number) => {
    // Clip infinite/deep columns to this complete swept vertical interval.
    // Huge floor extents degrade f32 shape-cast precision for a small box.
    bottom = Math.max(bottom, low);
    top = Math.min(top, high);
    if (top <= bottom) return;
    return add(
      RAPIER.ColliderDesc.cuboid(
        (b.right - b.left) / 2 / SCALE,
        (top - bottom) / 2 / SCALE,
        (b.bottom - b.top) / 2 / SCALE,
      ).setTranslation(
        (b.left + b.right) / 2 / SCALE - origin.x,
        (top + bottom) / 2 / SCALE - origin.y,
        (b.top + b.bottom) / 2 / SCALE - origin.z,
      ),
    );
  };
  if (xx.length * zz.length > MAX_COLLIDERS * 4)
    throw Error("Experimental geometry partition budget exceeded");
  const ground: { bounds: AABB; height: number }[] = [];
  let previousRow = new Map<string, { bounds: AABB; height: number }>();
  for (let zi = 1; zi < zz.length; zi++) {
    const row: { bounds: AABB; height: number }[] = [];
    for (let xi = 1; xi < xx.length; xi++) {
      const b = {
        left: xx[xi - 1] ?? 0,
        right: xx[xi] ?? 0,
        top: zz[zi - 1] ?? 0,
        bottom: zz[zi] ?? 0,
      };
      const tx = Math.floor((b.left + b.right) / 2 / TILE_SIZE),
        tz = Math.floor((b.top + b.bottom) / 2 / TILE_SIZE);
      const flags = source.getCollision(tx, tz);
      const floor = source.getHeight(tx, tz) * ELEVATION_PX;
      const wall = !!(flags & CollisionFlag.Solid);
      if (!wall && flags & CollisionFlag.Water) {
        const barrier = box(b, floor, Math.max(4096, high));
        if (barrier) water.set(barrier.handle, floor);
      }
      const cellCuts = wall ? [] : cuts.filter((cut) => aabbsOverlap(cut.bounds, b));
      if (cellCuts.length) {
        const points = clippedTerrainVertices(b, low, Math.min(floor, high), cellCuts);
        if (points.length >= 4) {
          const descriptor = RAPIER.ColliderDesc.convexHull(
            new Float32Array(
              points.flatMap((p) => [
                p.x / SCALE - origin.x,
                p.y / SCALE - origin.y,
                p.z / SCALE - origin.z,
              ]),
            ),
          );
          if (descriptor) add(descriptor);
        }
        continue;
      }
      const height = wall ? Math.max(4096, high) : floor;
      const last = row[row.length - 1];
      if (last && last.height === height && last.bounds.right === b.left)
        last.bounds.right = b.right;
      else row.push({ bounds: b, height });
    }
    const nextRow = new Map<string, { bounds: AABB; height: number }>();
    for (const cell of row) {
      const key = `${cell.bounds.left}:${cell.bounds.right}:${cell.height}`;
      const previous = previousRow.get(key);
      if (previous && previous.bounds.bottom === cell.bounds.top) {
        previous.bounds.bottom = cell.bounds.bottom;
        nextRow.set(key, previous);
      } else {
        ground.push(cell);
        nextRow.set(key, cell);
      }
    }
    previousRow = nextRow;
  }
  for (const cell of ground) box(cell.bounds, -4096, cell.height);
  for (const prop of props)
    for (const c of prop.walls ?? (prop.collider ? [prop.collider] : [])) {
      const authored = getEntityAABB(prop.position, c);
      const b = {
        left: Math.max(authored.left, bounds.left),
        right: Math.min(authored.right, bounds.right),
        top: Math.max(authored.top, bounds.top),
        bottom: Math.min(authored.bottom, bounds.bottom),
      };
      if (b.left >= b.right || b.top >= b.bottom) continue;
      if (c.passable && !c.surface && !c.walkableTop) continue;
      if (c.surface) {
        const vertices: number[] = [];
        for (const down of [0, c.surface.thickness])
          for (const [x, z] of [
            [b.left, b.top],
            [b.right, b.top],
            [b.right, b.bottom],
            [b.left, b.bottom],
          ])
            vertices.push(
              (x ?? 0) / SCALE - origin.x,
              (surfaceZAt(c.surface, authored, x ?? 0, z ?? 0) - down) / SCALE - origin.y,
              (z ?? 0) / SCALE - origin.z,
            );
        const descriptor = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
        if (!descriptor) throw Error("Invalid authored surface hull");
        const collider = add(descriptor);
        if (c.passable) oneWay.set(collider.handle, { bounds: authored, collider: c });
      } else {
        const collider = box(
          b,
          c.zBase ?? 0,
          c.zHeight === undefined ? Math.max(4096, high) : (c.zBase ?? 0) + c.zHeight,
        );
        if (c.passable && collider) oneWay.set(collider.handle, { bounds: authored, collider: c });
      }
    }
  return { water, oneWay };
}
