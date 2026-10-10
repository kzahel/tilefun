# Robin search CPU and allocation

Status: complete, 2026-10-10; physical performance A/B remains follow-up.
Owners: [performance](../topics/performance.md), [wildlife](../topics/wildlife.md).

The attached Pixel 7a investigation records expensive robin decisions in a
242-actor countryside world, including 221 robins. This slice optimizes shared
robin search without changing population, sleep interest, AI scheduling, saved
RNG, motion, contacts, clips or art. Broader budget/sleep work remains separate.

## Scope and validation

- Avoid whole-entity copies at path samples; occupancy needs only collider and
  proposed feet height. Do not mutate the persistent bird to test a route.
- Defer perch queries during timer waits when no player is close enough to cause
  an alarm. Query current crowns whenever a decision or close approach needs them.
- Compare native and optimized decision traces/RNG/occupancy inputs, and cover
  moved/removed crowns, alarm distance, recover and idle timer boundaries.
- Measure original/optimized shared code sequentially on the phone in isolated
  worlds, with bounded instrumentation and thermal readings.
- Run typechecks, full units, lint, build/browser regressions and streaming
  readiness. Shared Realm changes reach both game and embedded labs.

## Evidence and remaining work

Shared `updateRobinAI` now borrows one geometry-only body per decision and updates
its proposed height for each synchronous collision query. It no longer copies
every actor field at every three-pixel sample. `WildlifeEnvironment.canOccupy`
explicitly accepts collider/feet-height geometry; other species can still pass
their existing actors. No trial height is written into persistence.

During a timer wait, recover state or the absence of any player within 26 pixels
allows skipping crown discovery. A nearby player still uses the current crown
list to distinguish perched 12px versus grounded 26px alarms. Expired timers query
current trees; movement/support tracking still handles edits independently.

[Recorded decision measurements](../benchmarks/robin-search-optimization.json):
480 cases across 32 generated birds, five states, three timer schedules and four
player distances match the original `2d8248e` algorithm's complete saved actor
state/RNG and all **55,740 occupancy point/height samples**. A separate warmup and
six rounds without trace allocation reverse original/optimized lane order.
On Apple M4 Pro, median round CPU falls **250.8 → 146.2 ms (41.7%)**, and decision
p95 across these mixed fixtures falls **2.75 → 1.54 ms**. These are headless
decision measurements with observed actors/native terrain/prop queries; they
exclude full server scheduling, movement, rendering and IndexedDB. They do not
establish the phone's new search or whole-tick latency.

Two phone comparison attempts produced no completed captures: native Chrome was
backgrounded, causing New World/CDP timeouts. Own tabs and USB routes were removed;
the user's other app was left alone. `mobile-authority --robin-reference=PATH`
allows a future isolated native A/B; keep Chrome foreground during capture.

Focused regressions cover idle/recover timer fast paths, exact timer expiry,
current/removed crown alarm classification and elevated occupancy without actor
copies or mutation. All **2,108 units**, typechecks and lint pass; existing lint
warnings remain. Catalog/build manifest was refreshed: all **761 candidate
records are identical**, only the broad source digest changes. Build passes.
All **seven focused browser checks** pass: Canvas/GPU grove flight/perching,
contact and frozen trajectory reload, ordinary balls, durable manual deletion,
shared authority lifecycle and Worker disposal. The standard six-phase
`streaming:bench -- --assert-ready` gate passes with zero final missing,
incomplete or stale terrain and no browser errors. Its low-population city scene
does not establish countryside or phone CPU headroom.

The required production-table refresh was attempted after persisting this progress,
but `status.mjs` cannot read the ignored campaign `progress.json` in this checkout.
The last committed art table remains intact; no campaign state/receipt was invented.

Individual route searches remain synchronous and still test the same candidates,
neighbors and three-pixel paths. Sleeping, resumable decision budgets and cheaper
collision/support queries still need their own implementation. This first slice
is deliberately behavior-preserving; no population or animal art was changed.
