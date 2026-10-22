# 181 · Depot and driving acceptance

Status: driving measured and next experiment selected; exact depot location open · 2026-10-22.
Owner: [performance](../topics/performance.md).

## Scope

Qualify the 179/180 renderer changes in the owner's depot and sustained moving
overview before selecting another optimization. Keep ordinary vehicle controls,
authority cadence, ordering, outlines and native pixels. This slice starts with
measurement rather than another runtime policy change.

## Method

- Discover existing phone saves using read-only IndexedDB transactions. Keep
  private world records outside Git; test an isolated copy only if compatible.
- Use the existing `city-audit.mjs` real Worker/IndexedDB/GPU harness for a
  generated city driving lane, native touch and normal/0.1 overview framing.
  Record the one-for-one compact-car fixture replacement, real displacement,
  populations and source hashes; this is not the owner's exact save.
- Separate clean timing from deep counters, CPU sampling and render census.
  Gate phone timing at thermal status zero and <=29°C; retain rejected/hot
  attempts separately. No desktop validation jobs run during timing.
- Preserve original tabs, routes, foreground and saves. Close owned targets and
  remove only owned USB routes at completion. Store sanitized metrics and hashes
  in a public receipt, with raw records/profiles local only.

## Save discovery

The live-site origin contains one registered format-three world, using retired
`regional-v4`, and no saved vehicle entities. Current production requires
`regional-v13`; do not relabel, migrate or regenerate this save to claim exact
depot acceptance. The owner has been asked for the depot's world/location while
independent driving measurements continue. Original records remain untouched.

The pre-existing loopback game origin contains no registered worlds either.
Its temporary read-only inspection page, server and USB route were removed.

## Results and next decision

Straight 60-second controls travel about 4,145px but encounter an obstacle after
about 39 seconds. Normal view is 59.97 FPS (two intervals over 25ms); overview is
58.94 FPS (49). The first overview has only maximum displacement evidence; the
subsequent normal-view position series exposes the stopped tail. Neither is
accepted as a full minute of moving-camera rendering.

The sampler now records positions about once per second. The runner's opt-in
`--drive-reverse-at=20` changes held touch/keyboard direction once, using ordinary
rolling reverse with no teleport or simulation override. The explicit out-and-
back fixture avoids that obstacle. Both normal and overview have 61 position
samples: every interval changes position by more than 1px, covering about 4,448 /
4,445px of sampled path. This rules out a long stationary tail; one-second samples
do not prove motion at every instant.

| Native out-and-back, 60s each | Normal view | 0.1 overview |
| --- | ---: | ---: |
| Callback FPS | 59.73 | 56.76 |
| Frame p95 | 16.8ms | 33.2ms |
| Intervals over 25ms | 16 / 3,584 | 176 / 3,405 |
| Main render mean / p95 | 2.40 / 3.8ms | 5.33 / 7.8ms |
| Authority tick mean / p95 | 5.88 / 8.9ms | 5.52 / 7.9ms |
| Raster / mesh-outline calls per frame | 5.30 / 12.41 | 22.53 / 56.57 |
| Image hits / misses per frame | 0.16 / 1.30 | 5.94 / 5.80 |
| Battery temperature, start → end | 27.4 → 28.0°C | 28.5 → 28.5°C |

Both retain about 60Hz authority, thermal status zero and zero page errors.
Overview slow intervals grow from 10 in the first ten seconds to 57 in the last
ten; returning through the city retains more live road traffic than continuing
past it. This is workload characterization, not a matched before/after control,
a power measurement or hardware GPU timing. It does not certify the saved depot.

Attribution is separate. Its first entry attempt hits the <=29°C gate at 29.4°C,
status zero, and admits no sample. Cool on the launcher during required checks,
then explicitly relaunch Chrome before CDP attachment.

## Attribution and selected next work

A separate cooled native CPU capture samples about 20.96 seconds, including
profiler setup/stop around a 20-second client sample. Sampled inclusive totals are
1.53s in `GpuMeshBodies.draw`, 1.40s in `presentTerrain`, and 1.19s in `collectScene`.
`depthAboveProps` self samples total 114ms; it is not the leading target in this
lane. These inclusive totals overlap and are not additive.
Worker self samples put interest demand and replication above traffic here.
The Worker maximum tick in this capture includes profiler startup before the
client sample; it is not an ordinary driving spike.

The separate native trace has 25 intervals over 25ms in about 20 seconds. Six
overlap main-thread GC, 16 overlap a GPU-process request over 10ms, and 14 have
raster batches inside their longest overlapping GPU request. The trace contains
10,387 raster completions; GPU request-thread CPU totals about 9.92s. Source
texture uploads total 40.36 MiB (vertices are a separate 58.52 MiB). This identifies
raster servicing and allocation pressure as investigation targets; event overlap
does not prove a unique cause, identify every source, or measure hardware GPU time.
GPU-process totals are browser-wide, not isolated to this page; hidden original
tabs are preserved rather than globally disabled. Source-specific upload tags
are needed before attributing all raster batches to game terrain.
CPU and trace boundaries remain status zero at 28.3°C. No timing from these
instrumented captures is used as a before/after speedup.

The following native render census is rejected during setup: thermal status one
at 28.8°C, zero cases. Phone captures stop there. A bundled full Chromium desktop
census supplies structural counts only: about 10.24 body/outline target size
changes per frame across 128/224/288px targets in its 12-second moving overview.
Its CPU timing is not phone evidence. A bounded size pool would occupy about
1.71 MiB for those three color/depth/outline pairs, before other resources;
179's earlier desktop target-reuse pilot had only a small timing benefit.

**Next experiment: movement-time terrain raster and texture-upload admission.**
Attribute those bursts to prepared terrain versus dynamic UI/source canvases,
then compare a bounded upload/preparation queue that prioritizes visible holes
and approaching terrain while retaining complete surfaces during replacement.
Measure travel, visible readiness and callback tails together; the earlier small-
batch experiment traded lower burst cost for slower fill, so do not adopt a
blanket row cap. This follows the existing shared preparation owner, preserving
ordinary car pixels and scene ordering.

Keep bounded scratch-target reuse as a small separate cold-phone A/B control for
changing bodies. The size-change count makes it worth testing, not an established
speedup. Outline fusion follows only if it wins that same native moving workload;
general AI, global world depth and broad depth-query rewrites are lower priority
for the measured route. No runtime optimization is selected for production here.

## Validation and cleanup

Typechecks and lint pass (121 existing warnings / 42 infos). The full unit run
passes 6,638 of 6,640 cases; the unchanged swordfish/orca recipe cases time out at
their existing 5s limit, then both pass unchanged in a focused one-worker rerun
(3.53s total). Node integration passes. No tolerances or timeouts were changed.
Native out-and-back capture exercises the new diagnostic input option and motion
series. Production runtime/assets are unchanged from 180's full browser/pixel
qualification; no new browser test matrix or art inventory change is needed.

The [sanitized receipt](../benchmarks/depot-driving-acceptance.json) owns hashes,
capture variants, rejected attempts, thermal boundaries and measurement limits.
Raw saves, profiles, traces and screenshots stay outside Git.

Cleanup verifies all original tab URLs and USB routes preserved, no owned targets
remaining, owned routes/relay removed, and the launcher restored. The final
doctor is ready/unlocked, thermal status zero at battery 30.1°C. A second read-only
snapshot verifies the original registry and all exported world records unchanged.
