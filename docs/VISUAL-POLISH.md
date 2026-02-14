# Visual Polish & Effects Catalog

Visual tricks and polish effects for tilefun — cheap-to-implement techniques that add life and depth to the 2D tile world.

## Implemented

### Shadow blobs
- Dark ellipse sprites under trees, structures, and entities (~20% opacity)
- Huge depth cue for minimal cost

## In Progress

### Grass blades (Pokemon-style V blades)
- **Sprite**: `public/assets/sprites/grass-blades.png` — 4 variants (big-A, big-B, small-A, small-B) in 8×8 cells
- **Auto-placement**: Scatter N blades per grass tile (random positions within tile, seeded by chunk+tile coords for determinism)
- **Idle sway**: Each blade rotates from base anchor with a sine wave. Random period (1.5–3s) and phase offset per instance
- **Entity reaction**: When player/entity center is within ~1.5 tiles, blade rotates away from entity. Blend between idle sway and push-away based on distance
- **Rotation anchor**: Bottom-center of the shadow (big: cell pixel 3,6 — small: cell pixel 3,5)
- **Rendering**: `ctx.save()` → translate to blade world position → `ctx.rotate(angle)` → draw sprite offset by anchor → `ctx.restore()`
- **Performance**: Only process/render blades in visible chunks. Pre-compute blade positions per chunk on generation (store as parallel array, not per-entity)

#### Color palette (matched to ME grass autotile)
| Role | Hex | RGB | Notes |
|------|-----|-----|-------|
| Tip (light) | `#8DC07A` | 141, 192, 122 | Lighter than base grass |
| Mid | `#5E9646` | 94, 150, 70 | Main blade body |
| Dark (stem) | `#3E6E30` | 62, 110, 48 | Inner face / stem |
| Shadow | `#28501E` | 42, 80, 34 | Semi-transparent base (α=180) |

## Planned — Tier 1 (Cheap, High Impact)

### Screen tint / day-night cycle
- Single `globalCompositeOperation = "multiply"` or overlay pass per frame
- Warm orange for sunset, blue for night, neutral for day
- Transition: lerp tint color over time
- Cost: 1 fullscreen rect draw per frame

### Vignette
- Pre-rendered radial gradient PNG (dark edges, transparent center)
- Draw on top each frame, fixed to screen
- Instantly more cinematic

### Dust puffs on movement
- Small particle sprites spawned when player changes direction or stops abruptly
- 3-4 frame animation, expand + fade
- Spawn at player feet position

### Collectible bob
- Sine-wave Y offset on gem/collectible entities: `y += sin(time * speed) * amplitude`
- ~2px amplitude, ~2s period
- Optional: scale shadow inversely (smaller when item is "higher")

### Parallax background layer
- Distant mountains/clouds texture that scrolls at 0.3× camera speed
- Drawn behind all tiles, before terrain
- Tiled horizontally, maybe 2 layers at different speeds

## Planned — Tier 2 (Moderate Effort)

### Particle system (general)
- Lightweight particle emitter: position, velocity, lifetime, color, size, gravity
- Used for: dust, sparks, splashes, leaf fall, fireflies, rain, snow
- Pool and recycle particle objects

### Shoreline foam
- 2-3 frame animated white fringe along water edges
- Detect water→land transitions, place foam sprites
- Sine-wave pulsing (foam in/out)

### Light cones / glow
- Radial gradient overlay sprites, tinted warm yellow
- Placed at campfire, torches, windows
- Additive or screen blend mode
- Could use `globalCompositeOperation = "lighter"`

### Squash & stretch on player
- Scale Y 1.15× on jump start, 0.85× on land, lerp back over ~100ms
- Scale X inversely to preserve volume feel
- Applied as canvas transform around player sprite center

### Sprite outline / interactable highlight
- 1px white or colored outline on entities when player is near / can interact
- Draw sprite 4 times offset by (±1, 0) and (0, ±1) in outline color, then draw normal sprite on top

## Planned — Tier 3 (Advanced / Stretch)

### Water scrolling UV
- Offset source rect of water tile by a few pixels per frame (faux current flow)
- Pre-compute animated water tile strip

### Screen shake
- Random camera offset on impacts: 2-4px amplitude, exponential decay over ~200ms
- Triggered by: lightning, explosions, entity collision

### Heat shimmer near fire
- Shift pixel rows by ±1px with sine wave near campfire/lava tiles
- Very subtle, only within small radius

### Caustic overlay on shallow water
- Pre-rendered looping caustic texture, multiply-blended
- 4-8 frame loop, tiled

### Reflection strips at water edge
- Mirror bottom few rows of shoreline objects, flip Y, tint blue, low opacity overlay
- Only for props/entities adjacent to water

### Ghost trail on dash
- When player dashes, stamp faded copies of sprite at previous N positions
- Each copy lower opacity than the last

### Palette swap for entity variants
- Recolor chicken/cow sprites at load time (canvas pixel manipulation)
- "Breeds" for free: brown chicken, spotted cow, etc.

## Performance Notes

- All overlay effects should skip when off-screen (camera frustum culling)
- Particle system should use object pooling (pre-allocate, recycle)
- Grass blades: flat array per chunk, not individual entities — avoid GC pressure
- Day/night tint: single fullscreen draw, very cheap
- Parallax: single tiled draw, very cheap
- Batch similar draw calls where possible (all grass blades in one pass)

## Inspiration Sources

- Pokemon (Gen 3-5): V-shaped grass blades with sway + entity reaction
- Stardew Valley: Seasonal tinting, particle effects, crop sway
- Celeste: Screen shake, dust particles, squash/stretch
- Eastward: Lighting overlays, water reflections, parallax layers
- Undertale: Simple but effective screen effects (shake, flash, tint)
