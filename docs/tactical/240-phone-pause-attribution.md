# 240 — Attribution of the remaining phone driving pauses

Status: diagnostic delivered · 2026-11-11.
Owner: [performance](../topics/performance.md).
Follows [239's repeatable workloads](239-repeatable-driving-workloads.md).

## Findings

**Terrain raster completion is missing from the preparation budget.** CPU-requested
canvases can still defer their raster work. The terrain builder times its drawing
calls, but a later `GpuPages.get` copy forces pending work to finish inside
`CanvasRenderingContext2D.drawImage`, during rendering. In the phone profiles,
repeated 19–22 ms game callbacks spend roughly 8–12 ms sampled wall time in that
native copy; the enclosing page path accounts for still more. This is separate
from the subsequent GL upload and from authority chunk generation.

The [sanitized evidence](../benchmarks/240-phone-pause-attribution.json) includes
source-mapped stacks, trace alignment, all run summaries and a counterfactual.
Four shipping renderer files match `f95b6e57` exactly. This delivery adds capture
and analysis tools; the raster-flush experiment is local and is **not shipped**.

### Counterfactual: complete raster work before checking the budget

An isolated build transform adds `offCtx.getImageData(0, 0, 1, 1)` after each
terrain row, before the next deadline check. It forces pending raster work to
finish there. Both builds use the same page-copy/upload observation wrappers.
Order: control, flush, flush, control; fresh worlds, 30 s each, same physical phone.

| Main-thread measurement | Controls | Local row-flush experiment |
| --- | --- | --- |
| Page copies | 26 per run, all 256×256 | 26 per run, all 256×256 |
| Page-copy median | 5.0 / 5.0 ms | below 0.1 ms timer resolution |
| Worst page copy | 6.5 / 8.7 ms | 0.1 / 0.2 ms |
| Worst render callback | 23.2 / 22.6 ms | 11.9 / 13.1 ms |
| Median render callback | 2.6 / 2.7 ms | 2.9 / 3.0 ms |
| Ordinary canvas-upload calls | 26; max 1.5 / 1.4 ms | 26; max 1.9 / 1.6 ms |

Every source and destination reports `willReadFrequently: true`. That setting is
a request, not proof that all drawing has completed. The moved work is visible
in 828–832 one-pixel reads: median 0.5 ms each, max 0.9–1.1 ms. Frequent flushing
adds overhead and raises median render cost. This establishes the missing cost
boundary; it does not establish that per-row reads are the best product fix.
The experimental variant has no pixel-parity qualification.

All four workloads qualify (1,799–1,800 ticks, 3,324–3,328 px). Controls miss
one/zero intervals; flush runs miss zero/one, with the latter at startup. Thus
these runs support reducing render tails, not a universal frame-pacing claim.

### The missed intervals have more than one cause

Six normal-renderer phone runs bracket diagnostics with ordinary timing controls:

- Ordinary before/after each misses one interval; the compatible comparison
  passes. Neither has attribution instrumentation.
- Trace-only A misses 33.3 ms near startup. Its game `FunctionCall` lasts
  32.473 ms. There is no overlapping GC, including one neighbouring interval
  on either side. Exact attribution within that startup callback remains open.
- Trace-only B misses 33.4 ms near 29.49 s. A 46.245 ms Chromium
  `memory_instrumentation.mojom.ClientProcess` IPC occupies the main thread,
  alongside a memory-instrumentation task in the GPU process. Its trigger is
  not established; do not call it game code, GC, or assume it occurs without
  diagnostics.
- Both CPU+trace runs have zero missed intervals, while retaining repeated long
  render callbacks. They provide the source-mapped terrain-copy stacks above.

Across the four trace windows there are 137 main-thread **minor** collections,
maximum 7.562 ms, and no main-thread major collections. Neither captured missed
interval overlaps GC, including its neighbouring-frame context. This does not
rule out GC under other workloads. The historical untraced 50 ms interval in 239
cannot be attributed retrospectively.

Phone: Pixel 7a, Chrome 156, native 411×789 CSS px, DPR 2.625, Mali-G710. Capture
temperatures 25.6–26.4 °C; copy probes 26.8–27.0 °C; thermal status 0 throughout.
Owned tabs, Workers, preview servers and forwarding routes were cleaned up.
The common phone doctor passes afterward.

## Capture and analysis contract

```sh
npm run build -- --sourcemap
npm run driving:bench -- --headed --fixtures=clear --trials=1 --seconds=30 --profile --trace --output=/tmp/driving-profile.json
node scripts/analyze-driving.mjs --report=/tmp/driving-profile.json --maps=dist/assets
```

The same flags work with the existing device `--cdp`/`--base`/`--port` setup.
Use separate `--trace` controls and ordinary controls. CPU sampling is 1 ms;
`--allocations` cannot be combined with CPU/trace modes. Comparisons reject
different capture modes. New page clock fields/marks make the measurement version
v2, so v1 reports require a fresh baseline.

The page returns exact rAF clock boundaries and absolute slow-frame timestamps,
and emits cadence start/end user-timing marks. The analyzer checks those against
CDP's monotonic navigation clock; all four captures align with zero microsecond
error and report no trace data loss. It isolates the benchmark renderer thread,
unions nested synchronous durations, and includes neighbouring-frame context.
Async compositor flows are not counted as CPU execution. Chromium thread-time
counters can exceed wall durations; they are retained as reported and do not
drive the conclusions.

Chrome profiles can contain negative `timeDeltas`: one capture had 3,538. The
analyzer reconstructs and sorts sample timestamps before assigning disjoint
weights. Sampled wall-time estimates are not exact CPU durations. Matching Vite
source maps resolve profile and trace call frames; archive the maps before
rebuilding. The local campaign retains its maps beside the raw captures.

CPU sampling ends before trace transfer. Cadence ends before the pause fence,
end-of-window diagnostics and transfer; ordinary in-window benchmark bookkeeping
remains included. Analysis uses explicit cadence boundaries, not the capture's
full duration. Raw traces can contain unrelated browser metadata and remain in
ignored `data/scratch/driving-240/`; only sanitized summaries are committed.

## Checks and next work

Six Node report/capture/analysis tests pass, covering incompatible modes, trace
stream cleanup on profiler failure, clock mismatch/data loss, nested/foreign GC,
and out-of-order profile samples. Four typecheck projects, focused Biome, health,
normal production build with maps and all 2,130 Workshop identities pass. The
two desktop CPU/trace smoke runs, six phone captures and four copy probes all qualify.
Game authority, prediction and rendering algorithms are unchanged, so no broad
game/browser suite was needed for this diagnostic slice.

Next: make completed terrain raster work part of the preparation budget, then
qualify pixel parity, median CPU cost and cadence on the phone. Keep startup
initialization and Chromium memory-footprint work separate from that fix.
