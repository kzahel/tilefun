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
