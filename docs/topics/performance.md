# Streaming and gameplay performance

Topic: performance
Status: shared Worker authority and terrain preparation implemented; physical
Android traversal validated; renderer/allocation audit complete; grass cache
identity/lifetime fixed, gameplay grass frame storage and terrain scheduler records
reused; static prop depth and elevation metadata cached; Canvas terrain resources
removed from world chunks; neutral frame/backend separation delivered, with raster
scheduling and cold-entry presentation remaining as separate performance work.
Updated: 2026-10-03.

Owns current performance direction and the limits of the evidence.
[Rendering architecture](rendering-architecture.md) owns the desired backend
boundaries and incremental decoupling sequence. Detailed
captures and execution history live in
[Tactical 012](../tactical/012-streaming-performance-and-local-server-worker.md).
The [renderer/allocation audit](../tactical/013-renderer-boundary-and-allocation-audit.md)
owns the 2026-10-03 walking-hitch investigation, concrete allocation sites and
proposed renderer boundary. Its implementation record tracks completed slices;
the remaining recommendations are not implemented fixes.

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
- Grass placements are weakly cached by chunk object, revision and coordinates.
  The cache cannot retain discarded chunks or reuse another world's equal-revision
  chunk. Generated placement, animation and ordering stay unchanged.
- Each gameplay client owns a backend-independent `SceneFrame`: its sorted list
  and pooled grass records are borrowed for synchronous drawing. Release the
  list after drawing and clear storage on realm changes/teardown. Grass pools
  have retention caps and shrink after sustained underuse; excess still renders.
- Terrain preparation updates resident records in place and borrows them in a
  reusable job list. Visitation stamps replace the per-frame membership set.
  Membership and priorities still refresh every frame, including zero-work-budget
  frames; departing chunks and reset/error paths release references and surfaces.
  Visible holes, visible replacements and approaching halo work keep their order,
  with the same 2 ms deadline and 128-row ceiling.

- Each `SceneFrame` owns a prop depth cache. Object identity and scalar position/
  collider comparisons invalidate changed entries, including in-place edits.
  Each collection evicts props no longer supplied; realm reset/teardown clears
  all entries. The cache stores backend-independent bounds and height/depth data,
  and dynamic actor/ghost sorting still runs every frame. One-shot collectors
  retain their existing independent output ownership.

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

[Entity activation, AI and unloading](entity-activation.md) owns the separate
simulation-debt backlog: tick tiers do not eliminate all distant-entity work,
and placed entities remain resident after terrain unloads. Its source audit
does not establish the cause of observed frame hitches; measure dense local
scenes and distant populations separately before selecting fixes.

The grass-fix follow-up captured a 60-second Pixel 7a traversal with no visible
terrain gaps and two missed frames: one overlapping a 33 ms main-thread GC,
another overlapping about 20 ms of GPU-process work with no main-thread GC.
[Tactical 013](../tactical/013-renderer-boundary-and-allocation-audit.md#implementation-record-grass-cache-identity-and-lifetime)
owns the evidence and tracing/workload limits. Both allocation reduction and
raster scheduling remain justified; this is not a universal hitch diagnosis.

Grass position/item storage now reuses warm buffers. A fixed 600-frame synthetic
workload reduced sampled allocations from 64.3 MB to 13.5 MB (about 79%) with
identical grass output; this excludes rendering and is not a phone FPS claim.
Terrain scheduler bookkeeping now also reuses storage: an 80-chunk synthetic
probe reduced sampled allocations about 71% for ready chunks and 52% for pending
chunks, with identical job ordering. Coordinate strings, iteration and sorting
still allocate; these measurements exclude raster work.
Static prop depth metadata now reuses unchanged surfaces. A 400-prop synthetic
probe reduced sampled collection allocations from 81.0 MB to 12.4 MB (about 85%)
with identical metadata/depth hashes through edits. This excludes drawing and
simulation; scalar validation, output-list backing storage and iteration remain.
Elevation geometry now caches unchanged chunk descriptors and refers to backend
resource IDs. The synthetic nine-chunk sample reduced collection allocations
from 222.9 MB to 46.0 MB (about 79%) with identical geometry; output lists still
allocate. See [rendering architecture](rendering-architecture.md) for the completed
resource ownership, handles and completed frame/backend interface.
Continue with remaining scene allocations and measured raster submission. The grass cache lifetime
fix is complete; a synthetic post-GC probe verifies that discarded chunk placements no
longer accumulate. Phone traversal still has occasional missed frames, so this
does not resolve the reported hitch. Canvas resources now live in renderer-owned caches and elevation items carry
opaque handles. The complete frame/backend interface and asset metadata are separated; indoor
actor callbacks are replaced by ordered data. The audit records a reproducible stale-grass case and desktop
GC events; attribution of the user's intermittent phone hitch remains open.

Bound offscreen preparation work while keeping missing visible terrain first.
Validate movement, wide viewports, edits and cache catch-up before choosing a
production policy. Improve cold-entry presentation and broaden lower-end phone,
iOS and thermal coverage before setting timing gates. P2P can adopt the host
boundary when needed; moving authority again would not fix measured raster work.


## Renderer decoupling completion evidence

[Parent 022](../tactical/022-renderer-backend-decoupling.md) and
[final evidence](../benchmarks/034-renderer-completion.json) record the completed
boundary and integration checks. Shared terrain placement removes per-frame
coordinate/projection objects and a visibility set from the no-preparation path.
The matched 3,000-frame/27,000-placement sample fell from 4.53 MB to 1.69 MB;
geometry hashes match. This is sampled CPU allocation, not an FPS claim.
Elevation descriptor counts/hashes and scheduler order/record counts remain
unchanged; their allocation totals are close to the pre-series baseline.

Final Pixel 7a touch traversal covers v4, v10 and current v11: zero missing-data
or incomplete-cache frames in walking, sprinting, reversal and zoom-out. Movement
frame p95 is 16.7–16.8 ms. Cold entry retains 22–24 unfinished-cache frames and
0–3 missing-data frames. Ordinary and edited rooms both show 16.7 ms frame p95;
touch movement advances 12.8 pixels, and return to the street succeeds. No page
errors occurred. The phone was charging, about 30.5–30.8°C during traversal,
thermal status 0 afterward. This short run does not establish sustained thermal,
lower-end device or iOS performance, and does not close the intermittent-hitch issue.


## Optional GPU renderer comparison

[045](../tactical/045-gpu-measurement-decision.md) and its
[measurements](../benchmarks/045-gpu-comparison.json) compare the same traversal
with Canvas and optional WebGL2. All six runs pass movement terrain readiness.
On Pixel 7a, Canvas records 0/3 movement frames over 25 ms in two runs versus
GPU 19/13; desktop GPU submission also costs more CPU in movement. Canvas remains
the default. Warm standing uploads no new GPU page textures, but traversal staging,
texture uploads and draw submission need profiling before adoption. Live-heap
snapshots do not attribute allocation churn or close the intermittent-hitch issue.
The car also renders in native WebGPU, but this is an asset probe, not a complete
WebGPU game backend or proof that it will be faster.
