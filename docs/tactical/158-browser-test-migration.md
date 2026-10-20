# 158 — Browser-test migration

Status: implemented and locally validated, 2026-10-20. Owner: [testing](../topics/testing.md).

Implements [audit 157](157-browser-test-audit.md) end to end. Preserve that audit as
a dated baseline. Resolve every portable, mixed and capture-only source template,
with existing/replacement native coverage, retained browser boundaries and focused
validation. Browser rows remain unless a concrete duplicate/weak assertion is
established. Commit completed slices; finish with full local validation and green CI.

## Sequence

1. Reconcile food-chain assertions and move comparator self-tests to a genuinely
   browser-free lane, run once by the check job.
2. Move animal ball-command semantics to production Realm/replica tests. Preserve
   real input and audio dispatch: implementation review found frog and robin ball
   bodies assert client croak/chirp dispatch, which the baseline audit missed.
3. Resolve wildlife and vehicle roster matrices against existing native owners,
   retaining distinct real Worker, storage, input and GPU/asset-load contracts.
4. Resolve remaining scenarios, server endpoints, validators and client controllers.
5. Separate opt-in captures and meaningful regressions; remove proven smoke overlap.
6. Measure the residual suite, adjust CI distribution/artifact work where justified,
   run all local checks, push and verify the final commit's CI.

## Execution

Baseline guidance/audit committed as `d32bfa12`. The source audit's inventory checker
is intentionally a baseline checker and will report drift after migrations; current
inventory and resolution evidence belong here, not in rewritten historical counts.

Food-chain: preserve initial count and exact type-list reload in FoodChain.test;
retain the existing live wolf-pack browser case for sound, Pause and Save/reload.
Comparator: retain exactly the same Playwright PNG tolerance/missing-geometry/size
expectations in tests-node, without browser fixtures or browser/server setup.
Focused validation: FoodChain 3/3, browser-free comparator 1/1, real browser
food-chain/interior-approved 16/16, and build passed.

[Resolution ledger](158-browser-test-migration/resolutions.json) tracks all 403
baseline templates: retained browser contracts, completed migrations and remaining
work. Template keys refer to the frozen audit source locations.

Ball commands: all 157 subjects pass a production spawn/throw/codec/Realm/replica
escape/recovery test in 11.76 seconds. Removed 155 state-only browser cases;
retained two focused frog/robin client audio dispatch cases (both pass), with an
actual keyboard-release ball-creation check in the frog case. The original audit's
portable classification for these two complete bodies was too broad; their domain
semantics moved but their browser audio wiring remains.

Predators: reconciled exact interactive recipe feeding pose, frame, remaining prey
and reload for all 48 species (48/48 Node). Added generated-home editor-command
placement/deletion identity coverage (48/48 Node), sharing the bounded generator
fixture with browser representatives. Retained eight land pause/reload cases, four
lagoon cases and three actual editor/IndexedDB cases (15/15 browsers), replacing
144 old cases. Native aquatic parity observes the hunter/fish contract; unrelated
land wildlife can legitimately appear when new chunks become ready on reopening.

Fauna: strengthened existing land/water lifecycle owners to exercise editor commands
and exact deleted/manual identities through reload. The four existing exhaustive
suites pass 1,955 cases. Six distinct presentation/editor representatives plus
scene switching pass 20 browser cases, replacing 461; every species still has
real decoded animation pixel coverage in Animal Browser.

Vehicles: extended the existing 33-family production lifecycle test with signed
forward/reverse turns, stopped pose, binary heading and roof landing. All 33 pass.
All meshes retain real browser decode/draw/failure coverage; mobile lifecycle and
keyboard steering retain three representative families each (100/100 browsers
across authored gameplay, vehicle steering and the additional car-control paths).
Removed 150 repeated browser variants.

Portable validation/artifacts: all eight malformed family animation variants now
exercise the production loader in Node (9 including valid catalog); two actual
error/no-artwork UI paths remain. Historical model GLB/registration and all 45
frozen fit-report rows run in Node (47 cases); all 46 distinct comparison pages
retain browser decoding/layout. All eight manual prey-origin command pairs pass
in Node; one actual Worker/IndexedDB/profile path remains. The combined focused
browser run passed 102 cases. Existing native animal-work and furniture owners
passed in the 58-case scenario run; removed the long animal-work completion wait
and reduced 11 identical Circle controls to two representatives.

All six screenshot-only captures now run explicitly with `npm run screenshots`
(outside default testDir); all six passed. Default interiors retain their actual
bitmap/layout/input assertions. Retired the misleading water-animation nonblack
smoke after comparison with stronger real-frame movement checks. Consolidated
repeated generic smoke cases around readiness/viewport pixels, real arrow/WASD
movement/errors and F3 pixel changes. No screenshot golden references changed.

Shared test-only fixtures live in tests-support, outside broad art-input hashing;
adding a fixture must not invalidate production review identities.

The exact route/grade/shopping owners pass 58 native tests. Removed browser waits
for full inter-city arrival, bridge/tunnel endpoint reversal and post-reload
shopping completion while retaining real input, saved roof ride, client pause,
mesh/terrain readiness, controls and Worker cleanup. The focused integration run
passed 35/35. The existing explorer production message handler now runs all four
generators in Node (4/4); one compiled browser Worker still proves import/transfer.

Standalone server API checks run with real HTTP/WS clients after the build via
`npm run test:http-integration` (3/3). This lane has no browser fixture or auth
bootstrap page. It checks the full current tool URL inventory, protected legacy
APIs, CSRF, inbox and disk writes, and actual binary admin/guest acceptance. The
browser retains login/render/vote, anonymous gate and real RTC/fragment bootstrap.

All 403 baseline templates now have an execution decision. Retained mixed cases
keep their actual browser composition; their native references are supplementary,
not a claim that every assertion has exact native parity. In particular, React
speech-input cases retain real focus, keyboard/pointer cancellation and unmount
wiring even when recognition itself is doubled. Retaining those integrated paths
does not require duplicating their assertions in a new controller abstraction.

Current collection: **808 browser cases**, versus 1,724 baseline (916 fewer,
53.1%). Six opt-in captures sit outside that inventory. One new browser case
replaces the unasserted editor captures with an actual palette/mouse stroke →
Worker authority → changed terrain replica check (passes). Final local evidence
and the required exact-commit CI gates are recorded below.

CI uses eight browser shards for the reduced suite. Registered candidate raster
verification runs once in a separate required job instead of sixteen times.
Retain per-shard builds: the local dist is approximately 604 MB, so distributing
that artifact to every shard adds substantial transfer work to avoid a small
build. Measure the final run rather than assuming case count predicts runtime.

Full-unit follow-up: two baseline Workshop service timeouts reproduced. Tests now
compute the real unchanged source digest once and reuse it across fixture/service
restarts; all 13 focused cases pass without raising timeout limits. Updating test
scripts also exposed eight historical vehicle receipts pinning package.json.
Retained its exact original bytes in the existing replay-input catalog rather
than rewrite receipts; all 66 mesh/receipt cases pass.

Full-browser follow-up: the latest baseline CI had two independent failures.
Resource thumbnails looked up twig/nut/fruit as separate spritesheets even though
they share the forage sheet. The editor now resolves the entity's registered
sheet and initial clip column; the existing desktop/phone tests still compare
actual thumbnail pixels with independently decoded source frames. The mobile
Animal Browser test now scrolls the intentionally lazy preview into view before
expecting readiness. Both picker cases, mobile navigation and actual mouse terrain
editing pass (4/4); no timeout increases or golden changes. Refreshed generated
inventories: art-catalog changes only source line references and workshop-manifest
changes only inputDigest; all 1,840 candidate records are unchanged and their
registered raster identities verified by normal manifest generation.

## Final validation and handoff

All 403 original templates have an execution decision: 352 retained and 51
resolved; zero pending. The migration verifier passes and fingerprints the current
808-case browser lane, one browser-free comparator, three HTTP/WS cases and six
opt-in captures. Its baseline accounting stays separate from frozen audit 157.

Full local validation on the resulting implementation:

- `npm run typecheck`, `npm run check`, and `npm run build`: passed. Lint has
  zero errors; its existing 120 warnings and 37 informational diagnostics remain.
- `npm test`: 6,387/6,387 Vitest tests in 347 files (458.40 seconds), plus the
  unchanged browser-free PNG comparator (1/1). The baseline was 6,066 tests in
  341 files: 321 demonstrated native coverage gaps added, rather than 916 nominal
  replacements for the removed browser cases.
- `npm run check:worker`: all 11 Worker-package tests and deployment dry build passed.
- `npx playwright test --workers=2 --reporter=list,json`: 808/808 passed in
  31.3 minutes, with zero skipped, unexpected or flaky cases. Summed local test
  durations were 62.2 minutes; these are local measurements, not a comparison
  with differently provisioned GitHub software-GPU runners.
- `npm run test:http-integration`: 3/3 passed against isolated real standalone
  subprocesses; explicit capture lane: 6/6 passed.
- `npm run art:catalog`, `npm run workshop:manifest`, and the exact CI command
  `npm run workshop:manifest -- --verify-raster`: passed. All 1,840 registered
  candidate identities match in normal Chromium at retina scale; the last command
  writes no manifest. Reviewed pixels, immutable receipts and golden references
  were preserved.
- Main and Worker `npm audit --audit-level=high`: zero vulnerabilities.

The final handoff gate is the exact pushed commit's [CI checks](https://github.com/kzahel/tilefun/actions/workflows/ci.yml):
check, raster, all eight e2e shards and deploy must succeed. GitHub's checks attached
to that commit are the authoritative CI record; no documentation-only follow-up
commit should bypass that final gate. Compare actual job durations with audit 157's
historical baseline when evaluating savings, rather than extrapolating case counts.

First CI follow-up: [run 39411558703](https://github.com/kzahel/tilefun/actions/runs/39411558703)
finished with one failure: a room-editing test's final keyboard traversal overshoot
on shard 7. All other seven browser shards, raster and check passed. The
expanding positional poll could hold Left through an entire door activation zone
and then accept any farther-left position, leaving no Return button to click.
The test now samples actual control visibility at frame-sized intervals and
releases Left in a finally block. It preserves real keyboard travel and the
actual exit click; no product behavior, timeout or assertion scope changed.
Five consecutive focused runs with CI settings passed, followed by the entire
affected shard in the same single-worker CI mode (97/97 in 6.2 minutes). Typechecks,
lint and migration inventory verification also pass. The full local 808-case
run above predates this test-only synchronization correction; final exact-commit
CI remains the authoritative cross-platform validation of the correction.
