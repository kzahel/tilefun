#!/usr/bin/env node
/**
 * Generate grass blade spritesheet: 4 variants in 8×8 cells → 32×8 PNG.
 *
 * Variants: big-A, big-B, small-A, small-B
 * Each is a V-shaped pair of blades with graduated color (light tip → dark base → shadow).
 * Colors match ME grass autotile palette (~#6B935F base).
 *
 * Rotation anchor for rendering: bottom-center of each blade's shadow area.
 * Big variants: anchor (3, 6) within cell. Small variants: anchor (3, 5).
 *
 * Output: public/assets/sprites/grass-blades.png
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// === Colors (RGBA) — matched to ME grass palette ===
const _ = [0, 0, 0, 0]; // transparent
const T = [141, 192, 122, 255]; // tip — lightest, catches light
const M = [94, 150, 70, 255]; // mid — main blade body
const D = [62, 110, 48, 255]; // dark — inner stem
const S = [42, 80, 34, 180]; // shadow — semi-transparent base

// === Blade variants (8×8 each) ===
// Big V-A: wide symmetric V
const BIG_A = [
  [_, T, _, _, _, _, T, _],
  [_, M, _, _, _, _, M, _],
  [_, _, M, _, _, M, _, _],
  [_, _, D, _, _, D, _, _],
  [_, _, _, D, D, _, _, _],
  [_, _, _, D, D, _, _, _],
  [_, _, _, S, S, _, _, _],
  [_, _, _, _, _, _, _, _],
];

// Big V-B: asymmetric V, right blade taller
const BIG_B = [
  [_, _, _, _, _, _, T, _],
  [_, T, _, _, _, _, M, _],
  [_, M, _, _, _, M, _, _],
  [_, _, M, _, M, _, _, _],
  [_, _, D, _, D, _, _, _],
  [_, _, _, D, D, _, _, _],
  [_, _, _, S, S, _, _, _],
  [_, _, _, _, _, _, _, _],
];

// Small V-A: compact symmetric
const SMALL_A = [
  [_, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _],
  [_, _, T, _, _, T, _, _],
  [_, _, M, _, _, M, _, _],
  [_, _, _, D, D, _, _, _],
  [_, _, _, S, S, _, _, _],
  [_, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _],
];

// Small V-B: narrow tight V
const SMALL_B = [
  [_, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _],
  [_, _, T, _, T, _, _, _],
  [_, _, M, _, M, _, _, _],
  [_, _, _, D, _, _, _, _],
  [_, _, _, S, _, _, _, _],
  [_, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _],
];

const VARIANTS = [BIG_A, BIG_B, SMALL_A, SMALL_B];

// === Compose into 32×8 RGBA buffer ===
const WIDTH = 32;
const HEIGHT = 8;
const rgba = new Uint8Array(WIDTH * HEIGHT * 4);

for (let v = 0; v < VARIANTS.length; v++) {
  const grid = VARIANTS[v];
  const ox = v * 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const color = grid[y][x];
      const idx = (y * WIDTH + (ox + x)) * 4;
      rgba[idx] = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = color[3];
    }
  }
}

// === Minimal PNG encoder (reused from gen-debug-tileset.mjs) ===
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
const outPath = new URL("../public/assets/sprites/grass-blades.png", import.meta.url).pathname;
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes)`);
console.log("Layout: 4 × 8×8 cells [big-A, big-B, small-A, small-B]");
console.log("Anchor points (within cell):");
console.log("  Big variants:   (3, 6) — bottom-center of shadow");
console.log("  Small variants: (3, 5) — bottom-center of shadow");
