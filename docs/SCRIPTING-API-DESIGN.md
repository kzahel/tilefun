# Scripting API Design

Roblox-inspired server-side scripting system for tilefun. Scripts run on the
server only; state replicates to clients via existing `game-state` broadcast.

Design goal: **dogfood** by migrating all existing game logic (gem collection,
spawners, befriending, hostile AI, campfire traps) into mods that use the same
API available to user-authored scripts.

## Architecture

```
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│  Editor UI │  │  Gem Mod   │  │ Befriend   │  │ User Mod   │
│  (client)  │  │  (builtin) │  │  Mod       │  │  (future)  │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │ messages       │ direct        │ direct        │ direct
      ▼               ▼              ▼              ▼
 ┌──────────────────────────────────────────────────────────┐
 │                       WorldAPI                           │
 │  .terrain   .entities   .props   .world   .player       │
 └──────────────────────┬───────────────────────────────────┘
                        │
 ┌──────────────────────┴───────────────────────────────────┐
 │  Services                                                │
 │  TagService · EventBus · TickService · OverlapService    │
 └──────────────────────┬───────────────────────────────────┘
                        │
 ┌──────────────────────┴───────────────────────────────────┐
 │  Internals (not exposed to mods)                         │
 │  TerrainEditor · EntityManager · PropManager · World     │
 │  Physics · Autotile · SaveManager · Transport            │
 └──────────────────────────────────────────────────────────┘
```

## Roblox Mapping

| Roblox Concept              | Tilefun Equivalent              |
| --------------------------- | ------------------------------- |
| `Instance:SetAttribute()`   | `EntityHandle.setAttribute()`   |
| `Instance:GetAttribute()`   | `EntityHandle.getAttribute()`   |
| `CollectionService` tags    | `TagService`                    |
| `RunService.PreSimulation`  | `TickService.onPreSimulation`   |
| `RunService.PostSimulation` | `TickService.onPostSimulation`  |
| `BasePart.Touched`          | `OverlapService.onOverlap`      |
| `BindableEvent`             | `EventBus.emit` / `EventBus.on` |
| `RemoteEvent`               | Transport (already exists)      |
| `Players.PlayerAdded`       | `player-joined` event           |
| `Players.PlayerRemoving`    | `player-left` event             |
| `RunService` clock          | `WorldAPI.time`                 |
| `Workspace` spatial queries | `WorldAPI.world.*`              |
| `Humanoid`                  | Player entity + movement system |

---

## WorldAPI

The single object passed to every mod. Wraps all server-side systems behind a
clean, stable interface.

```typescript
interface WorldAPI {
  readonly terrain: TerrainAPI;
  readonly entities: EntityAPI;
  readonly props: PropAPI;
  readonly world: WorldQueryAPI;
  readonly player: PlayerAPI;
  readonly tags: TagService;
  readonly events: EventBus;
  readonly tick: TickService;
  readonly overlap: OverlapService;
  /** Seconds since server start. Monotonic. Useful for cooldowns / animation sync. */
  readonly time: number;
}
```

### TerrainAPI

Wraps `TerrainEditor`. Same operations the editor sends via protocol messages.

```typescript
interface TerrainAPI {
  paintTile(tx: number, ty: number, terrainId: number | null, opts?: {
    paintMode?: PaintMode;
    bridgeDepth?: number;
  }): void;

  paintSubgrid(gsx: number, gsy: number, terrainId: number | null, opts?: {
    paintMode?: PaintMode;
    bridgeDepth?: number;
    shape?: SubgridShape;
  }): void;

  paintCorner(gsx: number, gsy: number, terrainId: number | null, opts?: {
    paintMode?: PaintMode;
    bridgeDepth?: number;
  }): void;

  paintRoad(tx: number, ty: number, roadType: number, paintMode?: PaintMode): void;
  setElevation(tx: number, ty: number, height: number, gridSize?: number): void;
  clearAllTerrain(fillTerrainId: number): void;
  clearAllRoads(): void;
}
```

### EntityAPI

Wraps `EntityManager` + spawn logic currently in `GameServer.handleSpawn()`.

```typescript
interface EntityAPI {
  spawn(type: string, wx: number, wy: number): EntityHandle | null;
  remove(id: number): boolean;
  find(id: number): EntityHandle | null;
  findByType(type: string): EntityHandle[];
  findByTag(tag: string): EntityHandle[];
  findInRadius(wx: number, wy: number, radius: number): EntityHandle[];
  all(): EntityHandle[];
}
```

### PropAPI

Wraps `PropManager`.

```typescript
interface PropAPI {
  place(type: string, wx: number, wy: number): PropHandle | null;
  remove(id: number): boolean;
  find(id: number): PropHandle | null;
  all(): PropHandle[];
}
```

### WorldQueryAPI

Read-only world state queries.

```typescript
interface WorldQueryAPI {
  getTerrain(tx: number, ty: number): number;
  getCollision(tx: number, ty: number): number;
  getHeight(tx: number, ty: number): number;
  getRoad(tx: number, ty: number): number;
  isWalkable(tx: number, ty: number): boolean;
  /** Find a walkable tile near (wx, wy), spiral search. */
  findWalkableNear(wx: number, wy: number, maxRadius: number): { wx: number; wy: number } | null;
}
```

### PlayerAPI

Access to player session(s). Currently single-player; multiplayer later.

```typescript
interface PlayerAPI {
  /** The current player, or null if no player is connected. */
  get(): PlayerHandle | null;
  /** If this entity handle is actually the player, return a PlayerHandle. */
  fromEntity(entity: EntityHandle): PlayerHandle | null;
}
```

---

## Entity Handles

Safe wrappers around Entity objects. Stable API surface for mods.

### EntityHandle

```typescript
interface EntityHandle {
  readonly id: number;
  readonly type: string;

  // Position
  readonly wx: number;
  readonly wy: number;
  setPosition(wx: number, wy: number): void;

  // Velocity (null if entity has no velocity component)
  readonly vx: number;
  readonly vy: number;
  setVelocity(vx: number, vy: number): void;

  // Tile position (derived)
  readonly tx: number;
  readonly ty: number;

  // Spatial
  distanceTo(other: EntityHandle | PlayerHandle): number;

  // Tags (delegates to TagService)
  addTag(tag: string): void;
  removeTag(tag: string): void;
  hasTag(tag: string): boolean;
  readonly tags: ReadonlySet<string>;

  // Attributes (per-entity key-value store for script state)
  setAttribute(key: string, value: unknown): void;
  getAttribute(key: string): unknown;
  getAttributes(): Record<string, unknown>;

  // AI (for entities with WanderAI component)
  readonly aiState: "idle" | "walking" | "chasing" | "following" | null;
  setAIState(state: "idle" | "walking" | "chasing" | "following"): void;
  readonly isFollowing: boolean;
  setFollowing(following: boolean): void;

  // Lifecycle
  remove(): void;
  readonly alive: boolean;

  // Visual effects (sends ServerMessage to client)
  setFlashing(on: boolean): void;
  setDeathTimer(seconds: number): void;
}
```

### PlayerHandle

Extends EntityHandle with player-session state.

```typescript
interface PlayerHandle extends EntityHandle {
  readonly gemsCollected: number;
  giveGems(n: number): void;
  loseGems(n: number): number; // returns actual lost count (capped at current)
  readonly isInvincible: boolean;
  setInvincible(seconds: number): void;
  knockback(fromWx: number, fromWy: number, speed: number): void;
}
```

---

## Services

### TagService

Manages tags on entities. Inspired by Roblox `CollectionService`.

Entities can have multiple tags. Scripts watch for tag membership changes.
Tags are ephemeral (not persisted) — set at spawn time by factory or script.

```typescript
interface TagService {
  addTag(entity: EntityHandle, tag: string): void;
  removeTag(entity: EntityHandle, tag: string): void;
  hasTag(entity: EntityHandle, tag: string): boolean;
  getTagged(tag: string): EntityHandle[];

  /** Fires when an entity gains this tag (including spawn with tag). */
  onTagAdded(tag: string, cb: (entity: EntityHandle) => void): Unsubscribe;
  /** Fires when an entity loses this tag (including removal/death). */
  onTagRemoved(tag: string, cb: (entity: EntityHandle) => void): Unsubscribe;
}

type Unsubscribe = () => void;
```

### EventBus

Inter-mod communication. Like Roblox `BindableEvent` or Node `EventEmitter`.

Events are fire-and-forget, non-blocking. Handlers run in registration order.

```typescript
interface EventBus {
  emit(event: string, data?: unknown): void;
  on(event: string, cb: (data?: unknown) => void): Unsubscribe;
  once(event: string, cb: (data?: unknown) => void): Unsubscribe;
}
```

**Built-in events** (emitted by core or mods):

| Event                | Data                                    | Emitter           |
| -------------------- | --------------------------------------- | ----------------- |
| `entity-spawned`     | `{ entity: EntityHandle }`              | EntityAPI.spawn   |
| `entity-removed`     | `{ entity: EntityHandle }`              | EntityAPI.remove  |
| `player-joined`      | `{ player: PlayerHandle }`              | GameServer        |
| `player-left`        | `{ player: PlayerHandle }`              | GameServer        |
| `player-interact`    | `{ player: PlayerHandle, wx, wy }`      | GameServer        |
| `item-collected`     | `{ entity: EntityHandle, player, value }` | Gem mod         |
| `player-damaged`     | `{ player, source: EntityHandle, gems }` | Hostile mod      |

### TickService

Frame-cycle hooks. Inspired by Roblox `RunService`.

```typescript
interface TickService {
  /** Before AI + physics. Set velocities/intentions here. */
  onPreSimulation(cb: (dt: number) => void): Unsubscribe;
  /** After physics. React to final positions here. */
  onPostSimulation(cb: (dt: number) => void): Unsubscribe;
}
```

Tick order within `GameServer.tick(dt)`:

```
1. Apply player input (existing)
2. tickAllAI() (existing, default for entities without script AI)
3. ── TickService.preSimulation ──  ← mods run here
4. EntityManager.update() (physics + collision)
5. ── TickService.postSimulation ── ← mods run here
6. Broadcast game-state
```

### OverlapService

AABB overlap detection. Inspired by Roblox `BasePart.Touched`.

Runs once per tick (post-simulation), checks entity pairs for AABB overlap.
Only fires on **new** overlaps (enter), not sustained contact. Also fires
on overlap **end** (exit). Implementation: N² pairwise check among entities
sharing a watched tag. Fine for current entity counts (dozens); add spatial
hashing if it grows to hundreds+.

```typescript
interface OverlapService {
  /** Fires once when two entities start overlapping. */
  onOverlap(
    tag: string, // watch entities with this tag
    cb: (self: EntityHandle, other: EntityHandle) => void,
  ): Unsubscribe;

  /** Fires once when two entities stop overlapping. */
  onOverlapEnd(
    tag: string,
    cb: (self: EntityHandle, other: EntityHandle) => void,
  ): Unsubscribe;
}
```

---

## Mod Interface

A mod is a plain TypeScript module that exports a `register` function.

```typescript
interface Mod {
  name: string;
  register(api: WorldAPI): Unsubscribe;
}
```

`register()` returns an `Unsubscribe` function that tears down everything the
mod set up (disconnects all event/tick/overlap listeners). This enables
hot-reload and toggling mods at runtime. Each mod collects its subscription
handles internally and returns a single combined teardown.

Mods are registered at server startup. Order matters only for EventBus
listener priority (first registered = first notified).

```typescript
// in GameServer constructor or init:
const api = new WorldAPIImpl(...);
const teardowns = new Map<string, Unsubscribe>();
for (const mod of builtinMods) {
  teardowns.set(mod.name, mod.register(api));
}
```

---

## Dogfood: Migrating Existing Game Logic

### Mod 1: `collectible` (replaces gem collection in `tickGameplay`)

**Current code:** `GameplaySimulation.ts` lines 30-60 — proximity check player
vs gems, increment counter, remove gem.

**Tags:** Gems get `"collectible"` tag at spawn.

```typescript
// src/mods/collectible.ts
export const collectibleMod: Mod = {
  name: "collectible",
  register(api) {
    return api.overlap.onOverlap("collectible", (self, other) => {
      const player = api.player.fromEntity(other);
      if (!player || player.isInvincible) return;

      const value = (self.getAttribute("gemValue") as number) ?? 1;
      player.giveGems(value);
      api.events.emit("item-collected", { entity: self, player, value });
      self.remove();
    });
  },
};
```

### Mod 2: `hostile` (replaces knockback/invincibility in `tickGameplay`)

**Current code:** `GameplaySimulation.ts` lines 62-130 — hostile contact
detection, gem scatter, knockback velocity, invincibility timer, buddy scare.

**Tags:** Ghost-angry gets `"hostile"` tag at spawn.

```typescript
// src/mods/hostile.ts
export const hostileMod: Mod = {
  name: "hostile",
  register(api) {
    const unsub = api.overlap.onOverlap("hostile", (self, other) => {
      // Player contact: knockback + gem scatter
      const player = api.player.fromEntity(other);
      if (player && !player.isInvincible) {
        const lost = player.loseGems(3);
        for (let i = 0; i < lost; i++) {
          const angle = Math.random() * Math.PI * 2;
          const gem = api.entities.spawn("gem", player.wx, player.wy);
          if (gem) {
            gem.addTag("collectible");
            gem.setVelocity(Math.cos(angle) * 80, Math.sin(angle) * 80);
            gem.setAttribute("decaying", true);
          }
        }
        player.knockback(self.wx, self.wy, 200);
        player.setInvincible(1.5);
        api.events.emit("player-damaged", { player, source: self, gems: lost });
      }

      // Hostile scares away buddies
      if (other.hasTag("buddy") && other.isFollowing) {
        other.setFollowing(false);
      }
    });
    return unsub;
  },
};
```

### Mod 3: `campfire-trap` (replaces campfire logic in `tickGameplay`)

**Current code:** `GameplaySimulation.ts` lines 132-155 — hostile touches
campfire, dies with death timer, drops gem.

**Tags:** Campfire gets `"campfire"` tag.

```typescript
// src/mods/campfire-trap.ts
export const campfireTrapMod: Mod = {
  name: "campfire-trap",
  register(api) {
    return api.overlap.onOverlap("campfire", (self, other) => {
      if (!other.hasTag("hostile")) return;
      other.setDeathTimer(0.4);
      const gem = api.entities.spawn("gem", other.wx, other.wy);
      if (gem) gem.addTag("collectible");
    });
  },
};
```

### Mod 4: `befriendable` (replaces `handleInteract` toggle)

**Current code:** `GameServer.ts` line 596-606 — range check, toggle following.

**Tags:** Chickens, cows, etc. get `"befriendable"` tag.

```typescript
// src/mods/befriendable.ts
export const befriendableMod: Mod = {
  name: "befriendable",
  register(api) {
    return api.events.on("player-interact", (data) => {
      const { player, wx, wy } = data as { player: PlayerHandle; wx: number; wy: number };
      const nearby = api.entities.findInRadius(wx, wy, 24);

      for (const entity of nearby) {
        if (!entity.hasTag("befriendable")) continue;
        entity.setFollowing(!entity.isFollowing);
        if (entity.isFollowing) {
          entity.addTag("buddy");
        } else {
          entity.removeTag("buddy");
        }
        break; // only one per interaction
      }
    });
  },
};
```

### Mod 5: `gem-spawner` (replaces `GemSpawner` class)

**Current code:** `GemSpawner.ts` — timer-based spawning, off-screen placement,
chunk tracking, despawn far.

**Tags:** Spawned gems get `"gem"` + `"collectible"` tags.

```typescript
// src/mods/gem-spawner.ts
export const gemSpawnerMod: Mod = {
  name: "gem-spawner",
  register(api) {
    const MAX_GEMS = 8;
    const SPAWN_INTERVAL = 2.0;
    const DESPAWN_DISTANCE_SQ = (6 * 16 * 16) ** 2; // 6 chunks in px
    let timer = 0;

    return api.tick.onPreSimulation((dt) => {
      timer -= dt;
      if (timer > 0) return;
      timer = SPAWN_INTERVAL;

      const gems = api.tags.getTagged("gem");

      // Despawn far gems
      const player = api.player.get();
      if (player) {
        for (const gem of gems) {
          const dx = gem.wx - player.wx;
          const dy = gem.wy - player.wy;
          if (dx * dx + dy * dy > DESPAWN_DISTANCE_SQ) {
            gem.remove();
          }
        }
      }

      // Spawn if under cap
      if (gems.filter((g) => g.alive).length >= MAX_GEMS) return;
      if (!player) return;

      // Pick random walkable position 2-4 chunks away
      const pos = api.world.findWalkableNear(
        player.wx + (Math.random() - 0.5) * 4 * 16 * 16,
        player.wy + (Math.random() - 0.5) * 4 * 16 * 16,
        64,
      );
      if (!pos) return;

      const gem = api.entities.spawn("gem", pos.wx, pos.wy);
      if (gem) {
        gem.addTag("gem");
        gem.addTag("collectible");
      }
    });
  },
};
```

### Mod 6: `baddie-spawner` (replaces `BaddieSpawner` class)

Same pattern as gem-spawner with different constants:
- `MAX_BADDIES = 4`, `SPAWN_INTERVAL = 5.0`
- Spawns `ghost-angry` with `"hostile"` tag
- Despawn at 7 chunks

### Mod 7: `gem-physics` (replaces scattered gem velocity decay)

**Current code:** `GameplaySimulation.ts` lines 157-170 — gems with velocity
decelerate, stop at <1 px/s.

```typescript
// src/mods/gem-physics.ts
export const gemPhysicsMod: Mod = {
  name: "gem-physics",
  register(api) {
    return api.tick.onPostSimulation((dt) => {
      for (const gem of api.tags.getTagged("gem")) {
        if (!gem.getAttribute("decaying")) continue;
        const decay = Math.exp(-4 * dt); // ~4x/s
        const vx = gem.vx * decay;
        const vy = gem.vy * decay;
        if (Math.abs(vx) < 1 && Math.abs(vy) < 1) {
          gem.setVelocity(0, 0);
          gem.setAttribute("decaying", null);
        } else {
          gem.setVelocity(vx, vy);
        }
      }
    });
  },
};
```

---

## Entity Tagging at Spawn

Entity factories set initial tags. Tags are ephemeral — not persisted in
IndexedDB, reapplied on load via factory type.

| Entity Type      | Tags                                  |
| ---------------- | ------------------------------------- |
| `gem`            | `gem`, `collectible`                  |
| `chicken`        | `befriendable`, `npc`                 |
| `cow`            | `befriendable`, `npc`                 |
| `pigeon`         | `befriendable`, `npc`                 |
| `fish1/2/3`      | `befriendable`, `npc`                 |
| `ghost-angry`    | `hostile`                             |
| `ghost-friendly` | `befriendable`, `npc`                 |
| `campfire`       | `campfire`                            |
| `person1-20`     | `befriendable`, `npc`                 |
| `crow`, `seagull` | `befriendable`, `npc`                |
| `worm1-4`        | `npc`                                 |

---

## Entity Attributes Used by Built-in Mods

| Attribute     | Type      | Set By          | Read By          |
| ------------- | --------- | --------------- | ---------------- |
| `gemValue`    | `number`  | gem-spawner     | collectible      |
| `decaying`    | `boolean` | hostile (scatter)| gem-physics     |

---

## Implementation Phases

### Phase 1: WorldAPI + EntityHandle

New files:
- `src/server/WorldAPI.ts` — WorldAPI class, TerrainAPI, EntityAPI, PropAPI, WorldQueryAPI
- `src/server/EntityHandle.ts` — EntityHandle, PlayerHandle

Changes:
- `src/server/GameServer.ts` — construct WorldAPI, refactor `handleMessage()` to delegate
- `src/entities/Entity.ts` — add `tags: Set<string>` and `attributes: Map<string, unknown>`

Validation: all existing tests pass, editor still works. No behavioral change.

### Phase 2: TagService + EventBus + TickService

New files:
- `src/scripting/TagService.ts`
- `src/scripting/EventBus.ts`
- `src/scripting/TickService.ts`

Changes:
- `src/server/GameServer.ts` — wire services into `tick()`, emit `player-interact` event
- `src/server/WorldAPI.ts` — expose services on api object

### Phase 3: OverlapService

New files:
- `src/scripting/OverlapService.ts`

AABB overlap detection runs post-physics each tick. Maintains previous-frame
overlap set to detect enter/exit. Watches entities by tag for efficiency.

Changes:
- `src/server/GameServer.ts` — call overlap detection after physics

### Phase 4: Built-in Mods (Dogfood)

New files:
- `src/mods/collectible.ts`
- `src/mods/hostile.ts`
- `src/mods/campfire-trap.ts`
- `src/mods/befriendable.ts`
- `src/mods/gem-spawner.ts`
- `src/mods/baddie-spawner.ts`
- `src/mods/gem-physics.ts`

Changes:
- `src/server/GameServer.ts` — register built-in mods at startup
- Delete `src/entities/GemSpawner.ts`
- Delete `src/entities/BaddieSpawner.ts`
- Delete `src/server/GameplaySimulation.ts`
- Remove `handleInteract` befriend logic from GameServer

Each mod migration is independent and testable.

### Phase 5: Mod Entity Tags at Spawn

Changes:
- `src/entities/EntityFactories.ts` — set initial tags on created entities
- `src/server/GameServer.ts` — on entity load from save, reapply tags by type

### Future

- Client-side scripts (custom UI, effects, prediction)
- Zone triggers (rectangular regions with enter/exit events)
- Entity attachment (riding, sitting)
- Script persistence in world save
- In-game script editor UI
- Lua/WASM sandbox for untrusted scripts
- Rate limiting / per-mod resource budgets

---

## Key Constraints

- **No persistence format changes.** Tags and attributes are ephemeral.
  `SaveManager` continues to persist `subgrid`, `roadGrid`, `heightGrid` per
  chunk, and entity `type + position` in metadata. Tags are reapplied on load.
- **Tick budget.** Mod `onPreSimulation`/`onPostSimulation` callbacks share the
  frame budget. Future: add per-mod timing and warnings.
- **Event ordering.** Deferred model (inspired by Roblox): events emitted during
  a handler are queued and fire after the current batch completes. Re-entrancy
  cap at 10.
- **No undo.** Mods that mutate terrain do so permanently (same as editor).

---

## Design Decisions

### Tags replace per-entity `scriptId`

The original plan (`parallel-hatching-wozniak.md`) attached a `scriptId` to each
entity, mapping it to a single `GameScript` with `onTick`/`onInteract` hooks.
This design replaces that with tags + global mods:

- **Old model**: entity has `scriptId: "magic_chicken"` → ScriptHost looks up
  that script → calls `onTick(self)`. One script per entity, one-to-one.
- **New model**: entity has tags `["befriendable", "npc"]` → any mod watching
  those tags reacts. Many mods can care about the same entity. Many-to-many.

Tags are strictly better here: a chicken can be `befriendable` AND `collectible`
AND `flammable` without the chicken needing to know about any of those systems.
Mods compose orthogonally.

### No framework-managed tick throttling

Mods that want to run at lower frequency accumulate `dt` themselves (see
`gem-spawner` with its `SPAWN_INTERVAL` timer). The framework always calls tick
hooks every frame and passes `dt`. Three lines of accumulator code in the mod is
simpler than a framework-managed `tickRate` property with its own questions
(accumulated dt vs real dt? per-mod or per-entity?).

### Two-phase tick (simplified from Roblox)

Roblox's frame pipeline has ~10 phases (PreRender → PreSimulation → Physics →
PostSimulation → Heartbeat → Render). We collapse to two mod-visible phases
(pre/post simulation) because our physics is simple tile-based collision — no
meaningful distinction between Heartbeat and PostSimulation in our model.

### EventBus uses `unknown` data intentionally

EventBus event data is typed as `unknown`, requiring mods to cast (e.g.,
`data as { player: PlayerHandle; wx: number; wy: number }`). This is pragmatic
for dogfooding — Roblox does the same with BindableEvent payloads. A type-safe
event map (discriminated union or generic `EventBus.on<T>`) is a future polish,
not a blocker. The casting is confined to event handler entry points and easy to
grep for if we add types later.

### No sandboxing (yet)

All mods are trusted TypeScript. WorldAPI becomes the sandbox boundary when/if
untrusted scripts are added via Lua/WASM later. The API surface is designed to
be the complete set of operations a sandboxed script would need — no escape
hatches to internals.

---

## Open Questions

- **~~Error isolation.~~** **Resolved:** Follow Roblox's lead — catch and log per
  callback invocation, continue ticking. A failing mod does not prevent other
  mods or the tick loop from running. No auto-disable; just log. Surface errors
  in the debug panel when one exists.

- **~~Mod teardown / hot-reload.~~** **Resolved:** `register()` returns
  `Unsubscribe`. Mods collect their subscription handles internally and return a
  single combined teardown function. See updated Mod interface above.

- **Attribute persistence.** Tags and attributes are ephemeral today (reapplied
  on load via factory type). If mods want to persist custom state per entity
  (e.g., a chicken's friendship level, a gem's custom value), do we add attribute
  persistence to the save format? Or keep it ephemeral and let mods re-derive
  state on load?

- **Mod ordering / dependencies.** Currently "first registered = first notified."
  If mod A depends on mod B having run first (e.g., hostile mod needs collectible
  mod to have registered the `"collectible"` tag concept), is implicit ordering
  enough or do we need explicit `dependencies: ["collectible"]`?

- **Client-side mod hooks.** The current design is server-only. What about mods
  that want to add custom UI, particle effects, or sounds? Needs a separate
  `ClientMod` interface or a way to send mod-specific messages to the client.

---

## Appendix A: Security Model & Tiered Sandboxing

The sandboxing strategy depends on the deployment context. The WorldAPI is
designed so that **mod code is identical across all tiers** — only the execution
environment and how the `api` object is provided changes.

### Tier 1: Self-Hosted (own mods, full trust)

Mods are plain TypeScript modules imported at build time. No sandbox. The `api`
object is a direct reference to the real `WorldAPIImpl`. Mods run in the same
V8 context as the server and can access anything (but shouldn't — the API
surface is the contract).

```typescript
// mods/my-mod.ts — direct import, no isolation
import type { Mod } from "../src/scripting/Mod";
export const myMod: Mod = {
  name: "my-mod",
  register(api) { /* full trust, direct WorldAPI reference */ },
};
```

**Use case:** Development, self-hosted servers, parent authoring mods for kid.

### Tier 2: Containerized (other people's mods, container isolation)

Same as Tier 1 at the process level — mods are direct imports with full
in-process access. The security boundary is the **container** (Docker, Fly.io,
etc.). Mod crashes the server? Container restarts. Mod reads the filesystem?
Container has nothing valuable. This is the standard model for game servers with
mod support (Minecraft, Factorio, etc.).

**Use case:** Community-hosted servers where the server operator chooses which
mods to install. Operator trusts their own mod selection; container limits blast
radius.

### Tier 3: Shared Hosting (untrusted mods, in-process sandbox)

For hosted servers where users install arbitrary mods, the server process itself
must restrict what mod code can do. Options:

#### Option A: Node.js Permission Model

Node 20+ `--experimental-permission` restricts filesystem and child_process
access at the process level:

```
node --experimental-permission \
     --allow-fs-read=/app/data \
     --allow-fs-write=/app/data \
     server.js
```

Coarse-grained (whole-process, not per-mod) but free. Prevents mods from
reading secrets or writing outside the data directory. No network restriction
currently (Node permissions don't cover outbound network yet).

#### Option B: V8 Isolates (`isolated-vm`)

Each mod runs in a separate V8 isolate with its own heap. The host injects only
the WorldAPI proxy — no `fs`, `net`, `process`, `require`, or any Node globals
are available. Memory and CPU time are capped per isolate.

```typescript
import ivm from "isolated-vm";

const isolate = new ivm.Isolate({ memoryLimit: 128 }); // 128 MB per mod
const context = await isolate.createContext();

// Inject WorldAPI proxy — only thing the mod can access
await context.global.set("api", new ivm.Reference(worldAPIProxy));

// Run mod code with CPU time limit (16ms = one frame budget)
const script = await isolate.compileScript(modSource);
await script.run(context, { timeout: 16 });
```

**Guarantees:**
- No filesystem access (no `fs` module available)
- No network access (no `net`, `http`, `fetch` available)
- No process access (no `process`, `child_process` available)
- Memory capped per mod (isolate crashes if exceeded, server continues)
- CPU time capped per tick (timeout kills runaway scripts)
- No shared state (all WorldAPI calls cross the isolate boundary via
  `ivm.Reference`, similar to the existing JSON serialization firewall)

**Tradeoffs:**
- Serialization overhead on every WorldAPI call (like `SerializingTransport`)
- Mod code must be plain JavaScript (no TypeScript, no imports)
- Adds `isolated-vm` native dependency

#### Option C: WASM Sandbox (Lua)

Run mod code in a WASM-compiled Lua runtime (e.g., Wasmoon). WASM provides
hardware-level memory isolation — mod code physically cannot access anything
outside its linear memory. WorldAPI bindings are injected as Lua functions.

```lua
-- Mod written in Lua, runs in WASM sandbox
function register(api)
  api.overlap.onOverlap("collectible", function(self, other)
    local player = api.player.fromEntity(other)
    if not player then return end
    player:giveGems(1)
    self:remove()
  end)
end
```

**Guarantees:** Strongest isolation (WASM memory model). No escape possible.
**Tradeoffs:** Mods must be written in Lua. ~200-400KB WASM binary. JS↔Lua
bridge glue for every API call.

### Mod Storage API

Regardless of tier, mods should not have direct access to IndexedDB or the
filesystem for persistent state. Instead, a scoped `ModStorage` interface:

```typescript
interface ModStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}
```

- Scoped per mod (mod "gem-spawner" can't read mod "hostile"'s storage)
- Size-limited (e.g., 1 MB per mod)
- Backed by IndexedDB, SQLite, or a key-value API — mod doesn't know or care
- Available at all tiers (Tier 1 uses direct IndexedDB, Tier 3 uses a proxy
  that crosses the isolate boundary)

### Recommended Approach

Start with **Tier 1** (direct imports, no sandbox). Design the WorldAPI as if
it were the sandbox boundary — no escape hatches, no access to internals beyond
what the API exposes. This discipline means:

1. Dogfooding and development is frictionless (just TypeScript modules)
2. The API surface is proven correct before adding isolation overhead
3. Upgrading to Tier 2 is free (just containerize)
4. Upgrading to Tier 3 requires wrapping WorldAPI in an `isolated-vm` proxy —
   the mod code itself doesn't change, only the hosting infrastructure

The architectural shape is identical to the existing `LocalTransport` vs
`SerializingTransport` pattern: same API, different trust boundary.

```
Tier 1:  mod ──direct ref──→ WorldAPIImpl
Tier 3:  mod ──ivm.Reference──→ WorldAPIProxy ──→ WorldAPIImpl
         ↑                       ↑
    (same pattern as)       (same pattern as)
Client ──LocalTransport──→ GameServer
Client ──SerializingTransport──→ GameServer
```

---

## References

- **Roblox Creator Docs** (local checkout): `~/code/reference/roblox/creator-docs/`
  — Official Roblox creator documentation. Primary inspiration for this design.
  Key areas:
  - `content/en-us/scripting/` — scripting architecture, events, modules
  - `content/en-us/reference/engine/` — engine API reference (services, events, properties)
  - `content/en-us/resources/beyond-the-dark/` — NPC Kit patterns (tag-based AI, config-driven behavior, Maid cleanup)
  - `content/en-us/cloud-services/` — DataStore, MemoryStore (informed ModStorage design)
  - `content/en-us/projects/` — client-server model, replication, security
  - `tools/schemas/engine/` — JSON schemas for engine API (Instance, events, properties)

- **Original implementation plan**: `~/.claude/plans/parallel-hatching-wozniak.md`
  — Earlier WorldAPI + ScriptHost design with per-entity `scriptId`. Superseded
  by the tags + global mods approach in this document, but useful for context on
  how the design evolved.
