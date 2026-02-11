#!/usr/bin/env node
/**
 * Parses the Godot .tscn terrain peering bit data from Maaack/Sprout-Lands-Tilemap
 * and outputs a JSON autotile metadata file mapping 8-bit bitmask → (col, row) in Grass.png.
 *
 * Usage: node scripts/parse-tscn.mjs < sprout_lands_tile_map.tscn > grass-autotile.json
 *
 * The .tscn file can be downloaded from:
 *   https://github.com/Maaack/Sprout-Lands-Tilemap/blob/main/addons/sprout_lands_tilemap/base/scenes/sprout_lands_tile_map.tscn
 *
 * Bitmask bits:
 *   N=1, W=2, E=4, S=8, NW=16, NE=32, SW=64, SE=128
 *
 * Godot peering bit names → our bit values:
 *   top_side → N(1), left_side → W(2), right_side → E(4), bottom_side → S(8)
 *   top_left_corner → NW(16), top_right_corner → NE(32)
 *   bottom_left_corner → SW(64), bottom_right_corner → SE(128)
 */

import { readFileSync } from "node:fs";

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

function parseTscn(text) {
	// Find the first TileSetAtlasSource (Grass.png)
	const lines = text.split("\n");
	let inGrassSource = false;
	const tiles = new Map(); // "col:row" → { col, row, peeringBits: Set<string> }

	for (const line of lines) {
		// Detect start of Grass.png atlas source
		if (
			line.includes('[sub_resource type="TileSetAtlasSource"') &&
			line.includes("TileSetAtlasSource_2v0he")
		) {
			inGrassSource = true;
			continue;
		}
		// Detect start of next sub_resource (end of Grass section)
		if (inGrassSource && line.startsWith("[sub_resource")) {
			break;
		}
		if (!inGrassSource) continue;

		// Parse terrain_set=0 and terrain=0 tiles with peering bits
		const peeringMatch = line.match(/^(\d+):(\d+)\/0\/terrains_peering_bit\/(\w+)\s*=\s*0$/);
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

		// Also capture tiles with terrain=0 but no peering bits (isolated/variant tiles)
		const terrainMatch = line.match(/^(\d+):(\d+)\/0\/terrain\s*=\s*0$/);
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
		sheet: "grass",
		tileSize: 16,
		description:
			"8-bit blob autotile lookup for Sprout Lands Grass.png. Generated from Godot .tscn terrain peering data.",
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
const result = parseTscn(input);
console.log(JSON.stringify(result, null, "\t"));
