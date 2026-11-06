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
