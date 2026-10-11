# 124: Native city workload profile

Status: profile complete; city-specific server and renderer proposals, no runtime optimization shipped.
Date: 2026-10-11.
Owner: [performance](../topics/performance.md).

## Scope and method

Zoom out from 123's held dog crowds to ordinary generated-city traffic,
pedestrians, streaming, persistence, player driving and GPU rendering. Production
source is a frozen `c051a98` archive, excluding concurrent browser-test changes.
Diagnostic Vite transforms expose only the owned authority and timing/count hooks;
production simulation, publication, prediction, rendering and generation stay unchanged.

The reusable [city audit](../../scripts/instrumentation/city-audit.mjs) runs a real
fresh game, dedicated Worker and IndexedDB at seed 2026. Gateway arrival is the
existing city-center inspection `(300,519)`; core uses the same plan's central
north/south extent `(300,479)`. Generated traffic stays enabled. Standing,
walking, driving, warmed overview and zoom entry are separate. Four seconds of
warmup precede eight seconds of client frames. Authority reset precedes input
setup and its read follows client sampling, so its window is slightly longer.
Phase timers are inclusive; percentiles cannot be summed. Population snapshots
outside measured ticks every 30 ticks add diagnostic overhead too.

Driver setup stops and boards an existing horizontal-route car through the native
VehicleControl owner. Subsequent movement uses ordinary keyboard or native phone
touch joystick. Arrival loading/spawn progress can select a different model,
lane and neighborhood; selection prefers heading then X distance, not a fixed
road. Actual model/lane/pose, views and populations are retained. These are workload
profiles, not fixed-density matched before/after controls. The explicit compact
variant replaces that one car through the production factory without increasing
the count. Native models in these captures use sprite fallbacks; GPU/mesh mode
alone does not prove actual GLB draws.

Desktop uses isolated full bundled Chromium at 411×789 CSS pixels/dpr 1. Physical
Android uses its native 411×789/dpr 2.625 viewport and GPU renderer. Runners close
owned tabs, Workers, servers and isolated origin data. Phone routes are removed,
original routes preserved and the prior foreground app restored. Raw controller,
browser and host-identifying state remains temporary. [Sanitized evidence](../benchmarks/124-city-workload-profile.json)
retains all 30 cases across 11 runs, source/probe hashes, CPU summaries, timings,
counts, duration distributions, slow-frame/tick overlaps and failures.

## Ordinary city and camera residency

The gateway discovery has 12 cars, 13 resident route pedestrians and seven active
pedestrians. Core standing has 12 cars, 17 resident/13 active pedestrians and
about 25–26 active actors total. This is the current generator's modest population,
not a benchmark of hundreds of nearby people. Core overview driving at 0.05
loads surrounding city/landscape props and sleeping fauna: the final shallow
controls have 207–213 resident actors and 708–740 props, but only 14 active actors,
nine active route pedestrians and four active cars. Camera residency does not
activate the whole city. Different selected roads in the census reach 1,064–1,109
props; these are resident props, not that many buildings.

Seven shallow core controls reverse motion order after zoom entry. Their server
and renderer means (milliseconds):

| Desktop workload | Server mean | Server p95 | Render mean | Render p95 |
| --- | --- | --- | --- | --- |
| Standing, two controls | 0.754–0.792 | 0.9–1.1 | 0.218–0.222 | 0.3 |
| Normal-width driving, two controls | 0.769–0.963 | 1.0–1.3 | 0.267–0.298 | 0.4 |
| 0.05 overview driving, two controls | 1.762–1.858 | 2.7–3.0 | 2.334–2.448 | 4.4–4.6 |
| 1→0.05 zoom entry | 1.352 | 1.7 | 2.307 | 4.5 |

All final shallow drives cover about 874px, authority stays near 60Hz and rAF p95
is 16.7–16.8ms. Warm overview driving submits about 617 raster draw calls/frame
versus seven in core standing; its capture still includes newly streamed/uploaded
terrain during travel. Renderer timing is CPU submission, not GPU execution or
displayed presentation. The two normal-width drivers use different populations
(one starts with 232 props, the other 51); do not assign their difference to an
optimization. Readiness is enforced before warmed captures. Zoom entry starts
from prepared normal-width terrain and intentionally measures new preparation;
there is no every-frame missing-terrain acceptance claim.

Two separate explicit compact-1 controls exercise 27,048 actual mesh draw calls
over 483 GPU frames each (56/frame), cover about 874px and retain 16.7ms rAF p95.
Render mean is 0.419ms normal-width and 2.761ms overview, while server means are
0.763/1.720ms. This exercises one authored car on desktop, not a fully meshed fleet
or physical-phone mesh-city acceptance.

## Physical phone limits

The exploratory gateway captures use the same <=32°C/status-zero entry and
post-setup gate. Their end readings distinguish usable diagnostic controls from
the thermal-affected lane:

| Phone workload | Server mean/p95 | Render mean/p95 | rAF p95 | Entry→end thermal |
| --- | --- | --- | --- | --- |
| Normal-width native driving | 4.741 / 7.7ms | 1.723 / 3.4ms | 16.7ms | 31.1→31.3°C, status 0 |
| Warm 0.1 overview standing | 3.338 / 7.2ms | 2.908 / 3.9ms | 16.7ms | 31.3→31.4°C, status 0 |
| 0.1 overview driving warning lane | 3.503 / 5.5ms | 4.515 / 7.0ms | 50ms | 31.6°C, status 0→1 |

Ordinary native driving covers 876px and retains two >25ms frame intervals;
overview standing has one. The warning lane has 150 >25ms intervals, only 282px
maximum displacement, input acknowledgement p95 95.9ms and up to 0.762px
resimulation error. Its authority remains near 60Hz, with 5.5ms tick p95 and
7ms render-submission p95 despite 50ms frame p95. This does not establish server
saturation as the cause; GPU/presentation, temperature and movement blockage
remain unresolved. It is not a clean cool-phone capacity or continuous-traversal
acceptance case. No GPU-process/display trace was captured.

Status one stops subsequent runs; the planned zoom-entry case is not captured.
A later fixed 32°C cooldown attempt observes 32.9°C/status zero five times and
times out after its bounded window with zero admitted cases. No further gate
relaxation or phone CPU/census, core 0.05 or actual-mesh capture follows. Keep the
8-second/warmed/thermal limits explicit; no crowded-city 60Hz guarantee or original
walking-animation/desync reproduction is established.

Earlier desktop/phone pilots are retained but excluded from clean pacing claims.
The first helper set its rAF baseline before awaiting diagnostic reset, producing
a spurious initial long interval; the final helper aligns to rAF after reset.
Desktop pilot/first phone pilot also briefly overlap host setup/formatting. The
initial phone driver setup failed before horizontal traffic populated (zero
cases); the runner now waits boundedly for native traffic. Those failures and
probe revisions are evidence, not discarded lanes.

## Attribution and selected next work

A separate deep core census counts 600,118 road and 600,118 height reads across
486 standing ticks: about 1,234 each per tick. Distinct-cell sets reset per server
tick and traffic car. **81.7%** of each read class repeats a cell already read by
that car in the tick; normal/overview-driving traffic repetition remains about
81%. This is duplication, not an 81% server-time saving. Body-query candidates
average 3.69 per flat traffic probe (maximum seven); props average 0.33. The
previous dense-NPC broad phase is not the first target for these sparse lists.
Separate sampled CPU places `roadClear`/`blocked` among traffic's hot rows.
Deep timings are larger because every query/read is wrapped; do not compare them
to shallow means as gains or regressions.

Wide-view driving supplies full resident lists to `drivenCarPose` on authority and
prediction. Census normal driving supplies about 52.5 props/31.2 entities per
call; the selected wide neighborhood supplies about 1,080 props/303 entities.
Those are lists passed, not counts of tests surviving early collision exits.
There are about two native pose calls per recorded tick in these input windows.
Rider support/headroom remains a dependency beyond the chassis footprint.

In the two final shallow wide controls, driving averages 0.430–0.442ms,
replication 0.439–0.444ms and streaming 0.205–0.227ms per invocation; AI is only
0.045–0.054ms. Stream updates occur more than once per tick, and these are nested
phases. Separate 1ms Worker CPU confirms snapshot scalar validation/build and
interest-demand work are prominent. Main-page CPU contains scene collection,
prop-depth scans, drawing/submission, driving prediction and GC samples. Sampling
includes unknown runtime/program time and overlaps native callbacks; it does not
measure GPU duration or prove a GC cause for the phone's slow frames.

Proceed in this order:

1. **Server traffic terrain reuse:** prototype road/height reuse inside one car's
   synchronous lookahead sweep, expiring before later cars/next ticks. Preserve
   every live body/prop/junction check, edits and road/bridge readiness. Cover flat
   roads, turns, stopped crossings, grades, missing/deleted bridges and roof riders.
   Compare unchanged outcomes and cool-phone shallow controls before delivery;
   123's losing box prototype is a reminder that fewer calls need not be faster.
2. **Wide-view driving locality:** supply conservative swept-area prop/body
   candidates on authority and predictor, preserving oversized bodies, all wall
   pieces and rider/headroom dependencies. Measure ordinary and overview scenes;
   don't simply use nearby actor centers or reduce contact frequency.
3. **Snapshot/interest scale:** isolate checks over camera-resident sleeping actors
   and demand assembly. Any NPC publication cadence change must preserve immediate
   entry/exit/edits and 60Hz player input acknowledgement/contact ownership.
4. **Renderer/presentation:** cool-phone native-touch wide-view trace, including
   the actual compact mesh; separate main-thread work, GPU/presentation and thermal
   effects. Then target measured draw/collection/upload work. Also add a separately
   labelled nearby-people/traffic density and separated-co-op capacity matrix before
   claiming support for much busier future cities.

The earlier unused-water-read proposal remains valid but lower priority. There
is no measured case for adding simulation workers yet; scheduling or parallelism
would not by itself fix full-list driving, snapshots or GPU frame pacing.

## Validation

Three current-checkout typecheck configurations, 2,520 unit tests in 257 files and
lint pass (119 warnings/34 infos, zero errors). Frozen production build passes with
unchanged committed assets/inventories. Native audit checks exercise real Worker,
IndexedDB, input and GPU paths; two compact variants assert actual GLB draws and
continuous movement. All eight affected full bundled-Chromium traffic checks pass
serially on an isolated alternate port: the default port was already occupied,
so the first attempt ran zero checks. Unrelated concurrent test/doc changes remain
outside this task's commit. This is scoped validation, not a full browser suite.
