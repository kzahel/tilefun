# 095: Automatic game fault reports

Owner: [Game diagnostics](../topics/game-diagnostics.md).
Status: complete.
Date: 2026-10-10.

## Scope

User authorized automatic error uploads after the local-server recovery investigation.
Reuse the existing Workshop backend, retain pending reports across reload and
expose diagnostics privately to the owner. Detect a silent local authority failure
without confusing a hidden/suspended page with a crashed Worker.

Delivered: shared report whitelist; same-origin anonymous, byte/rate/capacity-bounded
intake; atomic private files and idempotent UUID retries; bounded browser events,
session deduplication and durable outbox; fatal and typed RPC timeout collection;
out-of-band Worker probes with tick/residency summaries and visibility-aware watchdog;
owner Workshop diagnostic list/detail/deletion.

## Validation and evidence

Focused unit tests cover upload acknowledgments, offline/reload, storage denial,
report/event/UTF-8 bounds, multi-tab outbox merging, absent replies vs frozen ticks,
suspension/visibility grace, server authentication/CSRF/origin validation,
whitelisting, idempotency, size limits and rate limits.

Browser tests inject a real Worker rejection and verify original stack/context in
the owner inbox; abort upload, reload and verify the same UUID reaches the API;
block a real Worker and verify watchdog termination, hang upload and Reload recovery.
The blocked-Worker test pauses main-thread input to isolate the watchdog: ordinary
active play hits the existing channel bound earlier, and that fatal error is reported.
The first browser pass confirmed this earlier queue bound rather than a watchdog
bug. Original lake-travel, independent rendering, save/reopen and lifecycle checks
remain in the regression suite.

The first isolated-watchdog run uploaded its hang report but immediate Reload
failed with “World is already open in another authority.” A separate minimal
Chromium Worker holding a Web Lock reproduced delayed release after termination
while busy; an idle terminated Worker released immediately. The browser adapter
now queues writer acquisition for at most five seconds with AbortController,
then rejects a competing writer. It never steals a lock. Unit checks verify both
delayed handoff and the competing-owner deadline. The final synthetic hang test
passes (33.3 seconds including watchdog/reload); all 12 fault-report, Worker,
map and standalone browser checks pass against the final rebuilt client.

Final validation: all 2,290 unit tests (240 files), typechecks, lint (existing
118 warnings/34 infos), inventory generation and production build pass. The broad
browser run completes 542 checks: 538 pass, with four initial failures. Two are
the earlier hang/lock race and a standalone manifest cached before source/manifest
refresh; both pass against the final build. Existing fish ball-interaction and
Canvas tap-target timing assertions also fail once without a crash/error screen;
both pass three serial repeats each (six checks, one browser worker). All initial
browser failures pass final reruns; the broad run itself was not repeated.

`streaming:bench -- --assert-ready` passes cold, standing, walk, sprint, reverse
and zoom-out with zero missing-data/incomplete-cache frames and no fixture errors
or failures. The report is `/tmp/tilefun-telemetry-streaming/report.json`.
This validates readiness; it does not establish phone timing or the original
failure's cause. Final `git diff --check` passes. Owned test browser/server
processes are reaped, including the orphan standalone child from its earlier
manifest-related timeout. The live fault endpoint was checked read-only and
requires Workshop login for diagnostics; no synthetic production report was sent.

No production deployment is performed by the tests. All test server data and auth
are isolated under test-results or temporary directories; browsers are bundled
Playwright Chromium and are reaped when runs end.
