# 236 — Render scorecard and GPU depth shadows

Status: delivered · 2026-11-10. Scorecard on the M4 Pro, Pixel 7a and Steam Deck;
body shadows drawn only by the GPU depth pass (owner decision: no second path);
resting entities presented without copies.
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
| `city` | The generated city: apartment and shop blocks, traffic and a station (arrival 300,519, the streaming bench's city) |
| `crowd` | The same place plus 1,000 rabbits and 50 parked cars |
| `woods` | Woodland beside the racetrack (arrival −380,−364): the most props and wildlife in an overview |

Earlier reports named these differently: `city` was `street` and then `town`,
and `woods` was first called "city" after an older note about that arrival. The
0.1× view of arrival 300,519 shows it is the city; −380,−364 is woodland.

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
- `--query=<params>` adds game URL parameters, for an A/B of a renderer flag.
- `--base=<origin>` targets an existing production origin (a `vite preview`
  server or the packaged shell) instead of the isolated Vite dev server.
- `--attach-page` drives the attached browser's existing page (the packaged shell
  has one window and no tabs).
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
| city | 1 | 8.3 / 0 of 600 | 0.8 | 0.3 | 0.97 | 0.9 |
| city | 0.25 | 8.3 / 0 of 600 | 1.2 | 0.4 | 1.78 | 1.2 |
| city | 0.1 | 8.3 / 0 of 600 | 1.3 | 0.8 | 1.93 | 1.4 |
| crowd | 1 | 8.3 / 2 of 598 | 3.9 | 0.4 | 2.29 | 4.1 |
| crowd | 0.25 | 10.2 / 161 of 410 | 9.6 | 1.3 | 5.02 | 9.7 |
| crowd | 0.1 | 9.5 / 173 of 426 | 6.0 | 1.8 | 3.45 | 6.5 |
| woods | 1 | 8.3 / 0 of 600 | 1.1 | 0.3 | 0.62 | 1.2 |
| woods | 0.25 | 8.3 / 0 of 600 | 1.6 | 0.2 | 0.62 | 1.7 |
| woods | 0.1 | 8.3 / 0 of 600 | 2.3 | 0.9 | 0.84 | 2.6 |

Pixel 7a, Chrome 156 over CDP, 60 Hz, battery 23.9 → 27.3 °C, thermal status 0:

| Scene | Zoom | Frame p50 / missed | Render | Submit | Render + finish | Worker tick |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| city | 1 | 16.7 / 0 of 300 | 3.4 | 1.4 | 3.9 | 4.3 |
| city | 0.25 | 16.7 / 0 of 300 | 3.9 | 1.5 | 4.0 | 4.3 |
| city | 0.1 | 16.7 / 1 of 299 | 4.1 | 2.7 | 4.1 | 3.1 |
| crowd | 1 | 16.7 / 84 of 210 | 12.5 | 0.8 | 12.7 | 33.5 |
| crowd | 0.25 | 50.0 / 6 of 93 | 29.5 | 4.0 | 28.6 | 48.0 |
| crowd | 0.1 | 33.4 / 17 of 125 | 16.7 | 4.2 | 17.2 | 36.8 |
| woods | 1 | 16.7 / 0 of 301 | 3.9 | 0.8 | 4.0 | 6.3 |
| woods | 0.25 | 16.7 / 2 of 291 | 4.4 | 0.6 | 4.5 | 6.9 |
| woods | 0.1 | 16.7 / 0 of 300 | 5.0 | 1.5 | 5.3 | 8.7 |

The Steam Deck was measured later, on the final code (see Final scorecard).

### What the baseline says

1. **Rendering is CPU-bound on both devices.** Render plus a blocking GPU finish
   is within about 1 ms of render alone in every cell (the two are separate
   sampling windows). The earlier suspicion that the phone's 0.1× overview is
   limited by GPU fill does not reproduce: `city` and `woods` hold 60 Hz at
   every zoom.
2. **Only the crowd misses cadence.** `city` and `woods` hold 120 Hz on the Mac
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

## GPU depth shadows

Every body shadow in the GPU fixed view is drawn from world depth. The work came
in three steps: an opt-in for actor ovals, then vehicle footprints and the
default, then (owner decision) removal of the projected body-shadow path and its
`?shadows=` switch. `projectShadow`, the decal mesh gating and the bench's
`--shadows` option are deleted.

**Collection.** A caster's shadow is no longer clipped against receivers. Its
sprite carries `gpuShadow` (`GpuShadowShape.ts`): a footprint parallelogram, a
mask, an upper plane and a band of heights below it.
- An actor oval is the oval of `shadowFootprint`, around the height of the
  surface under its centre.
- A boat or train without a mesh pose uses the same oriented footprint with the
  soft oval mask.
- Below 0.2× no receivers are built; the collector's own surface height stands in
  for the query, and a roof rider's support is the roof it stands on. Overview
  shadows therefore use the same pass.
- Towed cars and truck-bed contents leave the sorted scene list; the body that
  draws them queues their shadows.
- A mesh vehicle is the oriented footprint of `shadowFootprint`. Its upper plane
  is the body's underside (following pitch and roll), so its own roof and bonnet
  never receive the shadow. The band reaches down to the surface under its centre.
- A caster standing on base terrain needs no query. A caster above terrain (deck,
  ramp, roof, jump) makes one `SurfaceReceivers.hit` point query, the same
  support lookup projection already makes.
- A mesh vehicle's shadow is dropped by the pass unless that body was drawn in
  the same view: sprite fallbacks contain a baked shadow.

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
- A receiver must lie under the caster's plane and within its band. An oval's
  slack is `2 + 0.6 × max(rx, ry)` px, which covers slopes inside the footprint;
  a vehicle's is 4 px.
- The masks are the analytic forms of the CPU `oval` and `vehicle` masks, at
  alpha 0.28, blended as premultiplied black like the decal quads.
- The pass uses raw WebGL on a colour-only framebuffer, so the sampled depth
  texture is not attached to the draw framebuffer, then resets Three.js state.

Rooms (no world depth), clipped scene passes (explorer, renderer lab) and the
native review raster have no such pass: an oval draws the plain ground shadow
there. Receiver projection (`SurfaceReceivers.project`, `surfaceDecals`) remains
for contact effects only: particles and landing rings.

**Known differences from projection.**
- A footprint that straddles a ledge shades only receivers near the centre's
  support height. Projection also shades the lower level.
- At a ramp crest the GPU pass shades the seam strip that projection leaves
  unshaded (16–30 pixels in the probe).
- A caster near a ramp's low end can shade the ramp top within the slack.
- Mask edges differ by up to 9 of 255 levels (analytic masks against 64 px images).
- A tilted vehicle uses one underside plane. The deleted projection cast from
  each upper face with its own ceiling, so stacked or interpenetrating bodies
  can look different from before.
- A vehicle's own low parts (sills, tyre bottoms) within 4 px of its underside
  can take a little of its shadow where they face up.

### Equivalence probe

`probeDeferredShadows` (renderer lab; browser case in `tests/gpu-renderer.spec.ts`)
draws the same shadow two ways over the ramp/deck fixture at three zooms: the GPU
pass, and an oracle that clips the same footprint against receivers on the CPU
(the live contact-effect projection). For
ovals: flat ground, an airborne caster, the ramp, the deck, a caster under the
deck and a caster behind a solid body agree within 7 levels. The crest case
differs on 16–30 pixels. For vehicles: yawed on flat ground, pitched along the
ramp and turned on the deck agree within 9 levels. No other pixel differs by
more than 12.

### Results

Node render lane, 235 tape, Node 24.22.1 (`render.prepare` for the crowd):

| Shadows | p50 | p95 |
| --- | ---: | ---: |
| Projected (three runs across the slice) | 8.3–9.5 ms | 9.0–10.7 ms |
| GPU ovals only (first step, three runs) | 5.5–5.9 ms | 6.8–7.4 ms |
| GPU ovals and vehicles (default, two runs) | 1.46–1.49 ms | 2.8 ms |

Scene items fall from about 2,705 to 1,051 per frame and receiver queries from
2,083 to 12. What remains is collection itself and receiver construction.

Scorecard, `crowd`, matched pairs while both paths existed (p50):

| Device | Zoom | Shadows | Render | Frame p50 | Missed |
| --- | --- | --- | ---: | ---: | --- |
| M4 Pro, 120 Hz | 0.25 | Projected | 8.4 ms | 8.4 ms | 115 of 487 |
| M4 Pro, 120 Hz | 0.25 | GPU | 3.6 ms | 8.3 ms | 0 of 600 |
| M4 Pro, 120 Hz | 1 | Projected | 3.1 ms | 8.3 ms | 0 of 600 |
| M4 Pro, 120 Hz | 1 | GPU | 2.6 ms | 8.3 ms | 0 of 600 |
| Pixel 7a, 60 Hz | 0.25 | Projected | 22.9 ms | 33.4 ms | 5 of 139 |
| Pixel 7a, 60 Hz | 0.25 | GPU | 10.7 ms | 16.7 ms | 55 of 247 |
| Pixel 7a, 60 Hz | 1 | Projected | 10.5 ms | 16.7 ms | 30 of 271 |
| Pixel 7a, 60 Hz | 1 | GPU | 9.0 ms | 16.7 ms | 17 of 282 |

Missed counts are relative to each run's own median interval, so the phone's
0.25 rows are not comparable: its median moved from 33 to 17 ms. The phone
stayed at thermal status 0 (24.6–26.0 °C). The Mac's GPU timer at 0.25 is
1.7 ms projected and 2.8 ms with the pass; both are far inside the frame.

At 0.1 the overview LOD draws plain shadows in both modes, so nothing changes
there: the Mac's crowd at 0.1 is 4.5–5.2 ms render and still misses frames
(45 of 555 in the final crowd-only run). That cell is now the worst one.

The ovals-only step measured Mac render 8.8 → 6.1 ms and Pixel 7a about
25 → 19 ms at 0.25.

Also in this slice: `roofSupport` tests height before identity and kind. The
predicates are pure, so the result is the same (scene hashes unchanged). One
matched render-lane pair measured 9.23 → 8.63 ms, which is within the
run-to-run spread, so no saving is claimed.

## Cleanup and follow-ups (same day)

**One shadow path.** The numbers above compared the two paths while both
existed. After the removal, crowd `render.prepare` is 1.56 ms p50 / 2.65 ms p95.

**Overview shadows.** Below 0.2× casters now carry `gpuShadow` too, instead of
plain ellipses in the painter pre-pass. On the production build the Mac's crowd
at 0.1 went from missing 166 of 395 frames to 0 of 601 in the same run order
(render 5.5 → 4.8 ms; the earlier build also ran in that session).

**Resting entities are not copied.** `RemotePresentation.sample` cloned every
replicated entity with an object spread on every frame. It now presents the
entity itself when the sampled pose equals its committed pose and previous pose
(position, height, jump, heading and rotation): the copy would have been equal
field for field. Moving entities are still copied.
- Client lane, `client.presentation` per 120 Hz frame: 0.728 → 0.31 ms.
- Every collected scene hash is identical with the fast path on and off.

### Final scorecard (p50, ms)

M4 Pro, headed 120 Hz, **production build** (`--base` on `vite preview`):

| Scene | Zoom | Frame / missed | Render | Submit | GPU timer | Update |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| city | 1 | 8.3 / 0 of 600 | 0.6 | 0.3 | 0.95 | 0.6 |
| city | 0.25 | 8.3 / 0 of 600 | 0.8 | 0.4 | 1.74 | 0.6 |
| city | 0.1 | 8.3 / 0 of 599 | 1.2 | 0.5 | 1.61 | 0.6 |
| crowd | 1 | 8.3 / 0 of 600 | 2.5 | 0.3 | 2.32 | 2.7 |
| crowd | 0.25 | 8.3 / 3 of 598 | 4.7 | 1.2 | 5.02 | 2.9 |
| crowd | 0.1 | 8.3 / 0 of 601 | 4.8 | 1.6 | 4.86 | 2.9 |
| woods | 1 | 8.3 / 0 of 600 | 1.0 | 0.3 | 0.60 | 0.6 |
| woods | 0.25 | 8.3 / 0 of 600 | 1.3 | 0.2 | 0.62 | 0.8 |
| woods | 0.1 | 8.3 / 0 of 600 | 2.1 | 0.7 | 0.69 | 0.9 |

A crowd-only run in a fresh tab measured render 2.5 / 3.4 / 3.8 ms with 0, 0 and
2 missed frames. The crowd draws about twice as many batches when it follows
another scene in the same tab (37–40 against 15–34); that is unexplained.

Pixel 7a, Chrome over CDP, 60 Hz, Vite dev modules, 25.3 → 27.1 °C, status 0:

| Scene | Zoom | Frame / missed | Render | Submit | Update | Worker tick |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| city | 1 | 16.7 / 0 of 300 | 3.2 | 1.4 | 3.5 | 4.2 |
| city | 0.25 | 16.7 / 0 of 300 | 3.5 | 1.5 | 3.0 | 4.1 |
| city | 0.1 | 16.7 / 0 of 300 | 4.1 | 2.0 | 2.9 | 4.0 |
| crowd | 1 | 16.7 / 23 of 276 | 9.1 | 0.7 | 5.9 | 33.4 |
| crowd | 0.25 | 33.3 / 12 of 188 | 13.6 | 1.5 | 6.2 | 45.6 |
| crowd | 0.1 | 16.7 / 88 of 200 | 11.5 | 2.6 | 7.0 | 36.5 |
| woods | 1 | 16.7 / 0 of 300 | 3.9 | 1.0 | 3.1 | 7.5 |
| woods | 0.25 | 16.7 / 0 of 300 | 4.2 | 0.7 | 3.4 | 8.1 |
| woods | 0.1 | 16.7 / 0 of 300 | 4.7 | 1.4 | 3.3 | 7.8 |

Steam Deck, packaged Electron 44 shell in Gaming Mode, production build, 90 Hz
(11.1 ms), 1280×800:

| Scene | Zoom | Frame / missed | Render | Submit | GPU timer | Update | Worker tick |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| city | 1 | 11.1 / 0 of 450 | 2.0 | 1.0 | 0.78 | 1.7 | 2.1 |
| city | 0.25 | 11.1 / 0 of 450 | 3.1 | 1.7 | 0.76 | 1.9 | 2.0 |
| city | 0.1 | 11.1 / 0 of 450 | 4.3 | 2.2 | 0.87 | 1.8 | 2.2 |
| crowd | 1 | 11.1 / 107 of 344 | 7.6 | 0.8 | 1.21 | 5.9 | 31.9 |
| crowd | 0.25 | 22.2 / 41 of 212 | 12.8 | 1.9 | 1.47 | 5.7 | 41.4 |
| crowd | 0.1 | 33.3 / 4 of 153 | 18.0 | 7.7 | 2.85 | 6.2 | 37.4 |
| woods | 1 | 11.1 / 0 of 450 | 3.4 | 1.1 | 0.46 | 2.5 | 5.1 |
| woods | 0.25 | 11.1 / 0 of 450 | 4.0 | 0.8 | 0.47 | 2.5 | 5.3 |
| woods | 0.1 | 11.1 / 2 of 448 | 6.1 | 2.2 | 0.72 | 3.0 | 5.7 |

What the three devices agree on:
- `city` and `woods` hold the display cadence at every zoom.
- The GPU is idle: its timer is under 3 ms on the Deck and under 5 ms on the Mac.
- With 1,000 rabbits the phone and the Deck are limited by the authority (ticks
  of 32–46 ms against a 16.7 ms step). Their crowd render numbers are taken
  while the simulation runs at about half speed and replication arrives in
  bursts, so they are not clean render measurements. 235 owns that work.
- The Deck's crowd at 0.1 spends 7.7 ms in submits, the largest submit cost
  measured anywhere.

Deck procedure: `node scripts/build-desktop.mjs --linux` after a build; a
separate Devkit title (`tilefun_renderbench`) whose launcher exports
`TILEFUN_CDP_PORT` and an isolated `TILEFUN_USER_DATA`; an SSH forward of that
loopback port; then `render:bench --cdp=… --base=tilefun://app/tilefun
--attach-page`. The Devkit manifest's `env` did not reach the process, so the
exports live in a launcher script inside the payload. The bench title is still
installed on the Deck; its process was stopped and its save directory removed.

## Validation

- Scene hashes: identical with the resting-entity fast path on and off.
- `collectScene.test.ts` digests are unchanged by the cleanup.
- `DepthShadowQueue.test.ts` (Node): a body queues its own shadow and those of
  its towed car and bed contents, gated on the body; a sink without the pass
  draws the plain shadow, for a mesh car only while its mesh is ready; a roof
  rider keeps the roof as its support in the overview.
- 879 Vitest cases in `src/rendering`, `src/session`, `src/scenes`,
  `src/traffic` and `src/client`, and the four crowd-bench harness checks, pass.
- Typechecks, Biome, the code-health ratchet and knip pass.
- Art catalog and Workshop manifest regenerated; production build passes.
- Full browser suite on the final production build: 556 of 557 pass first time.
  The apartment interior case (`gameplay-interiors.spec.ts:12`) timed out once
  and passed on retry in each of three full runs today; 233 already lists it as
  a known local flake. An earlier run also retried the split-screen leave case,
  likewise listed there.
- The streaming readiness gate was not run (no streaming change).

### Independent review

A separate review session (yepanywhere, `gpt-6.1-sol`, high effort, read-only)
found no stale-pose, GL-state or feedback-loop defect, and three shadow gaps,
all fixed before the commit:
- Towed cars and bed contents lost their shadows, because grouped children
  leave the scene list. The drawing body now queues them.
- A mesh vehicle had no fallback where the pass cannot run (clipped passes, the
  first frame). Its shadow now queues before the body like an oval's, and the
  pass drops it at draw time if the body was not drawn.
- Mesh-body eligibility leaked between split-screen views. It is now cleared per
  view.
It also noted that a roof rider's overview shadow used terrain height (fixed
with roof support) and two stale documentation lines (fixed).

## Next options

1. **Authority first on weak devices (235).** The phone and Deck crowd cells are
   authority-bound. Sleeping-body reads and change-tracked replication are the
   planned slices there.
2. **Per-frame client scans.** `vehicleChoice`/`driveCandidate` and recipe
   appearances run over every entity each update (5–7% of the phone's main
   thread in the crowd).
3. **Receiver construction.** `SurfaceReceivers` is rebuilt every frame from all
   entities and props, and now serves only point queries and contact effects.
4. **Submission at overview scale.** The Deck spends 7.7 ms submitting the
   crowd at 0.1; sprites of a pixel or two could be skipped or instanced.
5. **The unexplained batch count** when the crowd follows another scene.
6. **Shadows in the first-person view**, by porting the depth pass.
7. **A retained, instanced scene** remains last: collection is 1.6 ms.

## Renderer notes for later 3D work

- The fixed view is one WebGL2 context with a painter-ordered, depth-writing
  quad batch. Vehicles are real meshes, but each renders into its own offscreen
  colour/depth pair and is composited as one quad carrying per-pixel depth.
- The first-person and chase views (229, 230) are a second Three.js renderer on
  their own canvas with unlit materials and fog. They share the collected
  actors, props and vehicle assets, but draw no shadows at all.
- So there is no unified shadow system across the two. The depth pass here is
  the nearest thing to one: it needs only a depth buffer and the casters'
  shapes, both of which a perspective view also has.
