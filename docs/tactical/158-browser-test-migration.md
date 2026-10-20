# 158 — Browser-test migration

Status: in progress, 2026-10-20. Owner: [testing](../topics/testing.md).

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
Worker authority → changed terrain replica check (passes). Complete final local
and exact-SHA CI validation remains before completion.

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
