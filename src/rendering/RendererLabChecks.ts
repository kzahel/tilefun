/** Pixel checks for the GPU renderer lab (232). Without a second renderer to
 * compare against, the lab asserts GPU invariants and explicit expected values. */

export type Rect = { x: number; y: number; width: number; height: number };

function rgba(hex: string): [number, number, number, number] {
  const value = hex.replace("#", "");
  const channel = (i: number) => Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return [channel(0), channel(1), channel(2), value.length >= 8 ? channel(3) : 255];
}

/** Count pixels per expected color (first within `tolerance` per channel), with each
 * color's pixel bounds `[left, top, right, bottom]` (inclusive), so mirrored or moved
 * content fails even when the counts hold. */
export function paletteCounts(
  pixels: Uint8ClampedArray,
  width: number,
  colors: readonly string[],
  tolerance = 2,
) {
  const palette = colors.map(rgba);
  const counts = palette.map(() => 0);
  const bounds: ([number, number, number, number] | null)[] = palette.map(() => null);
  let other = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const index = palette.findIndex((color) =>
      color.every((value, c) => Math.abs((pixels[i + c] ?? 0) - value) <= tolerance),
    );
    if (index < 0) {
      other++;
      continue;
    }
    counts[index] = (counts[index] ?? 0) + 1;
    const x = (i / 4) % width,
      y = Math.floor(i / 4 / width);
    const box = bounds[index];
    if (!box) bounds[index] = [x, y, x, y];
    else {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
  }
  return { counts, bounds, other };
}

/** Exact colors and their counts, most common first: the source of expected palettes. */
export function histogram(pixels: Uint8ClampedArray, min = 1) {
  const counts = new Map<string, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    let key = "#";
    for (let c = 0; c < 4; c++) key += (pixels[i + c] ?? 0).toString(16).padStart(2, "0");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]));
}

const inside = (x: number, y: number, rects: readonly Rect[]) =>
  rects.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);

/** Pixel centers inside the union must match the unclipped frame; outside, the clear
 * color. `outsideContent` counts unclipped pixels outside the union that are not the
 * clear color, so the check is not vacuous. */
export function clipErrors(
  clipped: Uint8ClampedArray,
  unclipped: Uint8ClampedArray,
  width: number,
  rects: readonly Rect[],
  clear: string,
) {
  const background = rgba(clear);
  let errors = 0,
    outsideContent = 0;
  for (let i = 0; i < clipped.length; i += 4) {
    const x = (i / 4) % width,
      y = Math.floor(i / 4 / width);
    const within = inside(x + 0.5, y + 0.5, rects);
    if (!within && [0, 1, 2, 3].some((c) => unclipped[i + c] !== background[c])) outsideContent++;
    for (let c = 0; c < 4; c++) {
      const expected = within ? (unclipped[i + c] ?? 0) : background[c];
      if (clipped[i + c] !== expected) {
        errors++;
        break;
      }
    }
  }
  return { errors, outsideContent };
}

/** A faded layer is the per-channel blend of its full and absent frames. */
export function fadeError(
  frame: Uint8ClampedArray,
  full: Uint8ClampedArray,
  none: Uint8ClampedArray,
  alpha: number,
) {
  let error = 0;
  for (let i = 0; i < frame.length; i++) {
    const expected = alpha * (full[i] ?? 0) + (1 - alpha) * (none[i] ?? 0);
    error = Math.max(error, Math.abs((frame[i] ?? 0) - expected));
  }
  return error;
}

/** Changes from `base` to `frame`: how many fall outside `bounds`, and the darkening
 * mass and centroid (shadows only darken). */
export function difference(
  frame: Uint8ClampedArray,
  base: Uint8ClampedArray,
  width: number,
  bounds?: Rect,
) {
  let outside = 0,
    mass = 0,
    x = 0,
    y = 0;
  for (let i = 0; i < frame.length; i += 4) {
    const px = (i / 4) % width,
      py = Math.floor(i / 4 / width);
    let changed = false,
      dark = 0;
    for (let c = 0; c < 4; c++) {
      if (frame[i + c] !== base[i + c]) changed = true;
      if (c < 3) dark += Math.max(0, (base[i + c] ?? 0) - (frame[i + c] ?? 0));
    }
    if (changed && bounds && !inside(px, py, [bounds])) outside++;
    mass += dark;
    x += dark * (px + 0.5);
    y += dark * (py + 0.5);
  }
  return { outside, mass, x: mass ? x / mass : 0, y: mass ? y / mass : 0 };
}

/** Largest error of a solid fill at `alpha` composited over `base` inside `rect`. */
export function fillError(
  frame: Uint8ClampedArray,
  base: Uint8ClampedArray,
  width: number,
  rect: Rect,
  fill: string,
  alpha: number,
) {
  const color = rgba(fill);
  let error = 0;
  for (let y = rect.y; y < rect.y + rect.height; y++)
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const expected = alpha * (color[c] ?? 0) + (1 - alpha) * (base[i + c] ?? 0);
        error = Math.max(error, Math.abs((frame[i + c] ?? 0) - expected));
      }
    }
  return error;
}
