import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Spritesheet } from "../../assets/Spritesheet.js";
import { TerrainId } from "../../autotile/TerrainId.js";
import { Chunk } from "../../world/Chunk.js";
import { Camera } from "../Camera.js";
import {
  collectCameraGrass,
  GRASS_ANCHOR_X,
  GRASS_ANCHOR_Y,
  GrassFrameBuffer,
} from "../GrassBladeRenderer.js";
import type { GrassItem } from "../SceneItem.js";
import type { CardPages } from "./FirstPersonBillboards.js";
import { bladeQuad, GrassCards } from "./FirstPersonGrass.js";
import { obliqueScreen } from "./ObliqueCamera.js";

const blade = (extra: Partial<GrassItem> = {}): GrassItem => ({
  kind: "grass",
  sortKey: 40,
  wx: 100,
  wy: 40,
  variant: 0,
  angle: 0,
  ...extra,
});

/** Where the fixed view puts the artwork's corners: turned about the anchor on
 * screen, clockwise for a positive angle (bottom-left, bottom-right, top-right, top-left). */
function fixedCorners(item: GrassItem): [number, number][] {
  const anchorY = GRASS_ANCHOR_Y[item.variant] ?? 7;
  const cos = Math.cos(item.angle),
    sin = Math.sin(item.angle);
  return (
    [
      [0, 8],
      [8, 8],
      [8, 0],
      [0, 0],
    ] as const
  ).map(([ix, iy]) => {
    const x = ix - GRASS_ANCHOR_X,
      y = iy - anchorY;
    return [item.wx + x * cos - y * sin, item.wy + x * sin + y * cos];
  });
}

describe("grass blades as cards", () => {
  it("lands every corner where the fixed view draws it, without going under the ground", () => {
    const camera = { x: 90, y: 50, scale: 3 };
    for (const variant of [0, 1, 2, 3])
      for (const angle of [0, 0.15, -0.15, 0.545, -0.545]) {
        const item = blade({ variant, angle });
        const quad = bladeQuad(variant, angle, 8, 8);
        const expected = fixedCorners(item);
        const origin = obliqueScreen(camera, 640, 480, 0, 0);
        for (const [i, [across, up]] of quad.corners.entries()) {
          // A top-down card runs east; its foot stands `south` of the anchor.
          const at = obliqueScreen(camera, 640, 480, item.wx + across, item.wy + quad.south, up);
          const [x, y] = expected[i] ?? [0, 0];
          expect((at.sx - origin.sx) / camera.scale).toBeCloseTo(x, 9);
          expect((at.sy - origin.sy) / camera.scale).toBeCloseTo(y, 9);
          expect(up).toBeGreaterThanOrEqual(0);
        }
        expect(Math.min(...quad.corners.map(([, up]) => up))).toBeCloseTo(0, 9);
      }
    // Upright, the artwork reaches one row (big blades) or two (small) below its anchor.
    expect(bladeQuad(0, 0, 8, 8).south).toBe(1);
    expect(bladeQuad(2, 0, 8, 8).south).toBe(2);
  });

  it("writes each blade's cell of the page atlas, blends at the frame's opacity and keeps depth", () => {
    const image = { width: 32, height: 8 } as unknown as CanvasImageSource;
    const sheet = new Spritesheet(image as never, 8, 8);
    const asked: [number, number][] = [];
    const pages: CardPages = {
      pageSize: 512,
      page(_image, x, y) {
        asked.push([x, y]);
        return { layer: 3, x: 1024, y: 512, width: 512, height: 512 };
      },
    };
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const cards = new GrassCards(new THREE.Group(), material);
    cards.fill([blade({ variant: 2, alpha: 0.4 }), blade({ wx: 12, wy: 9 })], sheet, pages);
    expect(cards.count).toBe(2);
    expect(cards.mesh.visible).toBe(true);
    expect(material.opacity).toBe(0.4);
    expect(asked).toEqual([
      [0, 0],
      [0, 0],
    ]);
    const geometry = cards.mesh.geometry;
    expect(geometry.drawRange.count).toBe(12);
    // Variant 2 is the cell at x 16; pages store their rows bottom first.
    const page = geometry.getAttribute("cardPage");
    expect([page.getX(0), page.getY(0), page.getZ(0)]).toEqual([
      expect.closeTo(1024 + 16 + 0.01),
      expect.closeTo(512 + 512 - 8 + 0.01),
      3,
    ]);
    expect([page.getX(2), page.getY(2)]).toEqual([
      expect.closeTo(1024 + 24 - 0.01),
      expect.closeTo(512 + 512 - 0.01),
    ]);
    // The second blade stands one row south of its anchor, on the ground.
    const centre = geometry.getAttribute("position");
    expect([centre.getX(4), centre.getY(4), centre.getZ(4)]).toEqual([12, 10, 0]);

    // No blades, or no sheet: nothing is drawn, and full opacity is the default.
    cards.fill([], sheet, pages);
    expect(cards.count).toBe(0);
    expect(cards.mesh.visible).toBe(false);
    cards.fill([blade()], undefined, pages);
    expect(cards.mesh.visible).toBe(false);
    cards.fill([blade()], sheet, { pageSize: 512, page: () => undefined });
    expect(cards.mesh.visible).toBe(false);
    cards.fill([blade()], sheet, pages);
    expect(material.opacity).toBe(1);
    cards.dispose();
  });
});

describe("a camera's grass for the 3D scene", () => {
  const grass = new Chunk();
  grass.blendBase.fill(TerrainId.Grass);
  grass.autotileComputed = true;
  const world = { getChunkIfLoaded: (cx: number, cy: number) => (cx || cy ? undefined : grass) };
  const camera = (zoom: number) => {
    const result = new Camera();
    result.setViewport(256, 256);
    result.zoom = zoom;
    result.snapTo(128, 128);
    return result;
  };

  it("collects the fixed view's blades at its zoom fade, and none at overview zooms", () => {
    const scratch = new GrassFrameBuffer();
    const near = collectCameraGrass(world, [], camera(1), 0, scratch);
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((item) => item.alpha === undefined)).toBe(true);
    const fading = collectCameraGrass(world, [], camera(0.375), 0, scratch);
    expect(fading.length).toBeGreaterThan(near.length);
    expect(fading.every((item) => item.alpha === 0.5)).toBe(true);
    expect(collectCameraGrass(world, [], camera(0.25), 0, scratch)).toEqual([]);
  });

  it("leans blades away from a body standing among them", () => {
    const scratch = new GrassFrameBuffer();
    const still = collectCameraGrass(world, [], camera(1), 0, scratch).map((item) => item.angle);
    const pushed = collectCameraGrass(
      world,
      [{ position: { wx: 128, wy: 128 } }],
      camera(1),
      0,
      scratch,
    ).map((item) => item.angle);
    expect(pushed).toHaveLength(still.length);
    expect(pushed.some((angle, i) => Math.abs(angle - (still[i] ?? 0)) > 0.1)).toBe(true);
  });
});
