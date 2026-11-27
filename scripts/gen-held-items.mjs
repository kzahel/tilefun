/**
 * Writes public/assets/farming/held-items.png: 8×8 avatar attachments.
 * Columns follow the inventory item codes (code − 1), then the open hand
 * (`HAND_FRAME`). Row 0 is the carried pose; rows 1 and 2 are the use poses
 * (wind-up and follow-through). Items without their own use poses repeat row 0.
 *
 *   node scripts/gen-held-items.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const PALETTE = {
  // Corn (unchanged from the original hotbar sheet).
  Y: "#f8bd43",
  b: "#b5732c",
  C: "#fff0a1",
  L: "#65a94e",
  D: "#40824b",
  // Wood bundle, stick and handles.
  a: "#ab7750",
  e: "#e2b076",
  o: "#4b3226",
  m: "#76513a",
  // Ball (matches the thrown ball sprite).
  r: "#dc3232",
  p: "#ff8c8c",
  h: "#ffc8c8",
  // Axe head.
  k: "#5b6470",
  g: "#9aa3ad",
  G: "#dfe5ea",
  // Cartoon glove, so the wave suits every character.
  w: "#f6f2e6",
  W: "#c4bba6",
  O: "#5a4636",
};

// biome-ignore format: pixel rows read as the sprite
const CORN = [
  "..YYYY..",
  ".bCCCY..",
  ".bCCCY..",
  ".bCCCLL.",
  ".DDCCLL.",
  ".DDYYLL.",
  ".DDYYLL.",
  ".DD.....",
];
// biome-ignore format: pixel rows read as the sprite
const WOOD = [
  "........",
  "........",
  "aeaommem",
  "aeaommee",
  "oooooooo",
  "........",
  "........",
  "........",
];
// biome-ignore format: pixel rows read as the sprite
const BALL = [
  "........",
  "...rr...",
  "..rhrr..",
  ".rppprr.",
  ".rrprrr.",
  "..rrrr..",
  "...rr...",
  "........",
];
// biome-ignore format: pixel rows read as the sprite
const STICK = [
  [
    ".......o",
    "......oa",
    ".....oa.",
    "....oa..",
    "...oa...",
    "..oa....",
    ".oa.....",
    "oa......",
  ],
  [
    "...oa...",
    "...oa...",
    "...oa...",
    "...oa...",
    "...oa...",
    "...oa...",
    "...oa...",
    "...om...",
  ],
  [
    "........",
    "........",
    "........",
    "........",
    "........",
    "aaaaaaae",
    "oooooooo",
    "........",
  ],
];
// biome-ignore format: pixel rows read as the sprite
const AXE = [
  [
    "....kkk.",
    "...kggGk",
    "...okgGk",
    "..oa.kk.",
    ".oa.....",
    "oa......",
    "a.......",
    "........",
  ],
  [
    "...okkk.",
    "...ogGGk",
    "...oggGk",
    "...okkk.",
    "...oa...",
    "...oa...",
    "...oa...",
    "...om...",
  ],
  [
    "........",
    "........",
    "........",
    "........",
    "......kk",
    "aaaaaagk",
    "ooooooGk",
    "......kk",
  ],
];
// biome-ignore format: pixel rows read as the sprite
const HAND = [
  ".O.O.O..",
  "OwOwOwO.",
  "OwwwwwOO",
  "OwwwwwOw",
  "OwwwwwwO",
  ".OwwwWO.",
  "..OWWO..",
  "...OO...",
]

const same = (frame) => [frame, frame, frame];
const columns = [
  same(CORN),
  same(WOOD),
  same(BALL),
  STICK,
  AXE,
  same(HAND),
  same([
    "........",
    ".oooooo.",
    ".aeeaea.",
    ".aeWWea.",
    ".aaaaaa.",
    ".ammmma.",
    ".oooooo.",
    "........",
  ]),
];
const ROWS = 3;
const SIZE = 8;

const png = new PNG({ width: columns.length * SIZE, height: ROWS * SIZE });
png.data.fill(0);
for (const [column, poses] of columns.entries()) {
  for (const [row, frame] of poses.entries()) {
    if (frame.length !== SIZE || frame.some((line) => line.length !== SIZE))
      throw Error(`Frame ${column},${row} must be ${SIZE}×${SIZE}`);
    for (const [y, line] of frame.entries()) {
      for (const [x, key] of [...line].entries()) {
        if (key === ".") continue;
        const hex = PALETTE[key];
        if (!hex) throw Error(`Unknown palette key ${key}`);
        const i = ((row * SIZE + y) * png.width + column * SIZE + x) * 4;
        png.data[i] = Number.parseInt(hex.slice(1, 3), 16);
        png.data[i + 1] = Number.parseInt(hex.slice(3, 5), 16);
        png.data[i + 2] = Number.parseInt(hex.slice(5, 7), 16);
        png.data[i + 3] = 255;
      }
    }
  }
}
const out = fileURLToPath(new URL("../public/assets/farming/held-items.png", import.meta.url));
writeFileSync(out, PNG.sync.write(png));
console.log(`Wrote ${out} (${png.width}×${png.height})`);
