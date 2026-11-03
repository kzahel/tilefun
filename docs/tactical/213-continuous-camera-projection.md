# Continuous camera projection

Status: delivered and locally qualified; owner playtest next.
Updated: 2026-11-03.

Follow-up: [214](214-world-registration.md) reproduces a stationary-world registration
regression under the new default. The static rigidity probe below retained snapped
projection and did not qualify that default. Moving-actor results remain valid;
the combined static/moving raster contract needs repair. Runtime policy is unchanged
at the investigation checkpoint.

Owner asks to reproduce and fix the remaining camera wobble noted in 211/212.
Preserve shared rendering/picking, pixel-art source banks, cached surfaces and
Canvas/GPU alignment. No simulation or prediction change is needed.

## Reproduction and fix

The pacing runner now also observes real backend draw destinations: cropped
`drawImage` rectangles for the player and `drawTexture` rectangles for the driven
car. Before the change, repeated steady walk/run sprite draws shift by a screen
pixel, and car draws vary by about 0.995–1.000px. The camera's continuous follow
state is stable; `Projection` independently rounds its screen translation while
the actor keeps its fractional world phase. That changes the actor's screen offset.

The common GameClient/ScenarioPresentationHost policy now defaults to continuous
projection. Shared sprite-edge rounding still determines destination widths from
both edges, and terrain retains seam overscan. Picking uses the same inverse
projection. The existing `?pixelsnap=1` comparison retains the old grid-lock mode;
no option or alternate renderer is introduced. Reference cameras already default
to continuous projection, so their source/art contracts are unchanged.

The native followed-actor regression fails under the old default and now passes
across fractional zooms and negative world coordinates. Explicit snapped geometry
and inverse-picking checks remain. All 39 selected projection/camera/terrain/
shared-prediction tests and all three TypeScript projects pass.

## Draw-position evidence

[The compact evidence](../benchmarks/213-continuous-camera-projection.json) records
before/after captures in two fresh ordinary Worker sessions each. After the change,
steady walk/run sprite destinations have zero horizontal range; the car destination
range is below 0.001px in both sessions. Every measured draw matches continuous
projection without the independent camera-rounding offset. No page errors occur.

The first before/walk capture includes another camera/player-relative transient,
with 4px total destination range. The artifact separately computes the rounding
contribution against the identical frames' continuous projection; it does not
attribute the entire transient to camera rounding. Normal pixel rasterization
and texture resampling remain, especially at fractional zoom.

## Qualification / next

Implementation checkpoint: `ea495386`. All eight selected production Chromium
cases pass: fractional-scale sprite seams (64 pixel reports across Canvas/GPU),
explicit snapped-reference stability (20 reports), default game/lab camera policy,
cached-surface reuse, unsupported-WebGL2 Canvas fallback, car ramp/seat reload and
traffic pause/reload/teardown. The main/lab assertions now require the continuous
default; frozen explicit snapped probes remain unchanged.

Art catalog and all 2,120 Workshop identities pass; the production build passes.
The review runtime source now includes presentation settings and projection math,
so a camera-policy change cannot silently retain the prior review fingerprint.
After this metadata addition, the manifest/build and shared traffic browser case
were requalified. Manifest changes are 1,024 runtime fingerprints and input digest;
there are no new candidates or changed art-bank pixels. Art catalog is unchanged.

GPU/meshes streaming readiness at 4× CPU throttling passes. Walking, sprinting and
reversal retain 16.8ms frame p99 and zero final missing/incomplete/stale terrain.
These are desktop captures, not physical-phone qualification.

Next: owner Save and reload and compare steady walking/running/driving on the
original desktop. Commit delivery evidence and mark development readiness last.
