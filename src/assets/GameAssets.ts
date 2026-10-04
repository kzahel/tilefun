import type { BlendGraph } from "../autotile/BlendGraph.js";
import { PROMOTED_CHARACTERS } from "../characters/PromotedCharacters.js";
import { CHICKEN_SPRITE_SIZE, PLAYER_SPRITE_SIZE, TILE_SIZE } from "../config/constants.js";
import trainBank from "../railway/rail-local-v1.json" with { type: "json" };
import { VEHICLE_MODELS } from "../traffic/Vehicle.js";
import { loadImage } from "./AssetLoader.js";
import { MODERN_INTERIORS_SHEET_KEY } from "./ModernInteriorsAtlasIndex.js";
import { Spritesheet } from "./Spritesheet.js";
import { TileVariants } from "./TileVariants.js";

export interface GameAssets {
  sheets: Map<string, Spritesheet>;
  blendSheets: Spritesheet[];
  variants: TileVariants;
}

/** Sprite asset manifest: key → { path, width, height }. */
export const SPRITE_MANIFEST: { key: string; path: string; w: number; h: number }[] = [
  { key: "train-local-v1", path: trainBank.image, w: trainBank.width, h: trainBank.height },
  { key: "railway-review-v1", path: "assets/tilesets/railway-review-v1.png", w: 16, h: 16 },
  { key: "door-butcher-v1", path: "assets/sprites/door-butcher-v1.png", w: 16, h: 32 },
  ...PROMOTED_CHARACTERS.map((c) => ({
    key: c.sheetKey,
    path: c.image,
    w: c.frameSize,
    h: c.frameSize,
  })),
  ...VEHICLE_MODELS.map((id) => ({
    key: `vehicle-v1:${id}`,
    path: `assets/vehicles/${id}-v1.png`,
    w: 192,
    h: 224,
  })),
  {
    key: "player",
    path: "assets/sprites/player.png",
    w: PLAYER_SPRITE_SIZE,
    h: PLAYER_SPRITE_SIZE,
  },
  {
    key: "chicken",
    path: "assets/sprites/chicken.png",
    w: CHICKEN_SPRITE_SIZE,
    h: CHICKEN_SPRITE_SIZE,
  },
  { key: "cow", path: "assets/sprites/cow.png", w: 32, h: 32 },
  { key: "pigeon", path: "assets/sprites/pigeon.png", w: 16, h: 16 },
  { key: "pigeon2", path: "assets/sprites/pigeon2.png", w: 16, h: 16 },
  { key: "fish1", path: "assets/sprites/fish1.png", w: 16, h: 16 },
  { key: "fish2", path: "assets/sprites/fish2.png", w: 16, h: 16 },
  { key: "fish3", path: "assets/sprites/fish3.png", w: 16, h: 16 },
  { key: "campfire", path: "assets/sprites/campfire.png", w: 16, h: 32 },
  { key: "egg-nest", path: "assets/sprites/egg-nest.png", w: 16, h: 16 },
  { key: "crow", path: "assets/sprites/crow.png", w: 32, h: 32 },
  { key: "seagull", path: "assets/sprites/seagull.png", w: 32, h: 32 },
  { key: "worm1", path: "assets/sprites/worm1.png", w: 16, h: 16 },
  { key: "worm2", path: "assets/sprites/worm2.png", w: 16, h: 16 },
  { key: "worm3", path: "assets/sprites/worm3.png", w: 16, h: 16 },
  { key: "worm4", path: "assets/sprites/worm4.png", w: 16, h: 16 },
  { key: "ball", path: "assets/sprites/ball.png", w: 8, h: 8 },
  { key: "ghost-friendly", path: "assets/sprites/ghost-friendly.png", w: 16, h: 16 },
  { key: "ghost-angry", path: "assets/sprites/ghost-angry.png", w: 16, h: 16 },
  ...Array.from({ length: 20 }, (_, i) => ({
    key: `person${i + 1}`,
    path: `assets/sprites/person${i + 1}.png`,
    w: 16,
    h: 32,
  })),
  // Large props (each PNG is its own sheet)
  { key: "prop-tent-blue", path: "assets/props/tent-blue.png", w: 64, h: 64 },
  { key: "prop-tent-green", path: "assets/props/tent-green.png", w: 64, h: 64 },
  { key: "prop-sand-castle", path: "assets/props/sand-castle.png", w: 32, h: 32 },
  { key: "prop-beach-umbrella", path: "assets/props/beach-umbrella.png", w: 48, h: 64 },
  { key: "prop-palm-tree", path: "assets/props/palm-tree.png", w: 64, h: 80 },
  { key: "prop-oak-tree", path: "assets/props/oak-tree.png", w: 64, h: 64 },
  { key: "prop-fountain", path: "assets/props/fountain.png", w: 32, h: 48 },
  { key: "prop-picnic-table", path: "assets/props/picnic-table.png", w: 48, h: 48 },
  { key: "prop-shed", path: "assets/props/shed.png", w: 48, h: 64 },
  // Playground equipment
  { key: "prop-climb-arch", path: "assets/props/climb-arch.png", w: 48, h: 64 },
  { key: "prop-swing", path: "assets/props/swing.png", w: 32, h: 48 },
  { key: "prop-seesaw", path: "assets/props/seesaw.png", w: 48, h: 32 },
  { key: "prop-bouncy-castle", path: "assets/props/bouncy-castle.png", w: 64, h: 48 },
  { key: "prop-slide", path: "assets/props/slide.png", w: 64, h: 48 },
  { key: "prop-play-fort", path: "assets/props/play-fort.png", w: 80, h: 80 },
  { key: "prop-tube-cross", path: "assets/props/tube-cross.png", w: 48, h: 48 },
  { key: "prop-tube-climber", path: "assets/props/tube-climber.png", w: 96, h: 64 },
  { key: "prop-basketball-hoop", path: "assets/props/basketball-hoop.png", w: 48, h: 64 },
  { key: "prop-dino-topiary", path: "assets/props/dino-topiary.png", w: 64, h: 32 },
  // Decorative overlays
  { key: "grass-blades", path: "assets/sprites/grass-blades.png", w: 8, h: 8 },
];

/**
 * Load all game assets (blend sheets, entity sprites, tileset).
 * Returns sheets map, indexed blend sheet array, and tile variants.
 */
/** Terrain-only consumer uses the same manifests and variants as gameplay. */
export async function loadTerrainAssets(blendGraph: BlendGraph): Promise<GameAssets> {
  const blendDescs = blendGraph.allSheets;
  const [blendImages, completeImg, objectsImg] = await Promise.all([
    Promise.all(blendDescs.map((desc) => loadImage(desc.assetPath))),
    loadImage("assets/tilesets/me-complete.png"),
    loadImage("assets/tilesets/objects.png"),
  ]);
  const sheets = new Map<string, Spritesheet>();
  const blendSheets: Spritesheet[] = [];
  for (const [i, desc] of blendDescs.entries()) {
    const img = blendImages[i];
    if (img) {
      const sheet = new Spritesheet(img, TILE_SIZE, TILE_SIZE);
      blendSheets.push(sheet);
      sheets.set(desc.sheetKey, sheet);
    }
  }
  const me03 = sheets.get("me03");
  if (me03) sheets.set("shallowwater", me03);
  sheets.set("objects", new Spritesheet(objectsImg, TILE_SIZE, TILE_SIZE));
  const completeSheet = new Spritesheet(completeImg, TILE_SIZE, TILE_SIZE);
  sheets.set("me-complete", completeSheet);
  const variants = new TileVariants(completeSheet);
  registerTileVariants(variants);
  return { sheets, blendSheets, variants };
}

export async function loadGameAssets(blendGraph: BlendGraph): Promise<GameAssets> {
  const [terrain, spriteImages, modernInteriorsImg] = await Promise.all([
    loadTerrainAssets(blendGraph),
    Promise.all(SPRITE_MANIFEST.map((m) => loadImage(m.path))),
    loadImage("assets/tilesets/modern-interiors-atlas.png"),
  ]);
  for (const [i, manifest] of SPRITE_MANIFEST.entries()) {
    const img = spriteImages[i];
    if (img) terrain.sheets.set(manifest.key, new Spritesheet(img, manifest.w, manifest.h));
  }
  terrain.sheets.set(
    MODERN_INTERIORS_SHEET_KEY,
    new Spritesheet(modernInteriorsImg, TILE_SIZE, TILE_SIZE),
  );
  return terrain;
}

/**
 * Register base fill variant tiles from the ME Complete Tileset.
 * Group names match TerrainId enum keys (e.g. "Grass", "DirtWarm").
 */
export function registerTileVariants(variants: Pick<TileVariants, "addTiles" | "addRect">): void {
  // --- Grass: tiles matching ME autotile grass color (71, 151, 87) ---
  // Region A (cols 51-63, rows 1-7): terrain section grass variants
  variants.addTiles("Grass", [
    { col: 52, row: 2 },
    { col: 53, row: 2 },
    { col: 55, row: 1 },
    { col: 58, row: 1 },
    { col: 59, row: 1 },
    { col: 61, row: 1 },
    { col: 63, row: 1 },
    { col: 63, row: 3 },
    { col: 55, row: 4 },
    { col: 58, row: 4 },
    { col: 59, row: 4 },
    { col: 61, row: 4 },
    { col: 62, row: 4 },
    { col: 62, row: 6 },
  ]);
  // Region B (cols 129-145, rows 1-5): alternate terrain grass variants
  variants.addTiles("Grass", [
    { col: 130, row: 2 },
    { col: 131, row: 2 },
    { col: 133, row: 1 },
    { col: 137, row: 1 },
    { col: 136, row: 1 },
    { col: 140, row: 1 },
    { col: 141, row: 1 },
    { col: 145, row: 1 },
    { col: 133, row: 4 },
    { col: 136, row: 4 },
    { col: 141, row: 5 },
    { col: 145, row: 5 },
  ]);

  // --- GrassLight: brighter green tiles (cols 7-11, rows 1-5) ---
  variants.addRect("GrassLight", 7, 1, 5, 5);
}

const sceneLoads = new WeakMap<GameAssets, Map<string, Promise<void>>>();
const closedAssets = new WeakSet<GameAssets>();
/** Lazy source sprites for a diagnostic scene, using gameplay's exact manifest. */
export async function loadSceneAssets(
  assets: GameAssets,
  keys: ReadonlySet<string>,
): Promise<void> {
  if (closedAssets.has(assets)) return;
  let loads = sceneLoads.get(assets);
  if (!loads) {
    loads = new Map();
    sceneLoads.set(assets, loads);
  }
  const work: Promise<void>[] = [];
  for (const entry of SPRITE_MANIFEST) {
    if (!keys.has(entry.key) || assets.sheets.has(entry.key)) continue;
    let pending = loads.get(entry.key);
    if (!pending) {
      pending = loadImage(entry.path)
        .then((image) => {
          if (closedAssets.has(assets)) image.close();
          else assets.sheets.set(entry.key, new Spritesheet(image, entry.w, entry.h));
        })
        .finally(() => loads?.delete(entry.key));
      loads.set(entry.key, pending);
    }
    work.push(pending);
  }
  await Promise.all(work);
}
export function closeAssets(assets: GameAssets): void {
  closedAssets.add(assets);
  for (const image of new Set([...assets.sheets.values()].map((sheet) => sheet.image))) {
    if (image instanceof ImageBitmap) image.close();
  }
  assets.sheets.clear();
  assets.blendSheets.length = 0;
}
