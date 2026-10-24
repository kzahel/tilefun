# Testing

## CI and deployment

[186](../tactical/186-ci-reliability-and-deployment-gate.md) owns the 2026-10-23
repair and simplification. Pushes and PRs require lint, types, all native and
HTTP/WS tests, dependency audits, the production build, raster verification, and
27 existing browser cases selected by `playwright.smoke.config.ts`. These cover
launch/pixels, keyboard/controller/touch controls, Worker lifecycle and saves,
mobile editing, vehicle driving/persistence, multiplayer and launcher assets.
Run them with `npm run test:smoke`; no browser tests are deleted.

The full browser suite runs at 02:17 UTC daily and through **Actions → CI → Run
workflow**, using eight independent shards. It collects all failures and retains
failure traces/screenshots. Only push validation on main deploys; scheduled and
manual runs never deploy. New revisions cancel superseded runs for the same
event/ref. Full local validation remains `npm run build && npx playwright test`.

The old run spent 16.2 minutes in `src/wildlife/Fauna.test.ts` alone; its per-species
production Realm samples and habitat generation are the next native performance
target. Keep semantic coverage while measuring fixture reuse or distribution;
do not add more browser shards to address a native test bottleneck.

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
