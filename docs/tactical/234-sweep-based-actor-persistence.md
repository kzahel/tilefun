# 234 — Sweep-based actor persistence (remove save-tracking Proxies)

Status: implemented · 2026-11-09, owner-approved. Owner: [performance](../topics/performance.md).

## Problem

`observeActor` (`src/persistence/ActorRecords.ts`) wraps the durable fields of
every saved actor in deep Proxies:
- position and `parentId`;
- every `DURABLE_ENTITY_FIELDS` entry;
- prop position and `spawnTimer`.

Each write calls `RealmRecords.changed()`, which re-indexes the actor's chunk
membership and marks its record dirty. Each read goes through a `get` trap and a
WeakMap lookup, and V8 cannot optimize code over Proxied objects.

The stress bench ([performance](../topics/performance.md#actor-stress-rabbits-and-parked-cars-2026-11-09))
shows the authority tick is the first limit: 500 rabbits on an M4 Pro, ~100 on
a Pixel 7a. In a headless A/B with 500 rabbits and 63 cars, skipping
`observeActor` cut the tick p50 from 14.5 to 7.5 ms. Every stage got cheaper:

| Stage | With Proxies | Without |
| --- | --- | --- |
| AI | 2.3 ms | 0.85 ms |
| Physics | 6 ms | 3.5 ms |
| Replication | 2 ms | 1 ms |

## Owner direction

Saved positions and other continuously changing state do not need to be exact.
After a crash, worlds may be 10–20 s behind. Performance matters more; remove
the Proxies.

## Design

1. **Plain objects.** Delete `observeActor`; actors keep ordinary data
   properties.
2. **Explicit dirty marks stay prompt.** These already call `changed()` and are
   unchanged:
   - spawn (`onSpawn`) and despawn/destroy (`onDespawn`);
   - prop add/change/delete (`props.onAdd`/`onChange`);
   - scripting edits (`EntityManager.onMutation` via `EntityHandle`; the
     review found most setters relied on the Proxy, and they now mark
     explicitly);
   - riding (`RealmRiding`) and horn reactions (`VehicleControl`).

   `RealmSimulation` also marked every simulated actor on every tick. The
   review found that this blanket mark kept awake actors re-encoded on every
   2 s save, as in the Proxy era, so it was removed (see Review).
3. **Incremental sweep for continuous state.** `RealmRecords.tick()` runs once
   per authority tick:
   - It checks a round-robin slice of persistent actors, sized so each is
     checked once per `SWEEP_SECONDS = 10`.
   - It encodes each actor's record JSON (`actorRecordJson`, the string
     `encodeActor` already builds) and compares it with the last string
     written. If they differ, it marks the record dirty.
   - The existing 2 s write debounce batches these.
   - At 1,000 rabbits that is about 2 encodes per tick.
4. **Chunk membership per tick.** In the same `tick()`, each persistent entity's
   root chunk is compared with a cached numeric chunk.
   - On a chunk crossing or a `parentId` change, it is re-indexed
     (`membershipRevision`, buckets and children), as `index()` does today.
   - A `parentId` change (carry, attach, detach) also marks the record dirty
     immediately. Attachment is a discrete event.
   - This keeps chunk unloading and `RealmActivity` correct.
5. **Sweeps at save barriers.**
   - Explicit flushes run a full sweep first. `SaveManager.beforeFlush`, set by
     `RealmRecords`, runs from `flush()`, `flushSnapshot()` and
     `flushTogether`/`capture()`. This covers save and reload, Worker shutdown,
     page hide, realm transfers, resident transfers and world inspection.
   - Chunk eviction sweeps only the released scope:
     `RealmStreaming`'s `save(key)` calls `flushSnapshot({ scope: key })`.
     Unloads never pay for a full sweep, which measured about 18 ms for 1,000
     actors with Proxies.
6. **Restored actors** record their stored record string as the last write, so
   loading a world does not rewrite every actor.

Crash loss: up to ~10 s of continuous actor state (plus the 2 s debounce).
Explicit edits, attachments, spawns and deletions keep today's immediacy.
Explicit save points are exact.

## Audit (2026-11-09)

Writers that relied only on Proxy detection:

- **Continuous simulation state:** `position`, `velocity`, `wanderAI`, species
  components (`rabbit`, `fauna`, `mallard`, `predator`, `animalWork`, …),
  `routeAI`, `wz`/jump, `deathTimer` countdowns and prop `spawnTimer`. The
  sweep covers these within 10 s and at every save barrier.
- **Discrete changes without explicit marks:**
  - `parentId`/`localOffset` from carried work items (`AnimalWorkSystem`,
    `ForestWork`). The per-tick `parentId` check marks these.
  - `naturalSpawnId` on respawns (`WildlifeRespawns`). This is set at spawn,
    and `onSpawn` marks it.
  - `weight`, set by hunter profiles at creation.
- **Not in records:** vehicles, trains, players and parking visitors are
  excluded by `onSpawn` and saved by their own registries. Vehicle cost is
  unaffected.
- **Transfers:** `ResidentTransfer` and `RealmTransitions` flush through
  `flushTogether`/`flushAsync`, which run the full sweep.

## Validation

- **Node:**
  - `RealmRecords`, `RealmStreaming`, `SaveManager`, `ResidentTransfer` and
    `StreamingConformance` tests;
  - the Mallard residency and predator recipe save/reload suites;
  - new cases:
    - a moved actor is saved after one sweep period and at a flush;
    - an unload saves a moved actor in its released scope;
    - a crossing re-indexes membership in the same tick;
    - attach and detach are marked immediately;
    - a restored world does not rewrite unchanged actors.
- **Full `vitest` and `npm run test:all`**, since persistence is broad.
- **Performance:**
  - headless `Realm.tick` at 500/63, with a target close to the 7.5 ms A/B
    bound;
  - `npm run stress:bench` on the Mac;
  - the Pixel 7a when it is attached.
- **Review:** Opus 5.5 (high) through Yep Anywhere, then commit.

## Implementation

- `ActorRecords.actorRecordJson` builds the record string; `encodeActor` parses
  it. `observeActor` is gone (including from `robin-search.mjs`).
- **`RealmRecords`:**
  - Membership is cached as a numeric chunk plus parent.
  - `tick(dt)`, called from `Realm.tick` after the step and timed as
    `realm.saveSweep`, does two things:
    - refreshes membership: a parent change calls `changed()`; a chunk crossing
      re-indexes and marks the record;
    - sweeps a credit-based slice of `byId`.
  - `sweepAll()` and `sweepScope(key)` are the barriers. They are installed as
    `SaveManager.beforeFlush(scope?)`.
  - `sweepScope` returns whether every actor in the scope matched its last
    write.
  - The dirty snapshot records the string it captured as the last write.
  - `restore()` takes the decoded actor's string as its baseline.
- **`SaveManager`:** `flush`, `flushSnapshot`, `flushAsync` and
  `flushTogether` accept `FlushOptions`. `{ sweep: false }` skips the sweep;
  `{ scope }` sweeps one chunk. `flushTogether` sweeps before `capture()`.
- **Periodic checkpoints skip the sweep.** This was not in the plan. Two 5 s
  checkpoints call `flushAsync` and would otherwise run a full sweep every 5 s:
  - `LocalServerRuntime`'s save timer;
  - `GameServer`'s location checkpoint.

  Both pass `{ sweep: false }`, as does the storage-pressure flush that repeats
  every paused tick. `ResidentTransfer` also skips it, because it writes the
  resident's record itself. Visibility hide, the flush command (save and
  reload), shutdown, realm unload and realm transfers (`flushTransfer`) still
  sweep.
- **`RealmStreaming`:** `save(key)` flushes with `{ scope: key }`.
  `canRelease(key)` requires `records.sweepScope(key)`, so an actor that changed
  during the write keeps the chunk resident, as a Proxy write did before.
- **Membership refresh** now happens at a tick boundary instead of on every
  write. `RealmActivity.test` refreshes it in its `check()`, as `Realm.tick` does.

## Review

An Opus 5.5 (high) review through Yep Anywhere found no data loss or
duplication. It checked the barriers, the release race, baseline handling
across failed writes and rollback, and membership updates during iteration.
Changes made from its findings:

- **The blanket per-tick mark is removed.** `RealmSimulation` marked every
  simulated actor on every tick, so the sweep was redundant for awake actors.
  Every 2 s save encoded all of them, and each chunk release's `dirtyInScope`
  snapshotted all of them too. Continuous state now follows the sweep.
- **`EntityHandle` setters mark explicitly** through `onMutation`. Before this,
  only `clearParent` and `dismount` did; the rest relied on the Proxy:
  - position, velocity and jump;
  - parent;
  - AI state, following, direction and timer;
  - death timer;
  - mount, and the mount target on dismount.
- **Stale sweep-queue entries spend no credit**, and the queue is rebuilt once
  it is more than twice the live set. Before this, after a large unload, the
  survivors could wait about 100 s between checks.
- **`root()` returns at once** for an unattached actor. It no longer allocates
  a `Set`.
- **Resident door crossings** flush with `{ sweep: false }` instead of sweeping
  both realms.
- **Tests:**
  - A change during the eviction write keeps the chunk, then saves. It fails
    without the `canRelease` re-sweep.
  - Sweep cadence after an unload fails with the old credit spending.
  - A sweep-found change is retried after a failed write.
  - `flushTogether` sweeps unless the caller opts out.
  - Handle edits are marked at once.
  - The scope-sweep test asserts its count (30) directly.

Not changed: an explicit barrier encodes each changed actor twice, once in the
sweep and once in the snapshot. This is an optional future saving.

## Results

- **Tests:** new `RealmRecords` cases cover:
  - the sweep period, `{ sweep: false }` and the full sweep;
  - crossing, attach and detach on the next tick;
  - a scope sweep that skips the rest of the realm.

  A `RealmStreaming` case checks that an unload saves unmarked motion and AI
  timers. Without the scope sweeps, it and the existing attachment-unload case
  fail. With the review cases added, the persistence, server, wildlife,
  interiors, scenarios, scripting and mods tests pass (198 files, 3,086 tests).
- **`npm run test:all`** (machine at load ~30 from other sessions):
  - lint, health, typecheck and vitest pass (445 files, 5,357 tests).
  - HTTP integration passes after a rebuild. `test:all` runs it before its own
    build, so a stale `dist` fails the manifest digest.
  - Browser: 553 passed and 2 flaky (the apartment interior and the train
    recovery station). One failed: the split-screen guest Options focus check
    (`split-screen.spec.ts:219`). It passes 3 of 3 alone.
- **Headless, 500 rabbits and 63 cars:**
  - tick p50 14.5 → 6.9–7.7 ms; 6.6–8.2 ms after the review changes, with the
    machine at load ~30 from other sessions;
  - AI 2.3 → 0.8 ms, physics 6 → 3.2–3.6 ms, replication 2 → 1 ms;
  - `realm.saveSweep` ~0.04 ms p50;
  - a full barrier sweep of 1,048 actors costs ~5.3 ms (a Proxied encode took
    ~18 ms).
- **Browser:**
  - Mac, ~430–500 rabbits: Worker tick 13–14 → 4.3–5.5 ms p50.
  - Pixel 7a, 300 rabbits: 27.4 → 11.4 ms p50 at 1× and 36.2 → 13.8 ms at
    0.25×, with 60 Hz frames.
  - Details are in [performance](../topics/performance.md#after-sweep-based-persistence-234).
