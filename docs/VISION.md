# Tilefun: Vision

## Concept

A cozy, top-down 2D exploration game for a 6-year-old. Walk around an infinite procedurally generated world filled with parks, ponds, forests, roads, and buildings. Pet chickens. Go down slides. Push things around. Explore.

**Minecraft meets SNES Zelda**: the world is infinite and chunk-based like Minecraft, but the renderer, mechanics, and feel are SNES Link to the Past — 16x16 pixel tiles, free-scrolling camera, interact with objects, enter buildings.

## Audience

Primary: a 6-year-old girl who wants to explore a pretty world with animals.
Secondary: parent-child co-creation — building maps together in Tiled, adding content.

## Inspirations

- **Minecraft**: Infinite procedural chunk-based world, creative mode, place/break blocks
- **Zelda: A Link to the Past**: Top-down tile renderer, push objects, interact, explore dungeons
- **Stardew Valley**: Cozy pixel art, farming/nature vibes, friendly NPCs
- **Sprout Lands** (tileset by Cup Nooble): The visual identity

## Core Principles

1. **Fun immediately** — walking around a pretty world with animals is the baseline
2. **Progressively deeper** — layers of mechanics added over time, never forced
3. **Co-creation friendly** — Tiled editor integration so we can build content together
4. **Web-native** — runs in any browser, deploy via GitHub Pages, works on Chromebook

## Tech Stack

- TypeScript (strict), Vite, Biome
- HTML5 Canvas2D (raw, no framework)
- simplex-noise + alea for procedural generation
- Playwright for testing
- Tiled editor (.tmj) for hand-crafted content

## Feature Roadmap

### Phase 1: Walking Around (Sessions 1-7)
- [x] Project scaffolding, build tooling, Playwright tests
- [ ] Game loop, camera, asset loading
- [ ] Chunk-based world with procedural terrain (grass, water, sand, forest)
- [ ] Autotiled water edges
- [ ] Player movement with collision
- [ ] Wandering NPCs (chickens)
- [ ] Debug overlay

### Phase 2: Places to Go
- [ ] Tiled .tmj loader for hand-crafted structures
- [ ] Structure templates placed into procedural world (houses, parks, bridges)
- [ ] Door tiles that load interior maps
- [ ] Slides and ladders (movement mechanics)
- [ ] Roads/paths connecting structures

### Phase 3: Things to Do
- [ ] Push/pull movable objects
- [ ] Interact with NPCs (speech bubbles, emotes)
- [ ] Pick up and carry items
- [ ] Simple inventory
- [ ] Give items to NPCs

### Phase 4: Make it Yours
- [ ] In-game tile/object placement (creative mode)
- [ ] Load any Tiled .tmj as world content
- [ ] Save/load world state

### Phase 5: Polish
- [ ] Day/night cycle with tint overlay
- [ ] Weather (rain, snow particles)
- [ ] Sound effects and cozy SNES-style music
- [ ] Animated tiles (water shimmer, flower sway)
- [ ] Simple quests ("find 3 shells for the chicken")

### Phase 6: Stretch Goals
- [ ] Gamepad support
- [ ] 47-tile blob autotile upgrade
- [ ] Multiple biome tilesets (winter, desert, etc.)
- [ ] Multiplayer (shared world via WebRTC or server)
- [ ] Mobile touch controls

## Tileset

**Sprout Lands** by Cup Nooble (free, from itch.io). 16x16 pixel art with:
- Grass terrain with autotile variants (blob bitmask)
- Water tiles
- Trees, flowers, fences, paths
- Houses, doors, furniture
- Character spritesheet (4 directions x 4 walk frames)
- Chickens, cows
- Tools, items, chests

May add additional tilesets for other biomes or styles later.
