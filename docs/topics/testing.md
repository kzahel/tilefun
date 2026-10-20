# Testing

Topic: testing

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
captures. CI uses eight browser shards and verifies registered art rasters once
in a separate required job. Keep those boundaries when extending coverage.

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
