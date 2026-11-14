/**
 * Comparison maths for the renderer parity probe (tactical 251): the same frozen
 * frame drawn by the fixed view and by the 3D scene's top-down camera. Frames
 * are RGBA bytes, rows top first, both `width` pixels wide.
 *
 * A category (props, actors, …) is compared through its footprint: the pixels
 * that change when the category is added to the ground-only picture, in each
 * renderer's own pictures. Footprints say where each renderer draws the
 * category; colours are compared only where both do.
 */

/** Channel difference (0–255) at which two pixels count as different. */
export const PARITY_TOLERANCE = 24;
/** Channel difference at which a pixel belongs to a category's footprint. */
const FOOTPRINT_TOLERANCE = 6;
/** Largest shift, in pixels each way, tried when aligning two pictures. */
const SHIFT_REACH = 3;

/** Largest channel difference between two frames at one pixel. */
function pixelDifference(a: Uint8ClampedArray, b: Uint8ClampedArray, i: number, j = i): number {
  return Math.max(
    Math.abs((a[i] ?? 0) - (b[j] ?? 0)),
    Math.abs((a[i + 1] ?? 0) - (b[j + 1] ?? 0)),
    Math.abs((a[i + 2] ?? 0) - (b[j + 2] ?? 0)),
  );
}

/** Pixels (1) where `frame` differs from `base`: what a category drew over it. */
export function footprint(frame: Uint8ClampedArray, base: Uint8ClampedArray): Uint8Array {
  const mask = new Uint8Array(frame.length / 4);
  for (let p = 0; p < mask.length; p++)
    if (pixelDifference(frame, base, p * 4) > FOOTPRINT_TOLERANCE) mask[p] = 1;
  return mask;
}

export interface ColourDifference {
  /** Pixels compared. */
  pixels: number;
  /** Mean of each pixel's largest channel difference, 0–255. */
  mean: number;
  /** Share of compared pixels that differ by more than `PARITY_TOLERANCE`. */
  over: number;
}

/**
 * Colour difference between `fixed` and `scene` with the 3D picture moved by
 * (dx, dy) pixels, over the pixels where `where` is set (all pixels when
 * omitted). `where` is in the fixed picture's coordinates.
 */
export function colourDifference(
  fixed: Uint8ClampedArray,
  scene: Uint8ClampedArray,
  width: number,
  where?: Uint8Array,
  dx = 0,
  dy = 0,
): ColourDifference {
  const height = fixed.length / 4 / width;
  let pixels = 0,
    sum = 0,
    over = 0;
  for (let y = Math.max(0, dy); y < Math.min(height, height + dy); y++)
    for (let x = Math.max(0, dx); x < Math.min(width, width + dx); x++) {
      const p = y * width + x;
      if (where && !where[p]) continue;
      const d = pixelDifference(fixed, scene, p * 4, ((y - dy) * width + (x - dx)) * 4);
      pixels++;
      sum += d;
      if (d > PARITY_TOLERANCE) over++;
    }
  return { pixels, mean: pixels ? sum / pixels : 0, over: pixels ? over / pixels : 0 };
}

/** Pixels set in both masks and in either, with `scene` moved by (dx, dy). */
function overlapAt(fixed: Uint8Array, scene: Uint8Array, width: number, dx: number, dy: number) {
  const height = fixed.length / width;
  let both = 0,
    either = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = fixed[y * width + x] ?? 0;
      const sx = x - dx,
        sy = y - dy;
      const b = sx >= 0 && sy >= 0 && sx < width && sy < height ? (scene[sy * width + sx] ?? 0) : 0;
      if (a & b) both++;
      if (a | b) either++;
    }
  return { both, either };
}

export interface CategoryParity {
  /** Pixels the category draws in the fixed view and in the 3D scene. */
  fixed: number;
  scene: number;
  /** Share of the pixels either draws that both draw (1 is the same silhouette). */
  overlap: number;
  /** The whole-pixel move of the 3D picture that makes the silhouettes overlap
   * most, and the overlap there. (0, 0) means it is registered. */
  shift: { x: number; y: number };
  shiftedOverlap: number;
  /** Colours where both draw the category, as drawn. */
  colour: ColourDifference;
  /** The same after the best move: differences that are not placement. */
  alignedColour: ColourDifference;
}

/**
 * Compare one category. Each renderer supplies its picture with the category
 * and its picture of the ground alone.
 */
export function compareCategory(
  fixed: { with: Uint8ClampedArray; ground: Uint8ClampedArray },
  scene: { with: Uint8ClampedArray; ground: Uint8ClampedArray },
  width: number,
): CategoryParity {
  const a = footprint(fixed.with, fixed.ground),
    b = footprint(scene.with, scene.ground);
  const count = (mask: Uint8Array) => mask.reduce((n, v) => n + v, 0);
  const share = ({ both, either }: { both: number; either: number }) =>
    either ? both / either : 1;
  const overlap = share(overlapAt(a, b, width, 0, 0));
  let shift = { x: 0, y: 0 },
    shiftedOverlap = overlap;
  for (let dy = -SHIFT_REACH; dy <= SHIFT_REACH; dy++)
    for (let dx = -SHIFT_REACH; dx <= SHIFT_REACH; dx++) {
      if (!dx && !dy) continue;
      const moved = share(overlapAt(a, b, width, dx, dy));
      // A longer move must be clearly better: ties stay at the shorter one.
      if (moved > shiftedOverlap + 1e-6) {
        shift = { x: dx, y: dy };
        shiftedOverlap = moved;
      }
    }
  const bothAt = (dx: number, dy: number) => {
    const height = a.length / width;
    const mask = new Uint8Array(a.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const sx = x - dx,
          sy = y - dy;
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
        if (a[y * width + x] && b[sy * width + sx]) mask[y * width + x] = 1;
      }
    return mask;
  };
  return {
    fixed: count(a),
    scene: count(b),
    overlap,
    shift,
    shiftedOverlap,
    colour: colourDifference(fixed.with, scene.with, width, bothAt(0, 0)),
    alignedColour: colourDifference(
      fixed.with,
      scene.with,
      width,
      bothAt(shift.x, shift.y),
      shift.x,
      shift.y,
    ),
  };
}

export interface FrameParity {
  /** Colours over the whole picture, as drawn. */
  colour: ColourDifference;
  /** The whole-pixel move of the 3D picture with the smallest mean difference. */
  shift: { x: number; y: number };
  alignedColour: ColourDifference;
}

/** Compare two whole pictures (the ground alone, or everything). */
export function compareFrames(
  fixed: Uint8ClampedArray,
  scene: Uint8ClampedArray,
  width: number,
): FrameParity {
  const colour = colourDifference(fixed, scene, width);
  let shift = { x: 0, y: 0 },
    alignedColour = colour;
  for (let dy = -SHIFT_REACH; dy <= SHIFT_REACH; dy++)
    for (let dx = -SHIFT_REACH; dx <= SHIFT_REACH; dx++) {
      if (!dx && !dy) continue;
      const moved = colourDifference(fixed, scene, width, undefined, dx, dy);
      if (moved.mean < alignedColour.mean - 1e-6) {
        shift = { x: dx, y: dy };
        alignedColour = moved;
      }
    }
  return { colour, shift, alignedColour };
}

/** A picture of where two frames differ: grey where they agree, red by how far
 * they do not. For a person to look at beside the numbers. */
export function differencePicture(
  fixed: Uint8ClampedArray,
  scene: Uint8ClampedArray,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(fixed.length);
  for (let i = 0; i < fixed.length; i += 4) {
    const d = pixelDifference(fixed, scene, i);
    const grey = (((fixed[i] ?? 0) + (fixed[i + 1] ?? 0) + (fixed[i + 2] ?? 0)) / 3) * 0.35 + 40;
    const hot = d > PARITY_TOLERANCE ? Math.min(1, 0.45 + d / 255) : 0;
    out[i] = grey + (255 - grey) * hot;
    out[i + 1] = grey * (1 - hot);
    out[i + 2] = grey * (1 - hot);
    out[i + 3] = 255;
  }
  return out;
}
