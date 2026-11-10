# 235 — Crowd bench: remove unnecessary work

Status: bench delivered, baseline recorded · 2026-11-10. Owner: [performance](../topics/performance.md).

The owner asked for a repeatable bench with about 1,000 rabbits and 50 cars,
all within a few chunks and all in view. The goal is to remove all
unnecessary work there.

## Bench

`src/scenarios/CrowdBenchRecipe.ts` holds the fixed scene:
- flat ground (`FLAT_SCENARIO`);
- 50 parked cars in ten columns by five rows, cycling eight models from the
  compact to the garbage truck;
- 1,000 rabbits in a 40 × 25 grid at 24 px;
- the player between the cars and the rabbits.

The whole crowd (about 1,200 × 960 px) sits inside chunks 0–4, which is the
player's default 5×5-chunk view. Every actor is therefore in view and simulated.
These are ordinary Realm actors with ordinary vehicle records and AI; only the
placement is synthetic.

### Authority: `npm run crowd:bench`

The bench runs the recipe in a headless `ScenarioSession`. By default it does
180 warm-up ticks, then measures 600 ticks.

It reports:
- tick p50/p95/p99;
- `performanceMetrics` stage p50/p95;
- work counts per tick:
  - simulated actors and actors in motion;
  - physics bodies and awake cars;
  - wheel rays and wheel body tests;
  - support queries;
  - replication bytes.

Options:
- `--output=<file.json>` writes the report;
- `--compare=<earlier.json>` prints deltas against an earlier report;
- `--profile` records a CPU profile of the measured ticks only. Its frames are
  mapped back to source files, and the top self-time functions are printed;
- `--rabbits` and `--cars` scale the crowd down.

Two choices make the bench repeatable:
- **Fixed workload.** Randomness is the scenario's seeded source. A simulated
  wall clock advances 1/60 s per tick, because streaming interest leases and
  door timers read `Date.now()`. Work counts repeat exactly between runs; only
  the times vary with the machine and its load.
- **Production-like code.** `scripts/benchmark-crowd.mjs` compiles the bench
  with esbuild and runs it in plain Node. tsx compiles with keepNames, which
  wraps hot closures in `__name` calls. That added about 8% to the tick
  (rabbit AI 1.4 → 0.95 ms) and does not happen in the Vite build.

### Browser: the `crowd` world-geometry lab

The lab is at `workshop.html?geometry=crowd#/tool/world-geometry`. It uses a
fixed camera at zoom 0.2, so the whole crowd fits in the lab's 960×640 canvas.
To measure it:

```
npm run build && npx vite preview --port 4174
node scripts/benchmark-realm-physics-browser.mjs --fixture=crowd --headed --trials=1
```

The browser bench gains `--headed` and treats `crowd` like `traffic-crowd`:
one population.

## Baseline (2026-11-10, M4 Pro, f96952a2 plus this bench)

Authority, 1,000 rabbits and 50 parked cars:

| Measure | Value |
| --- | --- |
| Tick p50 / p95 | 6.4–6.6 / 7.4–7.7 ms |
| Physics (`realm.entityPhysics`) | 3.0–3.1 ms |
| Replication | 1.2–1.3 ms |
| AI | 0.93–0.96 ms |
| Save sweep | 0.04 ms |
| Simulated actors | 1,051 every tick |
| Physics bodies | 1,051 |
| Actors in motion | **64** (6%) |
| Awake cars, wheel rays | 0 (parked cars sleep on flat ground) |
| Replication | 9.1 KB per tick (~550 KB/s) |

The browser Worker tick matches (7.0–7.1 ms p50). **The lab draws only about
2.3 frames per second** (426–433 ms per frame), headed or headless.

## Unnecessary work found

Only about 64 actors move in a typical tick, yet all 1,051 get the full
per-tick treatment. From a source-mapped profile of the authority tick:

1. **Physics on idle bodies (≈40% of the tick).**
   - `readBody` (12%) copies pose and velocity out of Rapier for every body
     every tick. It includes a WASM contact-pair callback per body (7%).
   - `synchronize` (7%), `finish` (7%), `synchronizeForPublication` (6%) and
     `collectMotionIntents` walk all 1,051 bodies.
   - Rapier's own step is about 4.5%.
2. **Replication of unchanged entities (≈19%).** Each tick builds and compares
   every entity's snapshot (`reuseEntitySnapshot` 8%, `entitySnapshotMatches`
   3%, `mirroredFieldsMatch`) to find the few that changed.
3. **AI (≈13%).** Rabbit decisions (`chooseHop` gap checks), meadow work and
   threat/range/woodland worker kind checks each tick. `faunaProfile` lookups
   repeat for each kind test.
4. **Activity selection (≈8%).** `RealmActivity.select` and
   `WildlifeActivity.awake` re-prove "awake" for every rabbit every tick.
   Each rabbit's wake test runs twice.
5. **Gameplay resolution (≈5%)** over all simulated actors.

Lab frame (main thread, 4 s headed profile; the lab and the game share
`collectScene`):

6. **Projected shadows (~3.45 of 4.8 s).** At zoom ≥ 0.2
   (`PROJECTED_SHADOW_MIN_ZOOM`), each rabbit's shadow goes through
   `SurfaceReceivers.project`:
   - It is split into one face per terrain tile.
   - Each piece is clipped (`clipPlane`) and subtracted against its
     neighbours (`subtract`), even on flat ground with no receiver nearby.

   A plain ground shadow would draw the same pixels there.
7. **Per-frame UI and lab scans.**
   - `VehicleControl` → `vehicleChoice`/`driveCandidate` scans all vehicles for
     a drive prompt every frame.
   - `applyRecipeAppearances` re-applies recipe appearances to every entity
     every frame.

Separate observation: in the earlier regional stress world, 26–41 of 53 cars
applied wheel forces per tick (`VehicleChassis.prepare`) without a driver. A
later read of Rapier sleep state found only the 8 traffic cars awake. The flat
bench has none. That measurement needs a recheck before any wheel-ray work.

## Goal

**Per-tick and per-frame cost should follow what changes (actors in motion,
visible changes), not the population.**

Targets on this bench (M4 Pro):
- **Authority tick p50 ≤ 2 ms**, from 6.5 ms.
  - Idle grounded rabbits must not pay for physics reads, snapshot comparison
    or wake checks each tick.
  - Physics bodies read per tick should track actors in motion plus their
    contacts.
  - Replication cost should track changed entities.
- **Lab at zoom 0.2 holds 120 Hz** (render ≤ 8.3 ms), from about 430 ms.
  - Shadows on flat ground with no receiver take the plain path.
  - Per-frame UI scans are bounded.

Each change keeps the bench's work counts identical unless it intends to
change them. Before and after reports are recorded here (`--compare`).
Behaviour must stay the same:
- Physics wakes on contact.
- Riding, carrying and gameplay contacts are unchanged.
- Replicated motion stays identical for actors in motion.

The existing focused tests and `test:all` cover these.

Suggested order:
1. Flat-ground shadow fast path (largest, renderer only).
2. Skip physics reads and contact queries for sleeping bodies.
3. Change-tracked replication.
4. Incremental activity selection.
5. AI kind lookups.
6. Lab per-frame scans.
