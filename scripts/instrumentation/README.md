# Diagnostic probes

## Render and authority rates

`npx tsx scripts/instrumentation/prediction-rates.ts --output=/tmp/prediction-rates.json`
extends six representative native contact/roof scenes through production
`GameLoop.externalTick`, shared interpolation and binary replication. Profiles
cover 60/120Hz presentation, 30/60Hz authority, live rate transitions, timed delay
and deliberately independent command rates. Every trace repeats in a fresh
session. `--case=free-walk --profile=switch60-30-60-render120` isolates the shared
loop's negative-alpha reproduction. The deterministic lane does not draw pixels.

The train browser probe also accepts `--server-hz=30|60|alternate` via the existing
server CVar and `--render-hz=120` for measured external-clock drawing. Use `--headed`
without a render override to measure native rAF; do not assume display cadence.
[Rate evidence](../../docs/research/prediction-rate-reproductions.md) records actual
native 120Hz Worker captures, Canvas/GPU runs, commands and measurement limits.
No gameplay fix is implemented.

## Moving contact and car/train roofs

`npx tsx scripts/instrumentation/moving-contact.ts --output=/tmp/moving-contact.json`
runs ten native production scenes under five controlled input/delivery schedules.
Every scene runs twice in fresh sessions and rejects differing complete trace
hashes. It also checks that walking really encounters a constraint and that roof
fixtures retain support at cruise speed. Only fixture data and clocks are controlled;
native AI, collider flags, carry logic, binary replication and prediction are unchanged.

Use `--case=person-away --profile=delay50`, `--case=cow-still --profile=lockstep`,
`--case=car-roof --profile=uneven` or `--case=train-roof --profile=uneven` for focused
reproductions. Other cases/profiles and the measured baseline are in
[moving-contact evidence](../../docs/research/moving-contact-reproductions.md).
JSON retains actual post-replay shifts, acknowledgements, geometry and
authoritative passenger offsets. This is characterization, not a fixed-behavior
test or a browser presentation measurement. Gameplay changes remain on hold.

## Train roof prediction

`npx tsx scripts/instrumentation/train-roof-prediction.ts --output=/tmp/train-clock.json`
characterizes a constant-speed train passenger with independently scheduled
commands/server ticks using production Realm, replication, codec and predictor.
It includes both train body representations and idle/walking ground controls.

`node scripts/instrumentation/train-roof-browser.mjs --renderer=canvas --output=/tmp/train-browser.json`
captures ordinary keyboard boarding in a fresh seed 2026 world through the real
Worker. Use `--renderer=gpu`, `--delay=50` (milliseconds each way), or `--headed`
for other lanes. It owns an isolated dev origin, temporary data and bundled full
Chromium, and closes both server and browser. Hooks observe without changing
simulation or prediction. Reports distinguish post-replay corrections from raw
backlog lead and measure displayed rider position relative to the carriage.
See [evidence and proposed fix](../../docs/research/train-roof-prediction-jitter.md).
Use `--assert-fixed` for roof alignment, `--assert-timing` for consumed authority
cadence and `--assert-presentation` for steady straight-motion step errors. The last
check uses the actual GameLoop/rAF timestamp, separately recording post-render
capture time, and compares world/camera travel against 192px/s × elapsed time after
one second of continuous cruise. It requires at least 60 steady steps, world error
≤0.05px, camera error ≤0.1px and no backwards camera frames.
`--server-hz=alternate --headed --renderer=gpu` exercises 60→30→60Hz at native refresh.
These checks establish the scoped straight-motion contract, not arbitrary motion
or whole-machine frame pacing. See [current presentation evidence](../../docs/research/camera-basics-reproductions.md#shared-presentation-fix).

## Rider-free camera timing

`npx tsx scripts/instrumentation/camera-basics.ts --output=/tmp/camera-basics.json`
records deterministic train-locked/train-smoothed and fast-player/noclip traces.
Production client math runs on explicit times; no browser or renderer starts.
Delivery delays and absent render callbacks are injected separately. Known-speed
motion and equal-time uninterrupted controls distinguish missing frames from extra
camera errors. `--assert-continuous` now passes through the shared timestamped
presentation/camera owner. Long-pause local simulation debt is characterized separately.
See [scope, evidence and next work](../../docs/research/camera-basics-reproductions.md).

## Sleeping NPC separation

Run `npx tsx scripts/instrumentation/entity-separation.ts` from the repository
root. It compares ungated separation with an empty tick selection over 400
coincident NPCs, with five warmup and 30 measured passes. Solid terrain keeps
the control fixture stationary. It asserts that sleeping NPCs make no tile
collision queries and reports median pass time; this isolates separation and
does not measure whole-server cost or gameplay FPS. See
[Tactical 018](../../docs/tactical/018-tick-aware-npc-separation.md).

## Grass cache retention

Run `node scripts/instrumentation/grass-cache-retention.mjs` from the repository
root. It uses isolated bundled Chromium and a minimal Vite page, generates two
batches of 1,000 discarded chunks, and reports heap usage after explicit GC.
The blade counts check equal work. This diagnoses retained cache memory; it is
not a gameplay allocation-rate, phone, GPU-memory or frame-pacing benchmark.
Small residual heap changes include browser/JIT bookkeeping. See
[Tactical 013](../../docs/tactical/013-renderer-boundary-and-allocation-audit.md).

## Grass frame allocation

Run `node scripts/instrumentation/grass-frame-allocation.mjs` from the repository
root. It warms nine resident grass chunks with 16 interacting entities, then
samples allocations for 600 collections in isolated bundled Chromium. The
sampling profiler includes objects collected during the sample; byte counts
are estimates, not timing gates. Three hashes cover exact grass output at fixed
animation times, including push angles and iteration order. The script also
works on the pre-pooling collector for before/after captures. This synthetic
workload excludes drawing, streaming, sorting, prediction and simulation.

## Terrain scheduler allocation

Run `node scripts/instrumentation/terrain-scheduler-allocation.mjs` from the
repository root. It samples 3,000 frames after a 60-frame warmup with 80 ready
chunks, then with 80 pending chunks. Zero row budget isolates membership and
job bookkeeping from raster work. A separate ordered-job hash covers camera
reversals and changes in old imagery availability. Bundled Chromium's sampling
includes collected objects; byte counts are estimates, not FPS/timing gates.
Historical before/after scheduler samples used the script at their recorded revisions;
the current fixture seeds renderer-owned resources after the ownership extraction.

## Prop depth metadata allocation

Run `node scripts/instrumentation/prop-depth-allocation.mjs` from the repository
root; add `--fresh` to use the unchanged uncached helper. The script warms 60
collections, then samples 600 over 400 props (two finite surfaces and one infinite
wall each). It reports storage creation, eight metadata/depth hashes through edits,
and five unprofiled timing batches. Sampling includes collected objects; the
synthetic workload excludes raster, streaming and simulation. Use these results
for allocation/parity evidence, not as an end-to-end FPS or timing gate.

## Elevation descriptor allocation

Run `node scripts/instrumentation/elevation-allocation.mjs` from the repository
root. Nine chunks with 192 raised tiles each warm for 60 collections, then sample
600 collections. Five geometry hashes cover content edits, replacement imagery,
eviction and chunk replacement; emitted handles must resolve. The diagnostic
seeds the concrete renderer's resource store to isolate collection from raster
work. It works before/after descriptor caching (after the terrain handle
extraction). Byte estimates include collected objects and do not measure FPS.

## Protocol instrumentation

Temporary scripts for auditing which messages still go through JSON fallback (`0xFF`) and roughly how large they are.

## Scripts

- `protocol-fallback-audit.ts`
  - Runs a controlled local `GameServer` simulation with two clients.
  - Reports measured JSON-fallback bytes/counts for client and server message types actually emitted in that scenario.

- `protocol-fallback-size-samples.ts`
  - Encodes representative payloads for each fallback message type.
  - Prints one-shot sample sizes (bytes) for quick comparisons.

## Run

From repo root:

```bash
npx -y tsx scripts/instrumentation/protocol-fallback-audit.ts
npx -y tsx scripts/instrumentation/protocol-fallback-size-samples.ts
```

## Notes

- These are intentionally ad hoc and easy to delete.
- They do not modify runtime behavior or production code paths.

## Replication delivery validation

`replication-delivery.ts` exercises the real server replicator, binary codec and
client replica under seeded entity-frame loss, delay, bursts and reordering.
Reliable traffic is unaffected. It is a repeatable diagnostic, independent of
the ad hoc JSON fallback audits above.

```sh
npx tsx scripts/instrumentation/replication-delivery.ts --output=/tmp/rtc-delivery.json
```

The default exit status is 1 when any scenario does not converge after its clean
recovery window. `--expect-known-gaps` permits a characterization run without
changing the recorded result. Current failures and real WebRTC browser checks
are documented in [Tactical 014](../../docs/tactical/014-webrtc-delivery-validation.md).
This models application-frame faults, not UDP/SCTP congestion or WAN behavior.


## Renderer boundary probes

Run from the repository root with `node scripts/instrumentation/<name>.mjs`:

- `terrain-frame-allocation`: matched moving-camera placement, resource handles,
  allocation sampling and geometry hash; excludes preparation and drawing.
- `elevation-allocation`: static descriptor reuse and geometry hashes.
- `terrain-scheduler-allocation`: ready/pending residency bookkeeping and job order.
- `grass-frame-allocation` / `grass-cache-retention`: warm frame pools and discarded
  chunk lifetime, with explicit GC only between retention batches.

Each owns an isolated Vite origin and bundled Chromium and closes both on exit.
V8 sampling is not an allocation census or a frame-pacing measurement. Compare
work counts, hashes, cache counters and source revisions alongside sampled bytes.
See [renderer completion](../../docs/tactical/034-renderer-completion.md).


## Airborne support momentum

`npx tsx scripts/instrumentation/roof-camera-jump.ts --assert-momentum` checks the
full native authority flight contract, including preserved Quake-air controls.
Its legacy `--assert-baseline` retains the historical momentum-loss expectation,
and its camera lanes intentionally retain the old untimed consumer. Current
camera continuity uses the separate timestamped presentation CLIs above.

Add `--jump-momentum` to `train-roof-browser.mjs` with a fixed 30/60Hz server rate
to run ordinary-keyboard next-carriage and midair-reversal flights. It requires
20 airborne samples per flight, retained departure velocity, next-roof landing,
forward/backward steering and takeoff step error ≤3.5px. Use native headed full
Chromium for actual 120Hz display evidence. Roof-offset/steady-idle assertions
are separate lanes: walking/jumping intentionally changes the passenger offset.
[Contracts, evidence and limits](../../docs/research/airborne-support-momentum.md).

## Saved train reload pacing

Add `--reload-pacing --headed` to `train-roof-browser.mjs` for a normal page reload
on a saved moving roof ride, followed by an isolated production clock-reset control.
The lane leaves native rAF and authority timers intact, records raw sampled clocks
and borrowed poses, and accepts `--assert-presentation` / `--output=...`.
It does not claim a real hidden-tab lifecycle test: automated pages are forced
visible in the measured setup. [Evidence and rerun](../../docs/research/train-refresh-pacing.md).
