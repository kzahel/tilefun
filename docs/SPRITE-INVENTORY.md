# Sprite Inventory — Placeable Animated Entities

All sprites from Modern Exteriors (ME) 16x16 and Sprout Lands packs that could
work as entities in the game. Organized by category.

**ME base path:** `assets/Modern_Exteriors_16x16/Animated_16x16/Animated_sheets_16x16/`
**Sprout Lands base path:** `Sprout Lands - Sprites - Basic pack/Characters/`
**In-game sprites:** `public/assets/sprites/`

---

## Already In Game

| Name | Sheet Key | Frame Size | Frames | Directions | Source |
|------|-----------|-----------|--------|-----------|--------|
| Chicken | chicken | 16x16 | 4 | 2 rows | Sprout Lands `Free Chicken Sprites.png` (64x32) |
| Cow | cow | 32x32 | 3 | 1 row | Sprout Lands `Free Cow Sprites.png` (96x64) |
| Pigeon | pigeon | 16x16 | 6 | single | ME `Pigeon_16x16.png` (96x16) |

---

## Animals — Birds

### Crow (3 animation states, all 4-directional)

**Crow Idle** — perched, bobbing
| Direction | File | Dimensions | Frame Size | Frames |
|-----------|------|-----------|-----------|--------|
| Down | `Crow_idle_Down_16x16.png` | 96x32 | 16x32 | 6 |
| Up | `Crow_idle_Up_16x16.png` | 96x32 | 16x32 | 6 |
| Left | `Crow_idle_Left_16x16.png` | 192x16 | 16x16 | 12 |
| Right | `Crow_idle_Right_16x16.png` | 192x16 | 16x16 | 12 |
| Combined | `Crow_idle_16x16.png` | 768x32 | — | all |

**Crow Hover** — hovering in place
| Direction | File | Dimensions | Frame Size | Frames |
|-----------|------|-----------|-----------|--------|
| Down | `Crow_Hover_Down_16x16.png` | 288x32 | 16x32 | 18 |
| Up | `Crow_Hover_Up_16x16.png` | 288x32 | 16x32 | 18 |
| Left | `Crow_Hover_Left_16x16.png` | 192x32 | 16x32 | 12 |
| Right | `Crow_Hover_Right_16x16.png` | 192x32 | 16x32 | 12 |

**Crow Flap** — flying/flapping
| Direction | File | Dimensions | Frame Size | Frames |
|-----------|------|-----------|-----------|--------|
| Down | `Crow_Flap_Down_16x16.png` | 288x32 | 16x32 | 18 |
| Up | `Crow_Flap_Up_16x16.png` | 288x32 | 16x32 | 18 |
| Left | `Crow_Flap_Left_16x16.png` | 192x32 | 16x32 | 12 |
| Right | `Crow_Flap_Right_16x16.png` | 192x32 | 16x32 | 12 |
| Combined | `Crow_Flap_16x16.png` | 1152x32 | — | all |

### Seagull (idle, 4-directional)

| Direction | File | Dimensions | Frame Size | Frames |
|-----------|------|-----------|-----------|--------|
| Down | `Beach_Seagull_Idle_Down_16x16.png` | 96x32 | 16x32 | 6 |
| Up | `Beach_Seagull_Idle_Up_16x16.png` | 96x32 | 16x32 | 6 |
| Left | `Beach_Seagull_Idle_Left_16x16.png` | 192x32 | 16x32 | 12 |
| Right | `Beach_Seagull_Idle_Right_16x16.png` | 192x32 | 16x32 | 12 |
| Combined | `Beach_Seagull_Complete_16x16.png` | 768x64 | — | all |

### Pigeon (2 color variants, single direction)

| Variant | File | Dimensions | Frame Size | Frames |
|---------|------|-----------|-----------|--------|
| 1 (blue) | `Pigeon_16x16.png` | 96x16 | 16x16 | 6 |
| 2 (gray) | `Pigeon_2_16x16.png` | 96x16 | 16x16 | 6 |

---

## Animals — Sea Creatures

### Crabs

| Variant | File | Dimensions | Frame Size | Frames | Notes |
|---------|------|-----------|-----------|--------|-------|
| Basic | `Crabs_16x16.png` | 320x64 | 16x16 | 20x4 grid | Multiple crabs |
| Sand Bucket | `Crabs_Sand_Bucket_16x16.png` | 320x128 | 16x16 | 20x8 grid | Crab + bucket interaction |

### Fish (3 types, single direction)

| Variant | File | Dimensions | Frame Size | Frames |
|---------|------|-----------|-----------|--------|
| Fish 1 | `Fishes_1_16x16.png` | 192x16 | 16x16 | 12 |
| Fish 2 | `Fishes_2_16x16.png` | 192x16 | 16x16 | 12 |
| Fish 3 | `Fishes_3_16x16.png` | 224x16 | 16x16 | 14 |

---

## Animals — Bugs & Worms

### Worms (4 color variants, all 4-directional)

Each worm variant has Down/Left/Right/Up sheets, all 96x16 (6 frames at 16x16).

| Variant | File Pattern | Dimensions | Frames/Dir |
|---------|-------------|-----------|-----------|
| Worm 1 | `Worm_1_[down\|left\|right\|up]_16x16.png` | 96x16 | 6 |
| Worm 2 | `Worm_2_[down\|left\|right\|up]_16x16.png` | 96x16 | 6 |
| Worm 3 | `Worm_3_[down\|left\|right\|up]_16x16.png` | 96x16 | 6 |
| Worm 4 | `Worm_4_[down\|left\|right\|up]_16x16.png` | 96x16 | 6 |

---

## Spooky / Fantasy

### Friendly Ghost

| File | Dimensions | Frame Size | Frames |
|------|-----------|-----------|--------|
| `Ghost_Friendly_16x16.png` | 1024x128 | 32x32? | many |

### Graveyard Ghosts (4 variants)

| Variant | File | Dimensions |
|---------|------|-----------|
| 1 | `Graveyard_Ghosts_1_16x16.png` | 384x32 |
| 2 | `Graveyard_Ghosts_2_16x16.png` | 224x32 |
| 3 | `Graveyard_Ghosts_3_16x16.png` | 1088x64 |
| 4 | `Graveyard_Ghosts_4_16x16.png` | 832x64 |

### Haunted Tree

| Variant | File | Dimensions |
|---------|------|-----------|
| Blink | `Graveyard_Haunted_Tree_Blink_16x16.png` | varies |
| Laugh | `Graveyard_Haunted_Tree_Laugh_16x16.png` | varies |
| Pumpkins | `Graveyard_Haunted_Tree_Pumpkins_16x16.png` | varies |

---

## Water Objects — Floaties & Toys

All single-direction bobbing/floating animations.

### Pool Floaties

| Name | File | Dimensions | Frames |
|------|------|-----------|--------|
| Dragon 1 | `Floating_Dragon_1_16x16.png` | 192x48 | 12x3 |
| Dragon 2 | `Floating_Dragon_2_16x16.png` | 192x48 | 12x3 |
| Dragon 3 | `Floating_Dragon_3_16x16.png` | 288x48 | 18x3 |
| Flamingo | `Floating_Flamingo_16x16.png` | 192x32 | 12x2 |
| Donut 1 | `Floating_Donut_1_16x16.png` | 192x32 | 12x2 |
| Donut 2 | `Floating_Donut_2_16x16.png` | 192x32 | 12x2 |
| Ball 1 | `Floating_Ball_1_16x16.png` | 192x32 | 12x2 |
| Ball 2 | `Floating_Ball_2_16x16.png` | 192x32 | 12x2 |
| Ball 3 | `Floating_Ball_3_16x16.png` | 192x32 | 12x2 |
| Ring 1 | `Floating_Ring_1_16x16.png` | 192x32 | 12x2 |
| Ring 2 | `Floating_Ring_2_16x16.png` | 192x32 | 12x2 |
| Ice Cream 1 | `Floating_Ice_Cream_Stick_1_16x16.png` | 192x32 | 12x2 |
| Ice Cream 2 | `Floating_Ice_Cream_Stick_2_16x16.png` | 192x32 | 12x2 |
| Ice Cream 3 | `Floating_Ice_Cream_Stick_3_16x16.png` | 192x32 | 12x2 |
| Ice Cream 4 | `Floating_Ice_Cream_Stick_4_16x16.png` | 192x32 | 12x2 |
| Ice Cream 5 | `Floating_Ice_Cream_Stick_5_16x16.png` | 192x48 | 12x3 |
| Ice Cream 6 | `Floating_Ice_Cream_Stick_6_16x16.png` | 192x48 | 12x3 |
| Trunk | `Floating_Trunk_16x16.png` | 384x16 | 24x1 |

### Buoys

| Name | File | Dimensions | Frames |
|------|------|-----------|--------|
| Buoy 1 | `Beach_Water_Buoy_1_16x16.png` | 256x32 | 16x2 |
| Buoy 2 | `Beach_Water_Buoy_2_16x16.png` | 256x32 | 16x2 |
| Buoy 3 | `Beach_Water_Buoy_3_16x16.png` | 256x32 | 16x2 |
| Sep Buoy 1 | `Floating_Separation_Buoys_1_16x16.png` | 128x16 | 8 |
| Sep Buoy 2 | `Floating_Separation_Buoys_2_16x16.png` | 128x16 | 8 |
| Sep Buoy 3 | `Floating_Separation_Buoys_3_16x16.png` | 128x16 | 8 |
| Sep Buoy 4 | `Floating_Separation_Buoys_4_16x16.png` | 128x16 | 8 |
| Sep Buoy 5 | `Floating_Separation_Buoys_5_16x16.png` | 128x16 | 8 |
| Sep Buoy 6 | `Floating_Separation_Buoys_6_16x16.png` | 128x16 | 8 |

### Floating Rocks (natural, static-ish)

13 variants + 13 moss variants. All in `Beach_Floating_Rock_[N]_16x16.png` and
`Beach_Floating_Rock_Moss_[N]_16x16.png`. Dimensions vary 128x16 to 512x64.

---

## Vehicles

### Boats

**Boat 1** (4-directional)
| Direction | File | Dimensions |
|-----------|------|-----------|
| Down 1 | `Boat_1_down_1_16x16.png` | 256x64 |
| Down 2 | `Boat_1_down_2_16x16.png` | 256x64 |
| Up 1 | `Boat_1_up_1_16x16.png` | 256x64 |
| Up 2 | `Boat_1_up_2_16x16.png` | 256x64 |
| Left 1 | `Boat_1_left_1_16x16.png` | 512x32 |
| Left 2 | `Boat_1_left_2_16x16.png` | 640x32 |
| Right 1 | `Boat_1_right_1_16x16.png` | 640x32 |
| Right 2 | `Boat_1_right_2_16x16.png` | 512x32 |

**Fishing Boats** (left/right only)
| Variant | File | Dimensions |
|---------|------|-----------|
| Fishing Boat L | `Fishing_Boat_left_16x16.png` | 640x32 |
| Fishing Boat L2 | `Fishing_Boat_left_2_16x16.png` | 768x48 |
| Fishing Boat R | `Fishing_Boat_right_16x16.png` | 640x32 |
| Fishing Boat R2 | `Fishing_Boat_right_2_16x16.png` | 768x48 |
| Fishing Boat 2 L | `Fishing_Boat_2_left_16x16.png` | 768x48 |
| Fishing Boat 2 R | `Fishing_Boat_2_right_16x16.png` | 768x48 |

### Drones

| Variant | File | Dimensions | Notes |
|---------|------|-----------|-------|
| Drone 1 | `Drone_1_16x16.png` | 384x80 | Small quadcopter |
| Drone 2 | `Drone_2_16x16.png` | 640x160 | Medium |
| Drone 3 | `Drone_3_16x16.png` | 1280x128 | Large |
| Drone 4 | `Drone_4_16x16.png` | 2016x96 | Very large |
| Helix | `Drone_Helix_16x16.png` | 640x32 | Rotor only |

---

## Environmental — Fire & Light

### Campfires

| Variant | File | Dimensions | Frames |
|---------|------|-----------|--------|
| Small | `Campfire_16x16.png` | 96x32 | 6 |
| Large | `Campfire_2_16x16.png` | 288x32 | 18 |

### Fountains (with on/off states)

| Variant | File | Dimensions |
|---------|------|-----------|
| Fountain 1 | `Garden_Fountain_1_16x16.png` | 192x48 |
| Fountain 1 On | `Garden_Fountain_1_Turn_On_16x16.png` | 384x48 |
| Fountain 1 Off | `Garden_Fountain_1_Turn_Off_16x16.png` | 192x48 |
| Fountain 2 | `Garden_Fountain_2_16x16.png` | 192x64 |
| Fountain 3 | `Garden_Fountain_3_16x16.png` | 192x80 |
| Fountain 4 | `Garden_Fountain_4_16x16.png` | 192x48 |
| Fountain 5 | `Garden_Fountain_5_16x16.png` | 192x48 |
| Fountain 6 | `Garden_Fountain_6_16x16.png` | 192x64 |

### Waterfalls (modular)

| Part | File | Dimensions |
|------|------|-----------|
| Top 1 | `Waterfall_1_Top_16x16.png` | 288x32 |
| Mid 1 | `Waterfall_1_Mid_16x16.png` | 288x16 |
| Bottom 1 | `Waterfall_1_Bottom_16x16.png` | 288x16 |
| Top 2 | `Waterfall_2_Top_16x16.png` | 288x48 |
| Mid 2 | `Waterfall_2_Mid_16x16.png` | 288x16 |
| Bottom 2 | `Waterfall_2_Bottom_16x16.png` | 288x16 |
| Top 3 | `Waterfall_3_Top_16x16.png` | 288x64 |
| Mid 3 | `Waterfall_3_Mid_16x16.png` | 288x16 |
| Bottom 3 | `Waterfall_3_Bottom_16x16.png` | 288x32 |

### Windmill

| Part | File | Dimensions |
|------|------|-----------|
| Building | `Additional_Houses_Wind_Mill_16x16.png` | 256x128 |
| Blades | `Additional_Houses_Wind_Mill_Blades_16x16.png` | 256x64 |

---

## Characters & Performers

### Street Musicians

| Variant | File | Dimensions |
|---------|------|-----------|
| Busker 1 | `Subway_Busker_1_16x16.png` | 192x32 |
| Busker 2 | `Subway_Busker_2_16x16.png` | 192x32 |
| Busker 3 | `Subway_Busker_3_16x16.png` | 384x32 |
| Busker 4 | `Subway_Busker_4_16x16.png` | 192x32 |

### Beach Concert

| Variant | File | Dimensions |
|---------|------|-----------|
| DJ | `Beach_Concert_DJ_16x16.png` | 576x48 |
| Singer 1 | `Beach_Concert_Singer_16x16.png` | 96x32 |
| Singer 2 | `Beach_Concert_Singer_2_16x16.png` | 96x32 |
| Singer 3 | `Beach_Concert_Singer_3_16x16.png` | 96x32 |

### Hospital Stretcher Characters (6 types, 3 orientations each)

| Type | Orientations | Dimensions |
|------|-------------|-----------|
| Char 1 | front/left/right | 192x16 each |
| Char 2 | front/left/right | 192x16 each |
| Char 3 | front/left/right | 192x16 each |
| Char 4 | front/left/right | 192x16 each |
| Char 5 | front/left/right | 192x16 each |
| Char 6 | front/left/right | 192x16 each |

---

## Sprout Lands Characters

| File | Dimensions | Notes |
|------|-----------|-------|
| `Basic Charakter Spritesheet.png` | 192x192 | 4x4 grid at 48x48 — player character |
| `Basic Charakter Actions.png` | 96x576 | Action animations |
| `Free Chicken Sprites.png` | 64x32 | 4x2 grid at 16x16 — **in game** |
| `Free Cow Sprites.png` | 96x64 | 3x2 grid at 32x32 — **in game** |
| `Egg_And_Nest.png` | 64x16 | 4 frames at 16x16 — egg hatching |
| `Tools.png` | 96x96 | 3x3 grid at 32x32 — farm tools |

---

## Priority for Game Integration

### Tier 1 — Easy (single-direction, simple format)
- Pigeon 2 (second color variant)
- Fish 1/2/3 (for water tiles)
- Campfire (stationary decoration)
- Egg & Nest (hatching animation)

### Tier 2 — Medium (4-directional, need composite sheet or multi-sheet loading)
- Crow idle/hover/flap (richest bird — 3 animation states)
- Seagull idle
- Worms 1-4 (4-directional, simple 16x16)

### Tier 3 — Larger sprites (multi-tile entities)
- Crabs (multi-frame ground creature)
- Friendly Ghost (large sheet, needs frame analysis)
- Fountains (stationary multi-tile)
- Floating toys (water decoration)

### Tier 4 — Complex (vehicles, structures)
- Boats (multi-tile, directional)
- Drones (multi-tile flying)
- Windmill (building-scale)
