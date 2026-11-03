# Continuous camera projection

Status: implemented; native and production motion captures pass, raster qualification in progress.
Updated: 2026-11-03.

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

Build/inventories, existing fractional-scale seam/overlap pixel probes on both
backends, snapped static-reference stability, default game/lab policy, cached-surface
reuse, Canvas fallback, car/traffic lifecycle and streaming readiness follow.
Commit delivery evidence and mark development readiness last. Then owner Save and
reload and compare steady walking/running/driving on the original desktop.
