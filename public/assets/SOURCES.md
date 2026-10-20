# Asset Sources

Explorer motorboat v1 is original Tilefun Blender geometry and palette UV paint.
Its hull, seating, helm and outboard use no third-party vehicle artwork.
Editable source and provenance: `art-source/vehicle-models/explorer-boat/v1/`.

Base player and animal sprites by Cup Nooble (Sprout Lands asset pack).

Additional interior art from LimeZu Modern Interiors. Credit required:
https://limezu.itch.io/moderninteriors

## Tilesets (`tilesets/`)

| File | Source | Original Name | Dimensions |
|------|--------|---------------|------------|
| grass.png | Maaack/Sprout-Lands-Tilemap addon | `assets/Tilesets/Grass.png` | 160x128 (10x8 tiles) |
| dirt.png | Maaack/Sprout-Lands-Tilemap addon | `assets/Tilesets/Tilled Dirt.png` | 128x128 (8x8 tiles) |
| water.png | Sprout Lands Basic Pack | `Tilesets/Water.png` | 64x16 (4x1 tiles) |
| objects.png | Sprout Lands Basic Pack | `Tilesets/Basic_Grass_Biom_things.png` | 144x80 (9x5 tiles) |
| grass-autotile.json | Generated from Maaack .tscn | `base/scenes/sprout_lands_tile_map.tscn` | 47 variants |
| modern-interiors-atlas.png | Generated from LimeZu Modern Interiors | `assets/interiors/` | See `public/data/modern-interiors-atlas.json` |

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

## Vehicles (`vehicles/`)

LimeZu Modern Exteriors vehicle art, copied from the committed
`tilesets/me-complete.png` source. Credit: https://limezu.itch.io/modernexteriors

`*-v1.png` preserves the 180 approved native crops across 45 four-direction
sets, padded to a common ground reference without scaling or mirroring.
`src/traffic/vehicles-v1.json` records source hash, exact rectangles, approved
geometry and approval fingerprints. See `docs/research/road-vehicles.md` for the
source audit. Builds verify this immutable bank; they do not regenerate it.

## Authored vehicle models (`models/vehicles/`)

All 45 source vehicle sets have authored Blender geometry and source-matched UV
paint derived from LimeZu Modern Exteriors: https://limezu.itch.io/modernexteriors
The runtime GLBs, editable scenes, clean atlases, own unused projection drafts,
frozen source crops and exact 4×2/contour/novel/light review captures are retained
in `art-source/vehicle-models/` and `models/vehicles/`. Earlier revisions remain
immutable. See `art-source/vehicle-models/catalog.json` for exact source/export
hashes and `docs/topics/vehicle-model-porting.md` for current integration/review.
Model integration does not imply new production-art approval or a change to the
approved sprite bank. Builds consume committed exports without running Blender.

## Railway Workshop preview atlas

`tilesets/railway-review-v1.png` packs 53 unchanged Modern Exteriors 16×16
singles by LimeZu. It is an unapproved review source, not a promoted gameplay
bank. `src/railway/RailwaySource.json` records each original filename, PNG SHA-256,
packed rectangle and visible bounds. `scripts/pack-railway-review.py` is the
explicit extraction tool (requires the purchased source pack and Pillow); normal
builds use the committed atlas and never repack it. Train pieces are not rotated,
mirrored or resampled. Schematic bridge/access/path shapes in preview scenes are
labelled layout proposals and are not claimed as vendor artwork.

## Door animation overlay v1

`sprites/door-butcher-v1.png` is an unchanged copy of Modern Exteriors 16x16
`Animated_16x16/Animated_sheets_16x16/Floor_Modular_Buildings_1_Door_Butcher_16x16.png`.
It contains fourteen 16×32 frames (opening then closing). Its closed panel matches
`me-complete.png` at (1312,2432,16,32); runtime overlays preserve the frozen facade.
New Workshop `doorways-v1` candidates review each entrance independently.

## Semantic review source exports

`semantic-sources/exteriors-bench-5.png` and `exteriors-bench-6.png` are unchanged
16×48 PNG copies of LimeZu Modern Exteriors native16 complete singles
`ME_Singles_City_Props_16x16_Bench_5.png` and `ME_Singles_City_Props_16x16_Bench_6.png`.
Credit: https://limezu.itch.io/modernexteriors
The [E01 proposal](../../docs/tactical/053-semantic-tileset-map/packets/E01-outdoor-seating.json)
pins original paths, hashes and aliases. Neither has a whole-frame exact master
or theme-sheet match. These copies let the family sheet display the originals;
they are unapproved review sources, not a promoted gameplay bank.


`semantic-sources/interiors-door-1.png` and `interiors-door-1-locked.png` are
byte-identical copies of LimeZu Modern Interiors native16 animation strips
`assets/interiors/3_Animated_objects/16x16/spritesheets/animated_door_1.png` and
`animated_door_1_locked.png`. They retain their original 80×32 / 64×32 frames and
transparency. The [A01 packet](../../docs/tactical/053-semantic-tileset-map/packets/A01-animation.json)
pins their exact original bytes; these review sources do not establish gameplay
animation timing, door mechanics or approval. Companion GIFs remain supporting
research evidence and are not repacked here.


### Authored blue train prototype

`models/trains/blue-{rear,middle,front}-{v1,v3}.glb` and
`models/trains/review/blue-{v1,v3}/` reconstruct LimeZu Modern Exteriors blue train
pieces from the unchanged `tilesets/railway-review-v1.png` bank. New Blender
geometry, owned UV atlases and wheel/bogie/coupler rigs are retained with exact
sources and dependencies in `art-source/train-models/blue/{v1,v3}/`. The model/motion
inspection captures are unapproved prototypes; the existing live train sprite
bank stays unchanged. Source credit: https://limezu.itch.io/modernexteriors

Dump-truck articulated v2 retains the original Tilefun-authored yellow/steel-blue
geometry and semantic UV paint. Separate bed/tailgate hinges and extending ram
poses use a new retained [source bundle](../../art-source/vehicle-bake/dump-truck/v2/).
The original v1 GLB, source and sprite fallback remain immutable. V2 carries no
new human art approval; see tactical 167 for gameplay and verification evidence.
