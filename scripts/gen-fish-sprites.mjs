#!/usr/bin/env node
/**
 * Generate fish spritesheets: 3 colorful fish variants, each with animation frames.
 * Each frame is 16×16. Output: horizontal strip per variant.
 *
 * Fish 1 — Tropical (orange/yellow/white)
 * Fish 2 — Blue tang (blue/yellow/black)
 * Fish 3 — Goldfish (red/orange/gold)
 *
 * 4 frames each: tail-up, neutral, tail-down, neutral (swimming cycle)
 *
 * Output:
 *   public/assets/sprites/fish1.png  (64×16)
 *   public/assets/sprites/fish2.png  (64×16)
 *   public/assets/sprites/fish3.png  (64×16)
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// === Shared transparent ===
const _ = [0, 0, 0, 0];

// ======================================================
// Fish 1 — Tropical clownfish (orange/white/black)
// ======================================================
const O = [240, 130, 30, 255]; // orange body
const W = [255, 255, 255, 255]; // white stripe
const K = [40, 30, 20, 255]; // black outline/eye
const Y = [255, 200, 60, 255]; // yellow-orange tail/fin
const o = [210, 100, 20, 255]; // darker orange shadow
const E = [20, 20, 20, 255]; // eye pupil

// Frame 1: tail up
const F1_1 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, Y, K, O, O, O, K, K, _, _, _, _],
  [_, _, _, _, Y, K, O, O, W, O, O, O, K, _, _, _],
  [_, Y, _, K, Y, O, O, W, O, O, E, O, O, K, _, _],
  [_, _, Y, K, O, O, O, W, O, O, K, O, O, O, K, _],
  [_, _, Y, K, O, O, o, W, O, O, O, O, O, O, K, _],
  [_, Y, _, K, Y, o, o, W, o, O, O, o, o, K, _, _],
  [_, _, _, _, Y, K, o, o, W, o, o, o, K, _, _, _],
  [_, _, _, _, _, Y, K, o, o, o, K, K, _, _, _, _],
  [_, _, _, _, _, _, _, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Frame 2: neutral
const F1_2 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, Y, K, O, O, O, K, K, _, _, _, _],
  [_, _, _, _, Y, K, O, O, W, O, O, O, K, _, _, _],
  [_, _, Y, Y, K, O, O, W, O, O, E, O, O, K, _, _],
  [_, Y, Y, K, O, O, O, W, O, O, K, O, O, O, K, _],
  [_, _, Y, Y, K, O, o, W, O, O, O, O, O, O, K, _],
  [_, _, _, _, Y, K, o, o, W, o, O, o, o, K, _, _],
  [_, _, _, _, _, Y, K, o, o, o, o, o, K, _, _, _],
  [_, _, _, _, _, _, K, o, o, o, K, K, _, _, _, _],
  [_, _, _, _, _, _, _, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Frame 3: tail down
const F1_3 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, Y, K, O, O, O, K, K, _, _, _, _],
  [_, _, _, _, Y, K, O, O, W, O, O, O, K, _, _, _],
  [_, Y, _, K, Y, O, O, W, O, O, E, O, O, K, _, _],
  [_, _, Y, K, O, O, O, W, O, O, K, O, O, O, K, _],
  [_, _, Y, K, O, O, o, W, O, O, O, O, O, O, K, _],
  [_, _, _, K, Y, o, o, W, o, O, O, o, o, K, _, _],
  [_, _, _, _, Y, K, o, o, W, o, o, o, K, _, _, _],
  [_, _, _, _, Y, Y, K, o, o, o, K, K, _, _, _, _],
  [_, _, _, _, _, _, _, K, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Frame 4: same as frame 2 (neutral return)
const F1_4 = F1_2;

// ======================================================
// Fish 2 — Blue tang (blue/yellow/black)
// ======================================================
const B = [50, 100, 220, 255]; // bright blue
const b = [30, 70, 170, 255]; // dark blue
const N = [20, 50, 130, 255]; // navy
const Yl = [255, 220, 50, 255]; // yellow accent
const Wh = [230, 240, 255, 255]; // white belly

// Frame 1: tail up
const F2_1 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, B, B, K, K, _, _, _, _],
  [_, _, _, _, _, K, B, B, B, B, B, B, K, _, _, _],
  [_, _, Yl, K, K, B, B, B, N, B, E, B, B, K, _, _],
  [_, Yl, _, K, B, B, B, N, N, B, K, B, B, B, K, _],
  [_, _, Yl, K, B, B, N, N, Wh, Wh, Wh, B, B, B, K, _],
  [_, _, _, K, K, b, b, N, Wh, Wh, b, b, b, K, _, _],
  [_, _, _, _, _, K, b, b, b, b, b, b, K, _, _, _],
  [_, _, _, _, _, _, K, K, b, b, K, K, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Frame 2: neutral
const F2_2 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, B, B, K, K, _, _, _, _],
  [_, _, _, _, _, K, B, B, B, B, B, B, K, _, _, _],
  [_, _, Yl, Yl, K, B, B, B, N, B, E, B, B, K, _, _],
  [_, Yl, Yl, K, B, B, B, N, N, B, K, B, B, B, K, _],
  [_, _, Yl, Yl, K, B, N, N, Wh, Wh, Wh, B, B, B, K, _],
  [_, _, _, _, K, b, b, N, Wh, Wh, b, b, b, K, _, _],
  [_, _, _, _, _, K, b, b, b, b, b, b, K, _, _, _],
  [_, _, _, _, _, _, K, K, b, b, K, K, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Frame 3: tail down
const F2_3 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, K, K, B, B, K, K, _, _, _, _],
  [_, _, _, _, _, K, B, B, B, B, B, B, K, _, _, _],
  [_, _, _, K, K, B, B, B, N, B, E, B, B, K, _, _],
  [_, _, Yl, K, B, B, B, N, N, B, K, B, B, B, K, _],
  [_, Yl, _, K, B, B, N, N, Wh, Wh, Wh, B, B, B, K, _],
  [_, _, Yl, K, K, b, b, N, Wh, Wh, b, b, b, K, _, _],
  [_, _, _, _, _, K, b, b, b, b, b, b, K, _, _, _],
  [_, _, _, _, _, _, K, K, b, b, K, K, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const F2_4 = F2_2;

// ======================================================
// Fish 3 — Goldfish (red/orange/gold/white)
// ======================================================
const R = [210, 50, 30, 255]; // red
const G = [255, 180, 30, 255]; // gold
const r = [170, 35, 25, 255]; // dark red
const g = [220, 140, 20, 255]; // dark gold
const P = [255, 220, 180, 255]; // pale belly
const Fw = [255, 140, 60, 255]; // fin warm

// Frame 1: tail up — goldfish has a fancier tail
const F3_1 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, _, K, G, G, G, K, _, _, _, _],
  [_, _, _, _, _, K, K, G, G, R, R, G, K, _, _, _],
  [_, _, Fw, K, K, G, G, G, R, R, E, R, R, K, _, _],
  [_, Fw, Fw, K, G, G, G, R, R, R, K, R, R, K, _, _],
  [_, Fw, Fw, K, G, G, g, R, P, P, R, R, R, K, _, _],
  [_, _, Fw, K, K, g, g, g, P, P, r, r, r, K, _, _],
  [_, _, _, _, _, K, K, g, r, r, r, r, K, _, _, _],
  [_, _, _, _, _, _, _, K, r, r, K, K, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Frame 2: neutral
const F3_2 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, _, K, G, G, G, K, _, _, _, _],
  [_, _, _, _, _, K, K, G, G, R, R, G, K, _, _, _],
  [_, _, _, Fw, K, G, G, G, R, R, E, R, R, K, _, _],
  [_, _, Fw, K, G, G, G, R, R, R, K, R, R, K, _, _],
  [_, Fw, Fw, K, G, G, g, R, P, P, R, R, R, K, _, _],
  [_, _, Fw, _, K, g, g, g, P, P, r, r, r, K, _, _],
  [_, _, _, _, _, K, K, g, r, r, r, r, K, _, _, _],
  [_, _, _, _, _, _, _, K, r, r, K, K, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Frame 3: tail down
const F3_3 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, K, _, _, _, _, _],
  [_, _, _, _, _, _, _, K, G, G, G, K, _, _, _, _],
  [_, _, _, _, _, K, K, G, G, R, R, G, K, _, _, _],
  [_, _, _, K, K, G, G, G, R, R, E, R, R, K, _, _],
  [_, _, Fw, K, G, G, G, R, R, R, K, R, R, K, _, _],
  [_, _, Fw, K, G, G, g, R, P, P, R, R, R, K, _, _],
  [_, Fw, Fw, K, K, g, g, g, P, P, r, r, r, K, _, _],
  [_, _, Fw, _, _, K, K, g, r, r, r, r, K, _, _, _],
  [_, _, _, _, _, _, _, K, r, r, K, K, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, K, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const F3_4 = F3_2;

// ======================================================
// PNG encoder (from gen-grass-blades.mjs)
// ======================================================
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

// ======================================================
// Render frames into horizontal strip
// ======================================================
function renderStrip(frames) {
  const frameCount = frames.length;
  const width = 16 * frameCount;
  const height = 16;
  const rgba = new Uint8Array(width * height * 4);

  for (let f = 0; f < frameCount; f++) {
    const grid = frames[f];
    const ox = f * 16;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const color = grid[y][x];
        const idx = (y * width + (ox + x)) * 4;
        rgba[idx] = color[0];
        rgba[idx + 1] = color[1];
        rgba[idx + 2] = color[2];
        rgba[idx + 3] = color[3];
      }
    }
  }

  const buf = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  return encodePNG(width, height, buf);
}

// ======================================================
// Write output files
// ======================================================
const base = new URL("../public/assets/sprites/", import.meta.url).pathname;

const fish = [
  { name: "fish1", frames: [F1_1, F1_2, F1_3, F1_4], desc: "Tropical clownfish" },
  { name: "fish2", frames: [F2_1, F2_2, F2_3, F2_4], desc: "Blue tang" },
  { name: "fish3", frames: [F3_1, F3_2, F3_3, F3_4], desc: "Goldfish" },
];

for (const { name, frames, desc } of fish) {
  const png = renderStrip(frames);
  const path = `${base}${name}.png`;
  writeFileSync(path, png);
  console.log(`Wrote ${path} (${png.length} bytes) — ${desc}, ${frames.length} frames`);
}
