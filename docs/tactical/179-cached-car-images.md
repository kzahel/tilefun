# 179 · Cached car images

Status: implemented and measured; intermittent Canvas deer test caveat below · 2026-10-22.
Owners: [rendering architecture](../topics/rendering-architecture.md),
[performance](../topics/performance.md).

## Scope

Reuse unchanged, finished native-pixel car images in the shared GPU backend used
by the game and embedded labs. Preserve exact local depth, silhouette ink,
nearest sampling and ordered world composition. Authority and source art remain
unchanged. Outline fusion and image atlas packing are later measurement-driven
slices, following the current pipeline audit.

## Implementation

- Key all consumed local pose, rig and paint texture/version inputs. Exclude
  world position, camera and composite opacity. No quantization of motion.
- Admit only poses observed in consecutive frames. Cargo groups, towed pairs
  and enabled emergency lights bypass reuse. Moving cars keep their current
  rendering path unless their exact pose recurs.
- Render the existing outline directly into a retained RGBA target; no GPU
  copy/readback. Limit retained images to 64 entries / 16 MiB, retire unused
  entries after 120 frames, and dispose on reset, asset invalidation, backend
  disable/replacement, recovery and teardown.
- Keep every car quad in its existing painter position. Diagnostics expose
  image hits/misses/count/bytes and include retained images in target bytes.

## Qualification

The [receipt](../benchmarks/cached-car-images.json) pins all source/probe/asset
hashes. Full Chromium compares **144 exact RGBA pairs** through the production
adapter, including four models, two alternate paints, fractional zoom, opacity,
clips and recovery. Warm hits issue zero mesh/outline calls. Cargo, towing and
flashing-light bypass checks match uncached reference pixels.

Native Pixel 7a, Chrome 155, 411×789 CSS / DPR 2.625: ten 12-second captures
after 12-second warmup, with cache on/off in the same current source. No validation
runs during timing. Both fleet pairs use the same 45 ready models, 51 visible
unchanged bodies and exactly 212 raster calls/frame:

| Fleet pair / order | Cache off FPS | Cache on FPS | Render CPU off → on | Mesh/outline calls/frame |
| --- | ---: | ---: | ---: | ---: |
| First, off → on | 29.24 | 38.03 | 12.89 → 6.32ms | 449 → 0 |
| Second, on → off | 24.75 | 32.92 | 15.66 → 7.62ms | 449 → 0 |

That is 30–33% higher callback FPS and about 51% less render CPU in both pairs.
51 retained images occupy 6,864,896 bytes (6.55 MiB). Normal view stays about
60 FPS; touch walking stays 59.5–59.6 FPS and travels 782px. Wide racing remains
44.61 off / 43.73 on, with no hits and about 168 raster calls/frame: no established
wide-view improvement. Authority stays about 60Hz throughout. All sample boundaries
pass thermal status zero at 23.6–28.1°C, with zero page errors. Absolute timings
drift despite that gate; these short pairs are not a sustained FPS guarantee.
The fleet obstructs racers and is not the owner's saved depot or an unchanged
race workload. rAF cadence is not hardware GPU/presentation timing.

Typechecks, 6,640 units in 366 files, the Node visual comparison, lint, catalog,
manifest and production build pass. Manifest regeneration preserves 1,977 other
fingerprints; two excluded interactive truck/towing identities hash the updated
adapter. GPU browser checks pass, including real context recovery, live backend
switching, ordering, paints, cargo/towing and fallback. The full browser run has
828 passes and one Canvas deer timeout waiting for all deer to stop being scared.
Its first isolated rerun also fails, then the unchanged current build passes
three consecutive repeats. Four original-runtime controls pass; scenario Worker
bytes are identical. No test deadline or AI behavior was changed. Preserve this
intermittent-test caveat; investigate with scare/clock traces if it recurs.

Owned phone tabs/routes and the CDP relay are removed, original routes retained,
launcher restored and doctor ready/unlocked. Final thermal status zero, 29.3°C.

## Next work

The cached fleet reaches the earlier sprite-only ceiling while retaining all
212 raster calls/frame. Prioritize an atlas/submission experiment that preserves
the existing quad order and native pixels across both vehicle and ordinary raster
work. Measure outline fusion separately for changing bodies at near/far zoom;
do not infer its speedup from the desktop pixel proof. Global world depth remains
its separate correctness experiment. Exact saved-depot and moving/driving-overview
acceptance remain open.
