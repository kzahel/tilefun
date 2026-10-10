# Rotated vehicle collision benchmark

Status: complete, 2026-10-10.
Owner: [performance](../topics/performance.md).

The user authorized the recommended deterministic AABB-versus-rotated-body
benchmark, desktop/physical-phone comparison and a commit. Gameplay still uses
cardinal colliders; continuous visual mesh orientation remains cosmetic.

## Prototype and measurement boundary

`src/diagnostics/VehicleCollisionBench.ts` has no gameplay consumer. It supplies
an XY oriented rectangle with vertical interval filtering, enclosing AABBs for
the native SpatialHash, four-axis separating-axis intersection, roof-local point
transforms and sampled translation/rotation sweeps. Dimensions are 56x20x24;
this is a representative compact-car proxy, not the complete approved directional
geometry bank. The nearest-cardinal control omits production facing hysteresis.

Both policies consume identical prescribed center/yaw traces, nearby bodies,
roof occupant positions and sweep subdivisions. Each 64-step trace completes
one full turn on a 30x22 ellipse. This intentionally exercises continuous turning:
if interpreted at 60Hz it is approximately 176px/s peak translation and 338°/s
rotation, rather than ordinary 36px/s traffic. Every vehicle step has three body
probes; roof scenes add two world-upright 10x6x16 occupant probes at each pose.
The vehicle footprint is the whole roof proxy. No roof support/landing or contact
response solver is implemented. Verdicts never change routes, preserving equal
work even when the two shapes accept different contacts. The AABB control also
pays the angular sampling cost, so the comparison isolates shape/query overhead;
it does not estimate the extra probes required relative to shipped cardinal
movement.

Sparse cruise has 32 small obstacles; tight turns have 256 wider obstacles;
roof scenes use the dense layout with every third obstacle tall enough to block
a passenger. Obstacles are static entity proxies using native chunk-sized entity
queries, not production prop/tile indices. All nearby candidates are counted;
all broad-overlapping/Z-overlapping candidates are checked without early exit.
The body/obstacle dimensions and candidate outcomes are intentional synthetic
workloads, not generated-city traversal. Counts are 1/8/32/128 vehicles; 32 is the
current traffic cap, and 128 is an explicit overload test.

The dedicated Worker lane checks all vehicles once per step. The main-thread
lane refreshes nearby proxies once and checks one controlled vehicle six times
per step, representing a bounded replay demand. Both include geometry preparation,
index refresh, candidate allocation/filtering, shape tests and diagnostic counters.
They do not invoke GameServer/Realm, PlayerPredictor, actual input history,
replication, AI, streaming, persistence, rendering or mesh triangles. These costs
cannot be added to old whole-tick p95 measurements or described as full-server
or prediction headroom.

The sweeps bound sampled translation plus angular corner travel to 4px and reject
more than 32 subdivisions. They are not continuous collision detection; thin
obstacles can fall between samples. Full yaw is represented as unwrapped angles,
not shortest-path interpolation across a wrap. Pitch/roll/tumbling are excluded.

## Runner and calibration

```sh
npm run vehicle-collision:bench -- --output=/tmp/tilefun-vehicle-collision
npm run vehicle-collision:bench -- --counts=1,32 --samples=12
```

The browser runner owns a minimal Vite page, module Worker and bundled full
Chromium, reaped on completion. Physical `--cdp`/`--port` uses only an owned tab
on the native phone browser and disconnects without stopping Chrome. No browser
storage or game worlds are written. Private USB endpoints/selectors and prior
foreground app stay out of the committed report.

Three warmup traces precede adaptive equal-cycle calibration targeting at least
25ms for the faster policy (up to 1,024 traces). Twelve measured paired batches
alternate A/B and B/A. Each batch starts at the same trace origin and verifies
identical deterministic work counts/checksum afterward. Work count instrumentation
is inside the timer; JSON validation and between-pair yields are outside it.
Percentiles describe batch-amortized milliseconds per trace step, not individual
tick percentiles. Twelve batches are insufficient to characterize rare tails.
Raw batch durations and cycle counts remain in the report.

Idle-page rAF cadence, page timer precision, hardwareConcurrency, viewport,
CPU/device/OS, browser, revision/dirty state and executable source hashes are
recorded. This calibrates sampling and display context; it supplies no normalized
CPU capacity score or universal timing threshold. Desktop is headless; display
cadence there is the headless browser's callback cadence, not the physical panel.
Worker timer precision can differ from the page timer measurement; adaptive
batch calibration executes in the measured Worker itself.

## Correctness evidence

Fifty-five tests cover 4,096 seeded OBB pairs against an independent convex-polygon
clipping/area oracle, symmetry, enclosing bounds, cardinal agreement with native
AABB overlap, exact touching and Z boundaries, empty diagonal bounding-box corners,
a rotation-only collision between clear endpoints, sweep budget refusal and a
roof passenger rotating into tall clearance while avoiding ground-only bodies.

All 48 scene/policy/lane/count traces compare native-index narrow-test/hit counts
against all-proxy brute-force queries and repeat exact indexed work counts/checksums.
These include negative coordinates, cell-spanning turning footprints and roof
heights. A timing-runner check verifies paired trace stability without imposing a
machine-specific speed gate. Browser smoke exercises both module Worker and
main-thread lanes in bundled full Chromium.

## Device measurements

[Sanitized evidence](../benchmarks/096-rotated-vehicle-collision.json) contains
two captures per device, 24 cases per capture and twelve alternating policy pairs
per case. The second capture reverses count order (128/32/8/1). All 96 cases have
zero page errors and exact matching work counts/checksums across devices/repeats.
All six executable input hashes match. The base is b3077ad plus this diagnostic;
no production runtime source changed between measurements.

Desktop: Apple M4 Pro, macOS arm64, bundled full headless Chromium 153.0.8010.12.
Phone: physical Pixel 7a, Android 17, native Chrome 154.0.8037.126, charging, no
CPU throttle. Phone battery temperature spans 30.0–30.8°C, with thermal status
zero throughout. Idle-page cadence is about 16.7ms on both devices; page timer
quantum is about 0.1ms. Adaptive calibration targets 25ms but measured batches
can become faster afterward; the shortest accepted batch is 17.6ms. Timings are
not deadline/cadence measurements, and the phone browser differs from desktop.
No tests or profilers ran concurrently with the timing captures. The owned
Worker/tab/server and USB routes are released, the prior foreground app is
restored, and the phone doctor remains ready.

Median **batch-amortized ms per step** at 32 cars; ranges span the two captures:

| Device / Worker workload | Cardinal AABB | Yaw OBB |
| --- | ---: | ---: |
| M4 Pro, sparse cruise | 0.041–0.042 | 0.044–0.046 |
| M4 Pro, dense turns | 0.124–0.125 | 0.129–0.132 |
| M4 Pro, roof occupants | 0.342–0.353 | 0.352–0.364 |
| Pixel 7a, sparse cruise | 0.103–0.107 | 0.110–0.111 |
| Pixel 7a, dense turns | 0.287–0.288 | 0.299–0.311 |
| Pixel 7a, roof occupants | 0.744–0.764 | 0.772–0.805 |

Paired Pixel median overhead is about 4–8% for dense turns and 4–5% for roof
occupants at the current cap. The roof scene's six-replay main-thread lane,
with 32 nearby cars and only one controlled car, is 0.217–0.227ms AABB versus
about 0.230ms OBB; desktop is 0.093–0.095 versus 0.097–0.098ms. At the explicit
128-car overload, Pixel Worker roof work is 3.827–3.881ms AABB versus
4.308–4.320ms OBB (about 11–13% overhead). This is modeled collision demand,
not real client replay or production traffic throughput.

For the 32-car dense Worker trace, both policies perform 6,144 body probes.
Returned broad candidates rise 221,810 → 239,856 (about 8%); narrow tests rise
6,248 → 8,446 (about 35%). OBB rejects 1,616 of those enclosing-box intersections.
The roof scene performs 18,432 total queries; broad candidates rise
589,012 → 613,599 (about 4%). Geometry verdicts deliberately differ, so equal
shape decisions are not an acceptance condition. The candidate increase supports
keeping precise narrow-phase tests behind broad rejection; it is no CPU-stack
attribution of the whole game.

The small marginal shape cost at 32 cars supports proceeding with a bounded
shared-engine yaw pilot. It does not establish full-feature headroom: angular
query count versus shipped movement, response/ground support, actual replay and
other server work are excluded. Some tiny cases vary more between captures
(e.g. one-car sparse main replay), reinforcing the lack of a universal timing
gate. Two short captures do not establish sustained thermal behavior, lower-end
phones, iOS, rare GC tails or a usable all-angle visual asset.

## Validation and next work

All three typecheck projects, all 2,345 unit tests in 241 files, lint and the
production build pass. Lint retains 118 existing warnings and 34 infos. The 55
new tests pass under the normal per-test deadline. The initial combined 48-case
oracle exceeded that deadline during the full concurrent suite; splitting it
into independent parameterized cases fixes the test boundary without weakening
the oracle or raising global timeouts. Invalid CLI populations, sample counts
and physical-port options refuse before opening a browser.

The new diagnostic source participates in Workshop's intentionally broad source
digest. Manifest regeneration verifies all 761 identities in headless-shell and
bundled full Chromium at retina scale. A whole-manifest comparison excluding
`inputDigest` is byte-equivalent after JSON decoding: all candidates, batches and
tools stay unchanged. Only that digest refresh is committed. Art catalog and
promoted vehicle bank checks pass without regeneration. There is no gameplay
runtime, renderer, recipe, input, asset or approval change; game browser/streaming
suites are not rerun for this isolated diagnostic. The four native benchmark
captures exercise the new browser/Worker runner and its cleanup. Final executable
source hashes still match every timing capture.

Next: integrate a single yaw-body pilot through shared vehicle movement,
authoritative heading replication, collision queries and player prediction.
Define rotation-only contact response and roof-local support/carry/landing first;
keep game and embedded labs on the same engine owners. Validate corners, angular
sweeps, roof riders and save/reload, then use native whole-game authority and client
profiles on matched device runs. This benchmark does not authorize an all-angle
art promotion, a new physics library or changes to existing approved bodies.
