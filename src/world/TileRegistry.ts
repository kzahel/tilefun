import { TerrainId } from "../autotile/TerrainId.js";

/** Tile type identifiers. 0 is reserved for "empty". */
export enum TileId {
  Empty = 0,
  Grass = 1,
  Water = 2,
  Sand = 3,
  Forest = 4,
  DenseForest = 5,
  DeepWater = 6,
  DirtPath = 8,
  // Detail tiles (decoration layer)
  FlowerRed = 10,
  FlowerYellow = 11,
  TallGrass = 12,
  Mushroom = 13,
  Rock = 14,
  Sunflower = 15,
  SmallBerries = 16,
  Sprout = 17,
  Leaf = 18,
  Pumpkin = 19,
  BigRock = 20,
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

/** Get default collision flags for a terrain tile type. */
export function getCollisionForTerrain(tileId: TileId): number {
  switch (tileId) {
    case TileId.Water:
    case TileId.DeepWater:
      return CollisionFlag.Water;
    case TileId.DenseForest:
      return CollisionFlag.SlowWalk;
    default:
      return CollisionFlag.None;
  }
}

/**
 * Map TerrainId to TileId for chunk terrain derivation.
 * SandLight maps to Sand, DirtLight/DirtWarm map to DirtPath (no dedicated TileIds).
 */
export function terrainIdToTileId(terrain: TerrainId): TileId {
  switch (terrain) {
    case TerrainId.DeepWater:
      return TileId.DeepWater;
    case TerrainId.ShallowWater:
      return TileId.Water;
    case TerrainId.Sand:
    case TerrainId.SandLight:
      return TileId.Sand;
    case TerrainId.Grass:
      return TileId.Grass;
    case TerrainId.DirtLight:
    case TerrainId.DirtWarm:
      return TileId.DirtPath;
    default:
      return TileId.Grass;
  }
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
    spriteCol: 9,
    spriteRow: 3,
    collision: CollisionFlag.None,
  });
  registerTile(TileId.Water, {
    sheetKey: "shallowwater",
    spriteCol: 1,
    spriteRow: 0,
    collision: CollisionFlag.Water,
  });
  registerTile(TileId.DeepWater, {
    sheetKey: "deepwater",
    spriteCol: 1,
    spriteRow: 0,
    collision: CollisionFlag.Water,
  });
  registerTile(TileId.Sand, {
    sheetKey: "dirt",
    spriteCol: 9,
    spriteRow: 3,
    collision: CollisionFlag.None,
  });
  registerTile(TileId.Forest, {
    sheetKey: "grass",
    spriteCol: 9,
    spriteRow: 3,
    collision: CollisionFlag.None,
  });
  registerTile(TileId.DenseForest, {
    sheetKey: "grass",
    spriteCol: 9,
    spriteRow: 3,
    collision: CollisionFlag.None,
  });
  registerTile(TileId.DirtPath, {
    sheetKey: "dirt",
    spriteCol: 1,
    spriteRow: 0,
    collision: CollisionFlag.None,
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
  registerTile(TileId.Mushroom, {
    sheetKey: "objects",
    spriteCol: 3,
    spriteRow: 2,
    collision: CollisionFlag.None,
  });
  registerTile(TileId.Rock, {
    sheetKey: "objects",
    spriteCol: 7,
    spriteRow: 0,
    collision: CollisionFlag.None,
  });
  registerTile(TileId.Sunflower, {
    sheetKey: "objects",
    spriteCol: 5,
    spriteRow: 2,
    collision: CollisionFlag.None,
  });
  registerTile(TileId.SmallBerries, {
    sheetKey: "objects",
    spriteCol: 2,
    spriteRow: 2,
    collision: CollisionFlag.None,
  });
  registerTile(TileId.Sprout, {
    sheetKey: "objects",
    spriteCol: 8,
    spriteRow: 0,
    collision: CollisionFlag.None,
  });
  registerTile(TileId.Leaf, {
    sheetKey: "objects",
    spriteCol: 4,
    spriteRow: 2,
    collision: CollisionFlag.None,
  });
  registerTile(TileId.Pumpkin, {
    sheetKey: "objects",
    spriteCol: 6,
    spriteRow: 1,
    collision: CollisionFlag.None,
  });
  registerTile(TileId.BigRock, {
    sheetKey: "objects",
    spriteCol: 6,
    spriteRow: 0,
    collision: CollisionFlag.None,
  });
}
