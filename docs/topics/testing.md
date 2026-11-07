# Testing

## Local validation

Match validation to the affected behavior and dependencies. Small code changes
should run focused tests and relevant lint/typechecks. Documentation-only edits
need diff review and `git diff --check`, without runtime tests. Report which
checks ran and any material limits in their coverage.

Use `npx vitest run <test-file>` for selected native tests and
`npx biome check <changed-files>` for supported source files. Run
`npm run typecheck` when TypeScript contracts are affected; it also typechecks
tests, specs, captures, TS scripts and configs (`tsconfig.tools.json`). Browser
specs reach the client through `canvas.__game`, typed as `GameTestHooks`
(`src/client/GameTestHooks.ts`); add members there rather than reading private
fields. For a browser-dependent
contract, select the relevant Playwright file and, where useful, `--grep` cases;
build first only when production output is required. Rendering or integration
changes do not automatically require the full browser suite.

Reserve `npm test`, repository-wide `npm run check`, and the full Playwright suite
for broad changes, evidence of wider impact, explicit requests or CI. Broaden
validation when focused checks expose unresolved concerns; do not repeat passing
checks without a relevant change or unresolved concern. CI keeps its existing gates.

Hosted CI renders with software WebGL (SwiftShader), where GPU-mode browser
steps are several times slower. Behavior, DOM and networking specs load
`renderer=canvas` (game) or `renderer=legacy-canvas` (labs, whose default is now
GPU + 3D car); keep GPU variants only for cases that assert GPU output
(`gpu-renderer.spec.ts` compares GPU with Canvas). Playwright assertion waits are
15 s under CI. Reproduce hosted timing locally with Chromium flags
`--use-angle=swiftshader --enable-unsafe-swiftshader --disable-gpu`.

Native tests share a 20 s deadline (`vitest.config.ts`) that only catches hangs:
many open production Realms and run 1–5 s under parallel load, 2–4× longer on
hosted runners. Don't depend on wall time in assertions; inject clocks (the
predictor's replay budget reads its injected clock) instead of raising deadlines.
Per-test overrides may only raise this deadline: the 2026-11-07 predator recipe
suite dropped its stale local 5 s override (aquatic cases take about 2 s alone
and timed out under full-suite load) and keeps its 30 s CI allowance.

## CI and deployment

[186](../tactical/186-ci-reliability-and-deployment-gate.md) owns the 2026-10-23
repair and simplification. Pushes and PRs require lint, types, all native and
HTTP/WS tests, dependency audits, the production build, raster verification, and
27 existing browser cases selected by `playwright.smoke.config.ts`. These cover
launch/pixels, keyboard/controller/touch controls, Worker lifecycle and saves,
mobile editing, vehicle driving/persistence, multiplayer and launcher assets.
Run them with `npm run test:smoke`; no browser tests are deleted.

CI layout (2026-11-07): `check` runs lint, typecheck, audits, Worker checks, build
and HTTP/Node integration; `unit` runs `vitest --shard=i/3` on three runners
(vitest balances by file, so split per-species matrices into short files); smoke
runs in two shards; the nightly/manual full suite runs in twelve shards with
`fullyParallel` on CI so long spec files spread across shards (one worker each).

The 2026-10-24 wildlife delivery follow-up patches Electron to 44.9.1 and
transitive body-parser to 1.20.9 after the existing dependency audit gate fails.
Worker Miniflare pins vulnerable Undici 7.29.1; a scoped `miniflare.undici`
override selects patched 7.30.1 until upstream updates that pin. Both audits
return zero vulnerabilities. Exact pre-upgrade package files remain registered
in the historical replay catalog; 48 replay/mesh checks and eleven Worker tests
plus its dry-run build pass. See [187](../tactical/187-shared-wildlife-finishing.md)
for delivery evidence. Keep the high-severity gate enabled.

The 2026-11-04 Dependabot consolidation in [PR 14](https://github.com/kzahel/tilefun/pull/14)
includes the root dependency group, Node 26 type definitions, Worker tooling and
pinned Actions updates from PRs 5, 7 and 10. Electron retains its own required
Node 24 types in the lockfile. Biome 2.6 adds Markdown support; Markdown stays
outside the existing check scope so frozen review/source records are not
reformatted. Seven benchmark JSON records receive formatting-only repairs.
The constructible Web Audio mock has a scoped React-rule exception, and the
furniture suite registers synchronously. Controller browser cases await game
readiness before menu assertions. The F3 pixel check uses seeded flat terrain
and the opaque actor-edge color, excluding terrain/UI blues from the layer
comparison, retaining the successful polled frame for each baseline. The gem HUD
viewport check exits touch-triggered native fullscreen before resizing. Keep
every existing assertion and the high-severity audit gates.
Local lint, all three typechecks, build, 71 focused native cases, eleven Worker
cases, the Worker dry-run and all eleven affected browser cases pass. Root audit
reports five moderate findings in
the Electron packaging chain and no high/critical findings; Worker audit is clean.
Hosted smoke completed twenty cases without assertion failures before exhausting
its ten-minute suite budget. The CI-only smoke budget is now twenty minutes;
individual test/assertion deadlines, serial execution and failure limits stay
unchanged. All 29 smoke cases pass locally with CI settings in 3.2 minutes.
The first hosted native run passed 6,900 cases and exposed three stale fixture
expectations. The spectator persistence test now selects spectator feature IDs
so two picnic gems do not enter its exact 48/47-person counts. Dense forest
fixtures assert rejection of oversized aggregate queries, then retain their
robin-density and seed-sharing checks through bounded per-chunk queries. No
generator output, runtime caps or gameplay behavior changes. The next hosted
smoke run passed 25 cases, including the repaired overlay/fullscreen cases, then
observed only two render frames during the 350 ms artificial Worker stall. That
existing isolation check now uses a two-second CI-only stall while retaining
the four-frame, authority-recovery and channel-cap assertions. This establishes
thread independence without treating software-GPU speed as a frame-rate target.
The final browser smoke run passes all 29 cases (10.0 minutes hosted), with
raster verification green. Its native run passes 6,897 cases but times out five
aquatic recipe reloads at the default five seconds and the complete art-bank
integrity audit at thirty seconds (53.5 seconds observed). These two existing
test owners now use CI-only allowances of thirty seconds per recipe and two
minutes for the full hash audit; local/global deadlines, the 1,800-step bound,
all saved-pose/population comparisons and every immutable-input hash stay intact.
Hosted CI on the consolidated PR remains the merge gate.

The full browser suite runs at 02:17 UTC daily and through **Actions → CI → Run
workflow**, using eight independent shards. It collects all failures and retains
failure traces/screenshots. Only push validation on main deploys; scheduled and
manual runs never deploy. New revisions cancel superseded runs for the same
event/ref. When full browser validation is warranted, run
`npm run build && npx playwright test` locally.

The old run spent 16.2 minutes in `src/wildlife/Fauna.test.ts` alone; its per-species
production Realm samples and habitat generation are the next native performance
target. Keep semantic coverage while measuring fixture reuse or distribution;
do not add more browser shards to address a native test bottleneck.

Vitest parallelizes and shards native tests by file, so long per-species matrices
are split into sibling `Name.partN.test.ts` files. Each part calls a suite module in
`tests-support/*.suite.ts` with its `import.meta.url`; `testPart` takes a
deterministic round-robin slice sized by the number of sibling part files, so every
case runs exactly once and a numbering gap fails collection. Non-matrix tests stay
in `Name.test.ts`. Fauna, Mallard residency, natural/aquatic hunters, predator
placement/recipes, original vehicles and the realm browser were split this way;
under full local load no native file now exceeds about 21 s (previously 110 s).
Add a part file, not a larger per-file timeout, when a matrix grows past that.

## Coverage and test scope

[169](../tactical/169-wheel-lift-towing.md) adds one distinct Worker/browser towing
boundary for shared controls, save/reload, coupled depth and backend/failed-model
fallback. Native tests own axle/contact qualification across 26 models, actor
ownership, blocked pair movement, chunk arrival order, prediction parity and
nullable uint32 links. The normal game capture also exercises editor entries,
actual GameServer requests, driving, reopening a world and phone release.

Topic: testing

[176](../tactical/176-familiar-animal-voices.md) adds two browser boundaries:
real recording decode/render, keyboard audition and shared lab action playback;
ordinary Worker placement/playback and menu/focus silence. Species/coat coverage,
source/export hashes, voice selection, cooldowns, spatial gain, late-load cleanup
and combined voice limits are covered natively. The current browser collection is
836 cases after [184](../tactical/184-ground-rendering-and-moving-racetrack.md),
with no per-species audio browser matrix or extra CI shards.

Status: browser-suite migration implemented and locally validated, 2026-10-20.

Choose test scope from the failure being prevented. Check existing assertions
before adding a test, including tests with different names or hosts. Prefer Node
unit tests or production simulation/integration tests. An existing browser test
is not a reason to create another one at that level or copy its variant matrix.
Headless Chromium still counts as a browser.

Use [ScenarioSession](gameplay-scenarios.md#headless-integration-usage) for portable
Realm behavior, input/replication codecs and memory-record reloads. Use GameServer
fixtures for world/profile/realm transitions and Node HTTP/WS integration for
server endpoints. These exercise production logic without requiring a page.
Memory persistence does not prove IndexedDB, and manually stepped simulation
does not prove real Worker/event-loop scheduling.

Browser tests should name their browser-dependent contract: actual pixels or GPU
resources, image decoding, DOM layout/focus/input routing, native Worker/RTC/audio
integration, browser persistence or page lifecycle. Keep exhaustive content and
rule variants below the browser where possible, retaining distinct browser
boundaries and required asset-load coverage. Screenshot artifacts without an
expectation are captures, not image regression tests.

Exact paused-scene samples await the host's `authority.clock.running === false`
acknowledgement. Saved-pose comparisons also await reload completion. Fence the
Worker around GPU pixel readbacks so slow screenshots retain the sampled pose;
compare distinct native animation columns and actual changed pixels.

[Audit 157](../tactical/157-browser-test-audit.md) accounts for all 1,724 registered
Playwright cases across 131 files and 403 templates at its source snapshot. It
identifies 162 fully portable cases, 1,105 mixed cases requiring a split, 451 browser
cases and six capture-only cases. These are audit dispositions, not approved
deletion counts; the ledger records partial overlap and outstanding parity work.
The Node baseline is 6,066 cases plus 11 separate Worker-package cases.

[Migration 158](../tactical/158-browser-test-migration.md) owns execution, current
counts and validation. The audit remains a frozen baseline. Reconcile assertions
in existing native owners, close genuine gaps and retain browser boundaries.
Avoid adding redundant native tests merely to replace a removed browser count.

Migration 158 resolves all 403 baseline templates. The default browser lane now
contains 808 cases (53.1% fewer); exhaustive semantic coverage uses existing native
owners with only demonstrated parity gaps added. The other lanes contain one
browser-free comparator, three real HTTP/WS integration cases, and six opt-in
captures. Full CI uses eight browser shards and verifies registered art rasters
once in a separate job. The deployment gate above selects a bounded browser
subset; keep the native/browser boundaries when extending coverage.

Wildlife [159](../tactical/159-foraging-and-lookouts.md) adds seven focused
browser cases, bringing the current browser lane to 815. Six check three new
behavior/animation boundaries in Canvas and GPU: native hopping/feeding,
height-aware tree-perch returns, and upright lookout/alarm presentation with
Worker save/reload. The seventh checks the canonical progress filter and demo
links. Fifteen production authority cases own the food, ownership, interruption,
residency and group-duty semantics below the browser. The 403-template audit
baseline stays unchanged; the migration inventory records the current collection.

[164](../tactical/164-playable-truck-bed.md) adds one focused Worker/GPU/host
lifecycle boundary for the opt-in bed occupant. Bed shapes, yaw, collision,
support, prediction and persistence are qualified in native tests; no per-car
browser matrix or extra CI shards are introduced. The inventory helper now
invokes the installed Playwright CLI with the current Node executable so the
same collection verification works on Windows without an `npx` shell shim.

[167](../tactical/167-tipping-dump-bed.md) extends the existing bed boundary with
articulation, mid-tip reload, disabled/failed meshes and discharge; it adds no
browser cases or CI shards. Native tests own diagonal chunk-seam bounds, inclined
contacts, loose actor identities, drive lock and both spatial indexes. The native
predator recipe save check now compares complete return-queue records by persistent
actor ID, preserving exact field coverage across record enumeration orders.
