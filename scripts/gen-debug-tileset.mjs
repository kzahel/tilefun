#!/usr/bin/env node
/**
 * Generate a 3-color debug GM blob autotile sheet (192×64, 12×4 grid of 16×16 tiles).
 * Green primary (opaque), transparent secondary (base shows through), red border.
 * Output: public/assets/tilesets/debug-3color.png
 *
 * Uses raw PNG encoding (no dependencies).
 */
import { writeFileSync } from "fs";
import { deflateSync } from "zlib";

// === Colors (RGBA) ===
const GREEN = [74, 154, 58, 255];
const RED = [204, 34, 34, 255];
const TRANSPARENT = [0, 0, 0, 0];

// Pixel values: 0=transparent(secondary), 1=green(primary), 2=red(border)
const PIXEL_COLORS = [TRANSPARENT, GREEN, RED];

// === GM Blob Layout ===
const N = 1,
  W = 2,
  E = 4,
  S = 8,
  NW = 16,
  NE = 32,
  SW = 64,
  SE = 128;

const GM_BLOB_47 = [
  [255, 1, 0],
  [239, 2, 0],
  [223, 3, 0],
  [207, 4, 0],
  [127, 5, 0],
  [111, 6, 0],
  [95, 7, 0],
  [79, 8, 0],
  [191, 9, 0],
  [175, 10, 0],
  [159, 11, 0],
  [143, 0, 1],
  [63, 1, 1],
  [47, 2, 1],
  [31, 3, 1],
  [15, 4, 1],
  [173, 5, 1],
  [141, 6, 1],
  [45, 7, 1],
  [13, 8, 1],
  [206, 9, 1],
  [78, 10, 1],
  [142, 11, 1],
  [14, 0, 2],
  [91, 1, 2],
  [27, 2, 2],
  [75, 3, 2],
  [11, 4, 2],
  [55, 5, 2],
  [39, 6, 2],
  [23, 7, 2],
  [7, 8, 2],
  [9, 9, 2],
  [6, 10, 2],
  [140, 11, 2],
  [12, 0, 3],
  [74, 1, 3],
  [10, 2, 3],
  [19, 3, 3],
  [3, 4, 3],
  [37, 5, 3],
  [5, 6, 3],
  [8, 7, 3],
  [4, 8, 3],
  [1, 9, 3],
  [2, 10, 3],
  [0, 11, 3],
];

// === Tile rendering ===
//
// Each 16×16 tile = four 8×8 quadrants. Each quadrant is determined by
// 2 cardinal bits (H=N/S, V=W/E) + 1 diagonal bit.
//
// EDGE RULES for correct seams between adjacent tiles:
//   - Cardinal bit SET → corresponding edge must be solid green (opaque)
//   - Cardinal bit NOT SET → corresponding edge must be transparent
//   - Inner edges (toward tile center) are always green
//
// We use a signed distance field approach: for each pixel in a quadrant,
// compute whether it's inside the green region based on the mask bits.

const QUADRANTS = [
  { cardH: N, cardV: W, diag: NW, ox: 0, oy: 0 },
  { cardH: N, cardV: E, diag: NE, ox: 8, oy: 0 },
  { cardH: S, cardV: W, diag: SW, ox: 0, oy: 8 },
  { cardH: S, cardV: E, diag: SE, ox: 8, oy: 8 },
];

function renderTile(mask) {
  const pixels = new Uint8Array(16 * 16);
  for (const q of QUADRANTS) {
    const hasH = !!(mask & q.cardH);
    const hasV = !!(mask & q.cardV);
    const hasDiag = !!(mask & q.diag);
    renderQuadrant(pixels, q.ox, q.oy, hasH, hasV, hasDiag);
  }
  return pixels;
}

function renderQuadrant(pixels, qox, qoy, hasH, hasV, hasDiag) {
  // Inner corner = toward tile center; outer corner = toward tile edge/neighbor
  const innerX = qox < 4 ? 7 : 0;
  const innerY = qoy < 4 ? 7 : 0;
  const outerX = 7 - innerX;
  const outerY = 7 - innerY;

  for (let py = 0; py < 8; py++) {
    for (let px = 0; px < 8; px++) {
      let primary;

      if (hasH && hasV && hasDiag) {
        // Full: entirely green
        primary = true;
      } else if (hasH && hasV && !hasDiag) {
        // Concave: green except rounded notch at outer corner
        const dx = px - outerX;
        const dy = py - outerY;
        primary = Math.sqrt(dx * dx + dy * dy) >= 3.5;
      } else if (hasH && hasV) {
        primary = true; // shouldn't reach here, but safety
      } else if (!hasH && !hasV) {
        // No cardinals: convex green blob near inner corner only
        const dx = px - innerX;
        const dy = py - innerY;
        primary = Math.sqrt(dx * dx + dy * dy) <= 5.5;
      } else {
        // Exactly one cardinal set. Green extends from center and along the
        // set cardinal's edge, creating a convex shape. The unset cardinal's
        // edge must be transparent.
        //
        // We define the green region as: distance from the "brown corner" >= radius.
        // The brown corner is where the unset cardinal edge meets the outer edge.
        //
        // For H-only (e.g. N=1, W=0 in NW quadrant):
        //   Brown corner = (outerX, innerY) = where W-edge meets inner-bottom
        //   This puts brown near bottom-left, green near top and right.
        //   BUT we must ensure outerX column (W edge) is fully transparent.
        //
        // For V-only (e.g. W=1, N=0 in NW quadrant):
        //   Brown corner = (innerX, outerY) = where N-edge meets inner-right
        //   Brown near top-right, green near left and bottom.

        if (hasH) {
          // H cardinal set, V not set
          // The V-edge column (px near outerX) must be transparent
          // The H-edge row (py near outerY) must be green
          // Inner edges always green
          const distFromOuter = Math.abs(px - outerX);
          const distFromInner = Math.abs(py - innerY);
          // Green if: close to H-edge (top/bottom) OR close to inner,
          // but NOT close to V-edge (left/right outer)
          // Use a simple threshold: brown within a circle near the V-outer+inner corner
          const cx = outerX + (outerX < 4 ? -0.5 : 0.5);
          const cy = innerY + (innerY < 4 ? -0.5 : 0.5);
          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          primary = dist >= 5.0;
        } else {
          // V cardinal set, H not set (mirror of above)
          const cx = innerX + (innerX < 4 ? -0.5 : 0.5);
          const cy = outerY + (outerY < 4 ? -0.5 : 0.5);
          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          primary = dist >= 5.0;
        }
      }

      pixels[(qoy + py) * 16 + (qox + px)] = primary ? 1 : 0;
    }
  }
}

function addBorder(pixels) {
  const out = new Uint8Array(pixels);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = y * 16 + x;
      const val = pixels[idx];
      if (val !== 1) continue; // only green pixels can become border
      // Check 4-connected neighbors for transparent
      const check = (nx, ny) => {
        if (nx < 0 || ny < 0 || nx >= 16 || ny >= 16) return false;
        return pixels[ny * 16 + nx] === 0;
      };
      if (check(x - 1, y) || check(x + 1, y) || check(x, y - 1) || check(x, y + 1)) {
        out[idx] = 2; // red border
      }
    }
  }
  return out;
}

// === Generate sheet pixels ===
const WIDTH = 192,
  HEIGHT = 64;
const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
// Default: all transparent
rgba.fill(0);

for (const [mask, col, row] of GM_BLOB_47) {
  const tile = renderTile(mask);
  const bordered = addBorder(tile);
  const tileX = col * 16,
    tileY = row * 16;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = PIXEL_COLORS[bordered[y * 16 + x]];
      const idx = ((tileY + y) * WIDTH + (tileX + x)) * 4;
      rgba[idx] = c[0];
      rgba[idx + 1] = c[1];
      rgba[idx + 2] = c[2];
      rgba[idx + 3] = c[3];
    }
  }
}

// Position (0,0) is unused in GM blob — fill with a subtle marker
for (let y = 0; y < 16; y++) {
  for (let x = 0; x < 16; x++) {
    const idx = (y * WIDTH + x) * 4;
    rgba[idx] = 50;
    rgba[idx + 1] = 50;
    rgba[idx + 2] = 50;
    rgba[idx + 3] = 255;
  }
}

// === Minimal PNG encoder ===
function encodePNG(width, height, rgbaData) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBuffer = Buffer.from(type, "ascii");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length);
    const crcInput = Buffer.concat([typeBuffer, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcInput));
    return Buffer.concat([lenBuf, typeBuffer, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    const srcOff = y * width * 4;
    const dstOff = y * (1 + width * 4) + 1;
    for (let i = 0; i < width * 4; i++) raw[dstOff + i] = rgbaData[srcOff + i];
  }
  const compressed = deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const rgbaBuf = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
const png = encodePNG(WIDTH, HEIGHT, rgbaBuf);
const outPath = new URL("../public/assets/tilesets/debug-3color.png", import.meta.url).pathname;
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes)`);
