import { describe, expect, it } from "vitest";
import type { Prop } from "../../entities/Prop.js";
import { createLayeredInteriorMap } from "../../interiors/LayeredInteriorMap.js";
import { artCard } from "./FirstPersonBillboards.js";
import { nextFogEnd } from "./FirstPersonCamera.js";
import {
  containingWallFace,
  DEFAULT_ROOM_WALL_HEIGHT,
  floorDecalQuad,
  furnitureFrame,
  paintedRun,
  paintedShell,
  roomFloorQuad,
  roomRasterSize,
  roomShellFrame,
  shellSideColor,
  wallPieceQuad,
} from "./FirstPersonInterior.js";
import { projectedUv, propSolids } from "./FirstPersonProps.js";

const map = { ...createLayeredInteriorMap(10, 8), contentOffsetY: 48 };

function prop(wx: number, wy: number, walls: Prop["walls"] = null): Prop {
  return {
    id: 1,
    type: "shell",
    position: { wx, wy },
    sprite: { sheetKey: "s", frameCol: 0, frameRow: 0, spriteWidth: 0, spriteHeight: 0 },
    collider: null,
    walls,
    isProp: true,
  };
}

describe("first-person rooms", () => {
  it("sizes the raster like the fixed view's room layers", () => {
    expect(roomRasterSize(map)).toEqual({ width: 160, height: 128 + 48, offsetY: 48 });
  });

  it("projects a wall point onto the pixel where the fixed view draws it", () => {
    const { width, height, offsetY } = roomRasterSize(map);
    // The shell prop sits at the room origin on the server; any anchor must work.
    for (const shell of [prop(0, 0), prop(32, 16)]) {
      const frame = roomShellFrame(shell, map);
      // A wall 64 px tall standing on row 96: its top edge is drawn at y − z.
      const [u, v] = projectedUv(shell, frame, 0, 40, 96, 64);
      expect(u * width).toBeCloseTo(40, 9);
      expect(v * height).toBeCloseTo(96 - 64 + offsetY, 9);
    }
  });

  it("covers the whole map with the floor plane", () => {
    const { positions, uvs } = roomFloorQuad(map);
    expect(positions).toHaveLength(18);
    expect(Math.max(...positions.filter((_, i) => i % 3 === 0))).toBe(160);
    expect(Math.max(...positions.filter((_, i) => i % 3 === 1))).toBe(128);
    expect(positions.filter((_, i) => i % 3 === 2).every((z) => z === 0)).toBe(true);
    // Row 0 of the world is raster row offsetY; the map's last row is the raster's last.
    const vs = uvs.filter((_, i) => i % 2 === 1);
    expect(Math.min(...vs)).toBeCloseTo(48 / 176, 9);
    expect(Math.max(...vs)).toBeCloseTo(1, 9);
  });

  it("places furniture by its anchor, and lays rugs on the floor", () => {
    const art = {
      rect: [0, 0, 16, 32] as const,
      anchor: [8, 25] as const,
      floor: true,
      wall: false,
    };
    const frame = furnitureFrame(art);
    expect(frame).toEqual({ left: -8, top: -25, width: 16, height: 32 });
    const rug = prop(100, 200);
    const { positions, uvs } = floorDecalQuad(rug, frame, 0.25);
    const xs = positions.filter((_, i) => i % 3 === 0);
    const ys = positions.filter((_, i) => i % 3 === 1);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([92, 108]);
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([175, 207]);
    expect(positions.filter((_, i) => i % 3 === 2).every((z) => z === 0.25)).toBe(true);
    expect(new Set(uvs)).toEqual(new Set([0, 1]));
  });

  it("colours wall sides from the artwork on that wall's south face", () => {
    const { width, height, offsetY } = roomRasterSize(map);
    const data = new Uint8ClampedArray(width * height * 4);
    // Paint red where a wall's south face (x 16–32, rows 64–128 minus height) is drawn.
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const onFace = x >= 16 && x < 32 && y >= 64 - 64 + offsetY && y < 64 + offsetY;
        data.set(onFace ? [255, 0, 0, 255] : [0, 0, 255, 255], i);
      }
    const shell = prop(0, 0, [{ offsetX: 24, offsetY: 64, width: 16, height: 16, zHeight: 64 }]);
    const frame = roomShellFrame(shell, map);
    const [solid] = propSolids(shell, frame);
    if (!solid) throw new Error("expected a wall solid");
    expect(shellSideColor({ data, width, height }, shell, frame, 0, solid)).toBe(0xff0000);
  });

  it("draws walls as tall as their painted band, not their 64 px collider", () => {
    const { width, height, offsetY } = roomRasterSize(map);
    const data = new Uint8ClampedArray(width * height * 4);
    const paint = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0 + offsetY; y < y1 + offsetY; y++)
        for (let x = x0; x < x1; x++) data[(y * width + x) * 4 + 3] = 255;
    };
    // An east–west wall painted over its 32 px footprint (rows 64–96), whose
    // collider runs on into unpainted space; a thin 16 px south wall; a
    // north–south wall painted along its whole length; and an outer wall off the art.
    paint(16, 64, 64, 96);
    paint(0, 112, 160, 124); // the strip stops 4 px above the base
    paint(144, 0, 160, 112);
    const across = { offsetX: 64, offsetY: 96, width: 96, height: 32, zHeight: 64 };
    const thin = { offsetX: 80, offsetY: 128, width: 160, height: 16, zHeight: 64 };
    const along = { offsetX: 152, offsetY: 112, width: 16, height: 112, zHeight: 64 };
    const outer = { offsetX: 80, offsetY: 160, width: 160, height: 32, zHeight: 64 };
    const shell = prop(0, 0, [across, thin, along, outer]);
    const frame = roomShellFrame(shell, map);
    const pixels = { data, width, height };
    expect(paintedRun(pixels, shell, frame, 0, { left: 16, right: 112, top: 64, bottom: 96 })).toBe(
      32,
    );
    const { painted, plain } = paintedShell(shell, frame, 0, pixels);
    // The typical (median) east–west height is shared by north–south and plain walls.
    expect(painted.walls?.map((w) => w.zHeight)).toEqual([32, 16, 32]);
    expect(plain.walls?.map((w) => [w.offsetY, w.zHeight])).toEqual([[160, 32]]);
    expect(shell.walls?.[0]?.zHeight).toBe(64); // the replicated prop is untouched
    const bare = paintedShell(shell, frame, 0, undefined);
    expect(bare.plain.walls?.map((w) => w.zHeight)).toEqual([32, 32, 32, 32]);
    expect(DEFAULT_ROOM_WALL_HEIGHT).toBe(32);
    // Side colours ignore unpainted (transparent) pixels; nothing painted gives no colour.
    const [outerSolid] = propSolids(plain, frame);
    if (!outerSolid) throw new Error("expected the outer wall");
    expect(shellSideColor(pixels, plain, frame, 0, outerSolid)).toBeUndefined();
  });

  it("stands furniture cards on their anchor; padding below it stays under the floor", () => {
    // potted-tree style art: 48 rows anchored at row 40 (its ground contact); the
    // 8 rows below are the catalog's intentional transparent padding.
    const frame = furnitureFrame({
      rect: [0, 0, 32, 48],
      anchor: [16, 40],
      floor: false,
      wall: false,
    });
    const texture = {} as Parameters<typeof artCard>[2];
    const card = artCard(prop(100, 200), frame, texture, 0);
    expect(card).toMatchObject({ x: 100, height: 48 });
    expect(card.z + card.height - 40).toBe(0); // the anchor row meets the floor
    // Outdoor art anchored at its bottom centre: its bottom row meets the ground.
    expect(
      artCard(prop(100, 200), { left: -16, top: -48, width: 32, height: 48 }, texture, 0).z,
    ).toBe(0);
  });

  it("hangs pictures on the south face of the wall containing their anchor", () => {
    const shell = prop(0, 0, [{ offsetX: 80, offsetY: 32, width: 160, height: 32, zHeight: 32 }]);
    expect(containingWallFace(shell, 40, 25)).toBe(32);
    expect(containingWallFace(shell, 40, 40)).toBeUndefined();
    // wall-picture: 16×32 art anchored at (8, 25), placed at y = 25 inside the wall.
    const frame = furnitureFrame({
      rect: [0, 0, 16, 32],
      anchor: [8, 25],
      floor: false,
      wall: true,
    });
    const { positions } = wallPieceQuad(prop(40, 25), frame, 32, 0);
    const ys = new Set(positions.filter((_, i) => i % 3 === 1));
    const zs = positions.filter((_, i) => i % 3 === 2);
    expect(ys).toEqual(new Set([32.25])); // a hair in front of the face
    // Rows 0..32 of the art sit at heights faceY − row: 32 − (25 − 25) … 32 − 32.
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([0, 32]);
  });
});

describe("first-person fog while streaming", () => {
  it("pulls in to the nearest missing chunk at once and eases back out", () => {
    expect(nextFogEnd(undefined, 1600, undefined)).toBe(1600);
    expect(nextFogEnd(1600, 1600, 300)).toBe(300);
    expect(nextFogEnd(300, 1600, 40, 96)).toBe(96);
    const eased = nextFogEnd(300, 1600, undefined);
    expect(eased).toBeGreaterThan(300);
    expect(eased).toBeLessThan(1600);
    expect(nextFogEnd(1599.5, 1600, undefined)).toBe(1600);
    expect(nextFogEnd(1600, 400, undefined)).toBe(400); // a nearer choice applies at once
  });
});
