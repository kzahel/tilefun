# Local server, map and water travel investigation

2026-10-10. The user reported intermittent map requests showing “Reconnecting…”
and traversal reaching unloaded chunks, possibly after travelling into a lake.
The original device, world seed, destination and failure have not been captured.
The root cause remains open.

## What the code establishes

- `WorldMap.refresh` used “Reconnecting…” for every rejected map request. This
  includes ordinary request errors, a 30-second request timeout, and requesting
  the map while travel is still running. It is not a Worker health indicator.
  The label now says “Map unavailable”; the detailed request error remains shown.
- `SafeArrival` readies a seven-by-seven chunk neighborhood outdoors and checks
  the requested point followed by rings through 32 tiles. Unsuccessful searches
  throw a normal travel error. `RealmTransitions` clears `transitioning` in a
  `finally` block; destination validation happens before removing the source
  player. `GameServer.respondToTransition` returns request errors to the client.
- The search is spatially bounded, but its readiness and persistence awaits do
  not have wall-clock deadlines. `RealmStreaming.ensure` waits for all pending
  residency operations, including operations outside the requested range.
  A stalled IO operation can delay travel without throwing a tick exception.
  This is a remaining investigation path, not an observed cause of this report.
- Runtime tick errors, malformed transport traffic, Worker errors and unhandled
  Worker promise rejections fail the local transport and terminate that instance.
  The existing full-screen error overlay offers Reload. There is no automatic
  authority restart. A browser page reload restores the last acknowledged saved
  state; it cannot recover unsaved state from a terminated Worker.
- Ordinary chunk read/publication/save failures are caught by `ChunkResidency`
  and retained for retry. Missing chunks can therefore occur while the Worker
  still ticks. A storage or residency failure is distinct from a fatal Worker
  exception. Browser lifecycle pause is another distinct state.

## Delivered diagnostic changes

The local Worker failure packet now carries its original stack. The transport
retains that error for `getDiagnostics()` after failure, and subsequent game
requests reject immediately with the cause instead of silently sending nothing
and waiting for the request timeout. Pending requests still reject on disconnect.

The existing `storage_stats` console command and Worker persistence diagnostics
now include loading/ready/saving/failed holder counts, demanded chunk count,
in-flight operations, last residency error and transitioning-player count. The
last error is historical; a non-null value alone does not establish a current
failure. These snapshots are collected on demand, not in the tick loop.

## Reproduction and evidence

`tests/worker-server.spec.ts` uses the actual local authority Worker, IndexedDB
and client replica in an isolated bundled Chromium context. The new water-travel
case creates regional seed 2026, travels to the center of `pond:1:-2`, verifies
safe dry-ground arrival, then attempts the open-water destination (-4000, -4000).
It repeats this three times, interleaving map opening and distant arrivals at
(300, 519), (1300, 519) and (2300, 519). After rejected water travel, authority
ticks advance, the map settles with the player roster and the next destination's
visible chunks load. This did not reproduce the reported failure.

A separate browser case injects an unhandled rejection into the actual authority
Worker and checks the fatal overlay, original authority stack and successful map
loading after Reload. This controlled failure proves the explicit recovery path;
it does not identify the user's original exception. Unit coverage checks pending
and subsequent request rejection, preserved failure diagnostics, and residency
failure diagnostics alongside existing publication rollback/retry behavior.

Validation on the working checkout (including pre-existing touch-control edits):

- Typechecks and production build pass. Lint passes with existing warnings.
- All 2,192 unit tests pass; the final transport refinement also passes its nine
  focused lifecycle tests.
- The full browser run passes 529 cases. Its two initial failures were the new
  recovery fixture forgetting to Resume after reloading its generation-handoff
  URL, and a Workshop manifest freshness mismatch after the transport changed.
  After correcting the fixture and regenerating/building final inventories, all
  eight Worker, map and standalone Workshop rerun cases pass, including both
  previously failing cases.
- `npm run streaming:bench -- --assert-ready` passes with zero missing-data or
  unfinished-cache frames across cold entry, standing, walking, sprinting,
  reversal and zoom-out. This is isolated desktop evidence, not a reproduction
  or performance guarantee for the user's device.

## Next evidence needed

Capture the affected device/browser, world generation identity, destination,
visible error text and whether the fatal overlay appears. While the Worker still
responds, `storage_stats` distinguishes readiness failures or pending travel from
normal residency. Two Worker diagnostic snapshots can establish whether authority
ticks advance and whether the host is hidden. If requests stop responding entirely,
capture browser console/Worker errors and the first overlay's Details before
reloading. A targeted slow/stalled-storage reproduction should precede changing
readiness deadlines or recovery policy.
