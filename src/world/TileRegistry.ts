/** Tile type identifiers. 0 is reserved for "empty". */
export enum TileId {
	Empty = 0,
	Grass = 1,
	Water = 2,
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
	registerTile(TileId.Grass, { spriteCol: 2, spriteRow: 4, collision: CollisionFlag.None });
	registerTile(TileId.Water, { spriteCol: 0, spriteRow: 0, collision: CollisionFlag.Water });
}
