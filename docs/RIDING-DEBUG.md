# Riding System: Debugging Guide

## Plan that was implemented
`~/.claude/plans/quirky-soaring-finch.md`

## Design Overview

Player jumps onto a "rideable" entity (cow) to mount. While mounted:
- Player input is **redirected to the mount entity** (cow moves, not player)
- Player position is **derived from mount** via `parentId` + `localOffsetX/Y`
- Mount AI is suppressed (state = `"ridden"`)
- Jump while riding = dismount

### Position Model
- `position.wx/wy` is always world-space
- Parented entities (rider) have `parentId`, `localOffsetX`, `localOffsetY`
- Each tick, `resolveParentedPositions()` sets `child.position = parent.position + offset`
- This runs in EntityManager Phase 4, AFTER movement

### Serialization Path
Every new field crosses the JSON serialization boundary each frame:
- Entity.ts → protocol.ts (EntitySnapshot) → serialization.ts (serialize/deserialize)
- `parentId`, `localOffsetX`, `localOffsetY` on Entity/EntitySnapshot
- `rideSpeed`, `"ridden"` state on WanderAI
- `mountEntityId` on GameStateMessage

---

## Server Tick Flow (Realm.ts + EntityManager.ts)

### Order of operations per tick:
```
1. Phase 1: Process player inputs (Realm.ts:232-364)
   ├─ For each session:
   │   ├─ Mount bookkeeping (auto-dismount if mount removed)
   │   ├─ Resolve mount entity: entities.find(e => e.id === mountId)
   │   ├─ Extra inputs loop (all but last):
   │   │   ├─ applyMountInput(mount, input)  → sets mount.velocity
   │   │   └─ resolveCollision(mount, dx, dy) → MOVES mount
   │   └─ Last input:
   │       ├─ applyMountInput(mount, lastInput)  → sets mount.velocity
   │       └─ zeros player.velocity (position derived from parent)
   │       └─ does NOT move the mount (left to EntityManager Phase 2)
   └─ No-input case: zeros both player and mount velocity

2. computeEntityTickDtsMulti (Realm.ts:374)
   └─ Assigns dt to entities based on distance tier

3. tickAllAI (Realm.ts:378)
   └─ Skips entities with wanderAI.state === "ridden"

4. EntityManager.update (Realm.ts:393):
   ├─ Phase 1: Player movement (velocity=0 when riding, no movement)
   ├─ Phase 2: NPC movement
   │   ├─ Skips parented entities (player has parentId, skipped)
   │   ├─ Cow has velocity from applyMountInput → MOVES by velocity*dt
   │   └─ Uses makeExtraBlocker(entity) for collision
   ├─ Phase 3: separateOverlappingEntities (cow is unparented, processed)
   ├─ Phase 4: resolveParentedPositions
   │   └─ player.position = cow.position + (0, -8)
   └─ Phase 5: Tick animations

5. Jump physics + tryMountOnLanding (Realm.ts:407-423)
6. buildGameState → serialize + broadcast
```

### Key: Where the cow should actually move
For the **last input** each tick, the cow's velocity is set by `applyMountInput` (Realm.ts:330) but the cow is NOT moved in Realm.ts. The cow moves in **EntityManager Phase 2** (EntityManager.ts:194-221), which applies `entity.velocity * dt` with collision resolution.

For **extra inputs** (jitter), the cow is moved by `resolveCollision` directly in Realm.ts (line 309).

---

## Client Prediction Flow (PlayerPredictor.ts + ClientStateView.ts + PlayScene.ts)

### Per frame:
```
1. PlayScene.update():
   ├─ Send player-input to server
   ├─ If new server state arrived this tick:
   │   └─ predictor.reconcile(serverPlayer, lastProcessedSeq, ..., mountEntityId)
   │       ├─ Find serverMount in entities by mountEntityId
   │       ├─ Snap predictedMount to serverMount position
   │       ├─ Snap predicted player to serverPlayer position
   │       ├─ Trim acknowledged inputs from buffer
   │       └─ Replay unacknowledged inputs via applyInput()
   ├─ predictor.storeInput(seq, movement, dt)
   └─ predictor.update(dt, movement, world, props, entities)
       └─ applyInput(movement, dt, ...)
           ├─ applyMountInput(predictedMount, movement)  → sets velocity
           ├─ Move predictedMount by velocity*dt with collision
           └─ predicted.position = predictedMount.position + offset

2. ClientStateView.entities getter:
   └─ Replaces server mount with predictedMount in entity list
   └─ Replaces server player with predicted player
```

### Predictor mirrors server logic
`applyMountInput` is identical in Realm.ts and PlayerPredictor.ts. Collision resolution is similar but uses simplified client-side checks.

---

## Fixed Bugs

### 1. Cow sprite disappearing (only shadow visible)
**Root cause:** `applyMountInput` set `sprite.frameRow = Direction` for all 4 directions (Down=0, Up=1, Left=2, Right=3). Cow spritesheet is 96x64px = 2 rows only. Rows 2-3 are out of bounds → `drawImage` draws nothing from empty source → cow invisible. Shadow drawn before sprite, so shadow persists.

**Fix:** Check `wanderAI.directional === false` — use `flipX` instead of `frameRow` for non-directional sprites. Matches how wanderAI.ts handles them.

### 2. Mount rendering without interpolation
**Root cause:** Predicted mount entity replaced server mount in entities list but never got `prevPosition` set. Renderer's `lerpPos()` fell back to raw position.

**Fix:** Set `prevPosition` on predicted mount from predictor's `mountPrevPosition` in entities getter.

---

## Remaining Bug: Position Snapping

### Symptoms
- While mounted, player snaps toward where it first mounted (cow's original position)
- On dismount, both player and cow teleport to near the original mount position
- Client prediction shows correct movement, but reconciliation snaps back

### Interpretation
This strongly suggests the **server cow is not actually moving** (or barely moving). The client predicts movement, but each reconciliation reveals the server cow is still at/near its mount-time position. On dismount, the true (server) positions are revealed.

### Investigation: Where to look

#### Theory 1: EntityManager Phase 2 is skipping the cow
In `EntityManager.update()` Phase 2 (EntityManager.ts:194-221):
```typescript
for (const entity of this.entities) {
  if (playerSet.has(entity) || !entity.velocity) continue;
  if (entity.parentId !== undefined) continue;
  if (entityTickDts && !entityTickDts.has(entity)) continue;  // ← COW SKIPPED?
  ...
}
```
**Check:** Is the cow in `entityTickDts`? It should be (near player = near tier), but verify by logging `entityTickDts.has(cow)` and `entityTickDts.get(cow)` inside Phase 2.

#### Theory 2: Collision is blocking the cow
In Phase 2, `resolveCollision(entity, dx, dy, getCollision, blockMask, makeExtraBlocker(entity))` might be blocking ALL movement. `makeExtraBlocker` (EntityManager.ts:87-119) queries the spatial hash for nearby entities and checks AABB overlap.

**Check:** Log the cow's `dx, dy` values AND whether `resolveCollision` returns `blocked=true`. If blocked, log which entity/terrain is blocking.

The `makeExtraBlocker` excludes the entity itself (`excludeIds = new Set([self.id])`), so self-collision isn't the issue. But other nearby entities (chickens, etc.) could block.

#### Theory 3: applyMountInput velocity is wrong or zero
Maybe `currentMount` in the last input path (Realm.ts:321-325) is null (entity not found), so the mount code is skipped and the cow never gets velocity.

**Check:** Log `currentMount` and `mount` at the beginning of input processing. Confirm they're the correct cow entity with non-null velocity.

#### Theory 4: The cow's velocity is being zeroed between applyMountInput and Phase 2
Something between Realm.ts line 330 (applyMountInput) and EntityManager.ts line 200 (Phase 2 velocity read) might zero the cow's velocity.

Candidates:
- `tickAllAI` (Realm.ts:378): Skips ridden entities, but check. If the cow's AI state somehow reverts from "ridden", tickAllAI might set velocity to 0 (frozen entity path when not in entityTickDts)
- `worldAPI.tick.firePre(dt)` (Realm.ts:381): Mod callbacks. Check if any mod modifies entity velocities
- No-input branch for another session: If multiple sessions exist, another session's "no input" branch won't affect this cow (only that session's mount)

#### Theory 5: separateOverlappingEntities pushing the cow back
Phase 3 runs `separateOverlappingEntities` on all unparented entities (EntityManager.ts:228-230). The cow IS unparented and has collider + wanderAI, so it's eligible. If the cow overlaps with following chickens/cows, it gets pushed. This push is usually tiny but happens every tick.

**Check:** Temporarily skip ridden entities in separation:
```typescript
const unparentedEntities = this.entities.filter(
  (e) => e.parentId === undefined && e.wanderAI?.state !== "ridden"
);
```

#### Theory 6: Player push mechanics in Phase 1
EntityManager Phase 1 pushes entities in the player's path. When riding, `player.velocity = (0, 0)` so the push probe is `if ((vx !== 0 || vy !== 0) && !jumping)` → skipped. This should be fine but verify.

### Recommended Debugging Approach

Add temporary logging in **Realm.ts tick** (inside the input processing for the mounted case):
```typescript
if (currentMount) {
  this.applyMountInput(currentMount, lastInput);
  console.log(`[mount] after applyMountInput: vel=(${currentMount.velocity?.vx}, ${currentMount.velocity?.vy}), pos=(${currentMount.position.wx.toFixed(1)}, ${currentMount.position.wy.toFixed(1)})`);
}
```

And in **EntityManager.ts Phase 2** (inside the NPC loop):
```typescript
if (entity.wanderAI?.state === "ridden") {
  console.log(`[mount] Phase2: vel=(${entity.velocity.vx}, ${entity.velocity.vy}), dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}, pos=(${entity.position.wx.toFixed(1)}, ${entity.position.wy.toFixed(1)})`);
}
```

And after Phase 2:
```typescript
if (entity.wanderAI?.state === "ridden") {
  console.log(`[mount] Phase2 after: pos=(${entity.position.wx.toFixed(1)}, ${entity.position.wy.toFixed(1)}), blocked=${blocked}`);
}
```

This will immediately reveal:
1. Whether the cow has velocity after applyMountInput
2. Whether Phase 2 processes the cow
3. Whether collision is blocking the cow
4. Whether the cow's position actually changes

---

## Key Files

| File | Role |
|------|------|
| `src/server/Realm.ts` | Mount/dismount, input redirection, applyMountInput, buildGameState |
| `src/entities/EntityManager.ts` | Phase 2 NPC movement, Phase 3 separation, Phase 4 parent resolution |
| `src/client/PlayerPredictor.ts` | Client mount prediction, input replay |
| `src/client/ClientStateView.ts` | Replace server entities with predicted versions |
| `src/entities/Entity.ts` | parentId, localOffset, rideSpeed, "ridden" state |
| `src/shared/protocol.ts` | EntitySnapshot, GameStateMessage.mountEntityId |
| `src/shared/serialization.ts` | Serialize/deserialize all mount fields |
| `src/entities/Cow.ts` | rideable tag, rideSpeed: 30 |
| `src/server/tickAllAI.ts` | Skip ridden entities |
| `src/entities/wanderAI.ts` | onWanderBlocked (reverses dir on collision) |
| `src/entities/collision.ts` | resolveCollision, separateOverlappingEntities |

## Quick Reference: Mount Trigger Flow

```
Player walks next to cow → presses jump →
  PlayScene sends player-input with jump=true →
  Server: updatePlayerFromInput sets jumpZ/jumpVZ →
  Server: jump physics (Realm.ts:407-423) →
    jumpVZ -= gravity, jumpZ += jumpVZ*dt →
    if jumpZ <= 0 (landed): tryMountOnLanding() →
      Check overlap with rideable entities →
      Set parentId, localOffset, mountId, AI="ridden" →
  Server: next tick, applyMountInput redirects input to cow →
  Server: buildGameState includes mountEntityId →
  Client: predictor.reconcile detects mount, starts predicting mount
```
