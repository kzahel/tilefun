# Tilefun: Architecture

## Project Structure

```
src/
  main.ts                        Entry point
  config/
    constants.ts                 TILE_SIZE, CHUNK_SIZE, PIXEL_SCALE, etc.
  core/
    Game.ts                      Top-level orchestrator (init/update/render)
    GameLoop.ts                  Fixed-timestep loop with interpolation
  math/
    Vector2.ts                   Vector utilities
  world/
    types.ts                     Coordinate types + conversions
    World.ts                     Public facade over ChunkManager
    Chunk.ts                     Typed arrays: terrain, detail, autotile, collision
    ChunkManager.ts              Load/generate/cache/unload chunks
    TileRegistry.ts              Tile definitions, collision flags, sprite mappings
  generation/
    WorldGenerator.ts            Noise -> biome -> tiles pipeline
    NoiseMap.ts                  Multi-octave simplex noise
    BiomeMapper.ts               Dual-noise (elevation + moisture) -> biome
  autotile/
    Autotiler.ts                 4-bit cardinal bitmask -> tile variant
  rendering/
    Renderer.ts                  Layer orchestrator
    Camera.ts                    Position, viewport, world<->screen conversion
    TileRenderer.ts              Chunk OffscreenCanvas caching + viewport culling
    EntityRenderer.ts            Draw entities Y-sorted
    DebugRenderer.ts             Chunk borders, collision boxes, FPS
  entities/
    Entity.ts                    Plain object with nullable component fields
    EntityManager.ts             Spawn, update, Y-sort query
    Player.ts                    Player factory
    Cat.ts                       NPC factory (chickens initially)
    collision.ts                 Tile-based AABB collision
    wanderAI.ts                  Random walk state machine
  input/
    InputManager.ts              Keyboard state -> action set
  assets/
    AssetLoader.ts               Image + JSON loading
    Spritesheet.ts               Grid region lookup
  tiled/
    TiledTypes.ts                TypeScript interfaces for .tmj
    TiledParser.ts               Minimal custom parser

tests/
  smoke.spec.ts                  Playwright smoke tests

public/
  assets/
    tilesets/                    Spritesheet PNGs + metadata JSON
    sprites/                     Character/NPC spritesheets
    structures/                  Hand-crafted .tmj files (Phase 2+)

docs/
  VISION.md                      Game concept + feature roadmap
  ARCHITECTURE.md                This file
```

## Coordinate Systems

Four coordinate spaces. All conversions are pure functions in `world/types.ts`.

| Space | Type | Unit | Example |
|-------|------|------|---------|
| **World** | `WorldPos { wx, wy }` | Pixels (fractional) | Player at (152.3, 87.9) |
| **Tile** | `TilePos { tx, ty }` | Integer tile index | `floor(wx / 16)` |
| **Chunk** | `ChunkPos { cx, cy }` | Integer chunk index | `floor(tx / 16)` |
| **Screen** | `ScreenPos { sx, sy }` | CSS canvas pixels | After camera transform |

Negative coordinates use double-modulo for local tile index: `((n % m) + m) % m`.

Chunk map key: `"cx,cy"` string in a `Map<string, Chunk>`.

## Core Loop

```
GameLoop (fixed timestep 60Hz)
  ├── update(dt)
  │   ├── InputManager.update()       — poll keyboard -> action set
  │   ├── Player input -> velocity     — WASD/arrows -> movement vector
  │   ├── EntityManager.update(dt)     — AI -> movement -> collision -> animation
  │   ├── World.updateLoadedChunks()   — load/unload based on camera
  │   └── Camera.follow(player)        — smooth lerp
  └── render(alpha)
      └── Renderer.render()
          ├── TileRenderer.drawTerrain()   — chunk caches
          ├── TileRenderer.drawDetails()   — flowers, short objects
          ├── EntityRenderer.draw()        — Y-sorted sprites
          └── TileRenderer.drawOverhead()  — tree canopies
```

## Chunk System

- Each chunk = 16x16 tiles = 256 pixels x 256 pixels
- Data stored as typed arrays for cache efficiency:
  - `terrain: Uint16Array[256]` — base tile IDs
  - `detail: Uint16Array[256]` — decoration tile IDs (0 = empty)
  - `autotileCache: Uint16Array[256]` — resolved spritesheet positions
  - `collision: Uint8Array[256]` — bitfield (Solid, Water, SlowWalk)
- ~1.8KB per chunk in memory
- Chunks are generated on demand, cached, and unloaded beyond `UNLOAD_DISTANCE`
- Each chunk has an `OffscreenCanvas` render cache, rebuilt when dirty

### Generation Pipeline

```
1. Elevation noise (simplex, freq ~0.008, 5 octaves) -> [0, 1]
2. Moisture noise  (simplex, freq ~0.012, 4 octaves) -> [0, 1]
3. Thresholds -> BiomeId (DeepWater, ShallowWater, Sand, Grass, Forest, DenseForest)
4. BiomeId -> base terrain TileId + collision flags
5. Detail noise -> scatter flowers, trees, tall grass
6. Autotile pass (after neighbors exist) -> resolve water/grass edge variants
```

## Autotile

### Phase 1: 4-bit Cardinal Bitmask (16 variants)

```
Bit 0 (1) = North neighbor is same type
Bit 1 (2) = West
Bit 2 (4) = East
Bit 3 (8) = South

Bitmask 0..15 -> index into 16-variant autotile strip
```

Computed per-chunk after terrain generation. Chunk borders read from neighbor chunks (must be generated first).

### Upgrade Path: 8-bit Blob (47 variants)

Add diagonal bits (NW, NE, SW, SE) that only count when both adjacent cardinals are set. 256 possible masks collapse to 47 unique visual variants via lookup table. Same data structures — only the bitmask computation and lookup table change.

## Entity System (ECS-lite)

Entities are plain objects with nullable typed component fields:

```typescript
interface Entity {
  id: number;
  type: string;
  position: PositionComponent;
  velocity: VelocityComponent | null;
  sprite: SpriteComponent | null;
  collider: ColliderComponent | null;
  wanderAI: WanderAIComponent | null;
}
```

No archetype tables or system queries. Systems iterate all entities and null-check components. Sufficient for hundreds of entities.

### Collision

Tile-based AABB. Movement resolved per-axis independently (slide along walls):
1. Try X movement alone — blocked? Keep old X.
2. Try Y movement alone — blocked? Keep old Y.

Player collider is inset to bottom half (feet area) for forgiving movement around objects.

## Rendering

- **Pixel scale**: 3x (16px tiles -> 48px on screen)
- **Camera**: Smooth lerp follow, configurable factor (~0.1)
- **Viewport culling**: Only draw chunks within visible range + 1 buffer
- **Chunk caching**: Static tiles pre-rendered to `OffscreenCanvas`, redrawn on dirty
- **Y-sorting**: Entities sorted by Y position for depth ordering
- **Pixel-perfect**: `imageSmoothingEnabled = false` + CSS `image-rendering: pixelated`

## Tiled Integration

- Custom minimal `.tmj` (JSON) parser, ~100 lines
- Tile layers parsed into `Uint16Array` with GID -> local TileId mapping
- Object layers provide spawn points, doors, collision overrides
- Structures "stamped" onto chunk arrays during generation (Phase 2)
- Tiled tilesets used as source of truth for tile IDs

## Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `simplex-noise` | Seeded 2D noise for procedural generation | ~2KB gzip |
| `alea` | Seedable PRNG for reproducible worlds | ~0.5KB gzip |
| `vite` | Dev server + bundler | Dev only |
| `typescript` | Type checking | Dev only |
| `@biomejs/biome` | Lint + format | Dev only |
| `@playwright/test` | E2E testing | Dev only |

Zero runtime framework dependencies.
