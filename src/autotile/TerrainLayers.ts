import { TileId } from "../world/TileRegistry.js";

/** @legacy Configuration for one autotile rendering layer. Replaced by BlendGraph. */
export interface TerrainLayerDef {
  /** Unique identifier for this layer. */
  id: string;
  /** The spritesheet key in the sheets map. */
  sheetKey: string;
  /** Asset path to load for this sheet. */
  assetPath: string;
  /** Which TileIds count as "same terrain" for bitmask computation. */
  isInGroup: (tileId: TileId) => boolean;
  /** Which TileIds should have this layer rendered on them. */
  appliesTo: (tileId: TileId) => boolean;
}

/** Deep water tiles. */
function isDeepWater(t: TileId): boolean {
  return t === TileId.DeepWater;
}

/** All non-water tiles (everything above water in the nested ring). */
function isNonWater(t: TileId): boolean {
  return (
    t === TileId.Grass ||
    t === TileId.Forest ||
    t === TileId.DenseForest ||
    t === TileId.Sand ||
    t === TileId.DirtPath
  );
}

/** Land tiles that form the grass surface (excludes Sand — sand stays as layer 1). */
function isGrassLand(t: TileId): boolean {
  return (
    t === TileId.Grass || t === TileId.Forest || t === TileId.DenseForest || t === TileId.DirtPath
  );
}

/** Dirt path overlay only. */
function isDirtPath(t: TileId): boolean {
  return t === TileId.DirtPath;
}

/**
 * @legacy 4-layer nested ring autotile, rendered bottom-to-top.
 * Replaced by BlendGraph + computeChunkCornerBlend (corner-based blend layers).
 * Each layer covers a broader area, painting over the one below:
 *   L0: deep water on shallow water base
 *   L1: sand fill on ALL land tiles; water shows at edges (ME #8)
 *   L2: grass overlay; transparent edges reveal sand below (ME #13)
 *   L3: dirt fill on paths; grass at edges (ME #2)
 */
export const TERRAIN_LAYERS: readonly TerrainLayerDef[] = [
  {
    id: "deep_on_shallow",
    sheetKey: "deepwater",
    assetPath: "assets/tilesets/me-autotile-16.png",
    isInGroup: isDeepWater,
    appliesTo: isDeepWater,
  },
  {
    id: "sand_on_water",
    sheetKey: "sand",
    assetPath: "assets/tilesets/me-autotile-08.png",
    isInGroup: isNonWater,
    appliesTo: isNonWater,
  },
  {
    id: "grass_overlay",
    sheetKey: "grassalpha",
    assetPath: "assets/tilesets/me-autotile-13.png",
    isInGroup: isGrassLand,
    appliesTo: isGrassLand,
  },
  {
    id: "dirt_on_grass",
    sheetKey: "dirt",
    assetPath: "assets/tilesets/me-autotile-02.png",
    isInGroup: isDirtPath,
    appliesTo: isDirtPath,
  },
];
