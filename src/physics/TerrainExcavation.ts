import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import { type AABB, aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { querySurfacePatch, type SurfacePatch, surfaceZAt } from "./SurfacePatch.js";
import type { PropSurface } from "./surfaceHeight.js";

function surfaces(props: readonly PropSurface[], excavationsOnly = false) {
  const result: { patch: SurfacePatch; bounds: AABB }[] = [];
  for (const prop of props)
    for (const c of prop.walls ?? (prop.collider ? [prop.collider] : []))
      if (c.surface && (!excavationsOnly || c.surface.excavation))
        result.push({ patch: c.surface, bounds: getEntityAABB(prop.position, c) });
  return result;
}

/** The solid terrain base, locally lowered to authored floors. Partition at tile
 * and excavation edges so even a narrow uncut strip remains solid. No world-grid
 * mutation or actor-dependent height override: authority and prediction agree.
 */
export function terrainBaseZ(
  footprint: AABB,
  getHeight: (tx: number, ty: number) => number,
  props: readonly PropSurface[] = [],
): number {
  const cuts = surfaces(props, true).filter((s) => aabbsOverlap(s.bounds, footprint));
  const minTx = Math.floor(footprint.left / TILE_SIZE);
  const maxTx = Math.floor((footprint.right - 0.001) / TILE_SIZE);
  const minTy = Math.floor(footprint.top / TILE_SIZE);
  const maxTy = Math.floor((footprint.bottom - 0.001) / TILE_SIZE);
  if (!cuts.length) {
    let z = 0;
    for (let ty = minTy; ty <= maxTy; ty++)
      for (let tx = minTx; tx <= maxTx; tx++) z = Math.max(z, getHeight(tx, ty) * ELEVATION_PX);
    return z;
  }
  const xs = new Set([footprint.left, footprint.right]);
  const ys = new Set([footprint.top, footprint.bottom]);
  for (let tx = minTx + 1; tx <= maxTx; tx++) xs.add(tx * TILE_SIZE);
  for (let ty = minTy + 1; ty <= maxTy; ty++) ys.add(ty * TILE_SIZE);
  for (const { bounds } of cuts) {
    for (const x of [bounds.left, bounds.right])
      if (x > footprint.left && x < footprint.right) xs.add(x);
    for (const y of [bounds.top, bounds.bottom])
      if (y > footprint.top && y < footprint.bottom) ys.add(y);
  }
  const xx = [...xs].sort((a, b) => a - b),
    yy = [...ys].sort((a, b) => a - b);
  let z = -Infinity;
  for (let i = 1; i < xx.length; i++)
    for (let j = 1; j < yy.length; j++) {
      const cell = {
        left: xx[i - 1] ?? 0,
        right: xx[i] ?? 0,
        top: yy[j - 1] ?? 0,
        bottom: yy[j] ?? 0,
      };
      const x = (cell.left + cell.right) / 2,
        y = (cell.top + cell.bottom) / 2;
      let base = getHeight(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE)) * ELEVATION_PX;
      for (const { patch, bounds } of cuts) {
        const hit = querySurfacePatch(patch, bounds, cell);
        if (hit) base = Math.min(base, hit.topMax);
      }
      z = Math.max(z, base);
    }
  return Number.isFinite(z) ? z : 0;
}

/** Space is derived from saved XYZ and authored floor/ceiling identity, including
 * while airborne. It is not an independently mutable realm/floor selector.
 */
export function locateSurfaceSpace(props: readonly PropSurface[], actor: Entity): string {
  const patches = surfaces(props);
  let space = "outside",
    highest = -Infinity;
  const x = actor.position.wx,
    y = actor.position.wy,
    feet = actor.wz ?? 0;
  for (const { patch, bounds } of patches) {
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
    const floor = surfaceZAt(patch, bounds, x, y);
    if (floor > feet + 1 || floor <= highest) continue;
    const ceilingId = patch.excavation?.ceilingId;
    if (ceilingId) {
      const roof = patches.find((s) => s.patch.id === ceilingId);
      if (
        !roof ||
        feet + (actor.collider?.physicalHeight ?? 0) >
          surfaceZAt(roof.patch, roof.bounds, x, y) - roof.patch.thickness + 0.001
      )
        continue;
    }
    highest = floor;
    space = patch.spaceId;
  }
  return space;
}

/** Bounded first authoring contract: tile-aligned, nonoverlapping excavation
 * footprints, with an optional matching ceiling slab. Adjacent floors form ramps
 * and entrances; unused surrounding terrain supplies the retaining boundaries.
 */
export function validateExcavations(props: readonly PropSurface[]): void {
  const patches = surfaces(props),
    cuts = patches.filter((s) => s.patch.excavation);
  for (const cut of cuts) {
    if (Object.values(cut.bounds).some((v) => v % TILE_SIZE !== 0))
      throw new Error("Excavation bounds must be tile aligned");
    if (cuts.some((other) => other !== cut && aabbsOverlap(cut.bounds, other.bounds)))
      throw new Error("Excavation footprints must not overlap");
    const ceilingId = cut.patch.excavation?.ceilingId;
    if (!ceilingId) continue;
    const roof = patches.find((s) => s.patch.id === ceilingId);
    if (
      !roof ||
      roof.patch.excavation ||
      Object.keys(cut.bounds).some(
        (key) => cut.bounds[key as keyof AABB] !== roof.bounds[key as keyof AABB],
      )
    )
      throw new Error("Excavation ceiling must match its floor footprint");
    for (const x of [cut.bounds.left, cut.bounds.right])
      for (const y of [cut.bounds.top, cut.bounds.bottom])
        if (
          surfaceZAt(roof.patch, roof.bounds, x, y) - roof.patch.thickness <=
          surfaceZAt(cut.patch, cut.bounds, x, y)
        )
          throw new Error("Excavation ceiling must clear its floor");
  }
}
