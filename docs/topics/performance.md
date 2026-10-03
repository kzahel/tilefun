# Streaming and gameplay performance

Topic: performance
Status: shared Worker authority and terrain preparation implemented; physical
Android traversal validated; zoom-out raster scheduling remains follow-up work.
Updated: 2026-10-03.

Owns current performance direction and the limits of the evidence. Detailed
captures and execution history live in
[Tactical 012](../tactical/012-streaming-performance-and-local-server-worker.md).

## Current state and contracts

- Single player runs the shared server in a dedicated browser Worker.
  `src/server/LocalServerRuntime.ts` owns lifecycle; ordered, bounded
  `src/transport/WorkerClientTransport.ts` carries replicated state. Prediction
  and rendering stay on the main thread. P2P hosting still runs its authority
  on the main thread; dedicated hosts reuse the same server implementation.
- Terrain cache preparation runs ahead of the camera. Measure both visible
  readiness and frame pacing; a fast frame with missing terrain is not success.
- Gameplay rooms cache native floor/wall layers per active room/plan. Furniture
  edits and actor depth remain live. See [Tactical 009](../tactical/009-city-places-and-indoor-performance.md)
  for cache parity and [011](../tactical/011-shared-pattern-brushes-and-room-drawing.md)
  for edited-room behavior.
- Keep benchmark overrides separate from production policies. WASM is conditional
  on measured compute need or an explicit native/browser sharing requirement.

## Evidence and validation

Use the repository runners with isolated bundled Chromium before manual UI work:

```sh
npm run streaming:bench -- --assert-ready
npm run interiors:bench -- --headed
npm run gameplay:bench -- --headed
npm run gameplay:bench -- --headed --edited-room
```

Tactical 012 owns exact scenario definitions, measurement limits, CPU throttling,
physical-device `--cdp`/`--touch` setup and trace analysis commands. Its recorded
desktop v4/v10 ordinary traversal has no missing/unfinished visible chunks and
about 16.7–16.8 ms frame p95. Three Pixel 7a touch traversals per fixture have no
movement gaps and about 16.8 ms movement frame p95. These are device/scenario
measurements, not universal timing gates.

Phone v4 zoom-out measured 33.3 ms p95; v10 measured 16.8 ms. Deferred cache raster
work explains the v4 stalls. A benchmark-only two-row limit after zoom restored
16.8 ms p95 while completing caches. Cold entry still showed unfinished-cache
frames. The room cache checks recorded exact pixel parity and responsive
ordinary/edited-room movement, but steady-state captures do not exclude initial
upload costs or device-specific problems.

## Next work

Bound offscreen preparation work while keeping missing visible terrain first.
Validate movement, wide viewports, edits and cache catch-up before choosing a
production policy. Improve cold-entry presentation and broaden lower-end phone,
iOS and thermal coverage before setting timing gates. P2P can adopt the host
boundary when needed; moving authority again would not fix measured raster work.
