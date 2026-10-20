# Testing

Topic: testing

Status: browser-suite audit complete; migrations and CI changes pending, 2026-10-20.

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

Next: reconcile the food-chain matrix's small assertion differences in its existing
native owner, then close the all-profile ball-command gap and move those matrices
to Node. Retain shared browser pause/reload,
input, rendering and storage boundaries. Follow the audit's staged plan and update
its decisions as migration evidence becomes available. Avoid adding redundant
native tests merely to replace a removed browser count.
