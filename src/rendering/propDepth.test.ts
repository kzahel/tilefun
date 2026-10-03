import { describe, expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import type { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import { depthAboveProps, PropDepthCache, propDepthSurfaces } from "./propDepth.js";
import { SceneFrame } from "./SceneFrame.js";
import type { TileRenderer } from "./TileRenderer.js";

const bed: Prop = {
  id: 1,
  type: "bed",
  isProp: true,
  position: { wx: 64, wy: 90 },
  sprite: { sheetKey: "bed", frameCol: 0, frameRow: 0, spriteWidth: 16, spriteHeight: 48 },
  collider: { offsetX: 0, offsetY: 0, width: 16, height: 28, zHeight: 8, walkableTop: true },
  walls: null,
};
const player = (x: number, y: number, z: number) => {
  const p = createPlayer(x, y);
  p.wz = z;
  return p;
};
const key = (x: number, y: number, z: number) => {
  const p = player(x, y, z);
  return depthAboveProps(
    y + z,
    p.collider ? getEntityAABB(p.position, p.collider) : null,
    z,
    propDepthSurfaces([bed]),
  );
};
describe("actor depth over prop tops", () => {
  it("draws above every part of a long, low bed, including its back edge", () => {
    for (const y of [62.01, 64, 70, 80, 90, 95.99]) expect(key(64, y, 8)).toBeGreaterThan(90);
    expect(key(64, 64, 16)).toBeGreaterThan(90);
  });
  it("preserves ground-level, below-top, and nonoverlapping ordering", () => {
    expect(key(64, 60, 0)).toBe(60);
    expect(key(64, 70, 7)).toBe(77);
    expect(key(90, 64, 8)).toBe(72);
    expect(key(64, 62, 8)).toBe(70); // Exact footprint edge is not overlap.
    expect(key(64, 100, 8)).toBe(108);
  });
  it("respects raised bases, compound wall shapes, and infinite walls", () => {
    if (!bed.collider) throw new Error("Missing bed collider");
    const bridge = { ...bed, collider: null, walls: [{ ...bed.collider, zBase: 20, zHeight: 8 }] };
    const p = player(64, 64, 28);
    if (!p.collider) throw new Error("Missing collider");
    const bounds = getEntityAABB(p.position, p.collider);
    const surfaces = propDepthSurfaces([bridge]);
    expect(depthAboveProps(64, bounds, 27, surfaces)).toBe(64);
    expect(depthAboveProps(64, bounds, 28, surfaces)).toBeGreaterThan(90);
    const { zHeight: _height, ...infinite } = bed.collider;
    expect(propDepthSurfaces([{ ...bed, collider: infinite }])).toEqual([]);
  });
  it("uses the corrected rule in the live scene collector, including prediction ghosts", () => {
    const p = player(64, 64, 8);
    const camera = new Camera();
    camera.setViewport(800, 600);
    camera.snapTo(80, 80);
    const items = collectScene(
      [p],
      [bed],
      { getHeightAt: () => 0 } as unknown as World,
      camera,
      { minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 },
      1,
      { collectElevationItems: () => [] } as unknown as TileRenderer,
      [],
      false,
      [{ entityId: p.id, wx: 64, wy: 65, wz: 8 }],
    );
    const sprites = items.filter((i) => i.kind === "sprite");
    expect(sprites.map((i) => i.sheetKey)).toEqual(["bed", "player", "player"]);
    expect(sprites[1]?.zOffset).toBe(8);
  });
});

describe("cached prop depth metadata", () => {
  it("reuses unchanged surfaces across fresh arrays without sharing one-shot results", () => {
    const prop = structuredClone(bed);
    const cache = new PropDepthCache();
    const first = cache.collect([prop]);
    const surface = first[0];
    expect(first).toEqual(propDepthSurfaces([prop]));
    cache.release();
    expect(first).toEqual([]);
    expect(cache.collect([prop])[0]).toBe(surface);
    expect(cache.getDiagnostics()).toMatchObject({
      residentProps: 1,
      builds: 1,
      createdSurfaces: 1,
    });
    const fresh = propDepthSurfaces([prop]);
    prop.position.wy++;
    expect(cache.collect([prop])).toEqual(propDepthSurfaces([prop]));
    expect(fresh[0]?.depth).toBe(90);
    expect(surface?.depth).toBe(90);
  });

  it("invalidates every depth-relevant scalar and collider shape, including in-place edits", () => {
    const prop = structuredClone(bed);
    if (!prop.collider) throw Error("Missing collider");
    const collider = prop.collider;
    const cache = new PropDepthCache();
    const verify = () => expect(cache.collect([prop])).toEqual(propDepthSurfaces([prop]));
    verify();
    for (const field of ["wx", "wy"] as const) {
      prop.position[field] += 9;
      verify();
    }
    for (const field of ["offsetX", "offsetY", "width", "height"] as const) {
      collider[field] += 5;
      verify();
    }
    collider.zBase = 15;
    verify();
    for (const height of [24, Infinity, Number.NaN, 0, -1, undefined, 8]) {
      if (height === undefined) delete collider.zHeight;
      else collider.zHeight = height;
      verify();
    }
    prop.walls = [];
    verify(); // Empty walls suppress the fallback collider.
    prop.walls.push({ ...collider });
    verify();
    const wall = prop.walls[0];
    if (!wall) throw Error("Missing wall");
    wall.offsetY++;
    verify();
    prop.walls.push({ ...collider, zBase: 80 });
    verify();
    prop.walls.reverse();
    verify();
    prop.walls.splice(0, 1);
    verify();
    prop.walls = null;
    prop.collider = null;
    verify();
    prop.collider = { ...collider, zHeight: 2 };
    verify();
    const builds = cache.getDiagnostics().builds;
    prop.sprite.frameCol++;
    prop.collider.passable = true;
    prop.collider.walkableTop = false;
    verify(); // These fields do not affect the existing depth rule.
    expect(cache.getDiagnostics().builds).toBe(builds);
  });

  it("preserves input order and duplicates, evicts unloaded props and isolates same-ID replacements", () => {
    const a = structuredClone(bed);
    const b = structuredClone(bed);
    b.position.wy = 200;
    const cache = new PropDepthCache();
    expect(cache.collect([a, b, a])).toEqual(propDepthSurfaces([a, b, a]));
    expect(cache.collect([b, a])).toEqual(propDepthSurfaces([b, a]));
    cache.collect([b]);
    expect(cache.getDiagnostics().residentProps).toBe(1);
    const replacement = structuredClone(b);
    replacement.position.wx = 500;
    expect(cache.collect([replacement])).toEqual(propDepthSurfaces([replacement]));
    expect(cache.getDiagnostics().residentProps).toBe(1);
    cache.collect([]);
    expect(cache.getDiagnostics()).toMatchObject({ residentProps: 0, borrowedSurfaces: 0 });
    const builds = cache.getDiagnostics().builds;
    cache.collect([a]);
    expect(cache.getDiagnostics().builds).toBe(builds + 1);
    cache.clear();
    expect(cache.getDiagnostics()).toMatchObject({ residentProps: 0, borrowedSurfaces: 0 });
  });

  it("preserves scene and ghost ordering through edits, filtering, movement and realm reset", () => {
    const prop = structuredClone(bed);
    const actor = player(64, 64, 8);
    const frame = new SceneFrame();
    const camera = new Camera();
    camera.setViewport(800, 600);
    camera.snapTo(80, 80);
    const collect = (props: Prop[], storage?: SceneFrame) =>
      collectScene(
        [actor],
        props,
        { getHeightAt: () => 0 } as unknown as World,
        camera,
        { minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 },
        0.5,
        { collectElevationItems: () => [] } as unknown as TileRenderer,
        [],
        false,
        [{ entityId: actor.id, wx: 64, wy: 65, wz: 8 }],
        new Set<number>(),
        storage,
      );
    for (let i = 0; i < 5; i++) {
      const cached = collect([prop], frame);
      expect(cached).toEqual(collect([prop]));
      // Hidden furniture still affects actor depth in the interior drawing path.
      if (i === 0) expect(cached.every((item) => item.sortKey > 90)).toBe(true);
      frame.release();
      expect(frame.propDepth.getDiagnostics().borrowedSurfaces).toBe(0);
      prop.position.wy += 4;
      actor.position.wy += 3;
      actor.wz = i * 4;
    }
    collect([], frame);
    expect(frame.propDepth.getDiagnostics().residentProps).toBe(0);
    collect([prop], frame);
    frame.clear();
    expect(frame.propDepth.getDiagnostics().residentProps).toBe(0);
    expect(collect([structuredClone(bed)], frame)).toEqual(collect([structuredClone(bed)]));
  });
});
