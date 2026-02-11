#!/usr/bin/env node
/**
 * Parses the Godot .tscn terrain peering bit data from Maaack/Sprout-Lands-Tilemap
 * and outputs a JSON autotile metadata file mapping 8-bit bitmask → (col, row).
 *
 * Usage:
 *   node scripts/parse-tscn.mjs < sprout_lands_tile_map.tscn > grass-autotile.json
 *   node scripts/parse-tscn.mjs --source TileSetAtlasSource_1kfwu --terrain 1 --sheet dirt < ... > dirt-autotile.json
 *
 * Options:
 *   --source ID    TileSetAtlasSource ID in .tscn (default: TileSetAtlasSource_2v0he for Grass)
 *   --terrain N    Terrain value to match (default: 0 for Grass, 1 for Dirt)
 *   --sheet NAME   Sheet name in output JSON (default: grass)
 */

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    source: { type: "string", default: "TileSetAtlasSource_2v0he" },
    terrain: { type: "string", default: "0" },
    sheet: { type: "string", default: "grass" },
  },
});

const PEERING_BIT_MAP = {
  top_side: 1,
  left_side: 2,
  right_side: 4,
  bottom_side: 8,
  top_left_corner: 16,
  top_right_corner: 32,
  bottom_left_corner: 64,
  bottom_right_corner: 128,
};

function parseTscn(text, sourceId, terrainValue, sheetName) {
  const lines = text.split("\n");
  let inSource = false;
  const tiles = new Map(); // "col:row" → { col, row, peeringBits: Set<string> }

  const peeringRe = new RegExp(
    `^(\\d+):(\\d+)\\/0\\/terrains_peering_bit\\/(\\w+)\\s*=\\s*${terrainValue}$`,
  );
  const terrainRe = new RegExp(`^(\\d+):(\\d+)\\/0\\/terrain\\s*=\\s*${terrainValue}$`);

  for (const line of lines) {
    if (line.includes('[sub_resource type="TileSetAtlasSource"') && line.includes(sourceId)) {
      inSource = true;
      continue;
    }
    if (inSource && line.startsWith("[sub_resource")) {
      break;
    }
    if (!inSource) continue;

    const peeringMatch = line.match(peeringRe);
    if (peeringMatch) {
      const col = Number(peeringMatch[1]);
      const row = Number(peeringMatch[2]);
      const bitName = peeringMatch[3];
      const key = `${col}:${row}`;
      if (!tiles.has(key)) {
        tiles.set(key, { col, row, peeringBits: new Set() });
      }
      tiles.get(key).peeringBits.add(bitName);
      continue;
    }

    const terrainMatch = line.match(terrainRe);
    if (terrainMatch) {
      const col = Number(terrainMatch[1]);
      const row = Number(terrainMatch[2]);
      const key = `${col}:${row}`;
      if (!tiles.has(key)) {
        tiles.set(key, { col, row, peeringBits: new Set() });
      }
    }
  }

  // Convert peering bits to 8-bit bitmask
  const variants = [];
  for (const [, tile] of tiles) {
    let mask = 0;
    for (const bitName of tile.peeringBits) {
      const bitValue = PEERING_BIT_MAP[bitName];
      if (bitValue !== undefined) {
        mask |= bitValue;
      }
    }
    variants.push({ mask, col: tile.col, row: tile.row });
  }

  // Sort by mask for readability
  variants.sort((a, b) => a.mask - b.mask);

  return {
    sheet: sheetName,
    tileSize: 16,
    description: `8-bit blob autotile lookup for Sprout Lands ${sheetName}.png. Generated from Godot .tscn terrain peering data.`,
    bits: {
      N: 1,
      W: 2,
      E: 4,
      S: 8,
      NW: 16,
      NE: 32,
      SW: 64,
      SE: 128,
    },
    variants,
  };
}

const input = readFileSync(process.stdin.fd, "utf-8");
const result = parseTscn(input, args.source, args.terrain, args.sheet);
console.log(JSON.stringify(result, null, "\t"));
