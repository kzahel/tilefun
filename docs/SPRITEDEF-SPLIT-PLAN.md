# Plan: SpriteDef Split — Separate Static Asset Metadata from Per-Tick State

Phase 2 of the Protocol Evolution Roadmap (`docs/NETWORK-ARCHITECTURE.md`).
Builds on Phase 1 delta fields (`docs/WIRE-PROTOCOL-DELTA-PLAN.md`).

## Goal

Entity snapshots currently serialize ~30 static fields per entity every tick that never change after creation (sprite dimensions, sheet keys, collider shapes, AI config). Extract these into a shared `ENTITY_DEFS` registry keyed by entity `type` string. Snapshots carry only dynamic state + the type key. Client reconstructs full entities by merging def + state.

**Expected impact**: ~60-70% reduction in per-entity snapshot size. A chicken goes from ~500 bytes JSON to ~150 bytes. Combined with the delta protocol (slow-changing fields), steady-state bandwidth drops from ~750 KB/s to ~250-300 KB/s for 20 entities.

## Field Classification

### SpriteComponent (11 fields → 5 dynamic + 1 override)

| Field | Static/Dynamic | Notes |
|-------|---------------|-------|
| `sheetKey` | **STATIC** | Asset identifier, set at creation |
| `spriteWidth` | **STATIC** | Pixel dimensions |
| `spriteHeight` | **STATIC** | Pixel dimensions |
| `frameCount` | **STATIC** | Animation frame count |
| `frameDuration` | **STATIC** (with player override) | Player halves this during sprint |
| `drawOffsetY` | **STATIC** | Only player sets `-2` |
| `frameCol` | **DYNAMIC** | Current animation frame |
| `frameRow` | **DYNAMIC** | Direction-based row |
| `animTimer` | **DYNAMIC** | Animation timer |
| `direction` | **DYNAMIC** | Facing direction |
| `moving` | **DYNAMIC** | Movement state |
| `flipX` | **DYNAMIC** | Horizontal flip for non-directional sprites |

### ColliderComponent (5-7 fields → ALL static)

Every field (`offsetX`, `offsetY`, `width`, `height`, `solid`, `clientSolid`, `physicalHeight`) is set once at creation and never mutated. The entire collider reference can be nulled for noclip, but individual fields never change.

### WanderAIComponent (18 fields → 5 dynamic)

| Static (13) | Dynamic (5) |
|-------------|-------------|
| `idleMin`, `idleMax`, `walkMin`, `walkMax`, `speed`, `directional` | `state`, `timer`, `dirX`, `dirY`, `following` |
| `chaseRange`, `chaseSpeed`, `hostile`, `befriendable` | |
| `followDistance`, `followLeash`, `rideSpeed` | |

### Entity-Level Fields

| Field | Static/Dynamic |
|-------|---------------|
| `sortOffsetY` | STATIC per type (only cow: -5) |
| `weight` | STATIC per type |
| `noShadow` | MOSTLY STATIC (fish: true at creation; toggled on mount/dismount) |
| `flashHidden` | DYNAMIC |
| `deathTimer` | DYNAMIC |
| `jumpZ`, `jumpVZ`, `wz` | DYNAMIC |
| `parentId`, `localOffsetX`, `localOffsetY` | DYNAMIC |

## Design

### New Types

```ts
/** Static asset/config metadata, shared registry keyed by entity type. */
interface EntityDef {
  sprite: SpriteDef | null;
  collider: ColliderDef | null;
  wanderAI: WanderAIDef | null;
  // Entity-level static fields:
  sortOffsetY?: number;
  weight?: number;
  noShadow?: boolean;
  // Whether entity has velocity (can move):
  hasVelocity: boolean;
  // Initial dynamic state overrides (e.g., fish moving=true):
  initialMoving?: boolean;
}

interface SpriteDef {
  sheetKey: string;
  spriteWidth: number;
  spriteHeight: number;
  frameCount: number;
  frameDuration: number;
  drawOffsetY?: number;
}

// ColliderDef is identical to ColliderComponent — just a rename for clarity
type ColliderDef = ColliderComponent;

interface WanderAIDef {
  idleMin: number;
  idleMax: number;
  walkMin: number;
  walkMax: number;
  speed: number;
  directional: boolean;
  chaseRange?: number;
  chaseSpeed?: number;
  hostile?: boolean;
  befriendable?: boolean;
  followDistance?: number;
  followLeash?: number;
  rideSpeed?: number;
}

/** Dynamic sprite state — serialized per-tick. */
interface SpriteState {
  frameCol: number;
  frameRow: number;
  animTimer: number;
  direction: Direction;
  moving: boolean;
  flipX?: boolean;
  frameDuration?: number;  // Override, only present when differs from def (player sprint)
}

/** Dynamic AI state — serialized per-tick. */
interface WanderAIState {
  state: string;
  timer: number;
  dirX: number;
  dirY: number;
  following?: boolean;
}
```

### EntitySnapshot (New Shape)

```ts
interface EntitySnapshot {
  id: number;
  type: string;                              // This IS the def key
  position: { wx: number; wy: number };
  velocity: { vx: number; vy: number } | null;
  spriteState: SpriteState | null;           // Was: sprite: SpriteComponent
  wanderAIState: WanderAIState | null;       // Was: wanderAI: WanderAIComponent
  // collider: REMOVED — entirely static, from def
  // Entity-level dynamic fields (unchanged):
  flashHidden?: boolean;
  noShadow?: boolean;                        // Kept because it's toggled on mount/dismount
  deathTimer?: number;
  jumpZ?: number;
  jumpVZ?: number;
  wz?: number;
  parentId?: number;
  localOffsetX?: number;
  localOffsetY?: number;
}
```

**Eliminated from snapshot**: `sprite.sheetKey`, `sprite.spriteWidth`, `sprite.spriteHeight`, `sprite.frameCount`, `sprite.frameDuration` (when unchanged), `sprite.drawOffsetY`, entire `collider` component, 13 `wanderAI` config fields, `sortOffsetY`, `weight`.

### ENTITY_DEFS Registry

New file `src/entities/EntityDefs.ts`. A `Record<string, EntityDef>` covering all 39 entity types (38 from `ENTITY_FACTORIES` + `player`). Values extracted from the existing factory functions. Example:

```ts
export const ENTITY_DEFS: Record<string, EntityDef> = {
  player: {
    sprite: { sheetKey: "player", spriteWidth: 16, spriteHeight: 16, frameCount: 4, frameDuration: 150, drawOffsetY: -2 },
    collider: { offsetX: 0, offsetY: -3, width: 10, height: 6, clientSolid: true, physicalHeight: 12 },
    wanderAI: null,
    weight: 30,
    hasVelocity: true,
  },
  chicken: {
    sprite: { sheetKey: "chicken", spriteWidth: 16, spriteHeight: 16, frameCount: 4, frameDuration: 200 },
    collider: { offsetX: 0, offsetY: -5, width: 10, height: 6, physicalHeight: 8 },
    wanderAI: { idleMin: 1.0, idleMax: 4.0, walkMin: 1.0, walkMax: 3.0, speed: 20, directional: false, befriendable: true, followDistance: 20 },
    weight: 2,
    hasVelocity: true,
  },
  fish1: {
    sprite: { sheetKey: "fish1", spriteWidth: 16, spriteHeight: 16, frameCount: 12, frameDuration: 180 },
    collider: null,
    wanderAI: null,
    noShadow: true,
    hasVelocity: false,
    initialMoving: true,
  },
  // ... 36 more entries
};
```

### Special Cases

1. **Player `frameDuration` override**: SpriteDef has `frameDuration: 150`. During sprint, player code sets `entity.sprite.frameDuration = 75`. SpriteState includes `frameDuration` only when it differs from the def. Client applies: `frameDuration = spriteState.frameDuration ?? def.sprite.frameDuration`.

2. **`noShadow` on mount/dismount**: Fish have `noShadow: true` in their def. But `EntityHandle.ts` toggles `noShadow` on mount/dismount for the rider. Keep `noShadow` as a dynamic field on the snapshot (it's 1 byte, not worth the complexity of distinguishing def vs override).

3. **Noclip nulls collider**: Server sets `entity.collider = null` during noclip. With def-based reconstruction, the client always gets the collider from the def. Since noclip is debug-only and doesn't affect other players' view, this is fine — noclip is a local server-side physics bypass, the client doesn't need to know.

4. **Entity types not in registry**: Runtime validation at server startup — if an entity's type isn't in `ENTITY_DEFS`, crash early with a clear error.

5. **`initialMoving`**: Fish, campfire, gem, ghosts, egg-nest start with `moving: true` (always animating). The factory sets this initial state. The def records it as `initialMoving: true` so the factory can reference it. On the wire, `spriteState.moving` is always present and carries the current value.

## Files to Modify

### New Files

- **`src/entities/EntityDefs.ts`** — `EntityDef`, `SpriteDef`, `WanderAIDef`, `SpriteState`, `WanderAIState` types + `ENTITY_DEFS` registry

### Modified Files

1. **`src/shared/protocol.ts`** — Change `EntitySnapshot`: replace `sprite: SpriteComponent | null` with `spriteState: SpriteState | null`, replace `wanderAI: WanderAIComponent | null` with `wanderAIState: WanderAIState | null`, remove `collider`.

2. **`src/shared/serialization.ts`** — `serializeEntity()`: extract only dynamic fields into `SpriteState`/`WanderAIState`. `deserializeEntity()`: look up `ENTITY_DEFS[type]`, merge def + state into full `Entity`.

3. **`src/entities/EntityFactories.ts`** + individual factory files — Refactor factories to reference `ENTITY_DEFS` for static config instead of hardcoding. Factories still handle dynamic initialization (position, initial state, tags).

4. **`src/entities/Entity.ts`** — No changes to `Entity` interface itself. The runtime Entity object keeps the same shape. Only the serialization/deserialization path changes.

5. **`src/client/PlayerPredictor.ts`** — Simplify the sprite copy logic. Instead of spreading the full server sprite and overwriting 4 fields, just spread the def's sprite and merge both server state and predicted state.

6. **`src/client/ClientStateView.ts`** — `deserializeEntity()` call already handles reconstruction. No changes needed beyond what serialization.ts provides.

### Files That Do NOT Change

- **Renderer** (`src/rendering/`) — still reads `entity.sprite.sheetKey`, `entity.sprite.spriteWidth`, etc. from full `Entity` objects. The merge happens in deserialization, before the renderer sees anything.
- **Physics/collision** (`src/shared/physics/`, `src/entities/collision.ts`) — still reads `entity.collider.width`, etc. from full `Entity` objects.
- **AI** (`src/entities/wanderAI.ts`) — still reads/writes the full `wanderAI` component on server-side `Entity` objects. Server entities are never serialized-then-deserialized internally.
- **Editor** (`src/editor/`) — spawns entities via factories, which produce full `Entity` objects.
- **Persistence** (`src/persistence/SaveManager.ts`) — already saves as `{type, wx, wy}` and recreates from factories. No format change.

## Entity Type Inventory (39 types)

| Type | Sprite | Collider | WanderAI | Special |
|------|--------|----------|----------|---------|
| `player` | 16x16, 4f | yes (clientSolid) | no | frameDuration override, drawOffsetY=-2 |
| `ball` | 8x8, 1f | yes (not solid) | no | weight=0.5 |
| `chicken` | 16x16, 4f | yes | yes (wander, befriendable) | weight=2 |
| `cow` | 32x32, 3f | yes | yes (wander, befriendable, rideable) | sortOffsetY=-5, weight=500 |
| `pigeon` | 16x16, 6f | yes | yes (wander) | |
| `pigeon2` | 16x16, 6f | yes | yes (wander) | |
| `fish1` | 16x16, 12f | no | no | noShadow, initialMoving |
| `fish2` | 16x16, 12f | no | no | noShadow, initialMoving |
| `fish3` | 16x16, 14f | no | no | noShadow, initialMoving |
| `campfire` | 16x32, 6f | yes (clientSolid) | no | initialMoving |
| `gem` | 16x16, 4f | yes (not solid) | no | initialMoving |
| `ghost-friendly` | 16x16, 4f | yes (not solid) | yes (wander, befriendable) | initialMoving |
| `ghost-angry` | 16x16, 4f | yes (not solid) | yes (chase, hostile) | initialMoving |
| `egg-nest` | 16x16, 4f | no | no | initialMoving |
| `crow` | 32x32, 6f | yes | yes (wander, directional) | |
| `seagull` | 32x32, 6f | yes | yes (wander, directional) | |
| `worm1`-`worm4` | 16x16, 6f | yes | yes (wander, directional) | |
| `person1`-`person20` | 16x32, 6f | yes (clientSolid) | yes (wander, directional) | weight=70 |

## Bandwidth Estimate

Per entity per tick (JSON):

| Component | Before | After | Saved |
|-----------|--------|-------|-------|
| Sprite fields | ~200 bytes | ~80 bytes (6 dynamic) | ~120 bytes |
| Collider fields | ~80 bytes | 0 bytes | ~80 bytes |
| WanderAI fields | ~150 bytes | ~40 bytes (5 dynamic) | ~110 bytes |
| Entity-level static | ~30 bytes | 0 bytes | ~30 bytes |
| **Total per entity** | **~460 bytes** | **~120 bytes** | **~340 bytes (74%)** |

20 entities at 60 Hz: **460 × 20 × 60 = 552 KB/s → 120 × 20 × 60 = 144 KB/s**
50 chickens at 60 Hz: **460 × 50 × 60 = 1.38 MB/s → 120 × 50 × 60 = 360 KB/s**

## Verification

1. `npx tsc --noEmit` — typecheck
2. `npm test` — unit tests
3. `npx biome check --write .` — lint + format
4. `npm run build && npx playwright test` — E2E smoke tests
5. Manual: verify all entity types render correctly, mount/dismount works, prediction works, editor spawn works, entities load from persistence

## Sequencing

This builds on top of the delta protocol work (slow-changing fields). The two are independent code paths but complementary:
- Delta protocol eliminates resending unchanged props/cvars/names/chunks
- SpriteDef split eliminates resending static entity metadata

Combined: ~750 KB/s baseline → ~100-150 KB/s steady state (80% reduction).

Next after this: entity delta compression (Option B) — only send changed dynamic fields per entity with bitmask flags. At that point, 50 idle chickens = 0 bytes.
