#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngjs from "pngjs";

const { PNG } = pngjs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "test-results", "interiors");
const sourceDir = path.join(
  repoRoot,
  "assets",
  "interiors",
  "1_Interiors",
  "16x16",
  "Room_Builder_subfiles",
);

const FONT = {
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"],
  7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
  c: ["111", "100", "100", "100", "111"],
  r: ["110", "101", "110", "101", "101"],
  "-": ["000", "000", "111", "000", "000"],
};

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function fillRect(png, x, y, width, height, r, g, b, a = 255) {
  for (let yy = 0; yy < height; yy++) {
    for (let xx = 0; xx < width; xx++) {
      setPixel(png, x + xx, y + yy, r, g, b, a);
    }
  }
}

function copyScaled(src, dest, srcX, srcY, width, height, destX, destY, scale) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((srcY + y) * src.width + (srcX + x)) * 4;
      for (let yy = 0; yy < scale; yy++) {
        for (let xx = 0; xx < scale; xx++) {
          const destIdx = ((destY + y * scale + yy) * dest.width + (destX + x * scale + xx)) * 4;
          dest.data[destIdx] = src.data[srcIdx];
          dest.data[destIdx + 1] = src.data[srcIdx + 1];
          dest.data[destIdx + 2] = src.data[srcIdx + 2];
          dest.data[destIdx + 3] = src.data[srcIdx + 3];
        }
      }
    }
  }
}

function drawText(png, text, x, y, r = 235, g = 240, b = 255) {
  let cursorX = x;
  for (const ch of text) {
    const glyph = FONT[ch];
    if (!glyph) {
      cursorX += 4;
      continue;
    }
    for (let gy = 0; gy < glyph.length; gy++) {
      for (let gx = 0; gx < glyph[gy].length; gx++) {
        if (glyph[gy][gx] === "1") setPixel(png, cursorX + gx, y + gy, r, g, b, 255);
      }
    }
    cursorX += 5;
  }
}

function writeSourceGrid({ sourceName, outName, cols, rows, scale }) {
  const src = readPng(path.join(sourceDir, sourceName));
  const tileSize = 16 * scale;
  const labelHeight = 11;
  const out = new PNG({ width: cols * tileSize, height: rows * (tileSize + labelHeight) });
  fillRect(out, 0, 0, out.width, out.height, 13, 17, 24, 255);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * tileSize;
      const y = row * (tileSize + labelHeight);
      copyScaled(src, out, col * 16, row * 16, 16, 16, x, y, scale);
      for (let i = 0; i < tileSize; i++) {
        setPixel(out, x + i, y, 70, 86, 112);
        setPixel(out, x + i, y + tileSize - 1, 70, 86, 112);
        setPixel(out, x, y + i, 70, 86, 112);
        setPixel(out, x + tileSize - 1, y + i, 70, 86, 112);
      }
      drawText(
        out,
        `c${String(col).padStart(2, "0")}-r${String(row).padStart(2, "0")}`,
        x + 1,
        y + tileSize + 2,
      );
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, outName), PNG.sync.write(out));
}

writeSourceGrid({
  sourceName: "Room_Builder_borders_16x16.png",
  outName: "borders-source-grid.png",
  cols: 45,
  rows: 10,
  scale: 2,
});
writeSourceGrid({
  sourceName: "Room_Builder_Baseboards_16x16.png",
  outName: "baseboards-source-grid.png",
  cols: 6,
  rows: 6,
  scale: 4,
});
writeSourceGrid({
  sourceName: "Room_Builder_3d_walls_16x16.png",
  outName: "3d-walls-source-grid.png",
  cols: 24,
  rows: 20,
  scale: 2,
});

console.log(`Wrote source-grid captures to ${path.relative(repoRoot, outDir)}`);
