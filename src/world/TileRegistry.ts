/** Tile type identifiers. 0 is reserved for "empty". */
export enum TileId {
	Empty = 0,
	Grass = 1,
	Water = 2,
	Sand = 3,
	Forest = 4,
	DenseForest = 5,
	DeepWater = 6,
	// Detail tiles (decoration layer)
	FlowerRed = 10,
	FlowerYellow = 11,
	TallGrass = 12,
}

/** Collision bitfield flags. */
export const CollisionFlag = {
	None: 0,
	Solid: 1,
	Water: 2,
	SlowWalk: 4,
} as const;

export type CollisionFlags = number;

/** Static definition for a tile type. */
export interface TileDefinition {
	sheetKey: string;
	spriteCol: number;
	spriteRow: number;
	collision: CollisionFlags;
}

const registry = new Map<TileId, TileDefinition>();

export function registerTile(id: TileId, def: TileDefinition): void {
	registry.set(id, def);
}

export function getTileDef(id: TileId): TileDefinition | undefined {
	return registry.get(id);
}

/** Register built-in tiles. Call once at startup. */
export function registerDefaultTiles(): void {
	// Terrain tiles
	registerTile(TileId.Grass, {
		sheetKey: "grass",
		spriteCol: 2,
		spriteRow: 4,
		collision: CollisionFlag.None,
	});
	registerTile(TileId.Water, {
		sheetKey: "water",
		spriteCol: 0,
		spriteRow: 0,
		collision: CollisionFlag.Water,
	});
	registerTile(TileId.DeepWater, {
		sheetKey: "water",
		spriteCol: 0,
		spriteRow: 0,
		collision: CollisionFlag.Water,
	});
	registerTile(TileId.Sand, {
		sheetKey: "dirt",
		spriteCol: 2,
		spriteRow: 4,
		collision: CollisionFlag.None,
	});
	registerTile(TileId.Forest, {
		sheetKey: "grass",
		spriteCol: 2,
		spriteRow: 4,
		collision: CollisionFlag.None,
	});
	registerTile(TileId.DenseForest, {
		sheetKey: "grass",
		spriteCol: 2,
		spriteRow: 4,
		collision: CollisionFlag.SlowWalk,
	});

	// Detail tiles
	registerTile(TileId.FlowerRed, {
		sheetKey: "objects",
		spriteCol: 1,
		spriteRow: 2,
		collision: CollisionFlag.None,
	});
	registerTile(TileId.FlowerYellow, {
		sheetKey: "objects",
		spriteCol: 5,
		spriteRow: 3,
		collision: CollisionFlag.None,
	});
	registerTile(TileId.TallGrass, {
		sheetKey: "objects",
		spriteCol: 0,
		spriteRow: 2,
		collision: CollisionFlag.None,
	});
}
