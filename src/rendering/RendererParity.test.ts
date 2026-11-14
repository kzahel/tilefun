import { describe, expect, it } from "vitest";
import {
  colourDifference,
  compareCategory,
  compareFrames,
  differencePicture,
  footprint,
  PARITY_TOLERANCE,
} from "./RendererParity.js";

const WIDTH = 16,
  HEIGHT = 12;

/** A grey picture with coloured rectangles painted over it. */
function picture(
  ...rects: { x: number; y: number; w: number; h: number; rgb: [number, number, number] }[]
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(100);
  for (const { x, y, w, h, rgb } of rects)
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++) pixels.set([...rgb, 255], (py * WIDTH + px) * 4);
  return pixels;
}
const RED: [number, number, number] = [220, 30, 30];
const ground = picture();

describe("renderer parity maths", () => {
  it("finds what a category drew over the ground", () => {
    const mask = footprint(picture({ x: 2, y: 3, w: 4, h: 2, rgb: RED }), ground);
    expect(mask.reduce((n, v) => n + v, 0)).toBe(8);
    expect(mask[3 * WIDTH + 2]).toBe(1);
    expect(mask[2 * WIDTH + 2]).toBe(0);
    // Rounding noise is not a footprint.
    const noisy = picture();
    noisy[0] = 104;
    expect(footprint(noisy, ground).some(Boolean)).toBe(false);
  });

  it("reports the same silhouette in the same place as registered", () => {
    const box = picture({ x: 4, y: 4, w: 5, h: 4, rgb: RED });
    const result = compareCategory(
      { with: box, ground },
      { with: box.slice(), ground: ground.slice() },
      WIDTH,
    );
    expect(result).toMatchObject({
      fixed: 20,
      scene: 20,
      overlap: 1,
      shift: { x: 0, y: 0 },
      shiftedOverlap: 1,
    });
    expect(result.colour).toEqual({ pixels: 20, mean: 0, over: 0 });
  });

  it("measures a picture drawn two pixels right and one down", () => {
    const fixed = picture({ x: 4, y: 4, w: 5, h: 4, rgb: RED });
    const scene = picture({ x: 6, y: 5, w: 5, h: 4, rgb: RED });
    const result = compareCategory({ with: fixed, ground }, { with: scene, ground }, WIDTH);
    // Moving the 3D picture left and up puts it on the fixed one.
    expect(result.shift).toEqual({ x: -2, y: -1 });
    expect(result.shiftedOverlap).toBe(1);
    expect(result.overlap).toBeCloseTo(9 / 31, 9);
    expect(result.alignedColour).toMatchObject({ pixels: 20, mean: 0 });
  });

  it("separates colour from placement and from coverage", () => {
    const fixed = picture({ x: 4, y: 4, w: 6, h: 4, rgb: RED });
    // The 3D scene draws only the left half, a little darker.
    const scene = picture({ x: 4, y: 4, w: 3, h: 4, rgb: [190, 30, 30] });
    const result = compareCategory({ with: fixed, ground }, { with: scene, ground }, WIDTH);
    expect(result.fixed).toBe(24);
    expect(result.scene).toBe(12);
    expect(result.overlap).toBe(0.5);
    expect(result.shift).toEqual({ x: 0, y: 0 });
    expect(result.colour).toEqual({ pixels: 12, mean: 30, over: 1 });
  });

  it("treats a category neither renderer draws as agreeing", () => {
    const result = compareCategory({ with: ground, ground }, { with: ground, ground }, WIDTH);
    expect(result).toMatchObject({ fixed: 0, scene: 0, overlap: 1 });
    expect(result.colour.pixels).toBe(0);
  });

  it("compares whole pictures and finds their best alignment", () => {
    const fixed = picture({ x: 3, y: 2, w: 6, h: 6, rgb: RED });
    const scene = picture({ x: 4, y: 2, w: 6, h: 6, rgb: RED });
    const result = compareFrames(fixed, scene, WIDTH);
    expect(result.colour.over).toBeCloseTo(12 / (WIDTH * HEIGHT), 9);
    expect(result.shift).toEqual({ x: -1, y: 0 });
    expect(result.alignedColour.mean).toBe(0);
    // A moved comparison leaves out the pixels with no partner.
    expect(result.alignedColour.pixels).toBe((WIDTH - 1) * HEIGHT);
    expect(compareFrames(fixed, fixed.slice(), WIDTH).shift).toEqual({ x: 0, y: 0 });
  });

  it("reports the shortest of the moves that align equally well", () => {
    // A band across the whole picture, two rows lower in the 3D scene: any move
    // sideways does as well, and the plain one is reported.
    const fixed = picture({ x: 0, y: 4, w: WIDTH, h: 3, rgb: RED });
    const scene = picture({ x: 0, y: 6, w: WIDTH, h: 3, rgb: RED });
    const result = compareCategory({ with: fixed, ground }, { with: scene, ground }, WIDTH);
    expect(result.shift).toEqual({ x: 0, y: -2 });
    expect(result.shiftedOverlap).toBe(1);
    expect(compareFrames(fixed, scene, WIDTH).shift).toEqual({ x: 0, y: -2 });
  });

  it("does not call a silhouette moved off the picture agreement", () => {
    // The fixed view draws nothing; the 3D scene draws a strip at the left edge.
    const scene = picture({ x: 0, y: 2, w: 2, h: 4, rgb: RED });
    const result = compareCategory({ with: ground, ground }, { with: scene, ground }, WIDTH);
    expect(result).toMatchObject({ fixed: 0, scene: 8, overlap: 0, shiftedOverlap: 0 });
    expect(result.shift).toEqual({ x: 0, y: 0 });
  });

  it("counts only differences beyond the tolerance", () => {
    const near = picture();
    near.fill(100 + PARITY_TOLERANCE);
    expect(colourDifference(ground, near, WIDTH).over).toBe(0);
    near.fill(101 + PARITY_TOLERANCE);
    expect(colourDifference(ground, near, WIDTH).over).toBe(1);
  });

  it("paints differences red on a dimmed copy", () => {
    const out = differencePicture(ground, picture({ x: 0, y: 0, w: 1, h: 1, rgb: RED }));
    expect(out[0]).toBeGreaterThan(200);
    expect(out[1]).toBeLessThan(60);
    expect(out[4]).toBe(out[5]);
    expect(out[3]).toBe(255);
  });
});
