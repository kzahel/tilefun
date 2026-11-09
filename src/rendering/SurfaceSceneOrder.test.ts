import { expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { surfaceZAt } from "../physics/SurfacePatch.js";
import type { SceneItem } from "./SceneItem.js";
import { nearbySurfaceTop, type SurfaceVisibility, surfaceDisplay } from "./SurfacePresentation.js";
import { planeZ } from "./SurfaceReceivers.js";
import { orderNodes, surfaceSceneOrder } from "./SurfaceSceneOrder.js";

/** The original quadratic implementation, retained as the ordering reference. */
function referenceOrder(
  items: readonly SceneItem[],
  props: readonly Prop[],
  observer: Entity,
  mode: SurfaceVisibility,
  alpha: number,
): (number | string)[] {
  const patches = props.flatMap((p) =>
    (p.walls ?? (p.collider ? [p.collider] : [])).flatMap((c) =>
      c.surface ? [{ patch: c.surface, bounds: getEntityAABB(p.position, c) }] : [],
    ),
  );
  const nodes: (number | string)[] = [...items.map((_, i) => i), ...patches.map((s) => s.patch.id)];
  const edges = nodes.map(() => new Set<number>()),
    degree = nodes.map(() => 0);
  for (const [j, { patch, bounds }] of patches.entries()) {
    if (surfaceDisplay(patch, bounds, observer, mode, alpha) === "hidden") continue;
    for (const [i, item] of items.entries()) {
      if (item.kind !== "sprite" && item.kind !== "decal" && item.kind !== "particle") continue;
      const vertices = item.kind === "decal" ? item.polygons.flat() : undefined;
      const halfWidth =
        item.kind === "sprite" ? item.spriteWidth / 2 : item.kind === "particle" ? item.size : 0;
      const left = Math.max(
        bounds.left,
        vertices ? Math.min(...vertices.map((v) => v.x)) : item.wx - halfWidth,
      );
      const right = Math.min(
        bounds.right,
        vertices ? Math.max(...vertices.map((v) => v.x)) : item.wx + halfWidth,
      );
      if (left >= right) continue;
      const north = Math.min(
        ...[left, right].map((x) => bounds.top - surfaceZAt(patch, bounds, x, bounds.top)),
      );
      const south =
        Math.max(
          ...[left, right].map((x) => bounds.bottom - surfaceZAt(patch, bounds, x, bounds.bottom)),
        ) + patch.thickness;
      const z = item.kind === "sprite" ? item.zOffset : item.z;
      const bottom =
        vertices && item.kind === "decal"
          ? Math.max(...vertices.map((v) => v.y - planeZ(item.plane, v.x, v.y)))
          : item.wy -
            z +
            (item.kind === "sprite" ? item.drawOffsetY : item.kind === "particle" ? item.size : 0);
      const highest =
        vertices && item.kind === "decal"
          ? Math.min(...vertices.map((v) => v.y - planeZ(item.plane, v.x, v.y)))
          : bottom -
            (item.kind === "sprite"
              ? item.spriteHeight * (item.scaleY ?? 1)
              : item.kind === "particle"
                ? item.size * 2
                : 0);
      if (bottom <= north || highest >= south) continue;
      const top = nearbySurfaceTop(patch, bounds, {
        left: item.wx,
        right: item.wx,
        top: item.wy,
        bottom: item.wy,
      });
      const slab = items.length + j;
      const [from, to] = z < top - 1 ? [i, slab] : [slab, i];
      edges[from]?.add(to);
      degree[to] = (degree[to] ?? 0) + 1;
    }
  }
  const result: (number | string)[] = [],
    emitted = new Set<number>();
  while (result.length < nodes.length) {
    let index = nodes.findIndex((_, i) => !emitted.has(i) && degree[i] === 0);
    if (index < 0) index = nodes.findIndex((_, i) => !emitted.has(i));
    emitted.add(index);
    const node = nodes[index];
    if (node !== undefined) result.push(node);
    for (const to of edges[index] ?? []) degree[to] = (degree[to] ?? 1) - 1;
  }
  return result;
}

function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function scene(seed: number, spread: number) {
  const r = random(seed);
  const props: Prop[] = [];
  for (let i = 0; i < 12; i++) {
    const width = 32 + r() * 400,
      height = 32 + r() * 300;
    const surface = {
      id: `slab-${i % 10}`, // repeated ids keep first-wins lookups honest
      spaceId: "outside",
      z: r() * 48,
      riseX: (r() - 0.5) * 40,
      riseY: (r() - 0.5) * 40,
      thickness: 4 + r() * 12,
      connectsTo: [],
    };
    const collider = { offsetX: 0, offsetY: 0, width, height, surface };
    props.push({
      position: { wx: r() * spread, wy: r() * spread },
      ...(i % 3 ? { collider } : { walls: [collider, { offsetX: 0, offsetY: 0, width, height }] }),
    } as unknown as Prop);
  }
  const items: SceneItem[] = [];
  for (let i = 0; i < 400; i++) {
    const wx = r() * spread,
      wy = r() * spread,
      kind = r();
    if (kind < 0.6)
      items.push({
        kind: "sprite",
        sortKey: wy,
        wx,
        wy,
        zOffset: r() * 64,
        sheetKey: "s",
        frameCol: 0,
        frameRow: 0,
        spriteWidth: 8 + r() * 64,
        spriteHeight: 8 + r() * 64,
        flipX: false,
        drawOffsetY: (r() - 0.5) * 8,
        hasShadow: r() < 0.5,
        shadowFeetWy: wy,
        shadowWidth: 8,
        shadowTerrainZ: 0,
        flashHidden: false,
        ...(r() < 0.2 ? { scaleY: 0.5 } : {}),
      } as SceneItem);
    else if (kind < 0.8)
      items.push({
        kind: "particle",
        sortKey: wy,
        wx,
        wy,
        z: r() * 40,
        size: r() * 6,
        color: "",
        alpha: 1,
      });
    else {
      const polygon = Array.from({ length: 3 + Math.floor(r() * 3) }, () => ({
        x: wx + (r() - 0.5) * 40,
        y: wy + (r() - 0.5) * 40,
        u: 0,
        v: 0,
      }));
      items.push({
        kind: "decal",
        sortKey: wy,
        wx,
        wy,
        z: r() * 30,
        receiverId: "r",
        plane: [(r() - 0.5) * 0.2, (r() - 0.5) * 0.2, r() * 20],
        polygons: r() < 0.1 ? [] : [polygon],
        mask: {},
        alpha: 1,
        color: "",
      } as unknown as SceneItem);
    }
  }
  return { props, items };
}

it("orders surface scenes exactly as the original quadratic implementation", () => {
  let edges = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { props, items } = scene(seed, seed % 2 ? 600 : 4000);
    const observer = createPlayer(300, 300);
    observer.wz = (seed % 4) * 20;
    for (const mode of ["auto", "all"] as const) {
      const expected = referenceOrder(items, props, observer, mode, 1);
      expect(surfaceSceneOrder(items, props, observer, mode, 1)).toEqual(expected);
      if (expected.some((node, i) => node !== (i < items.length ? i : node))) edges++;
    }
  }
  // The fixtures must actually exercise reordering, not just the identity.
  expect(edges).toBeGreaterThan(10);
});

it("orders nodes lowest-ready-first and breaks cycles at the lowest remaining index", () => {
  expect(orderNodes(4, [[], [], [], []])).toEqual([0, 1, 2, 3]);
  expect(orderNodes(3, [[], [0], []])).toEqual([1, 0, 2]);
  // 0 -> 1 -> 2 -> 0 is a cycle; 3 is free and emitted first.
  expect(orderNodes(4, [[1], [2], [0], []])).toEqual([3, 0, 1, 2]);
});
