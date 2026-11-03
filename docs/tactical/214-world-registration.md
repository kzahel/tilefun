# World registration during camera settling

Status: reproduced and investigated; compositor recommendation is provisional,
with no playable renderer change delivered.
Updated: 2026-11-03.

Follow-up: [215](215-coherent-world-raster.md) implements the common composition
and fractional-actor repair. The investigation/control evidence below is historical.

Owner observes trees and the stopped player shifting a pixel relative to terrain
after movement. This follows the continuous-camera change in 213. Preserve both
static-world registration and the steady followed-actor behavior; toggling the
old camera mode alone is not a complete repair.

## Reproduction and evidence

[Compact evidence](../benchmarks/214-world-registration.json) records bundled full
Chromium 153.0.8010.12 against runtime revision `5cad3fd0`:

- The existing real cached-terrain/sprite/grass probe reproduces relative horizontal
  prop/terrain displacement up to 1 screen pixel with continuous projection. Both
  Canvas and GPU reproduce it across fractional camera phases and positive/negative
  world regions. Five zooms are sampled: 0.4, 0.5, 0.8, 1 and 1.3.
- Explicit snapped projection gives zero relative displacement and exact rigid
  integer translation in all 20 groups. This preserves the older static-world fix,
  but 213 already demonstrates its moving-follow-target problem.
- An isolated control changing terrain origin rounding from round to floor still
  produces 1px relative displacement. Matching rounding function names is insufficient.
- Two ordinary GPU + mesh game sessions each capture walk, immediate release/stop,
  run and driving. Both 240-frame stop stages have exactly constant displayed XY,
  one retained terrain resource, and a 1px horizontal player/terrain draw-offset
  range. Grounded Z varies by less than 0.00013 world pixels; that cannot explain
  horizontal displacement. No page errors occur. Steady walk/run draw X remains
  fixed, with driven-car draw X range below 0.001px, confirming the tradeoff.

For example, one stop capture has player X=306.13140869140625 throughout. The
sprite/terrain-left difference is 894px at frame 0, 893px at frame 10, 894px at
frame 12, 893px at frame 33, and 894px at frame 34. Only the camera is moving
horizontally. This is raster placement, not a prediction correction.

Reproduce with Node 24 and installed bundled Chromium:

```sh
node scripts/instrumentation/camera-registration.mjs --output=/tmp/tilefun-registration
node scripts/instrumentation/movement-pacing.mjs --output=/tmp/tilefun-pacing
```

Both runners own isolated Vite/data/browser resources and clean up on completion.
The registration runner observes the existing lab probe and two isolated controls;
it adds no production renderer mode. Its landmark coordinates deliberately follow
CameraStabilityProbe and its ordering/count checks fail if that fixture changes.
Raw frame traces stay local. Movement capture now retains an actual terrain draw
and samples release immediately, alongside its existing steady movement stages.

## Cause and previous validation gap

The world uses one logical projection, but final raster placements differ:

- `TerrainFrame` rounds projected chunk origins and stretches each cached 256px
  image to its scaled size plus a 1px seam overscan.
- `Canvas2DRenderer.drawSprite`, shared by Canvas/GPU sprites, floors both projected
  rectangle edges. Fractional zoom can change width/height by a pixel as well as origin.
- Grass and shadows have other integer placements; mesh image anchors remain fractional.

Continuous camera translation is therefore quantized independently by each object.
When follow settles, their thresholds occur on different frames. Even identical
floor operations do not fix arbitrary anchors: `floor(A + T) - floor(B + T)` can
change when A-B is fractional. Natural tree anchors and physics poses are fractional;
non-integral zoom creates this even for otherwise grid-aligned world positions.

213 correctly measured followed actors, seam coverage, picking and default policy,
but its stationary rigidity browser test still called `probeCameraStability()` with
the old explicit snapped default. Passing adjacent-sprite coverage does not establish
registration against terrain. Those were two separate guarantees; the combined
default-policy qualification was missing. Future coverage must check both together.

Overscan stretching is a separate scale inconsistency worth removing in the repair:
it slightly changes terrain texel scale relative to props within each chunk. The
camera-phase experiments establish independent placement as a cause of the wiggle;
they do not isolate the stretching's contribution to appearance.

## Provisional solution and bounded implementation slices

Recommend proving a common world raster frame with one final fractional camera
translation. Static terrain, props, grass, shadows and stopped actors should retain
one stable raster relationship. Render the world against the shared aligned frame,
then apply the camera's fractional remainder once to the composed world image.
HUD/text remain separate. Physics/world coordinates and camera follow stay continuous.

A post-readback Canvas prototype translates each snapped image once with smoothing.
Prop/terrain centroid variation falls from 1px to at most 0.0103px across all sampled
groups (8-bit filtered-color measurements). Thresholded integer bounding boxes can
still change by 1px under filtering; that is not independent geometry movement.
This demonstrates stationary composition only. It does not qualify a GPU host,
moving actors, retained art appearance, or performance.

1. **Prove both guarantees in one small scene.** Include actual tree/terrain art,
   a sprite player and mesh car, steady motion and release, fractional zoom and
   negative coordinates. Moving actors need fractional placement/sampling inside
   the world frame too: retaining their old floored rectangles would simply put
   the moving-player wobble inside the new target. Avoid switching raster policy
   based on whether an actor is currently moving; that can pop on stop/start.
   Show the sampling/crispness tradeoff before promoting the design. Compare a
   coordinated pixel-grid/follow-anchor alternative if resampling is unacceptable;
   the existing absolute camera snap toggle does not establish that alternative.
2. **Integrate one shared frame lifecycle after that proof.** Add an explicit
   world-complete/composition boundary to RenderHost and all game/lab consumers.
   GPU already separates HUD; Canvas currently shares world/UI and needs an owned
   world target. Include interiors, Edit, captures, resize, context recovery, renderer
   switching and inverse picking. Keep cached terrain/elevated surfaces and ordered
   batches. Replace overscan stretching with scale-correct padded/extruded edges.
   Audit atlas crop boundaries before any filtering, to avoid neighboring-frame bleed.
3. **Qualify the combined contract and cost.** Default-policy tests must cover
   camera-only rigidity, followed actors in steady movement, stop/settle, zoom and
   sprite/terrain seams on both backends. Include grass/shadows, bridge overlays and
   mesh/sprite fallback. Measure the bounded extra target/fullscreen pass on a
   Chromebook/phone before defaulting. A 1280x900 RGBA8 image alone is about 4.4MiB;
   fill/bandwidth and Canvas composition cost remain unmeasured, not assumed free.

Filtered final translation can soften edges over roughly a screen pixel. Perfectly
crisp integer pixels, arbitrary smooth subpixel camera motion and arbitrary fractional
geometry cannot all be promised simultaneously. The acceptance criterion is one
coherent moving image and stable geometry, not identical hard pixel classifications
at every fractional phase. A camera freeze, separate per-layer rounding tweaks or
CSS-only world shift would not qualify the complete contract.

## Checkpoint

No gameplay, physics, camera policy or production renderer code changed. The two
diagnostic CLIs completed against the current runtime; focused script lint and
diff checks qualify the instrumentation/documentation checkpoint. No new tests or
full build are needed for this investigation. Next: implement the combined visual
prototype before committing to the production composition design.
