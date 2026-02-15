# 3D Physics Engine Design Doc

**Status**: Design reference (not implementing yet)

## Vision
Full 3D physics under the hood, rendered as top-down pixel art sprites (Link's Awakening Switch model). Discrete Minecraft-style height steps, no smooth slopes. Entities have absolute Z position, land on surfaces, fall off edges, walk on rooftops.

## Current State
- **Position**: `{ wx, wy }` + `jumpZ` (relative to ground, ephemeral)
- **Jump**: Simple Euler: `jumpVZ -= gravity*dt`, `jumpZ += jumpVZ*dt`, land when `jumpZ <= 0`
- **Elevation**: `heightGrid` per tile (0-3), `ELEVATION_PX = 8px` per level
- **Collision**: 2D AABB per-axis sliding. Elevation check only at feet center point
- **Bug**: Getting stuck on elevation edges (AABB straddles two tiles, only center checked)
- **Props**: 2D walls[], no height concept
- **Physics duplication**: Server (Realm.ts) and client (PlayerPredictor.ts) manually mirror movement physics instead of sharing code. Jump initiation, gravity, mount input, and collision resolution are all reimplemented separately.

---

## Phase 0: Shared Player Movement Module

**Goal**: Unify duplicated physics code into a single shared module (Quake `pmove.c` / Source `gamemovement.cpp` pattern). Prerequisite for all later phases — every new physics feature would otherwise need to be implemented twice.

### Problem
Currently duplicated between `Realm.ts` and `PlayerPredictor.ts`:
1. **Jump initiation** — `if (jump && !(jumpZ ?? 0)) { jumpZ = 0.01; jumpVZ = JUMP_VELOCITY; }`
2. **Jump gravity tick** — `jumpVZ -= JUMP_GRAVITY * dt; jumpZ += jumpVZ * dt; if (jumpZ <= 0) land`
3. **`applyMountInput()`** — ~40 lines near-identical in both files
4. **Collision resolution** — server uses shared `resolveCollision()`, but client reimplements as `resolvePlayerCollision()` / `resolveMountCollision()` with different entity iteration and `clientSolid` vs `solid` checks
5. **Movement pipeline orchestration** — input → speed → dx/dy → collision → gravity

Already shared (good): `updatePlayerFromInput()`, `getSpeedMultiplier()`, collision primitives, constants.

### Solution: Collision Context Interface

Like Quake's `playermove_t` — an interface that abstracts world queries so the same physics code works with different data sources:

```typescript
interface MovementContext {
  getCollision(tx: number, ty: number): number;
  getHeight(tx: number, ty: number): number;
  isEntityBlocked(aabb: AABB): boolean;
  isPropBlocked(aabb: AABB): boolean;
  noclip: boolean;
}
```

Server constructs context from `SpatialHash` + `PropManager` + live entities.
Client constructs context from flat entity/prop snapshot arrays.

### New file: `src/physics/PlayerMovement.ts`

Unified movement tick — single implementation, two callers:

```typescript
export function applyPlayerMovement(
  entity: Entity,
  input: PlayerInput,
  dt: number,
  ctx: MovementContext,
): void;

export function applyMountMovement(
  mount: Entity,
  rider: Entity,
  input: PlayerInput,
  dt: number,
  ctx: MovementContext,
): void;

export function tickJumpGravity(entity: Entity, dt: number): void;
```

### Migration

1. Extract shared functions from `Realm.ts` into `PlayerMovement.ts`
2. Have `Realm.ts` call the shared functions with a server-side `MovementContext`
3. Replace `PlayerPredictor.ts` reimplementations with calls to the same shared functions using a client-side `MovementContext`
4. Delete `resolvePlayerCollision()` / `resolveMountCollision()` / `applyMountInput()` from PlayerPredictor
5. The `clientSolid` vs `solid` distinction becomes a property of the context (client context checks `clientSolid`, server context checks `solid`)

### Testing

**Physics parity test** (`src/physics/physicsParity.test.ts`):
- Construct identical `MovementContext` for server and client paths
- Feed same input sequence through both
- Assert positions match at every tick
- This test becomes trivial to write once both sides call the same function — the parity is guaranteed by construction, and the test validates the contexts produce the same results

### Key files
| File | Change |
|------|--------|
| `src/physics/PlayerMovement.ts` | **NEW** — unified movement, jump, mount logic |
| `src/physics/MovementContext.ts` | **NEW** — context interface |
| `src/server/Realm.ts` | Replace inline physics with calls to shared module |
| `src/client/PlayerPredictor.ts` | Replace reimplemented physics with calls to shared module, delete ~120 lines |
| `src/entities/collision.ts` | May need minor refactor to support context-based blocking |

---

## Phase 1: Absolute Z Position & Surface Snapping

**Goal**: Replace relative `jumpZ` with absolute `wz`. Fix elevation edge bugs.

Split into two sub-steps for smaller, more debuggable changes:

### Phase 1a: wz Foundation (server-side)
- Add `wz`/`vz`/`groundZ` fields
- `surfaceHeight.ts` module
- Rewrite jump physics in Realm.ts
- Ground tracking in EntityManager.ts
- Serialization of `wz`
- Unit tests for surface queries

### Phase 1b: Edge Fix & Prediction
- Replace `isElevationBlocked` with AABB-wide `isElevationBlocked3D`
- Update shared `PlayerMovement.ts` (Phase 0) — prediction gets it for free
- Integration testing (manual: walk elevation edges without getting stuck)

### New file: `src/physics/surfaceHeight.ts`
- `getSurfaceZ(wx, wy, getHeight)` — terrain surface height at a point
- `getMaxSurfaceZUnderAABB(aabb, getHeight)` — max surface across all tiles under AABB footprint (fixes edge bug)

### Entity.ts — add fields
```typescript
wz?: number;      // absolute Z in world pixels (0 = world floor)
vz?: number;      // vertical velocity px/s (server-only, not serialized)
groundZ?: number;  // computed surface height (server-only, not serialized)
```

### Realm.ts — rewrite jump physics (lines 407-423)
```
vz -= JUMP_GRAVITY * dt
wz += vz * dt
groundZ = getSurfaceZ(wx, wy, getHeight)
if wz <= groundZ → land (wz = groundZ, delete vz)
// Compute legacy field for renderer:
entity.jumpZ = wz - groundZ
```

### EntityManager.ts — ground tracking after movement
- Grounded entities: snap `wz` to `getSurfaceZ` after XY movement
- Walk off cliff edge: `groundZ < wz` triggers falling (set `vz = 0`, gravity pulls down)

### collision.ts — replace `isElevationBlocked`
```typescript
isElevationBlocked3D(aabb, entityWz, getHeight, stepUpThreshold)
```
- Checks ALL tiles under AABB (not just feet center)
- Blocks if `maxSurfaceZ > entityWz + stepUpThreshold`
- Phase 1: `stepUpThreshold = 0` (must jump for any elevation change)

### PlayerPredictor.ts — mirror all changes
- Track `wz`/`vz` on predicted entity
- Use new surface/collision functions
- Reconcile `wz` from server state

### Serialization
- Add `wz` to `EntitySnapshot` in `protocol.ts`
- Add `wz` to `serialization.ts` (manual optional field pattern)
- `jumpZ` still computed and serialized (renderer reads it unchanged)

### Rendering — no changes
- Renderer still reads `jumpZ` (server computes `jumpZ = wz - groundZ`)
- EntityRenderer.ts, Renderable.ts unchanged

### Persistence — no changes
- Entities respawn at saved XY, snap to ground. No Z in save format.
- heightGrid format unchanged.

### Testing (focused on high-value tests only)

**Surface height queries** (`src/physics/surfaceHeight.test.ts`):
- Pure math, foundation for everything. If wrong, breaks silently.
- AABB straddling two tiles of different height returns max
- AABB fully within one tile
- AABB at chunk boundary

**Client-server physics parity** (`src/physics/physicsParity.test.ts`):
- The most valuable test. Catches rubber-banding bugs that are hardest to debug manually.
- Construct minimal world with elevated tiles
- Feed identical input sequence (move, jump, land, walk edge, walk off cliff) through both server physics (Realm) and client physics (PlayerPredictor)
- Assert `wz` and position match at every tick
- If server physics changes without matching predictor update, this fails immediately

**Elevation edge cases** (in `collision.test.ts`):
- AABB straddles height-0 and height-2: blocked (can't step up)
- Jump + land with AABB straddling: snap to higher surface
- Walk along elevated platform edge: no stuck
- Walk off cliff: triggers falling, not teleport to ground

**Not worth testing**: `aabb3DOverlap` (trivial), renderer (visual), `wz` serialization (same pattern as existing optional fields)

### Key files
| File | Change |
|------|--------|
| `src/entities/Entity.ts` | Add `wz`, `vz`, `groundZ` |
| `src/shared/protocol.ts` | Add `wz` to `EntitySnapshot` |
| `src/shared/serialization.ts` | Serialize `wz` |
| `src/physics/surfaceHeight.ts` | **NEW** |
| `src/entities/collision.ts` | `isElevationBlocked3D`, AABB surface query |
| `src/server/Realm.ts` | Jump rewrite, ground tracking |
| `src/entities/EntityManager.ts` | Ground snap, fall detection |
| `src/client/PlayerPredictor.ts` | Mirror physics |
| `src/config/constants.ts` | `STEP_UP_THRESHOLD = 0` |

---

## Phase 2: 3D Collision Volumes & Step-Up

**Goal**: Terrain tiles as 3D boxes. Step-up threshold for walking onto small ledges. Proper falling with visible fall animation.

### New file: `src/physics/AABB3D.ts`
```typescript
interface AABB3D { left, top, right, bottom, zMin, zMax }
function aabb3DOverlap(a, b): boolean
function entityToAABB3D(pos, collider, wz, physicalHeight): AABB3D
```

### ColliderComponent — add `physicalHeight`
```typescript
physicalHeight?: number  // z-axis extent above feet (world pixels)
```
Replaces external `ENTITY_PHYSICAL_HEIGHT` registry. Auto-serialized via spread.

### Step-up: `STEP_UP_THRESHOLD = 4` (half an ELEVATION_PX level)
- Walking into a surface that's <=4px above your feet: auto-step up, snap wz
- Above threshold: blocked (must jump)

### Entity-entity 3D filtering
- Skip collision if Z ranges don't overlap (replaces the `jumpZ > 0` hack)
- Skip separation for non-overlapping Z ranges

### Key files
| File | Change |
|------|--------|
| `src/physics/AABB3D.ts` | **NEW** |
| `src/entities/Entity.ts` | `physicalHeight` on `ColliderComponent` |
| `src/entities/EntityFactories.ts` | Set `physicalHeight` per entity type |
| `src/entities/collision.ts` | 3D overlap, step-up |
| `src/entities/EntityManager.ts` | 3D entity filtering, separation |
| `src/config/constants.ts` | `STEP_UP_THRESHOLD = 4` |
| `src/client/PlayerPredictor.ts` | Mirror |

---

## Phase 3: Structure 3D Bodies

**Goal**: Props get Z-axis collision. Walk on rooftops, enter tubes properly.

### PropCollider — add Z fields
```typescript
zBase?: number       // default 0
zHeight?: number     // default infinity (full-height wall)
walkableTop?: boolean // top surface is a platform
```

### Surface query includes props
- `getSurfaceZ` extended to check walkable prop surfaces
- Entity standing on a house roof: `wz = prop.zBase + prop.zHeight`

### PropFactory updates
- Play fort: walls `zHeight: 32`, platform on top `walkableTop: true`
- Tube climber: walls with Z ranges, passable underneath
- Existing props: defaults work (zBase=0, zHeight=infinity = current behavior)

### Key files
| File | Change |
|------|--------|
| `src/entities/Prop.ts` | Z fields on `PropCollider` |
| `src/entities/PropFactories.ts` | 3D data for structures |
| `src/shared/protocol.ts` | `PropSnapshot` type update |
| `src/physics/surfaceHeight.ts` | Prop surface queries |
| `src/entities/collision.ts` | Z-aware prop wall checks |
| `src/client/PlayerPredictor.ts` | Mirror |

---

## Phase 4: Physics/Render Body Split

**Goal**: Separate physics position from render position. Render tweens toward physics for smooth corrections.

### Client-side `renderPosition`
```typescript
renderPosition?: { wx: number; wy: number; wz: number }  // not serialized
```

### Tween logic (per render frame)
```typescript
renderPos.wx += (physPos.wx - renderPos.wx) * lerpFactor
// same for wy, wz
// Large delta → snap immediately
```

### Applied in
- `RemoteStateView` — tween remote entities toward latest snapshot
- `PlayerPredictor` — tween predicted player toward reconciled position
- `EntityRenderer` — prefer `renderPosition` over `position` for drawing

### Key files
| File | Change |
|------|--------|
| `src/rendering/Renderable.ts` | Add `renderPosition` |
| `src/rendering/EntityRenderer.ts` | Read `renderPosition` |
| `src/client/ClientStateView.ts` | Tween remote entities |
| `src/client/PlayerPredictor.ts` | Tween predicted player |
| `src/scenes/renderWorld.ts` | Y-sort uses renderPosition |

---

## Phase 5: Debug 3D Wireframe

**Goal**: Visualize 3D collision geometry in debug overlay.

### DebugRenderer.ts enhancements
- 3D wireframe boxes: bottom face at zMin, top face at zMax (Y-offset), vertical edges
- Color coding: terrain=green, entities=red, props=orange, walkable surfaces=cyan
- Z-range labels
- Tile height columns for elevated terrain
- New cvar: `r_show3d`

---

## Future (out of scope, enabled by this foundation)
- **Noise-generated cliffs**: Terrain generation assigns elevation, cliff tiles are impassable walls
- **Multi-layer worlds**: Overworld/underworld/cloud layer, portals between them
- **Cardinal slopes**: Simple one-direction ramps, no corner slopes
- **Throwable objects / bouncing balls**: 3D projectile physics with bounce coefficient
- **Bandwidth optimization**: Only serialize `wz` for airborne entities

## Cross-Cutting
- **Save format**: No changes. Entities respawn at ground level. heightGrid unchanged.
- **Bandwidth**: +1 number per entity per tick (~400 bytes for 50 entities). Negligible.
- **Prediction parity**: Extract shared physics into `src/physics/`. Both Realm and PlayerPredictor call same functions.
- **Backward compat**: `jumpZ` still computed for renderers. Old clients work (ignore `wz`).

## Verification
1. `npx tsc --noEmit` — typecheck
2. `npm test` — unit tests (new surfaceHeight tests + updated collision tests)
3. `npx biome check --write .` — lint
4. Manual test: walk onto elevated tiles from all 4 sides without getting stuck
5. Manual test: jump onto height-2 tile, walk around on it, walk off edge and fall
6. Manual test: client prediction feels smooth (no rubber-banding on elevation changes)
7. `npm run build && npx playwright test` — E2E smoke test
