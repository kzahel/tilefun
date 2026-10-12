# 127: Wide-view drawing and GPU-service investigation

Status: investigated; production rendering policy unchanged.
Date: 2026-10-12.
Owner: [performance](../topics/performance.md).

## Findings

126's remaining phone slowdown reproduces at 0.1 zoom. The main drawing path is
an immediate cost, while moving-camera terrain adds another workload. Worker
authority remains around 4ms mean in these native drives. Moving AI to additional
workers would not directly reduce the measured drawing work.

Every visible mesh car renders to an offscreen body target, gets an outline pass,
then composites into the ordered scene. The shared targets resize between vehicle
families. Three's RenderTarget.setSize disposes resources on an actual size change;
the next render recreates them. A stationary phone census observes three body and
three outline size changes per frame, across 128/160/224-pixel targets. Target size
uses native-world radius, so zoomed-out cars retain their full offscreen resolution.

The current registered bank has 45 models, each with 32–56 mesh primitives and one
opaque source material. These are separate GPU draws today. Runtime emergency-light
lenses clone their material, and wheels have independent transforms; those controls
must survive any merging. Source assets and promoted review snapshots stay immutable.

## Controls and tracing

[Sanitized evidence](../benchmarks/127-wide-view-investigation.json) retains all
12 runs, including failed setup/cooldown lanes, full callback/render distributions,
source/probe hashes, native populations/travel, trace summaries and the 45-model
census. Raw browser traces and private controller state remain local.

Native phone controls use unchanged `946e05a` runtime, real Worker/IndexedDB,
seed-2026 core arrival, production traffic/people, 0.1 zoom, four-second warmup and
eight-second capture. Successful shallow phone drives begin with 367 props,
124 actors, eight active cars and six active route people. They use the same sedan,
road and approximately 880px native driving input. Vehicle visibility/model mix
changes with wall time. No timing runs overlap task validation/builds.

| Shallow phone lane | Render mean | rAF mean / p95 | Actual draws per GPU frame |
| --- | --- | --- | --- |
| Native meshes | 8.28ms | 30.18 / 50ms | 179.5 raster + 253.0 mesh |
| GPU sprites, first | 4.98ms | 27.13 / 50ms | 179.4 raster, zero mesh |
| GPU sprites, repeat | 4.93ms | 26.30 / 50ms | 178.8 raster, zero mesh |
| Exact-size mesh target reuse | 7.60ms | 29.39 / 50ms | 179.0 raster + 235.8 mesh |

Mesh disabling removes substantial drawing/submission work but leaves slow tails.
Target reuse is a diagnostic intervention, preserving native body/outline resolution
and ordered submission. It retains three size pairs, about 1.05MiB of estimated
color/depth storage. This single phone reuse lane has fewer mesh calls as well as
different temperatures than the first baseline; it does not establish a causal
8% saving or a frame-pacing fix. A headless desktop profile pair also shows no
consistent render-time improvement (original 1.29ms, reuse 1.40ms). Both desktop
lanes have 119 entry props, a different actual footprint from the phone.

Successful shallow phone start/end readings are 29.2–31.9°C, status zero. The
planned second mesh baseline loses its setup gate; a first reuse attempt reaches
32.1°C at setup, and a second expires its cooldown. These failures remain recorded;
the experiment is not a completed clean ABBA comparison.

The stationary mesh trace has zero texture upload bytes in the marked window and
about 0.15ms terrain preparation per census frame. Chrome's GPU service still spends
almost the entire eight-second trace handling requests: approximately 7.98s elapsed,
4.69s request-thread CPU, request p95 24.2ms. Main-thread task p95 is 9.36ms.
Its late post-drain thermal reading changes from status zero to one, so it is
attribution evidence, excluded from clean pacing controls. It demonstrates expensive
warm drawing without newly prepared terrain; it does not isolate hardware GPU time.

The sprite-only driving trace starts/ends at 31.8°C/status zero. It uploads about
12.4MiB in the sampled window and records 3,274 Canvas raster batches, versus 352
in the stationary mesh trace. Terrain preparation averages about 1.22ms per census
frame. GPU-service request p95 is 24.6ms, with approximately 7.98s elapsed and 4.56s
thread CPU across the trace. Several 50–83ms callback intervals overlap long GPU
requests without main-thread GC; other intervals include GC. This supports drawing
plus raster/upload pressure as contributors, rather than attributing every stall
to one cause. The trace/census lane adds overhead and is not a shallow FPS control.

Earlier inclusive render censuses span installation through restoration, including
trace setup/draining boundaries. Their frame normalization uses their own beginFrame
count. The final diagnostic tooling resets/restores census at sample markers and
reads authority/thermals and releases movement before trace draining. Earlier
stationary-trace authority timing includes draining and is excluded from comparisons.

rAF describes callback cadence, not physical display presentation. GPU-service
elapsed time includes waits/descheduling; nested trace totals must not be summed.
Chrome pipeline reporter state events include dropped states, but multiple reporter
states can describe one frame. No hardware GPU timer or physical screen present
timestamp series was captured. The analyzer's adaptive slow threshold follows the
observed median; use explicit interval distributions/over-25ms counts, not that
threshold as a calibrated count of missed 60Hz frames.

## Next optimization proposal

First, merge compatible rigid vehicle geometry at runtime asset loading: retain one
body draw per material, independent wheel roll/steer groups and tagged emergency
lenses. This directly attacks the 32–56 draws per car without reducing art detail
or changing authority, prediction or wheel/light timing. Measure actual calls and
cool-phone pacing; require native pixel comparisons across model families, poses,
wheel phases, light phases, fallback and recovery. The shared CarMeshAsset/GpuMeshBodies
owners reach game and embedded labs; validate both main game and Traffic.

Exact-size target reuse can accompany or follow that slice with bounded retention
and correct recovery/disposal, but its timing win remains unproven. Sprite batching
is a separate next lane: approximately 179 raster calls/frame remain with meshes
disabled. Preserve ordering, shadows, clipping and texture lifetimes when reducing
texture switches or renderer submissions.

Separately repeat a bounded terrain-row intervention, retaining visible readiness,
backlog and catch-up measurements as in 046/049. A main-thread 2ms preparation budget
does not bound Chrome's later raster work. Current driving captures assert ready
terrain at entry, not per-frame readiness during motion; they are not acceptance
for lowering production preparation budgets. No production LOD, row-budget or
renderer default change is delivered here.

## Reproduction and validation

The native city runner now accepts `--trace=true`, `--render-profile=true` and
diagnostic-only `--mesh-target-reuse=true`. CPU sampling and tracing use separate
captures. Physical runs require a selected unlocked phone, dedicated HTTP/CDP
routes and the fixed thermal gate; identifiers/routes remain private.

```sh
node scripts/instrumentation/city-audit.mjs --arrival=core --overview-zoom=0.1 --stages=overview-drive --seconds=8 --warm-seconds=4 --trace=true --render-profile=true --output=/tmp/tilefun-wide
node scripts/analyze-streaming-trace.mjs /tmp/tilefun-wide/0-overview-drive-trace.json /tmp/tilefun-wide/summary.json
npx tsx scripts/instrumentation/vehicle-draw-census.mjs /tmp/tilefun-vehicle-census.json
```

Omit trace/profile flags for shallow controls; add `--meshes=false` for the
sprite control, or `--mesh-target-reuse=true` for the target intervention. Keep
profiles separate from clean controls and perform repeated reverse-order comparisons.

Three typecheck configs, all 2,567 unit tests/259 files and production build pass.
Whole-tree lint passes with 119 existing warnings/34 infos. Earlier diagnostics in
concurrently edited tap-movement tests resolve outside this commit.
Three relevant full bundled Chromium checks pass with isolated auth/data/port 4191:
default game mesh host, optional mesh body composition/fallback and shared Traffic.
The initial isolated browser runner lacks its auth-state file; an isolated setup
corrects that harness error and the three cases pass. Final trace+census+reuse smoke
has 120 intervals, aligned census frame count, zero target resize events and zero
page errors. Owned phone routes/tabs/proxy close, original selected-phone routes
are verified and prior foreground restored. No production engine or art changed.
Separate native desktop main/Worker CPU sampling also passes; both raw profiles
have private 0600 permissions.
