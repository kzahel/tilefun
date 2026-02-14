# Engine Architecture Checklist

Things experienced game developers always build early because they're painful to retrofit later. Ordered by priority for this project (creative-mode editor-first 2D tile game for a 6-year-old).

## Already in place

- [x] **ECS-lite** — entity/component pattern with plain objects
- [x] **Event bus** — decoupled communication between systems
- [x] **Persistence** — IndexedDB auto-save (chunks + player + entities)
- [x] **Scripting/mod API** — Roblox-inspired WorldAPI facade + services (in progress)
- [x] **Input action mapping** — ActionManager maps raw keys/gamepad/touch to named actions
- [x] **Save format versioning** — migration chain system with `PersistenceStore` abstraction (IDB now, SQLite later)

---

## High priority — hard to retrofit

### ~~1. Input action mapping layer~~ ✓

*Done — `ActionManager` maps raw keys/gamepad/touch to named actions. See `src/input/ActionManager.ts`.*

### 2. Command pattern (undo/redo)

Every edit operation becomes a `Command` object with `execute()` and `undo()`. Nothing directly mutates world state in the editor — everything goes through a command.

**Why it's hard to retrofit:** The longer the editor grows without this, the more edit operations need to be wrapped retroactively.

**What it unlocks:**
- Undo/redo in the editor (essential for a creative tool)
- Edit history / timeline
- Foundation for collaborative editing (commands can be serialized and sent over the network)

**Multiplayer complexity note:** Undo gets tricky with multiple editors. Simplest approach is chunk-level snapshots (save the full chunk state before each edit, restore on undo). More fine-grained approaches (operational transform, CRDTs) are much more complex. Chunk snapshots are probably fine for LAN co-op scope.

**Minimum viable stub:** A `CommandHistory` class with `execute(cmd)`, `undo()`, `redo()`. Wrap the terrain brush as the first command.

### 3. Scene / game state machine

A formal state machine for game states: `Menu → Playing → Editing → Paused → Dialogue → Inventory`.

**Why it's hard to retrofit:** Ad-hoc boolean flags (`isPaused && !isEditing && !isInMenu`) multiply quickly and create impossible-to-debug state combinations.

**What it unlocks:**
- Title screen, pause menu, settings screen, inventory
- World management UI (create/switch/delete worlds — already on the roadmap)
- Clean input routing (pause menu captures input, game doesn't)
- Modal dialogs that block game input

**Minimum viable stub:** A stack-based state manager: `pushState(PauseMenu)`, `popState()`. Each state owns its own `update()`, `render()`, `handleInput()`.

### 4. Asset manager / resource registry

A central place that loads, caches, and references assets by key. `assets.get("player_walk")` instead of scattered `new Image()` calls.

**Why it's hard to retrofit:** Asset loading is scattered across many files. Centralizing later means finding and rewriting every load site.

**What it unlocks:**
- Loading screen with progress bar
- Hot-reload during development (change a sprite, see it update without refresh)
- Asset pack swapping for mods
- Prevents duplicate loads of the same spritesheet
- Prerequisite for asset encryption/obfuscation (already on the roadmap)

**Minimum viable stub:** An `AssetManager` with `load(key, path)`, `get(key)`, and a `Promise.all` loading phase at startup.

### ~~5. Save format versioning~~ ✓

*Done — `CURRENT_SAVE_VERSION` + chainable `SaveMigration` system in `src/persistence/migrations.ts`. Generic `PersistenceStore` interface (`src/persistence/PersistenceStore.ts`) with `IdbPersistenceStore` for browser; SaveManager delegates to it. Bump version + add migration entry = done.*

---

## Medium priority — worth stubbing early

### 6. Audio system

A `SoundManager` with `play("gem_collect")`, `playMusic("overworld")`, `setVolume(0.5)`.

**Why to do it early:** Audio touches everything — entities, UI, player actions, ambient sounds. Threading it through after the fact means touching every system.

**What it unlocks:**
- Sound effects (gem collect, footsteps, entity sounds, UI clicks)
- Background music with crossfade
- Ambient soundscapes (wind, water, birds)
- Volume/mute settings

**Tech:** Web Audio API is fine for this scale. Howler.js is a nice wrapper if you want a library.

### 7. Fixed timestep + time manager

A central `Time` object: `{ dt, elapsed, timeScale, paused }`.

**Why to do it early:** Without this, game speed varies with frame rate, and adding pause/slow-mo later means auditing every `dt` usage.

**What it unlocks:**
- Pause for free (`timeScale = 0`)
- Slow-mo for free (`timeScale = 0.5`)
- Frame-rate independent physics/movement
- Consistent behavior across fast/slow machines
- Day/night cycle (if ever wanted)

### 8. Render layer / draw order system

Explicit named layers (`terrain`, `roads`, `props`, `entities_below`, `player`, `entities_above`, `particles`, `ui_world`, `ui_screen`) with z-sorting within layers.

**Why to do it early:** Hardcoded draw order breaks the moment you want an entity behind a tree, a particle effect above UI, or a prop that the player walks behind.

**What it unlocks:**
- Correct depth sorting (entities behind tall props)
- Weather/particle effects on the right layer
- UI elements that don't get occluded by game objects
- Props system needs this (props span multiple tiles with depth)

### 9. Object pooling

Reuse entity/particle/projectile objects instead of creating and destroying them.

**Why to do it early:** When 50+ chickens each drop gems, creating/destroying hundreds of objects per frame causes GC stutters. Easier to design factories around pools from the start.

**What it unlocks:**
- Smooth performance with many entities (directly relevant — our user spawns 50+ chickens)
- Particle effects without GC pauses
- Mass-spawn without frame drops

**Minimum viable stub:** A generic `Pool<T>` with `acquire()` and `release()`. Wire into entity factories.

---

## Nice to have — add when the mood strikes

### 10. Tweening / easing library

Programmatic animations: `tween(entity, { y: entity.y - 10 }, 300, "bounceOut")`.

**What it unlocks:**
- Screen shake, bounce, fade, scale pop — "game juice"
- UI transitions (menu slide in/out)
- Entity animations (gem float up, damage flash)
- Everything feels better with a little easing

**Effort:** Tiny. A 50-line tween system covers 90% of use cases.

### 11. Debug console / inspector

An in-game command line: `/spawn chicken 50`, `/tp 100 200`, `/god`, `/time 0.1`.

**What it unlocks:**
- Rapid testing without going through menus
- Power-user commands for the parent
- Can double as a chat input for multiplayer
- Developers who build this once never skip it again

### 12. Replay system

Record input actions (requires #1 input action mapping) and play them back.

**What it unlocks:**
- Demo recordings / attract mode
- Bug reproduction (send a replay file)
- "Watch what I built" sharing

**Prerequisite:** Input action mapping (#1) — you record actions, not raw events.

### 13. Localization (i18n)

Wrap all user-visible strings in `t("key")`.

**What it unlocks:**
- Other languages (if ever wanted)
- Easy text changes without hunting through code

**When to do it:** Only if you anticipate wanting other languages. Wrapping strings early is trivial; finding every string literal later is not.

### 14. Configuration / settings system

A `Settings` object persisted to localStorage with UI to change values.

**What it unlocks:**
- Volume, controls, graphics options
- Accessibility settings (text size, contrast)
- Developer toggles (show hitboxes, show chunk borders)

---

## Summary: suggested implementation order

| Phase | Item | Effort |
|-------|------|--------|
| ~~Now~~ | ~~Save format versioning (#5)~~ | ✓ Done |
| ~~Now~~ | ~~Input action mapping (#1)~~ | ✓ Done |
| Soon | Scene state machine (#3) | Medium |
| Soon | Asset manager (#4) | Medium |
| Soon | Time manager (#7) | Small |
| When editor grows | Command pattern (#2) | Medium |
| When adding entities/props | Render layers (#8) | Medium |
| When performance matters | Object pooling (#9) | Small |
| When it feels right | Audio (#6) | Medium |
| For juice | Tweening (#10) | Small |
| For power users | Debug console (#11) | Small |
| Someday | Replay (#12), i18n (#13), Settings (#14) | Varies |
