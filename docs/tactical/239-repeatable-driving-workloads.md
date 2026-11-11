# 239 — Repeatable driving workloads

Status: delivered · 2026-11-11.
Owner: [performance](../topics/performance.md).
Follow-up to [238](238-allocation-churn-and-regional-planning.md).

## Problem and delivered workloads

The generated-city `render:bench --scenes=drive` discovers streets with a timed
autopilot. Traffic sometimes blocks it, so equal durations can cover very
different terrain and object populations. Keep it as an exploratory city/art/
streaming probe, and compare those records by actual distance.

`npm run driving:bench` adds two controlled workloads using one data-only recipe
factory, the ordinary `ScenarioSession`/recipe-world Worker, `LabView`, predictor,
vehicle registry, road decisions, chassis and renderer:

- **clear:** one compact, ordinary eastward throttle without boost or steering,
  on a prepared 7,936 px straight asphalt strip. Follow camera, default zoom 1.
- **jam:** 32 autonomous compacts in four lanes, four parked leaders and the
  driver's compact (37 vehicles). The driver reaches the queue with the same
  eastward throttle; the leaders keep all four lanes backed up. Fixed camera,
  default zoom 0.25 so the population is visible on a phone too.

No ambient animals or generated traffic are admitted. The recipe's opt-in
`fixedTrafficPopulation` disables only procedural population admission; the
authored autonomous cars keep ordinary routing, following, motors and contacts.
Other labs retain their existing population behavior. A small registry helper
extracts the unchanged private memory-world setup from `ScenarioSession`,
tightening its health baseline. Health also caught and removed an unused planner
re-export left by 238; the underlying function is unchanged.

These are **prepared flat-road fixtures**, excluding regional generation, city
building art and physical storage I/O. Ordinary memory-record bookkeeping still
runs; the report's storage exclusion refers to durable user-world storage.
They isolate recurring driving/prediction/physics
and render work; they do not replace the regional generation benchmark or prove
that a city streaming hitch is fixed. Terrain images still enter the clear
fixture's moving camera, but road chunks are admitted before the timed window.

## Commands and measurement contract

```sh
npm run driving:bench -- --headed --seconds=30 --trials=3 --output=/tmp/driving-before.json
npm run driving:bench -- --headed --seconds=30 --trials=3 --compare=/tmp/driving-before.json --output=/tmp/driving-after.json
npm run driving:bench -- --fixtures=jam --allocations --output=/tmp/driving-allocations.json
npm run driving:bench -- --base=http://localhost:4174/tilefun --headed
npm run driving:bench -- --cdp=http://127.0.0.1:9223 --port=4188 --device=pixel7a
```

Use the common physical-device readiness/CDP/port-forward setup; never CPU
throttle a phone. `--base` needs a freshly rebuilt production origin containing
`driving-bench.html`. Without it the CLI owns an isolated Vite server and bundled
Chromium, or only its own device tab over CDP. It reaps owned browser processes,
Workers, tabs and servers; the recipe saves only to memory. Host forwarding
routes remain the caller's responsibility. `--help` lists the bounded options.

Each cell has a fresh page, Worker, world and GPU caches. Warm-up is exactly 180
paused-authority ticks with idle input, followed by initial mesh/terrain readiness.
The sampler calibrates 60 idle display intervals while paused. Missed intervals
use 1.5× that idle cadence, rather than a potentially degraded loaded median.
Trial order alternates clear/jam and jam/clear. Browser/driver caches and process
JIT are not reset; fresh page caches do not imply a cold physical GPU or browser.

Reports retain every frame interval, >25 ms intervals, named per-second vehicle
poses and speeds, starting/ending authoritative ticks, distance/lateral drift,
main-thread lab update/render timings, and authority stage timings/counters.
Physics percentiles retain the last 512 samples; its cumulative counters span
the whole sample plus the pause-acknowledgement fence. No frame-rate threshold
is imposed. A slow but valid workload remains a performance result.

The workload must retain its seated driver and exact population, advance the
authority and query wheels. Clear progress must match actual simulated time and
stay in its lane. The jam must reach its queue and finish with the driver and at
least 28/32 queued cars stopped. Failed qualification exits nonzero and retains
the report; setup/runtime exceptions save a separate `.failure.json`.

Comparison requires matching recipes, initial named poses (within one pixel),
measurement version, browser, viewport/GPU, duration, runtime mode and allocation
mode. Simulation ticks and clear-route distance must agree within 5%; otherwise
the runner refuses an A/B CPU comparison while preserving the measurements.
Reports fingerprint the local executable-source inputs and served entry module.
For production, the served entry's hashed dependency references identify its
bundle; the checkout fingerprint alone does not identify an arbitrary `--base`.

`--allocations` saves main-thread sampled heap profiles, including collected
objects. It excludes warm-up/idle calibration and includes cadence setup, the
pause fence/diagnostics and benchmark bookkeeping. Use separate ordinary runs
for cadence. Sampling estimates object production; it does not measure retained
heap or attribute a particular frame to GC. The profiler stops after cadence.

Fixed geometry, population and input make the live workload repeatable, **not a
bit-exact real-time replay**: browser/Worker scheduling and input arrival still
vary. Native manually stepped tests separately check exact pose repetition.

## Validation and final measurements

[Sanitized evidence](../benchmarks/239-driving-workloads.json). Raw reports,
heap profiles and the local campaign setup stay in ignored
`data/scratch/driving-239/`. Production was rebuilt after the final runtime edits.

| Ordinary 30-second runs | Clear road | Jam |
| --- | --- | --- |
| M4 Pro, three runs each, 120 Hz | 3,329.7–3,331.6 px; 1,800 ticks; 0 missed intervals | 37 cars, all 32 queue cars stopped; 1,800 ticks; 0 missed intervals |
| Pixel 7a, two runs each, 60 Hz | 3,324.1 / 3,326.0 px; 1,800 ticks both; 1 / 1 missed intervals | 37 cars, all 32 queue cars stopped; 1,800 / 1,799 ticks; 1 / 2 missed intervals |

All ten ordinary cells qualify. On the phone, independent report B successfully
uses CLI `--compare` against A: matching initial poses/populations, under 0.1%
clear-distance variation and at most one simulated tick difference. Mac worst
frame interval is 10.5 ms. Phone clear worst intervals are 50.0 / 33.4 ms; jam
worst is 33.3 ms in both runs. These occasional pauses are retained, including
the clear fixture's 50 ms interval at 22.59 s. No claim of hitch-free play or GC
attribution follows from this workload qualification.

Phone main-thread render p50 is 2.6–2.7 ms clear and 3.6–3.7 ms jam. Its rolling
authority `realm.tick` p50 varies 1.8–4.1 ms clear and 2.9–3.2 ms jam despite
matching work. Controlled geometry/population does not freeze runtime/JIT or
device scheduling; use repeated paired measurements before claiming a speedup.
These are lab Realm timings, not the whole main game's `server.tick`.

Separate 10-second phone allocation controls also qualify and save heap profiles:
88.2 MiB clear, 445.5 MiB jam (estimated main-thread allocation, including
collected objects and harness bookkeeping). This is a workload contrast, not an
optimization result. Instrumented cadence is retained separately from the
ordinary runs above.

Phone: native 411×789 CSS px, DPR 2.625, Mali-G710, Chrome 156, external power,
25.2–25.4 °C, thermal status 0 at every checkpoint. Mac: M4 Pro, 1280×800, DPR 1,
bundled full Chromium and hardware Metal rendering. Owned browser processes,
tabs, Workers, preview server and task forwarding routes were cleaned up; common
phone doctor passes afterward. No saved player worlds were created.

Checks passed:

- 27 native tests across recipe repetition, recipe-world authority/client and
  road traffic. The new test compares two fresh 900-tick traces per fixture after
  the same 180-tick idle warm-up: all named per-second vehicle poses are exact.
  It also checks retained autonomous counts and refusal of extra population.
- Two Node report tests own invalid-workload and incompatible-comparison gates.
- Two production browser lifecycle/scheduling checks, plus all twelve production
  benchmark cells (ten ordinary, two allocation-sampled) on Mac/physical phone.
- Four typecheck projects, focused Biome, health/unused-code checks, tightened
  scenario health baseline, normal build and streaming readiness.
- Art inventory source locators and Workshop input digest updated; all 2,130
  candidate identities verified unchanged. No promoted pixels were regenerated.

## Next work

Use the clear fixture for predictor allocation comparisons and the jam fixture
for backed-up-traffic physics. Keep the city drive/generation probes for streaming
tails. CPU attribution of the occasional city frame pause remains separate work.
