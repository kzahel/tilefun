# 237 — Dropped frames while driving on the phone

Status: delivered · 2026-11-10. Driving through the city on the Pixel 7a dropped
12–15 frames in 30 seconds; it now drops none.
Owner: [performance](../topics/performance.md); renderer contracts in
[rendering architecture](../topics/rendering-architecture.md).

The owner reported visible frame drops when driving around the city on the phone,
with traffic on the roads. Standing in the same city the phone held every frame
(0 of 300 missed, authority tick 3.6 ms), so the drops came from moving.

## Measurement: the `drive` scene

`npm run render:bench -- --scenes=drive` arrives in the seed-2026 city, puts the
player in a car and drives it with a small autopilot that runs in the page: it
holds the throttle, follows road tiles in the right-hand half of the street,
turns where the road ends and turns round after two seconds without progress.
The route is not a fixed replay: traffic differs between runs, and in about one
run in four the car is held up and covers under 1,000 px. Compare runs by
`drivenPx`.

The bench gained, for every scene:

- `slowFrames`: each frame interval over 25 ms, with the update and render time
  spent in it and the texture pages uploaded around it;
- `upload`: texture bytes and pages uploaded per frame;
- `--profile` now also saves the main-thread CPU profile and the page clock's
  origin, so profile samples can be assigned to individual slow frames;
- `--trace` saves a Chrome trace of every thread and the GPU process.

## What the drops were

Profile samples inside the slow frames, then a trace, showed three causes, all
in bringing new terrain and sprite pages onto the GPU as the car moves:

1. **A texture copy that waited for the GPU.** Each page upload went through
   three.js's `copyTextureToTexture`, which first reads five pixel-store
   parameters from the GL context. The depth-shadow pass resets three.js's
   cached state every frame, so those reads were real `gl.getParameter` calls,
   and each waits until the GPU process has finished the upload just issued:
   20–40 ms on the phone, inside the render callback. This was about two thirds
   of all time in slow frames.
2. **Terrain rasterized in the GPU process.** Chunk images were built on
   GPU-backed 2D canvases, where the tile blits are only recorded on the main
   thread and executed later in the GPU process. The builder's 2 ms time budget
   saw none of that cost; the trace showed 72 GPU-process flushes of 8–30 ms in
   45 seconds.
3. **Four-megabyte page uploads.** A sprite sheet was split into 1,024-texel
   pages, and a page uploads whole the first time a sprite in it is drawn. For
   the large building sheet (2,816 × 8,224) that was 4 MiB at once, up to 11 MiB
   in one frame.

A fourth, rarer cause remains: one 20 ms major garbage collection on the main
thread in the traced run.

## Changes

- `GpuPageAtlas.write` copies the staging texture into its atlas layer with
  plain GL (`copyTexSubImage3D` from a read framebuffer), reading nothing back.
- Terrain chunk canvases (`cpuRasterCanvas` in `RasterSurface.ts`) and page
  source canvases are CPU canvases: rasterized on the calling thread, inside
  the time budget, and uploaded as pixels.
- Pages are at most 512 texels a side (1 MiB). The atlas layer stays 1,024.

## Result

Pixel 7a, 30 seconds of driving at zoom 1, before and after runs alternated
([evidence](../benchmarks/237-phone-driving-hitches.json)):

| | Before (`085fe6fc`) | After |
| --- | ---: | ---: |
| Missed frames, runs that drove over 2,000 px | 15, 15, 12 of about 1,783 | 0, 0 of 1,800; two more runs of the final code: 0, 0 |
| Worst frame in those runs | 50–67 ms | 16.9–17.5 ms |
| Missed frames, car held up (under 1,000 px) | 1 | 1, 0 |
| Largest upload in one frame | 4–7 MiB | 1–2.5 MiB |
| Render p50 / p95 | 3.4–3.8 / 5.1–5.4 ms | 3.9–4.1 / 5.5–6.2 ms |

Render time per frame rose by about half a millisecond, because terrain is now
rasterized on the main thread instead of in the GPU process. (Distances in
these runs also count the bench's warm-up and finish windows, about 33.5 s in
all; the bench now reports the 30 s cadence window only.) Added one at a time
(not interleaved), the changes gave 8–19 missed frames at first, 4–8 with the
plain copy, 3 with CPU canvases and 0 with 512-texel pages.

Steady scenes on the phone (city, woods and crowd at zooms 1 and 0.25, one run
each side) and all scenes on the M4 Pro are unchanged within run-to-run
variation. The Steam Deck was not measured.

## Validation

A browser test (`tests/gpu-renderer.spec.ts`, "page uploads read nothing back…")
resets the renderer state as the shadow pass does, re-uploads a 1,100 × 600
image and requires no `getParameter` call, six pages, and the same pixels as
separate page textures; with three.js's copy restored it fails with five reads.
The independent review found no rendering defect; it found the read framebuffer
left unbound after a copy into a non-default target (now both bindings are
released before the caller's target is restored) and three faults in the new
bench records (slow-frame work attributed one frame late, distance counted
outside the sample window, profiles running through the trace download), all
fixed. The existing atlas parity and growth tests pass unchanged, as do 513 rendering
unit tests and the streaming bench. Browser tests run against the production
build: rebuild before trusting them after a source change.

## Not done

- The remaining major garbage collection (about 20 ms, once in the traced run).
- The authority at 30 Hz, which the owner named as a reasonable option. It was
  not needed for this: the tick was 4–6 ms while driving.
- Chunk generation on the authority Worker is the largest stage while driving
  (about 5 ms p50) and showed Worker tasks of 17–27 ms. They did not drop frames
  here, but they delay the simulation by a tick or two.
- The autopilot is sometimes held up by traffic; a fixed route would make runs
  comparable without checking `drivenPx`.
