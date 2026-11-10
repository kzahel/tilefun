# 236 — Render scorecard and GPU depth shadows

Status: scorecard delivered; GPU oval shadows delivered as an opt-in experiment
(`?shadows=gpu`), awaiting owner review · 2026-11-10.
Owner: [performance](../topics/performance.md); renderer contracts in
[rendering architecture](../topics/rendering-architecture.md).

The owner asked for rendering performance work, with large refactors allowed, on
the M4 Pro, the Pixel 7a and the Steam Deck. This slice answers two questions
first: is there one comparable rendering measurement, and where does render time
go?

## Scorecard: `npm run render:bench`

`scripts/benchmark-render.mjs` runs fixed real-game scenes at fixed zooms and
prints one table per device. It uses isolated Vite, the seed-2026 regional world
and a steady camera after terrain settles.

| Scene | Content |
| --- | --- |
| `street` | A quiet town crossing (arrival 300,519) |
| `crowd` | The same place plus 1,000 rabbits and 50 parked cars |
| `city` | The dense block east of Oakgrove (arrival −380,−364) with its own traffic |

Each scene runs at zooms 1, 0.25 and 0.1 by default. Each cell reports:
- frame interval p50/p95 and frames that missed the display cadence;
- the main-thread render and update callbacks;
- time inside backend submits (the rest of render is collection and terrain
  preparation);
- draw calls, entities and the Worker tick;
- GPU time from `EXT_disjoint_timer_query_webgl2` when the browser exposes it;
- render plus `gl.finish()` in a separate window. This blocks on the GPU, so it
  is a GPU-inclusive upper bound that also works where the timer query is absent
  (Android Chrome).

Options:
- `--headed` uses the display's real cadence (headless rAF runs at 60 Hz).
- `--scenes=`, `--zooms=`, `--seconds=`, `--viewport=` select the matrix.
- `--query=shadows=gpu` adds game URL parameters, for an A/B of an opt-in path.
- `--compare=<before.json>` prints per-cell deltas.
- `--profile` samples a main-thread CPU profile per cell and prints the top
  self-time functions. Profiled timings are not the baseline.
- `--screenshots=<dir>` saves one screenshot per cell.
- `--cdp=<url> --port=<n>` attaches to a device browser, as `stress:bench` does.

Device attach uses `scripts/cdp-tab.mjs`, a small raw DevTools client that
creates and drives only its own tab. Playwright's `connectOverCDP` attached to
every existing tab and timed out on the phone's background tabs.

Pixel 7a setup (routes removed afterwards):

```sh
adb forward tcp:9223 localabstract:chrome_devtools_remote
adb reverse tcp:4189 tcp:4189
npm run render:bench -- --cdp=http://127.0.0.1:9223 --port=4189 --device="Pixel 7a"
```

Limits:
- The camera does not move. `streaming:bench` owns motion and terrain streaming.
- Rabbits wander and the replicated count varies (883–1,000 rabbits placed), so
  populated cells are not exact replays. Compare cells with similar entity counts.
- The build is Vite dev modules, like `stress:bench`.
- On the phone, 1,000 rabbits overload the authority (tick 31–48 ms), so the
  `crowd` cells there also carry main-thread replication bursts.

## Baseline (2026-11-10, before this slice's code changes)

p50 values in ms. Full cells: [evidence](../benchmarks/236-render-scorecard.json).

M4 Pro, headed bundled Chromium 156, 1280×800, 120 Hz (idle 8.3 ms):

| Scene | Zoom | Frame p50 / missed | Render | Submit | GPU timer | Render + finish |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| street | 1 | 8.3 / 0 of 600 | 0.8 | 0.3 | 0.97 | 0.9 |
| street | 0.25 | 8.3 / 0 of 600 | 1.2 | 0.4 | 1.78 | 1.2 |
| street | 0.1 | 8.3 / 0 of 600 | 1.3 | 0.8 | 1.93 | 1.4 |
| crowd | 1 | 8.3 / 2 of 598 | 3.9 | 0.4 | 2.29 | 4.1 |
| crowd | 0.25 | 10.2 / 161 of 410 | 9.6 | 1.3 | 5.02 | 9.7 |
| crowd | 0.1 | 9.5 / 173 of 426 | 6.0 | 1.8 | 3.45 | 6.5 |
| city | 1 | 8.3 / 0 of 600 | 1.1 | 0.3 | 0.62 | 1.2 |
| city | 0.25 | 8.3 / 0 of 600 | 1.6 | 0.2 | 0.62 | 1.7 |
| city | 0.1 | 8.3 / 0 of 600 | 2.3 | 0.9 | 0.84 | 2.6 |

Pixel 7a, Chrome 156 over CDP, 60 Hz, battery 23.9 → 27.3 °C, thermal status 0:

| Scene | Zoom | Frame p50 / missed | Render | Submit | Render + finish | Worker tick |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| street | 1 | 16.7 / 0 of 300 | 3.4 | 1.4 | 3.9 | 4.3 |
| street | 0.25 | 16.7 / 0 of 300 | 3.9 | 1.5 | 4.0 | 4.3 |
| street | 0.1 | 16.7 / 1 of 299 | 4.1 | 2.7 | 4.1 | 3.1 |
| crowd | 1 | 16.7 / 84 of 210 | 12.5 | 0.8 | 12.7 | 33.5 |
| crowd | 0.25 | 50.0 / 6 of 93 | 29.5 | 4.0 | 28.6 | 48.0 |
| crowd | 0.1 | 33.4 / 17 of 125 | 16.7 | 4.2 | 17.2 | 36.8 |
| city | 1 | 16.7 / 0 of 301 | 3.9 | 0.8 | 4.0 | 6.3 |
| city | 0.25 | 16.7 / 2 of 291 | 4.4 | 0.6 | 4.5 | 6.9 |
| city | 0.1 | 16.7 / 0 of 300 | 5.0 | 1.5 | 5.3 | 8.7 |

Steam Deck: not measured. `steamdeck doctor` reached the Deck over SSH but
reported `session: error`, and the scorecard needs the packaged shell launched
with `TILEFUN_CDP_PORT`.

### What the baseline says

1. **Rendering is CPU-bound on both devices.** Render plus a blocking GPU finish
   is within about 1 ms of render alone in every cell (the two are separate
   sampling windows). The earlier suspicion that the phone's 0.1× overview is
   limited by GPU fill does not reproduce: `street` and `city` hold 60 Hz at
   every zoom.
2. **Only the crowd misses cadence.** `street` and `city` hold 120 Hz on the Mac
   and 60 Hz on the phone at every zoom.
3. **In the crowd, the cost is collection, not submission.** At 0.25 the Mac
   spends 1.3 of 9.6 ms in submits and the phone 4.0 of 29.5 ms.

### Where collection goes

The Node render lane (`crowd:bench --lane=render`, the 235 tape) splits the
crowd's scene preparation:

| Variant | `render.prepare` p50 |
| --- | ---: |
| Current, projected shadows | 9.2 ms |
| Projected shadows disabled (LOD threshold raised for one run) | 1.7 ms |

Projecting shadows onto surface receivers is about 7.5 of 9.2 ms. Collecting,
culling, interpolating and sorting all 1,051 actors is 1.7 ms. A CPU profile
attributes the rest of the difference to `entityRoofSupport` (about 1 ms per
frame: each actor against each vehicle).

This changes the plan from the advice that preceded this slice. A retained,
instanced scene would save at most the 1.7 ms. Shadows are the larger target.

A browser profile of the crowd (`--profile`) adds main-thread items outside
scene preparation:
- `RemotePresentation.sample` clones every replicated entity with an object
  spread each frame: 9.6–11.2% of sampled time on the Mac and 4.5–8.8% on the
  phone.
- Garbage collection is 9.3–14.2% on the phone.
- `vehicleChoice`/`driveCandidate` prompt scans are 5–7% on the phone.
- `SurfaceReceivers` construction is 2–4% on both.

The phone profile is flat: many per-entity, per-frame passes and their
allocations, with no single dominant function.

## GPU depth shadows (`?shadows=gpu`)

An opt-in experiment for actor oval shadows. The default path is unchanged: the
render lane matches every scene hash of the 235 checkpoint (`--verify
--assert-equivalent`).

**Collection.** With the flag on, a non-vehicle actor's shadow is no longer
clipped against receivers. Its sprite carries `gpuShadow`: the oval of
`shadowFootprint` and the height of the surface under its centre. An actor
standing on base terrain needs no query; an actor above terrain (deck, ramp,
roof, jump) makes one `SurfaceReceivers.hit` point query, the same support
lookup projection already makes.

**Drawing.** `GpuDeferredShadows` draws every queued oval in one instanced draw
after the world is complete, before late decals and non-world overlays:
- The world target gets a sampleable depth texture once a shadow asks for it,
  attached between frames. Without the flag it keeps its renderbuffer.
- World depth is `0.5 − (wy + z − cameraY) / range` and screen y is
  `scale × (wy − z) + origin`, so a pixel and its depth give the visible point's
  `wx`, `wy` and `z`. Base terrain never writes depth: a cleared pixel is ground
  at `z = 0`.
- Only upward-facing receivers take a shadow. Along one screen column `wy + z`
  rises on floors, ramps and roofs and falls on upright sprites, so a caster does
  not darken its own or a neighbour's body.
- A receiver must lie within a slack of the support height
  (`2 + 0.6 × max(rx, ry)` px), which covers slopes inside the footprint.
- The mask is the analytic form of the CPU oval mask, at alpha 0.28, blended as
  premultiplied black like the decal quads.
- The pass uses raw WebGL on a colour-only framebuffer, so the sampled depth
  texture is not attached to the draw framebuffer, then resets Three.js state.

Rooms (no world depth), clipped scene passes (explorer, renderer lab) and the
native review raster have no such pass: `drawSceneEntry2D` draws the plain
ground shadow there. Vehicles, particles and landing rings keep the projected
path.

**Known differences from projection.**
- A footprint that straddles a ledge shades only receivers near the centre's
  support height. Projection also shades the lower level.
- At a ramp crest the GPU pass shades the seam strip that projection leaves
  unshaded (16–30 pixels in the probe).
- A caster near a ramp's low end can shade the ramp top within the slack.
- Mask edges differ by up to 7 of 255 levels (analytic oval against a 64 px mask).

### Equivalence probe

`probeDeferredShadows` (renderer lab; browser case in `tests/gpu-renderer.spec.ts`)
draws the same oval both ways over the ramp/deck fixture at three zooms. Flat
ground, an airborne caster, the ramp, the deck, a caster under the deck and a
caster behind a solid body all agree within 7 levels with no pixel differing by
more than 12. The crest case differs on 16–30 pixels.

### Results

Node render lane, 235 tape, Node 24.22.1, three interleaved pairs:

| Shadows | `render.prepare` p50 | p95 |
| --- | ---: | ---: |
| Projected | 9.26–9.55 ms | 10.6–10.7 ms |
| GPU ovals | 5.49–5.92 ms | 6.8–7.4 ms |

The remaining difference from the 1.7 ms floor is the 50 parked cars' projected
shadows (about 650 decal items and 3,400 fragments per frame, although none of
them move) and receiver construction.

Scorecard, `crowd` at 0.25 (p50):

| Device | Shadows | Render | Frame p50 | Missed |
| --- | --- | ---: | ---: | --- |
| M4 Pro, 120 Hz | Projected | 8.8 ms | 8.7 ms | 144 of 457 |
| M4 Pro, 120 Hz | GPU ovals | 6.1 ms | 8.3 ms | 13 of 587 |
| Pixel 7a, pair 1 | Projected | 24.4 ms | 49.9 ms | n/a |
| Pixel 7a, pair 1 | GPU ovals | 20.3 ms | 33.4 ms | n/a |
| Pixel 7a, pair 2 (GPU first) | Projected | 25.3 ms | 49.9 ms | n/a |
| Pixel 7a, pair 2 (GPU first) | GPU ovals | 18.7 ms | 33.3 ms | n/a |

The Mac's GPU timer falls from 2.67 to 1.74 ms: the pass is cheaper on the GPU
than the decal quads it replaces. At zoom 1 (about 100 rabbits in view) render is
unchanged at 3.2 ms. At 0.1 the shared overview LOD already skips projection, so
the flag has no effect. The phone stayed at thermal status 0 (26.6–28.3 °C); its
missed-frame counts are not comparable because the median interval itself moved.

Also in this slice: `roofSupport` tests height before identity and kind. The
predicates are pure, so the result is the same (scene hashes unchanged). One
matched render-lane pair measured 9.23 → 8.63 ms, which is within the
run-to-run spread seen later, so no saving is claimed.

## Validation

- Render lane `--verify --assert-equivalent` against the 235 checkpoint: every
  default-path scene hash matches.
- 633 Vitest cases in `src/rendering`, `src/traffic` and `src/session`, and the
  four crowd-bench harness checks, pass.
- Typechecks, Biome on changed files and the code-health ratchet pass.
- Art catalog and Workshop manifest regenerated; production build passes.
- All 28 cases in `tests/gpu-renderer.spec.ts` pass in bundled Chromium,
  including the new probe case and the existing surface-decal case.
- Not run: the full repository suite and the streaming readiness gate (no
  streaming or default rendering behaviour changed), and any Steam Deck run.

## Next slices, in order

1. **Owner review of `?shadows=gpu`.** Decide whether the known differences are
   acceptable, then make it the default at every zoom and delete the oval branch
   of the projected path.
2. **Vehicle shadows in the same pass.** A rotated footprint, the rounded
   `vehicle` mask and the body's underside plane as the height limit. This
   removes the remaining ~3 ms of crowd preparation and most receiver use.
3. **Stop cloning presented entities each frame** (`RemotePresentation.sample`):
   reuse one presented record per entity and rewrite only pose fields.
4. **Bound per-frame UI scans and receiver construction** (the 235 slice-1
   items), then reprofile the phone.
5. **Reconsider the retained, instanced scene** only if collection and
   submission still exceed the budget after 1–4. Today they are 1.7 ms and
   0.3–1.8 ms on the Mac.
6. **Steam Deck scorecard run**, once the packaged shell is launched with its
   CDP port.
