import { isRoad } from "../road/RoadType.js";
import { TileId } from "../world/TileRegistry.js";

/** Sound surface categories mapped to footstep audio variants. */
export enum SurfaceType {
  Grass = "grass",
  Sand = "sand",
  Concrete = "concrete",
  Wood = "wood",
  Generic = "generic",
}

/** Physical material of a prop, determines impact/landing sounds. */
export enum MaterialType {
  Soft = "soft",
  Wood = "wood",
  Metal = "metal",
  Stone = "stone",
  Fabric = "fabric",
}

/** Buffer keys per surface type (preloaded by AudioManager). */
export const SURFACE_VARIANTS: Record<SurfaceType, readonly string[]> = {
  [SurfaceType.Grass]: ["grass_000", "grass_001", "grass_002", "grass_003", "grass_004"],
  [SurfaceType.Sand]: ["sand_000", "sand_001", "sand_002", "sand_003", "sand_004"],
  [SurfaceType.Concrete]: [
    "concrete_000",
    "concrete_001",
    "concrete_002",
    "concrete_003",
    "concrete_004",
  ],
  [SurfaceType.Wood]: ["wood_000", "wood_001", "wood_002", "wood_003", "wood_004"],
  [SurfaceType.Generic]: [
    "generic_00",
    "generic_01",
    "generic_02",
    "generic_03",
    "generic_04",
    "generic_05",
    "generic_06",
    "generic_07",
    "generic_08",
    "generic_09",
  ],
};

/** Impact sound keys per material type for landing. */
export const IMPACT_VARIANTS: Record<MaterialType, readonly string[]> = {
  [MaterialType.Soft]: [
    "impact_soft_heavy_000",
    "impact_soft_heavy_001",
    "impact_soft_heavy_002",
    "impact_soft_heavy_003",
    "impact_soft_heavy_004",
  ],
  [MaterialType.Wood]: [
    "impact_wood_light_000",
    "impact_wood_light_001",
    "impact_wood_light_002",
    "impact_wood_light_003",
    "impact_wood_light_004",
  ],
  [MaterialType.Metal]: [
    "impact_metal_light_000",
    "impact_metal_light_001",
    "impact_metal_light_002",
    "impact_metal_light_003",
    "impact_metal_light_004",
  ],
  [MaterialType.Stone]: [
    "impact_generic_light_000",
    "impact_generic_light_001",
    "impact_generic_light_002",
    "impact_generic_light_003",
    "impact_generic_light_004",
  ],
  [MaterialType.Fabric]: [
    "impact_soft_medium_000",
    "impact_soft_medium_001",
    "impact_soft_medium_002",
    "impact_soft_medium_003",
    "impact_soft_medium_004",
  ],
};

/** Jump launch sound keys. */
export const JUMP_VARIANTS: readonly string[] = [
  "jump_cloth_00",
  "jump_cloth_01",
  "jump_cloth_02",
  "jump_cloth_03",
];

/** Map terrain surface to an impact material for landing on ground. */
export function surfaceToMaterial(surface: SurfaceType): MaterialType {
  switch (surface) {
    case SurfaceType.Wood:
      return MaterialType.Wood;
    case SurfaceType.Concrete:
      return MaterialType.Stone;
    case SurfaceType.Sand:
    case SurfaceType.Grass:
    case SurfaceType.Generic:
      return MaterialType.Soft;
  }
}

/** Determine sound surface for a tile, considering road overlay. */
export function getSurfaceAtTile(tileId: TileId | number, roadType: number): SurfaceType {
  if (isRoad(roadType)) return SurfaceType.Concrete;

  switch (tileId) {
    case TileId.Grass:
    case TileId.Forest:
    case TileId.DenseForest:
      return SurfaceType.Grass;
    case TileId.Sand:
      return SurfaceType.Sand;
    case TileId.DirtPath:
      return SurfaceType.Generic;
    case TileId.Playground:
      return SurfaceType.Wood;
    case TileId.Curb:
      return SurfaceType.Concrete;
    default:
      return SurfaceType.Grass;
  }
}

/** Build the full preload manifest for all audio files. */
export function buildAudioManifest(): { key: string; path: string }[] {
  const manifest: { key: string; path: string }[] = [];

  // Footstep sounds
  for (const variants of Object.values(SURFACE_VARIANTS)) {
    for (const key of variants) {
      manifest.push({ key, path: `assets/audio/footsteps/${key}.ogg` });
    }
  }

  // Impact sounds
  const impactPathMap: Record<string, string> = {
    impact_soft_heavy: "soft_heavy",
    impact_soft_medium: "soft_medium",
    impact_wood_light: "wood_light",
    impact_metal_light: "metal_light",
    impact_generic_light: "generic_light",
  };
  for (const variants of Object.values(IMPACT_VARIANTS)) {
    for (const key of variants) {
      // key = "impact_soft_heavy_000" → path prefix = "soft_heavy", suffix = "000"
      const lastUnderscore = key.lastIndexOf("_");
      const prefix = key.slice(0, lastUnderscore);
      const suffix = key.slice(lastUnderscore + 1);
      const pathPrefix = impactPathMap[prefix] ?? prefix.slice("impact_".length);
      manifest.push({ key, path: `assets/audio/impacts/${pathPrefix}_${suffix}.ogg` });
    }
  }

  // Jump sounds
  for (const key of JUMP_VARIANTS) {
    // key = "jump_cloth_00" → path = "cloth_00"
    const pathSuffix = key.slice("jump_".length);
    manifest.push({ key, path: `assets/audio/jump/${pathSuffix}.ogg` });
  }

  // UI sounds
  manifest.push({ key: "gem_pickup", path: "assets/audio/ui/gem_pickup.ogg" });
  for (let i = 0; i < 5; i++) {
    const suffix = String(i).padStart(3, "0");
    manifest.push({ key: `ghost_hit_${suffix}`, path: `assets/audio/ui/ghost_hit_${suffix}.ogg` });
    manifest.push({
      key: `ghost_death_${suffix}`,
      path: `assets/audio/ui/ghost_death_${suffix}.ogg`,
    });
  }

  // Ambient sounds
  for (let i = 0; i < 3; i++) {
    const suffix = String(i).padStart(2, "0");
    manifest.push({ key: `crackle_${suffix}`, path: `assets/audio/ambient/crackle_${suffix}.ogg` });
  }

  return manifest;
}

/** @deprecated Use buildAudioManifest() instead. */
export const buildFootstepManifest = buildAudioManifest;
