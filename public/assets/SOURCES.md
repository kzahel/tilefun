# Asset Sources

All sprites by Cup Nooble (Sprout Lands asset pack).

## Tilesets (`tilesets/`)

| File | Source | Original Name | Dimensions |
|------|--------|---------------|------------|
| grass.png | Maaack/Sprout-Lands-Tilemap addon | `assets/Tilesets/Grass.png` | 160x128 (10x8 tiles) |
| dirt.png | Maaack/Sprout-Lands-Tilemap addon | `assets/Tilesets/Tilled Dirt.png` | 128x128 (8x8 tiles) |
| water.png | Sprout Lands Basic Pack | `Tilesets/Water.png` | 64x16 (4x1 tiles) |
| objects.png | Sprout Lands Basic Pack | `Tilesets/Basic_Grass_Biom_things.png` | 144x80 (9x5 tiles) |
| grass-autotile.json | Generated from Maaack .tscn | `base/scenes/sprout_lands_tile_map.tscn` | 47 variants |

Grass and dirt tilesets use the Maaack versions because the autotile coordinate
lookup table (extracted from their Godot .tscn) matches that layout. The basic
pack versions have different dimensions and tile arrangements.

- Maaack addon: https://github.com/Maaack/Sprout-Lands-Tilemap
- Local copy: `Sprout-Lands-Tilemap-addon/`

## Sprites (`sprites/`)

| File | Source | Original Name | Dimensions |
|------|--------|---------------|------------|
| player.png | Sprout Lands Basic Pack | `Characters/Basic Charakter Spritesheet.png` | 192x192 (4x4 at 48x48) |
| chicken.png | Sprout Lands Basic Pack | `Characters/Free Chicken Sprites.png` | — |

## Backup files

`*.bak` files are the original basic pack versions before swapping in Maaack equivalents.
