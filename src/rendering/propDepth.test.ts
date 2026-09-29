import { describe, expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import type { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import { depthAboveProps, propDepthSurfaces } from "./propDepth.js";
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
