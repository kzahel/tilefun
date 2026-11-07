# Code health and refactoring sequence

Status: parent sequencing plan, approved 2026-11-06 for autonomous delivery of
phases 1–5. Phase 6 (storage policy) is deferred by the owner.
Owner: [code health](../topics/code-health.md). Related: [testing](../topics/testing.md),
[client/server boundaries](../client-server-architecture.md),
[embedded engine labs](../topics/embedded-engine-labs.md).

Each phase is reviewed by an independent Opus 5.5 high-effort session launched
through yepanywhere, repaired, committed, and recorded below before the next
phase starts. Phases are bounded: when an item proves larger than its phase,
record it as remaining work instead of stretching the phase.

## Research summary (2026-11-06 audit)

Read-only audit by five parallel subsystem reviews plus measured import-graph,
lint and typecheck experiments. Numbers are as of commit `2a662f6c`.

### Shape and hotspots

`src/` holds 1,095 TS/TSX files and about 184k lines; `scripts/` holds 1,341
tracked files (270 JS/MJS ≈40k lines, 37 TS, 693 Python ≈132k lines).

| File | Lines | Commits/60d | Core problem |
| --- | --- | --- | --- |
| `src/server/Realm.ts` | 2348 | 102 | 11 responsibilities; `handleMessage` ≈250 lines; `loadWorld` ≈300 lines with duplicated binds/parses |
| `src/client/GameClient.ts` | 1888 | 57 | Unreachable local mode; 441-line constructor, 393-line `init` |
| `src/wildlife/Fauna.ts` | 1539 | 53 | 82% profile data; churn is "shotgun surgery" across many files per species batch |
| `src/rendering/collectScene.ts` | 484 | 47 | One 417-line function; per-entity `find` (O(n²)) |
| `src/server/GameServer.ts` | 1763 | 43 | Request plumbing copy-pasted 11×; four handlers lack `.catch` |
| `src/client/PlayerPredictor.ts` | 983 | 41 | Replay, presentation and input history mixed; imports rendering helpers |
| `src/scenes/PlayScene.ts` | 848 | 40 | 348-line `update`; reconcile duplicated in `ScenarioReplica` |
| `src/generation/regional/NaturalLandscape.ts` | 1591 | 33 | ≈900 lines of spawning; self-instantiates up to five copies to fake stage order |
| `src/workshop/NaturalLandscapePage.tsx` | 1034 | 39 | One 969-line component; per-frame `JSON.stringify` telemetry |
| `ToolRegistry.ts` / `build-manifest.ts` / `App.tsx` | — | 35/31/23 | Hand-edited central lists |

Realm lines ≈700–1000 (tick) and ≈1600–1800 (`loadWorld`) were 70–99% rewritten
in 60 days; split cold regions first and land hot-region moves in short commits.

Biome cognitive complexity (default max 15) flags 557 functions: 318 at 16–29,
132 at 30–49, 78 at 50–99 and 29 at ≥100. Worst: `restoreAnimalWorkPose` 255,
`NaturalLandscapePage` 255, `updatePredatorAI` 251, `WoodlandWork.update` 227,
`reviewCases` 219, `PastureWork.update` 217. All nine wildlife `*Work.update`
methods score 105–227 and re-implement the same `find`/`nearby`/`gap`/`enter`/
`stop`/`face` plumbing.

### Root causes

1. **Shotgun surgery through central lists.** A new species touches Fauna,
   FoodWeb, WildlifeActivity, `tickAllAI`, Realm's `isWildlife` copy and startle
   chain, EntityManager dispatch, ActorRecords, NaturalLandscape spawning,
   NaturalLandscapePage zoom/camera/description chains and ToolRegistry (commit
   `3c36563a` touched ≈12 shared files). A replicated field needs ≈14 edits in
   four files. A Workshop tool touches ToolRegistry, build-manifest and three
   places in `App.tsx`. `Entity` has 51 fields (44 optional, ≈40 added in 60 days);
   AnimalWork carries 40 optional counters.
2. **Dead paths kept alive.** GameClient local mode (all five `new GameClient`
   calls pass `server: null, mode: "serialized"` since `d5b6ffdb`), Realm
   non-streaming mode, extrapolation ghosts, `CountrySource`, duplicate collision
   visualizers, unused Realm methods and dead exports.
3. **Copy-paste helpers.** `gap` ×18, LCG step ×9, position-seed hash ×7, FNV ×2,
   literal `256` instead of `CHUNK_SIZE_PX` ×50+, cache eviction ×24, wheel zoom ×4,
   art-notes query ×3, DOM `el`/`$` helpers ×6, "two reports pause" rule ×5.
4. **Untyped seams.** Nothing typechecks `tests/`, `scripts/` or configs (`tsx` and
   Playwright transpile only). 59 specs read `#game.__game` 507 times, each with
   an ad-hoc type of `GameClient` privates.

### Layering (runtime import graph, non-test files)

- Four runtime cycles: a 20-file wildlife knot (Robin/FoodWeb/Roadkill/Rabbit/
  Predator/Mallard/Frog/…), 11 Workshop pages ↔ `App.tsx`, three interiors files
  (BuildingDoors/IndoorResidents/GameplayInterior), `predatorAI` ↔ `WildlifeRespawns`.
- 39 directory pairs import each other. `required()` lives in `art/ArtCatalog.ts`
  (default message "Missing art source") and is imported by 155 files (40
  production), creating false `art ↔ X` coupling.
- Real violations: `shared/` imports `traffic/` (`binaryCodec`, `entityDelta`,
  `serialization`) and `protocol.ts` imports `server/SafeArrival`; the Worker
  authority reaches Canvas drawing via `ApartmentFloorPlan.ts:1` →
  `rendering/CanvasInteriorMap`; `Movement` lives in `input/ActionManager` but
  Realm, PlayerControls, Player and others import it; `entities` ↔ `wildlife`
  (28/45 imports); `RenderingBoundary.test` checks files, not transitive imports
  (`collectScene` → `ProjectedDecals` → `document.createElement`).
- Six-level regional strategy inheritance chain; `rendering/` is flat with 137
  files (≈50 vehicle/mesh).
- Likely dead files: `src/railway/RailRoute.ts`, `src/workshop/CurvedTrainPreview.ts`.

### Lint and type experiments (counts against current code)

| Candidate | Hits | Notes |
| --- | --- | --- |
| TS `verbatimModuleSyntax` | 0 | Free |
| TS `noImplicitOverride` / `noImplicitReturns` | 2 / 7 | Cheap |
| TS `noPropertyAccessFromIndexSignature` | 649 | Not worth it |
| Typecheck tests/scripts/configs | ≈500 | 380 private-member access; ≈114 real drift |
| Biome `noImportCycles` | 26 | Locks cycle repairs |
| Biome `noFloatingPromises` | 25 | Includes the GameServer missing-`.catch` bugs |
| Biome `useExhaustiveSwitchCases` | 3 | Realm/GameServer message switches, ScenarioWorkerHost |
| Biome `noMisusedPromises` | 12 | Intentional `if (this.closing) await` patterns; skip |
| Biome `noExcessiveCognitiveComplexity` / `noExcessiveLinesPerFunction` | 557 / 554 | Use as ratchets, not defaults |
| Biome `useExplicitType` | 3,040 | Skip |
| Biome `noConsole` | 116 | Mostly transport/server diagnostics; skip for now |

TypeScript 7 typechecks `src` in ≈1.3 s, so broader typecheck scope is cheap.
No knip, dependency-cruiser, jscpd or git hooks exist. Undeclared imports:
`esbuild` ×19, `playwright-core` ×17, `playwright` ×7.

### Bugs found during the audit

| # | Defect | Location | Audit status |
| --- | --- | --- | --- |
| B1 | `list-worlds`, `rename-world`, `list-realms` and connect paths lack `.catch`; failures become unhandled rejections and clients wait for the 30 s timeout | `GameServer.ts` ≈319, 411, 1564, 1651, 1661 | Verified |
| B2 | Touch `commitTouchPaint` never resets `lastPaintedCorner`; a second corner tap draws a line from the previous tap and the same corner is a no-op | `EditorMode.ts:877-899` | Verified by reading |
| B3 | ≈114 type errors in untypechecked tests/scripts (e.g. `vehicleRamp` on `Entity`, `towTargetId`, readonly assignment in the `build-art-catalog.ts` build gate) | various | Verified |
| B4 | ScenePage effect depends on `notes.length`; camera snaps back on note refresh | `ScenePage.tsx:130` | Reported |
| B5 | ReviewTool effect depends on a fresh array; runs every render | `App.tsx:1011-1025` | Reported |
| B6 | `BehaviorArt` overrides art JSON `loop`; `fox.stalk` loops although JSON says `loop:false` | `BehaviorArt.ts:48-68` | Reported |
| B7 | Grass sway uses `performance.now()`, ignoring pause/presentation clock | `collectScene.ts:448` | Reported |
| B8 | `streaming.update` runs twice per tick with different dormant filters | `Realm.ts:724` vs `1177` | Verify intent |
| B9 | Gravity is page-global module state overwritten by `RemoteStateView`; `ScenarioClient` drops `sync-cvars` | `physics/Gravity.ts:2` | Reported |
| B10 | Server console commands act on the default realm through forwarding getters | GameServer getters | Reported |
| B11 | `SpatialHash.queryRadius` skips `spanningEntities`, unlike `queryRange` | `SpatialHash.ts:143` | Verify |

### Operational findings

- Local `main` was 66 commits ahead of the last-fetched `origin/main`, while the
  real remote head `3788ec75` (2026-11-04) has 10 commits not in local `main`.
  The next push requires a merge or rebase. This plan commits locally only.
- The scheduled full browser run failed 12 consecutive nights (2026-10-25 →
  11-05); the latest had 45 failures / 801 passes across all eight shards.
- `npm run check` failed on `main`: 12 `docs/benchmarks/*.json` files written by
  benchmark scripts with `JSON.stringify` are unformatted.
- CI builds three times per push (check, smoke, deploy), each repeating the six
  inventory gates; `tsc` runs twice; `npm test` is ≈24 of the 28 check minutes.
- 14 test files under `scripts/` never run in CI; `playwright.dev-updates.config.ts`
  is orphaned; `captures/*` and `scripts/screenshot.mjs` write PNGs into the root.
- Tracked `art-source/` + `public/` grew from 0.10 GB to 2.64 GB between Oct 15
  and Nov 1; the pack is 1.04 GiB; one projection is 88.6 MB (GitHub limit
  100 MB). Phase 6 owns this; it is deferred.

## Phases

### 1 — Green gates and audit bugs

- Exclude `docs/benchmarks/**` from formatting; exclude hash-pinned
  `art-source/**` and `public/demos/**` from Biome wholesale where that replaces
  hand-listed paths without hiding live source; remove the stale `demo` entries.
- Add a staged-file Biome pre-commit hook (opt-in install script; no new dependency).
- Fix B1 and B2 with native tests. Confirm or refute B4–B11; fix confirmed
  defects that are small and local, otherwise record them with evidence.
- Triage the nightly browser failures: classify by cause and record them; fix
  only defects that are clearly regressions with narrow repairs.
- Validation: `npm run check`, `npm run typecheck`, focused vitest files.

### 2 — Delete before splitting

- Remove GameClient/PlayScene/EditScene local mode, `LocalStateView` and related
  `GameContext` members; remove the extrapolation-ghost path; remove Realm's
  non-streaming branches once the replication harness uses `init()`.
- Delete dead files/exports (`RailRoute.ts`, `CurvedTrainPreview.ts`,
  `CountrySource`, unused Realm methods and the confirmed dead exports).
- Move `required()` to `shared/required.ts`, `Movement` to a shared module,
  `WildlifeEnvironment` to its own module and traffic fixtures/test helpers to
  `tests-support/`. Fix garbled comment characters.
- Add `shared/Determinism.ts` (LCG step, position seed, FNV) and a shared `gap`
  helper only where constants and salts are byte-identical; replace chunk-size
  literals with `CHUNK_SIZE_PX` where they mean chunk size.
- Validation: typecheck, lint, focused native tests for touched areas,
  `npm run streaming:bench -- --assert-ready` if streaming paths change.

### 3 — Guardrails

- Enable TS `verbatimModuleSyntax`, `noImplicitOverride`, `noImplicitReturns`.
- Add `tsconfig.tools.json` (tests, tests-*, captures, scripts TS, configs) to
  `npm run typecheck`; fix real drift; replace private-member access with a typed
  `GameTestHooks` surface exported from `src`.
- Enable Biome `noImportCycles` (after breaking the runtime cycles),
  `noFloatingPromises`, `useExhaustiveSwitchCases`, and per-directory
  `noRestrictedImports` boundaries for simulation/shared layers.
- Add a file-size and complexity ratchet (baseline file, fails on growth).
- Add knip (or an equivalent script) for dead files/exports and undeclared deps;
  declare or remove the undeclared imports.
- Validation: full `npm run check` and `npm run typecheck`.

### 4 — Registries that remove shotgun surgery

- GameServer typed request-handler table from `shared/requests.ts` with one
  `respond()` wrapper and an arrival helper.
- Wildlife species registry for activity/AI/startle/isWildlife lists; shared
  `WorkKit` for the nine Work classes; clip lookup driven by art banks.
- Codec `ENTITY_FIELDS` schema driving snapshot/delta encode/decode (removes the
  mask/write split and most non-null assertions).
- Workshop self-registration replacing ToolRegistry/build-manifest/App lists;
  `NATURAL_CASES` gains zoom/camera/description.
- Validation: affected native suites, binary codec/serialization tests,
  `npm run art:catalog` + `npm run workshop:manifest`, build when inventories change.

### 5 — Split hot regions

- Realm: `RealmPhysics`, `Riding`, then `RealmCommands`, `RealmComposition`,
  `RealmSimulation` as far as the phase allows.
- GameServer: `DoorTransitions`, `RealmDirectory`, `SessionRegistry`.
- GameClient: `PlayInputController`, `ServerMessageRouter`,
  `WorldSessionActions`, `GameMenuChrome`.
- `collectScene` stage functions and indexes; NaturalLandscape characterization
  digest before any split; `App.tsx` shell/routes split; EditorPanel sections;
  `rendering/` subfolders. PhysicsScene last, behind parity tests.
- Validation: affected native and focused browser boundaries, streaming
  readiness, build, `art:catalog` + `workshop:manifest` where relevant.

### 6 — Storage policy (deferred)

Git LFS versus default `.json.gz` for projections, shared viewer bundles,
retiring per-vehicle script copies, and splitting review demos from Pages.
Deferred by the owner on 2026-11-06.

## Execution record

Phase evidence, reviewer findings, repairs, remaining work and commits are
appended below as each phase completes.

### Phase 1 record — green gates and audit bugs

Context change: during delivery another session rebased local `main` onto the
remote (Biome 2.6.4) and pushed, which removed the divergence and formatted the
12 benchmark records. The gate is now kept green structurally:

- Biome skips the hash-pinned or snapshot trees `art-source/` and `public/demos/`
  wholesale (replacing ≈40 hand-listed paths). Knowingly unlinted as a result: a few
  hand-maintained gallery viewers (`public/demos/*/gallery.js`, `blender-tiger/demo.js`)
  and root-level art-source JSON; no `src`, script or test module imports them and no longer formats `docs/benchmarks/**`, whose
  records are written by scripts. `npm run check` now checks 2,215 files in
  <1 s instead of 8,953 files in ≈8 s. Stale `demo` entries are removed.
- `npm run hooks:install` opts a checkout into `scripts/git-hooks/pre-commit`
  (`biome check --staged`, which reads working-tree contents of staged files).
  It is not installed automatically.

Audit bugs:

| # | Outcome |
| --- | --- |
| B1 | Fixed: `GameServer.requestFailed` answers every failing world/realm request with `request-error` (also reused by create-world, arrival and vehicle control); a failed connect-time realm list logs and sends an empty list. Regression test fails on the old code. |
| B2 | Fixed: one `resetPaintDedup()` replaces three hand-copied resets; native touch test (fails on the old code) proves separate corner taps no longer connect. |
| B3 | Deferred to phase 3 (typecheck tools/tests). |
| B4 | Confirmed (narrower: any new note, not every refetch). Fixed: each focus/note target centres once per navigation; clearing the parameter re-arms it. No React DOM test harness exists. |
| B5 | Confirmed, low impact. Fixed with `useMemo`. |
| B6 | Confirmed mismatch: only `fox.stalk` changes behavior (JSON `loop:false`, forced to loop); `red-squirrel.eat` lacks a flag. Needs owner decision: honoring JSON would make the fox stalk hold its last frame. Unchanged. |
| B7 | Confirmed for labs (game presentation time is wall time; scenario labs pause their clock but grass kept swaying). A fix using `frame.presentationTime` was written and reviewed, then withdrawn: `collectScene.ts` source text is hashed into 1,025 Workshop candidate identities (1,008 `nature:*`, 6 `character:*`, 11 geometry diagnostics), so any edit reopens them for human review. Withdrawn here; re-applied in phase 2 once the inbox showed no human decisions on those batches. |
| B8 | Confirmed inconsistency from `4df2527a`: the second `streaming.update` passes dormant sessions, dropping and re-requesting their chunks each broadcast tick. Needs a decision on dormant residency. Unchanged. |
| B9 | Confirmed latent, no current impact: labs pass gravity explicitly and must drop `sync-cvars`. Recommended per-view gravity. Unchanged. |
| B10 | Confirmed: remote console commands act on the local/default realm. Recommended: pass the sender realm into `execServer`. Unchanged. |
| B11 | Refuted: spanning entities are also bucketed by origin cell; `queryRadius` is origin-distance by design. |

Nightly browser triage. The latest scheduled run (`3788ec75`, 2026-11-05) had 45
failures. Re-running the 25 failing spec files (101 tests) locally on the
rebased HEAD gave 65 passed / 36 failed, so roughly 10 were fixed by the
intervening train/physics commits. Remaining failures by cause:

- Test drift (fixed): `server-security.spec.ts` used `sv_speed`, removed by
  `8fe1c968`; it now uses `sv_gravity` and passes for ws and WebRTC.
- Wildlife walk/hop phase never observed (13 cases): `fauna-gameplay` fox,
  horse, kangaroo, fish, penguin, manta-ray (canvas+gpu), deer, frog hop and
  `range-work` poll for a walk clip at ground height with frame ≥ 4 and never see
  it. Common cause, likely movement/physics-reset interaction; needs investigation.
- Ball contact no longer startles small animals (2): robin/frog expect `scared`,
  observe `idle`.
- Natural landscape explorer never reaches `data-settled` (3) and the landscape
  lab cannot find "Ride train roof" (2).
- World geometry lab: player height 48 not reached and start buttons time out (5).
- Local 30 s timeouts on long gameplay flows (character placement, room editing,
  tap-to-water): CI uses 60 s; inconclusive locally.
- `webrtc-delivery` world-reset ordering (1).

These are behavior regressions or stale expectations across several systems,
not narrow repairs; they are recorded for a dedicated investigation rather than
fixed inside this refactoring sequence.

New friction finding, and a constraint on later phases: `workshopInputDigest`
hashes every non-test `.ts` under `src/` (except `server/` and `workshop/`), so any
engine edit requires a full `workshop:manifest` render (≈3 minutes, 2,121
candidates) even when every candidate is byte-identical. Worse, candidate
identities embed raw source text (`NaturalLandscapeCandidate.ts` and
`ScenarioRuntimeSource.ts` import `collectScene.ts?raw` and others), so a pure
refactor of those modules reopens hundreds of candidates for human review.
Phase 4 must narrow identities to rendered output or explicit recipe inputs
before phase 5 splits `collectScene` or other hashed engine modules.

Validation: `npm run check` (exit 0), `npm run typecheck`, focused vitest
(`GameServer`, `EditorMode`, editor and SceneFrame tests), both
`server-security` Playwright cases, the 25-file nightly re-run above, and
`art:catalog` + `workshop:manifest` regeneration (digest-only change).
Review: an independent Opus 5.5 high review found no blockers; it caught a vacuous
`toContain("2")` assertion (the cvar description contains "2"), a missing re-arm
when ScenePage parameters clear, a misplaced doc comment, remaining inline copies
of the error reply, an empty lobby on realm-list failure, and the identity churn
above. All were repaired or recorded.

### Phase 2 record — delete before splitting

Precondition: `npm run workshop:inbox` on 2026-11-06 still showed 0 approvals
and 0 change requests on every source-hashed batch (natural-landscapes 1,008
unchecked, rail-*, authored-trains; world-geometry/physics excluded), so engine
edits here reopen only unreviewed candidates. Pixel-identity batches (buildings,
roads, rooms, streets, districts, vehicles) are unaffected by these refactors.

- B7 re-applied: grass sway uses `frame.presentationTime` when a frame is
  supplied (paused labs stay still; frameless callers keep wall time), with a
  regression test in `SceneFrame.test.ts`.
- Local mode removed: `GameClient` takes `(canvas, transport, options)`; the
  `server`/`mode` arguments, `localServer`, `serialized`, `remoteView` and the
  local-only menu/world/door branches are gone. `GameContext` loses
  `server`/`serialized` and types `stateView` as `RemoteStateView`, so PlayScene
  and EditScene drop their casts and local tick paths. `LocalStateView` and its
  test are deleted; `ClientStateView` stays as the narrow read interface used by
  `DoorControl`/`VehicleControl`.
- Extrapolation ghosts removed: `getExtrapolationGhosts` had no production
  caller, so the overlay's `Extrap` stats were never populated and
  `collectScene`'s ghost parameter was always `undefined`. The view sampling,
  overlay stats, `collectScene` parameter/branch and their tests are gone; every
  caller drops one positional `undefined`. `GameServer.invalidateAllChunks` lost its
  last callers with local mode and is deleted.
- Browser hooks: Playwright specs and instrumentation scripts read
  `__game.remoteView` (72 sites in 17 files, including `benchmark-streaming.mjs`);
  they now read `__game.stateView`, the same `RemoteStateView`. The worker-server
  "no in-page server" assertion became structural and is removed.
  `docs/client-server-architecture.md` no longer describes a local path.
- Realm non-streaming branches removed: `ReplicationDeliveryHarness` (the only
  realm user that skipped `init()`) now uses `memoryServer()`; Realm drops the
  legacy chunk-loading, structure placement and activity-tier paths and
  `MAX_CHUNK_LOADS_PER_UPDATE`; `requireStreaming()` guards load-dependent paths
  and `tick()` returns early for an unloaded realm. B8 (two `streaming.update`
  calls per tick) is unchanged. `GameServer.updateVisibleChunks` had no caller.
- Dead code deleted: `railway/RailRoute.ts`, `workshop/CurvedTrainPreview.ts`,
  `CountrySource` (file keeps the `CountryPlan` type), Realm `inspectionState`,
  `realizeProceduralActors`, `closePersistenceIfCurrent`, and the exports
  `canBecomeRoadkill`, `controlsTreeHeight`, `turnPath`, `vehicleRoofSize`,
  `TRAIN_PUSH`, `SHOPPING_PARKED_BAYS`, `solidOverlaps`/`solidTop`.
- Moves: `required()` → `shared/required.ts` (175 importers including tests; removes the false
  `art ↔ X` coupling), `Movement` → `shared/Movement.ts`, `WildlifeEnvironment`
  and `WildlifeBody` → `wildlife/WildlifeEnvironment.ts` (out of `mallardAI.ts`),
  four test-only traffic fixtures/helpers → `tests-support/`. Mojibake fixed in
  13 comment lines.
- Shared helpers with byte-identical behavior: `shared/Determinism.ts`
  (`lcgNext` ×11, `positionSeed` ×7, `fnv1a32` ×2, with a test pinning outputs
  computed from the old inline code) and `shared/gap.ts` (×18, including eight
  identical `distance` helpers). `CHUNK_SIZE_PX` replaces `256` only where it
  means chunk pixels. Deliberately left alone because constants or coercions
  differ: `TrainAudio` (signed LCG), `OrderedLatency` (Park–Miller),
  `GrassBladeRenderer`/`TileVariants` (no floor/salt), `RailTrackRaster`,
  `noise`, `RoadGenerator`, `RegionalPlanner`, `NaturalLandscape:327`,
  `ReviewCases` FNV (review IDs), `RoadTraffic` FNV (`charCodeAt(i)` differs
  for astral characters), `LaneGraph` (`{x,y}` distance).

Remaining phase 2 candidates, not done: cache eviction ×24, wheel zoom ×4,
art-notes query ×3, DOM `el`/`$` ×6 and the "two reports pause" rule ×5;
unreferenced constants and exports (`BALL_*`, `BOUNCE_*`, `PLAYER_*`,
`ENTITY_ACTIVATION_DISTANCE`, `JUMP_CUT_MULTIPLIER`, `BOAT_SEAT_Z`,
`IDENTITY_ROTATION`, `MODERN_INTERIORS_ATLAS_PREFIX`, `TOW_TRUCK`,
`TRAIN_LENGTH`, `artNotesPlugin`, `isTransporter`/`transporterLocal`,
`AABB3D` helpers) — phase 3's knip run will list them mechanically;
`StructureGenerator`/`placements(...).newIntersectionKeys` and its `processed`
set lost their consumer with the legacy Realm structure path (callers pass
`new Set()`); `Overview.countryside` is always empty, so the explorer's countryside layer is
dead; `scripts/instrumentation/protocol-fallback-audit.ts` already crashes
(`new GameServer(t)` lacks deps); `src/workshop/animal-behavior-status.json`
carries mojibake generated from `art-source/wildlife-v2/behavior-campaign.json`.

Pre-existing unit failures (fail identically on a clean export of `2e80bef9`):
`VehicleDepot.test.ts` (7874.18 vs 7875.32), `SharedPhysics`,
`VehiclePlacement`, `VehicleControl`.

Validation: `npm run typecheck`; `npx biome check .` (warnings only, all
pre-existing); full `npx vitest run` (4,615 passed; the four failures above plus a
one-off `SharedPrediction` timing flake, which also flakes on `2e80bef9`);
`ReplicationDelivery.test.ts` and `scripts/instrumentation/replication-delivery.ts`
(all profiles converge); `art:catalog` (source-line references and the removed
`CountrySource` usages only) and `workshop:manifest` — fingerprints changed only in
source-hashed batches with no human decisions (natural-landscapes 1,008,
world-geometry 10, rail-* 32, physics-prototype 1, character-lab 6); `npm run
build`; `npm run streaming:bench -- --assert-ready` after the hook migration;
`npm run test:smoke`. Smoke failures caused by this phase (`remoteView` hooks,
`g.server`) were fixed and re-run green. Remaining smoke failures predate it: F3
expects a "Driving bodies" label absent from `src` at `2e80bef9`; the
worker-server physics case reads `stateView.physicsParameters`, also absent at
`2e80bef9`; the mobile-editor rosso-coupe car does not drive (same symptom as the
`VehiclePlacement` unit failure); the local 350 ms busy-Worker frame count is
frame-rate sensitive (passes with the CI 2 s stall).

Review: an independent Opus 5.5 high review found no remaining blockers. It
confirmed the dedented GameClient branches are byte-identical, every determinism
substitution and pinned value, the `CHUNK_SIZE_PX` swaps, the dead-code claims and
that B8 is unchanged. It flagged the `remoteView` browser hooks (fixed during
review), the half-removed ghost renderer path, the stale architecture doc,
orphaned `invalidateAllChunks`/`loadWorld` docs, stripped JSDoc spacing in
`ClientStateView.ts`, a tautological spec assertion, stale Realm comments and the
incomplete record; all were repaired.

### Phase 3 record — guardrails

Precondition: `npm run workshop:inbox` still showed 0 approvals and 0 change
requests on every source-hashed batch.

- TypeScript: `verbatimModuleSyntax` (0 hits), `noImplicitOverride` (2, the
  Workshop error boundary) and `noImplicitReturns` (7 trailing
  `return undefined;` on paths that already returned `undefined`) are on in
  `tsconfig.json` and `worker/tsconfig.json`.
- `tsconfig.tools.json` typechecks tests, specs, captures, TS scripts and root
  configs and is part of `npm run typecheck`. It started at 460 errors: 380
  private `GameClient` reads and ≈80 real drift (B3). Fixed drift includes the
  `build-art-catalog.ts` readonly rect (output byte-identical), stale
  `SubgridShape`/`PhysicsCVars`/`ServerLoop`/`ScenarioRecipe`/`Realm.traffic` uses
  in instrumentation, a crashing `protocol-fallback-audit.ts` (now constructs
  `GameServer` with current deps; its `join-realm "__default__"` scenario is
  still stale), impossible comparisons and dead branches for removed vehicle
  features, and unused `@ts-expect-error`s now that `@types/pngjs` is installed.
  Four instrumentation scripts for towing/truck beds (retired in `8f405aaf`)
  could not compile and are deleted; their docs point to history.
- `GameTestHooks` (`src/client/GameTestHooks.ts`) is the typed `canvas.__game`
  surface. `GameClient implements` it with those members public (readonly where
  possible); `exposeGameTestHooks` replaces four `as any` assignments and the
  runtime value is still the client. 39 specs migrated. Real spec bugs: four
  specs assigned getter-only `debugPanel.paused`/`zoom` (silently ignored); they
  now call `setPaused()`/`setZoom()`.
- Biome: `noImportCycles` (26 → 0: Workshop page helpers moved from `App.tsx` to
  `WorkshopCommon.tsx`; interiors identity to `InteriorIdentity.ts`;
  `predatorHabitatAllows` to `PredatorHabitat.ts`, added to
  `ScenarioRuntimeSource`), `noFloatingPromises` (19 → 0; `main.ts` profile
  picker failures now reach startup error handling instead of an unhandled
  rejection; peer `send` promise failures are handled like synchronous throws;
  menu-open failures from the hamburger/menu buttons now print to the in-game
  console like the keyboard path instead of reaching the fatal fault overlay),
  `useExhaustiveSwitchCases` (3 → 0; partial message switches get commented
  `default: break`), and `noRestrictedImports` boundaries: `shared/` may not
  import hosts, presentation or feature directories (six allow-listed imports:
  `PlayerModels`, `EditorTypes`, `CurveTrain`, `RailPath`, `Vehicle`,
  `VehiclePaint`; `Arrival` moved into `shared/protocol.ts`); Worker-authority and
  simulation directories (including config, mods, projection, rooms, scenarios
  and transport) may not import client, rendering, scenes, UI or Workshop
  (presentation/lab files such as `ScenarioPresentationHost` excluded;
  `ApartmentFloorPlan.ts` may import only `CanvasInteriorMap`). Patterns are
  depth-independent (`**/client/**`). Biome does not check inline `import("…")` types, so
  `shared/localHostProtocol.ts` and inline types in `shared/protocol.ts` escape.
- Ratchet: `npm run health:ratchet` (`scripts/code-health/ratchet.mjs`, ≈0.4 s)
  baselines 195 non-test `src` files over 600 lines or with a function above
  Biome cognitive complexity 25; lines, worst score and over-limit count may not
  grow, and new files must stay under both limits. Biome's JSON reporter is
  experimental, so the script exits non-zero if the report shape or message
  format stops parsing rather than silently reporting zero complexity.
- knip (`knip.json`, ≈8 s) checks dead files, exports, types, duplicates and
  unlisted dependencies. Declared the undeclared `esbuild`, `playwright`,
  `playwright-core` (same range as `@playwright/test`; bump the three together). Removed what it
  found: 14 unused constants in `config/constants.ts`, `AABB3D` helpers,
  retired transporter/towing pose helpers, the legacy `artNotesPlugin`/
  `interiorReviewPlugin` Vite plugins, unused re-exports and types, and the
  `LATEST_REGIONAL_REVISION`/`buildFootstepManifest` aliases. `npm run check` is
  now Biome + ratchet + knip, and CI's check step calls it.

Remaining: `StructureGenerator.newIntersectionKeys`, `Overview.countryside` and the
other phase 2 candidates knip cannot see (structural dead state, duplicated
helpers); `ApartmentFloorPlan.drawApartmentPlan` could move to its only caller
(`editor/InteriorCatalog.ts`) to drop the boundary exception; six `shared/`
allow-list entries; specs that still bypass `GameTestHooks`:
`fault-reports.spec.ts` (`RequestBroker` privates via a documented `as any`),
`worker-server.spec.ts` (14 `as any` `__game` reads), `streaming.spec.ts` (2) and
`tap-movement.spec.ts` (a hand-written shape reading
`NetEmulatedClientTransport.messageHandler` and `TapMovement.view`/`plane`);
`GameClient implements GameTestHooks` makes those members public to app code
too, so app code should not start depending on them; knip's
`ignoreExportsUsedInFile` hides ≈59 over-exported (not dead) symbols; Biome cognitive-complexity and
lines-per-function remain ratchets rather than rules.

Validation: `npm run typecheck` (all four projects); `npm run check` (Biome
warnings only, ratchet, knip); full `npx vitest run` (4,615 passed; the four
pre-existing failures plus the `SharedPrediction` timing flake); `art:catalog`
(source-line references moved by the identity/pose edits) and `workshop:manifest`
(`ScenarioRuntimeSource` now also hashes `PredatorHabitat.ts`) — fingerprints changed only in
source-hashed batches without human decisions (natural-landscapes 1,008,
world-geometry 10, character-lab 6, physics-prototype 1); `npm run build`;
`npm run test:smoke` (22 passed; the three pre-existing failures F3,
worker-server physics settings and rosso-coupe placement). The four specs whose
pause/zoom writes now take effect: predator-origins, predator-world and most of
tap-movement pass; `horse-riding` (mount/speed) and tap-movement "stops at water"
fail, and the unchanged HEAD versions of both also fail against the same build
(the tap-movement case now gets further, failing at the later water stop rather
than the earlier target reset).

Review: an independent Opus 5.5 high review found no blockers. It confirmed the
moved code is byte-identical, removed exports have no consumers (including
`/tilefun/src/...` runtime imports in `.mjs` scripts), the `return undefined;` and
`default:` arms do not change behavior, `canvas.__game` is still the client, and
the boundary rules fire as intended. It asked for browser evidence on the four
pause/zoom specs (recorded above), a fail-loud ratchet parser and Windows path
normalization (done), an honest list of specs that still bypass the hooks, the
menu-error behavior note, wider and depth-independent boundary patterns (done),
and documentation of knip's in-file export setting and the Playwright version
coupling; all were repaired or recorded.

### Phase 4 record — registries

Precondition: `npm run workshop:inbox` still showed 0 approvals and 0 change
requests on every source-hashed batch.

- **Requests.** `shared/requests.ts` adds `RequestType`, `RequestOf`,
  `ResponsePayload`, `isRequest` and `responseTo` (builds `{type, requestId, …}`
  from the existing `RESPONSES` map). `GameServer` dispatches every request through
  a handler table typed `{ [K in RequestType]: … }`, so a missing handler or wrong
  payload fails `tsc`; one `respond()` sends success or `request-error` (sync results
  still answer before returning, async ones in the same promise chain), and one
  `arrival()` helper replaces `respondToTransition` for load-world, join-realm and
  enter/exit-building. Adding a request: protocol union + `RESPONSES` + a 1–5 line
  compiler-required table entry (before: a 10–15 line switch case that silently fell
  through to realm dispatch when forgotten). One deliberate change: an `rcon` whose
  `execServer` throws now answers `request-error` (B1 policy) instead of escaping
  `handleMessage`. GameServer 1,742 → 1,714 lines, worst complexity 67 → 40.
- **Entity codec schema.** `shared/entityFields.ts` (`ENTITY_FIELDS`: name, mask
  bit, wire kind, equality/copy) and `shared/entityWire.ts` (byte layouts) drive
  snapshot/delta encode, decode, diff, apply, serialize, deserialize and reuse;
  the compiler rejects a snapshot field without an entry. A new replicated field
  is one table entry plus its `Entity`/`EntitySnapshot` type fields (before ≈16
  edits in four files); the four core fields (velocity, sprite, AI state, position
  header) keep hand-written entity mappings. `entityWireGolden.test.ts`, written against the old code,
  pins SHA-256 digests of 121 encodings (every field alone and combined, nulls,
  edge floats, u32 max, unknown AI state, diff/apply round trips); wire bytes are
  identical. Three codec files 1,926 → 993 lines (1,529 with the new modules); 17
  non-null assertions and 11 casts removed; `binaryCodec.ts` leaves the ratchet.
  Cost: table dispatch is ≈20–70 ns slower per entity per operation (300-entity
  microbenchmark, µs before → after: encode baselines 42 → 59, deltas 31 → 50,
  decode 10 → 28 / 6 → 15, serialize 52 → 72; diff 124 → 92 is faster).
  `streaming:bench --assert-ready` still passes. Generated per-field code could
  recover the difference if a profile ever shows it.
- **Wildlife.** `wildlife/WildlifeKinds.ts` lists the seven native brain kinds in
  the old dispatch order (`isWildlife`, `wildlifeKind`, `wildlifeBrain`);
  `WildlifeSpecies.ts` maps each kind to its AI update and startle
  (`satisfies Record<WildlifeKind, …>`; `startleWildlife` stops at the first kind,
  like the old chains). They replace hand-written chains in `tickAllAI`,
  `WildlifeActivity.isWildlife`, Realm's support-contact list and startle chain,
  `EntityManager.finishPhysics`, ball contact (`BallGameplay`), horn reactions and
  AI planning seeds: adding a native kind went from ≈11 places in 7 files to two
  compiler-checked lines. `AnimalWorkSystem.update` dispatches habitats from an
  ordered table (construction and listener order unchanged). `WorkKit.ts` holds the
  Work-class plumbing that was behaviorally identical (find, nearest-first sort
  with durable-id tiebreak, release, fresh work, home key, protected actor, ground
  support with per-class tolerance, facing, fauna enter); classes keep their own
  `stop`/`cancel`, divergent `enter`/`face` and all decision logic. Nine Work files
  4,063 → 3,789 lines; `tickAllAI` worst 57 → 42. Behavior oracle: wildlife,
  entity, Realm/activity suites and `Fauna.test.ts` (saved poses/populations)
  pass unchanged.
- **Workshop.** Tool entries carry sidebar placement and inbox area; App
  navigation, counts, inbox filters and the manifest `tools` list derive from
  `ToolRegistry`; `ToolPages.tsx` binds dedicated pages by typed tool id with the
  same lazy imports. `build-manifest.ts` runs one ordered `steps` list (call
  sequence diffed mechanically against the old file). Natural-case zoom, camera,
  description, guides and mount lists moved from chains in
  `NaturalLandscapePage.tsx` to `NaturalCasePresentation.ts` (old/new outputs
  compared for all 252 case ids plus `explore`; behavior scenes must declare a
  camera and description and cat scenes zoom 1.4, enforced by `satisfies`);
  `NaturalLandscapeRecipe.ts` is untouched so the
  recipe JSON in fingerprints is unchanged. App.tsx 1,111 → 1,021 lines;
  NaturalLandscapePage 1,035 → 902 lines, worst complexity 255 → 32.
- **Identity coverage.** Code moved out of hashed modules keeps its review
  coverage: `ScenarioRuntimeSource` now also hashes `entityFields.ts`,
  `entityWire.ts`, `WildlifeKinds.ts` and `WildlifeSpecies.ts`.
- **Identity narrowing (phase 1 note) — not done, by decision.** Natural landscape
  candidates are interactive explorer scenes, so they cannot be fingerprinted by
  rendered output, and replacing raw-source hashing with an explicit engine
  revision constant would trade automatic re-review for manual bumps — an owner
  decision. Until then, phase 5 may split hashed modules only while those batches
  hold no human decisions, and must add split-out files to the owning identity
  sources.

Remaining: the `privileged` request list could become a per-entry table flag;
`protocol.ts` still hand-declares optional `EntitySnapshot` fields (could derive
from `ENTITY_FIELDS`); wildlife sites with a different check order
(`predatorAI.alarmPrey`, `WildlifeRespawns.habitat`, EntityManager motion hooks)
need a one-brain-per-entity guarantee before using the registry;
`ProceduralActors`/`NaturalLandscape` copy wildlife components by hand; clip lookup
from art banks is blocked by B6 (`BehaviorArt` loop list disagrees with JSON) and
by `restoreAnimalWorkPose` state→clip allowlists that differ per species; the Work
classes' `update` decision logic (complexity 105–227) is unchanged; inline batches
in `build-manifest.ts` and per-case action buttons in `NaturalLandscapePage.tsx`
are still hand-listed.

Validation: `npm run typecheck`; `npm run check` (Biome warnings only; ratchet
tightened for 19 files, none raised; knip clean); full `npx vitest run` (4,619
passed; the four pre-existing failures plus the `SharedPrediction` flake);
`art:catalog` + `workshop:manifest` — candidate ids, order, tools and batches
identical to HEAD; fingerprints changed only in source-hashed batches without
human decisions (natural-landscapes 1,008, world-geometry 10, character-lab 6,
physics-prototype 1); `npm run build`; `npm run streaming:bench -- --assert-ready`;
`npm run test:smoke` (21 passed; the four pre-existing failures: F3, worker-server
physics settings, rosso-coupe placement, local busy-Worker frame count).

Review: an independent Opus 5.5 high review found no blockers. It re-ran the golden
test against an exported HEAD (digests are the old codec's bytes), confirmed the
44 manifest builder calls, natural-case presentation for all cases, sidebar/inbox
derivations, request reply shapes/timing/privilege checks, wildlife dispatch order
and every WorkKit extraction, and that ratchet entries only decrease. Repairs: the
natural-case table lost HEAD's `behavior-*` camera/description and `behavior-cat*`
zoom prefix fallbacks for future cases — now compiler-required via `satisfies`
(verified by removing one description); the golden test also pins the decoded
object shape (null vs absent; digest computed on HEAD); a malformed privileged
request without an id again answers `requestId: 0`; a comment records that vehicle
facing runs after mirrored fields. Recorded: `ToolRegistry.ts` is in the Workshop
input digest, so navigation-only edits need a manifest run; the semantic golden
path has no vehicle/wander entity (decode/encode digests cover their fields).

### Phase 5 record — split hot regions

Precondition: `npm run workshop:inbox` still showed 0 approvals and 0 change
requests on every source-hashed batch. All splits are moves: tick, send, effect,
listener and draw order, RNG draws and wire bytes are unchanged; new files stay
under the ratchet limits (≤600 lines, every function ≤25 cognitive complexity),
so large functions were decomposed into ordered helpers as they moved.

| File | Lines | Worst complexity | Over-limit functions | New collaborators |
| --- | --- | --- | --- | --- |
| `server/Realm.ts` | 2,145 → 1,357 | 66 → 21 | 4 → 0 | `RealmRiding`, `RealmPhysics`, `RealmCommands`, `RealmComposition`, `RealmPlayerRestore`, `RealmSimulation` |
| `server/GameServer.ts` | 1,714 → 1,019 | 40 → 25 | 3 → 0 | `RealmDirectory`, `SessionRegistry`, `DoorTransitions`, `ResumeDestination`, `ResidentTraffic` |
| `client/GameClient.ts` | 1,746 → 982 | 44 → <15 | 1 → 0 | `ServerMessageRouter`, `PlayInputController`, `WorldSessionActions`, `GameMenuChrome`, `ClientConsoleBindings` |
| `rendering/collectScene.ts` | 432 → 177 | 176 → 17 | 1 → 0 | `rendering/scene/EntitySprites`, `scene/SceneCull` |
| `workshop/App.tsx` | 1,021 → 71 | 28 → <15 | 2 → 0 | `WorkshopChrome`, `WorkshopRoutes`, `ToolRoutes`, `InboxPage`, `RequestPages`, `LoginPage`, `WorkshopSync` |
| `editor/EditorPanel.ts` | 1,292 → 300 | 49 → 20 | 3 → 0 | `EditorPanelWidgets`, `EditorBrushTools`, `EditorTerrainPalettes`, `EditorPlacementPalettes`, `EditorPatternPalette`, `EditorElevationPalette` |

- **Realm.** Riding (mount on landing, dismount, step outcomes, last safe
  position, saved mount) and physics stepping (`RealmPhysics` owns the scene,
  participants, geometry version and environment builder; Realm keeps thin
  delegates and a `physicsScene` getter used by the throw-ball command and the
  active-crowds instrumentation) moved out. `handleMessage` became a
  compiler-complete handler table (`{ [K in RealmCommandType]: … }`) over a narrow
  context, dispatched like the GameServer request table. `loadWorld` is a sequence
  of named steps; a second, identical `saveManager.bind` call was removed. Both B8
  `streaming.update` calls are unchanged. `computeEntityTickDtsMulti`/`decisionDts`
  stay on Realm because instrumentation scripts patch them there.
- **GameServer.** The request table stays the only dispatch path; handlers delegate
  to the new modules. Reply shapes, error texts, `player-assigned` before arrival,
  sync-reply timing, admin checks, operation tracking and B10 forwarding getters are
  unchanged. The duplicated `player-assigned` + `world-loaded` pair is one helper.
  Resume fallbacks gain a few microtask hops (same effect order), as do Realm's
  saved-world placement in `loadWorld` and the rare airborne-over-water respawn;
  ticks are macrotasks, so no interleaving changes. `enter-building` reads the
  return world id before awaiting the interior realm (differs only if the default
  realm reloads during that await).
- **GameClient.** Incoming messages route through one `switch` ending in
  `msg satisfies never`, so a new server message type needs a routing decision
  (reply-only types are listed explicitly). GameClient is the composition root with
  small adapters; every `GameTestHooks`/`__game` member keeps its name and meaning
  (`touchJoystick`, `touchButtons`, `tapMovement` are the controller's instances).
  `ServerMessageRouter.test.ts` pins realm-entry effect order, reload camera,
  buffering and auto-join. Two stateless menu elements are now created at
  construction; `OptionsDialog.css` loads after `WorldMap.css` (disjoint selectors).
- **collectScene.** Stage functions run in the original order; the three per-entity
  linear `find`s (roof support, boat parent, carrying parent) use first-match Maps
  built once per call. A Node characterization test digests the full collected
  output for five variants of a scene that reaches every stage and the reachable
  branches (culling on each edge and mesh bounds, riders on a yawed bus, planar
  shadows, duplicate ids, carried-item depth, emergency lights, native trains,
  partial grass opacity); digests are computed on an exported HEAD. It kills 58 of
  62 single-line mutants of the moved code; the four survivors are equivalent with
  current data (roof-support shift terms, a decal guard unreachable in raster mode).
- **Workshop App and EditorPanel.** App is the shell (state, effects in the same
  order, layout); routes, chrome, inbox, request and login pages are their own
  modules with identical nav, counts, filters and lazy boundaries. EditorPanel
  composes per-section modules; a temporary fake-DOM harness compared 7,774
  snapshots (tree, styles, attributes, listeners, canvas draws) across tabs, both
  interior and outdoor models and every button with zero differences. The three
  Clear-confirm copies are one helper.
- **Bugs fixed.** `GameServer.rejoin` tracked `transitionDone.then(reconnect)`
  without `.catch`, so a throwing reconnect was silently swallowed — now logged.
  The Workshop save status rendered a stray `0` when the native outbox was empty
  (`length && …`). Biome's floating-promise inference newly flagged two un-awaited
  `server.destroy()` calls in `GameServer.test.ts` (now awaited) and a false
  positive in `RealmTransitions.move` caused by a shadowed `resolve` (renamed).
- **Identity coverage.** `ScenarioRuntimeSource` hashes the six Realm modules and
  the two `rendering/scene` modules (which also covers character-lab and natural
  candidates through the runtime digest). `city-audit.mjs` and
  `shared-world-depth.mjs` provenance lists include them too.

Remaining: Realm, GameServer and GameClient are still over 600 lines (mostly
composition: constructors, adapters, `publishState`, `playerData`, `simulate`,
`updateDecisions`; the Realm constructor still duplicates `composeWorld`'s manager
setup); GameServer `handleMessage` (25) and room/pattern edit routing could move
next; `RoofSupport.roofSupport` and `propDepth.depthAboveProps` still scan all
vehicles/surfaces per actor; `scripts/instrumentation/city-audit.mjs` patches Realm
source strings that no longer matched before this phase, and
`city-audit-profile.mjs` reads `realm.traffic`/`realm.railway` and probes
`entityManager.update`, none of which existed at HEAD either. Not started: NaturalLandscape (needs a characterization digest first),
`rendering/` subfolders beyond `scene/`, PlayerPredictor/PlayScene, and
PhysicsScene (last, behind parity tests).

Validation: `npm run typecheck`; `npm run check` (ratchet tightened for 6 files,
three leave the baseline, none raised; knip clean); full `npx vitest run` (4,626
passed; the four pre-existing failures plus `SharedPrediction` flakes, 24/24 alone);
`art:catalog` + `workshop:manifest` — candidate ids, order and batches identical to
HEAD; fingerprints changed only in source-hashed batches without human decisions
(natural-landscapes 1,008, world-geometry 10, character-lab 6, physics-prototype 1);
the art catalog changed only consumer source references (EditorPanel,
collectScene, Realm; two duplicate references merged); `npm run build`;
`npm run streaming:bench -- --assert-ready`; `npm run test:smoke` (21 passed; the
four pre-existing failures); focused Playwright (tap-movement, pinch-zoom,
car-controls, controller-menu, mobile-editor, editor-paint, world-map, play-ideas,
interiors, p2p-menu, realm-physics, tools-index, workshop, workshop-standalone):
65 passed; the pre-existing tap-movement "stops at water" failure in both modes.

Review: an independent Opus 5.5 high review found no blockers and confirmed every
split as a faithful move (22 Realm handler keys vs the old cases, the redundant
`saveManager.bind`, reply shapes and timing, router effect order, `__game` member
identity, first-match Maps, 7,911 EditorPanel DOM snapshots, lazy boundaries, no
value-import cycles, identity coverage through the runtime digest). Repairs: the
collectScene characterization fixture was extended (mutant kills 39 → 58 of 62;
digests re-verified on HEAD); `RenderingBoundary.test.ts` now also guards
`rendering/scene/*`; record wording for the art-catalog diff, the rejoin bug
(swallowed, not unhandled) and the added Realm/door await points; RealmBrowser test
casts use `RealmDirectory`; comments for the router, the `startupMenuRequested`
init order and the `RealmPhysics` field initializer; a shadowed `location` renamed
in `WorkshopRoutes`. Recorded, not changed: test-only casts in
`ServerMessageRouter.test.ts`, unpinned door-motion/horn orderings, and no browser
assertion for the stray-`0` fix.

### Owner decisions applied (2026-11-06)

The owner asked for recommendations favoring simplify/remove and approved them:

- **Workshop identity narrowing** (`43c5fe9b`): engine-driven candidates hash
  recipe/definition + art + `ENGINE_REVIEW_REVISION` instead of ~130 raw engine
  sources; `ScenarioRuntimeSource.ts` is deleted. Fingerprints changed once, only
  in batches without human decisions.
- **B10** (`ea56fc4b`): console commands act in the rcon sender's realm and session.
  The forwarding getters stay as test conveniences (~300 test call sites) but now
  follow the sender.
- **B9** (`ea56fc4b`): keep one gravity per JS realm; rule documented in
  [embedded engine labs](../topics/embedded-engine-labs.md).
- **B8** (`ba075c50`): one interest update per tick; dormant sessions keep their
  neighbourhood resident without contributing a camera range.
- **B6** (`ccdb90d8`): clip looping comes only from art banks; `fox.stalk`,
  `rabbit.eat` and `robin.eat` play once; `red-squirrel.eat` loops via its
  generator.

### Green baseline record (2026-11-06)

Before: push CI had failed since 2026-11-04 (unit, HTTP and smoke), so Pages had not
deployed; the nightly full browser run had failed every night since 2026-10-25
(270 failures on Linux at `e48e0f9a`). Progress per full run: 270 → 196 → 48 → 8.
After `b4789107`, push CI (check, raster, smoke, Pages deploy) passed end to end.

Root causes fixed in product code:

- GPU raster shader inlined the 4-tap actor filter per texture slot (`b4144ded`);
  SwiftShader frames were 81–100 ms. Unfiltered batches use a filter-free program
  (0 differing bytes on Metal and SwiftShader; ~17–24 ms frames) — `12aa2a51`.
- `PlayerPredictor` replay budget read wall time instead of its injected clock;
  `RealmStreaming.ensure()` leaked an arrival interest owner per call (~700 live,
  ~10x slower lab steps) — `4e696c73`.
- Shared Rapier support velocity carried players on fleeing wildlife — `262eafb0`.
- `safeArrival` relocated players resting against walls after reload; scenario
  prop walls were not replicated — `7877d0af`.
- Furniture lab rejected nudges and lost verdicts over resting-contact error;
  generated crossings crashed when world cars blocked the staged car — `8004bb70`.
- Roadkill had no trigger after `8f405aaf`; explorer previews rejected footprints
  over the 128-actor cap — `dcbb1587`.
- Console realm (B10) and dormant residency (B8) as above.

Test-side causes: stale expectations after intentional changes (gradual braking,
relative steering, renamed controls, removed fixtures, Rapier rest heights and
float32 positions); host-speed dependence (5 s waits → CI expect timeout 15 s,
fixed sleeps, D-pad auto-repeat during long simulated presses, wall-clock
budgets); and coverage cost on hosted software WebGL. Coverage policy: behavior,
DOM and networking flows run on Canvas; duplicate GPU variants without GPU-specific
assertions were removed; GPU output stays covered by `gpu-renderer.spec.ts`,
terrain-pacing's upload case, world-geometry cutaway pixels and the Deck default-GPU
case. Native tests default to a 20 s hang deadline.

Open items:

- Resolved: `tests/furniture-motion.spec.ts` back-of-bed sprite case (was `fixme`
  since `b4144ded` drew actors at fractional positions with smoothing). Owner
  decision: the lab follows the game's smoothing. The case now releases keys on
  observed positions, asserts a landing on the bed's back half at its top height,
  and requires ≥95% of the sprite's fully covered pixels to match the idle frame
  smoothed at the same offset; a scratch build drawing the player behind the bed
  scored 0.72–0.79 and failed.
- Resolved (`c63052a1`): door walk-throughs on a starved Worker were rejected
  because the client requested traversal from its prediction while authority
  lagged; the client now waits until authority is within the server's one-tile
  allowance (server check unchanged).
- Train riding stutter (below): owner leaves it as a bounded, host-speed artefact.
- Rapier side effects to schedule: an idle player creeps down ramps (~1.2 px/s);
  a frog hopping against a parked driven car accelerates it backwards; Rapier in
  the main/Worker bundles raised hosted startup (Worker bundle 1.2 → 5.5 MB,
  SwiftShader startup 1.85 → 2.9 s).
- The racetrack `racer:` diagnostics in `NaturalLandscapePage.tsx` are dead code.
- Riding stutter on starved hosts: when a prediction replay spans two updates the
  train/rider display holds one frame and doubles the next (~3.2 px).
  `train-recovery.spec.ts` allows a few such hitches but never more than one frame
  of travel; a fix would advance presentation on its own clock during replays.

### CI time (2026-11-07)

Push CI took ~14 min (serial `npm test` 8.7 min inside `check`) and the full run
~35–50 min (8 per-file shards of 6–32 min, one worker each). Changes: native tests
in a three-way `vitest --shard` job; per-species matrices (Fauna 513 cases, 110 s
locally; PredatorPlacement, MallardResidency, NaturalHunters, OriginalVehicles,
RealmBrowser, AquaticHunters, PredatorRecipe) split into `Name.partN.test.ts`
files over shared `tests-support/*.suite.ts` bodies with deterministic slices (same
1,309 test names); smoke in two shards; the full suite in 12 shards with
`fullyParallel` on CI; behavior cases off the hosted GPU path. Result: push CI
~9–10 min including deploy, full run ~17 min, local `npx vitest run` ~66 s.
Remaining cost: every job spends ~1.5 min checking out the 2.6 GB asset tree
(storage policy, phase 6) and ~1 min installing Chromium/dependencies; vitest
shards balance by file count, not duration.
