# 238 — Allocation churn and regional planning

Status: delivered · 2026-11-11.
Owner: [performance](../topics/performance.md).
Baseline: [237's physical measurements](237-phone-driving-hitches.md#physical-pixel-7a-measurements-2026-11-11).

The owner requested measured optimizations, commits when complete, and options
for the next valuable work. Benchmark infrastructure and the original phone
evidence are committed separately as `a7c647e6`.

## Scope and invariants

- Retain unchanged prop receiver geometry, with scalar validation for in-place
  editor mutations, observer-local visibility and frame-local query stamps.
  Keep face/candidate order, excavation, attachments and moving roofs exact.
- Reuse vehicle suspension scratch/output storage across steps, preserving
  operation order, all-chassis pre-impulse reads, material handling and replay.
- Reuse bounded coordinate-addressed regional plans without changing generation
  output, leaking worlds, or allowing public query mutations to poison caches.
- Keep game/lab consumers on the shared code. No art, input or gameplay changes.

## Validation and evidence

Before/after generation verification hashes all terrain/rail/placement plans on
the existing four 7×7 routes. Native tests own receiver edits/lifetimes, wheel
impulse isolation, physics/replay parity and planner query-order behavior.
Existing GPU contact/depth probes own browser pixels; rebuild production first.
Run inventories, relevant type/lint checks and streaming readiness, then repeat
physical-phone allocation/generation and ordinary driving measurements. Record
thermal/workload limits and retain raw profiles locally. Mark dev ready only
after successful validation, and commit the completed runtime slice.

## Delivered

`SceneFrame` owns a weak prop receiver cache. Scalar shape snapshots detect
in-place edits and identity changes; cached faces are immutable borrows, replaced
on edits. Visibility, eligibility and excavation remain per-view decisions.
Unique query tokens prevent a shared source's dedupe stamp from colliding between
frame/view instances. Moving-body bounds use the identical eight transforms
without corner/map arrays, and triangle caches allocate only on a real query.

Each chassis owns vector and impulse scratch, borrowed until its next prepare.
No pool is shared between chassis: all suspension preparation still completes
before any impulse is applied. Arithmetic grouping is retained. Wheel-grid
buckets are recycled within a bounded spare pool; travelled cells and body
references retire on reset/disposal instead of accumulating along the route.

Per-world weak owner/connection caches retain at most 128 plans each (settlements
and each connection axis separately). A last-owner fast path avoids coordinate
strings during terrain sampling. Public query results remain independent deep
copies; cached internal geometry cannot be poisoned by caller edits. Regional
road distances also avoid a temporary mapped/spread array per sample.

The cache/scratch helpers split existing large files; the code-health ratchet
is tightened for four improved files. Generated art inventory changes only its
source locator; Workshop candidate identities/pixels stay unchanged, with a new
input digest. No promoted art bank was regenerated.

## Physical phone results

[Sanitized evidence](../benchmarks/238-allocation-and-generation.json), full local
records and heap profiles in ignored `data/scratch/churn-238/`.

Actual Pixel 7a, Chrome 156, normal zoom, native portrait viewport. Preserved
`a7c647e6` source runs on its own isolated Vite origin with the same dependencies,
assets and measurement harness as the optimized origin. Sequential interleaved
30-second allocation samples; thermal status 0 throughout, 24.8–28.8 °C across
the campaign, external power. All task tabs, origin storage, servers and USB
forwarding routes were cleaned up; common device doctor passes afterward.

| Main-thread sampled allocations / 30 s | Before | After |
| --- | ---: | ---: |
| Standing city, 11 actors both sides | 529.3 MiB | 409.4 MiB |
| Qualifying drive 1 | 672.4 MiB / 2,689 px | 490.5 MiB / 2,023 px |
| Qualifying drive 2 | 669.6 MiB / 2,872 px | 523.2 MiB / 2,217 px |

About 23% less allocation standing and 22–27% less in the moving samples (about
25% by the two-run means). These are observed reductions, not fixed-replay causal
estimates: traffic, populations and distance differ. The two before controls
held up in traffic (147/150 px) are retained and excluded from moving comparison.
All four qualifying sampled drives miss zero frames. Receiver constructor self
allocation falls from 79.7 to 13.4 MiB standing; from 106.7 to 14.5 MiB in the
first moving pair. Chassis temporary-vector allocation largely leaves the top
sites. Prediction clones, presentation records and Rapier wrapper registration
remain prominent.

The separate ordinary after drive covers 2,604 px, missing 1/1,800 frames, worst
interval 33.4 ms. Shorter ordinary runs are retained (737–1,186 px, zero or one
miss). An occasional pause remains; neither this allocation work nor a sampled
run proves universal frame-pacing improvement. No claim of zero GC or a leak fix.

### Matched generation pair

Separate diagnostic Workers on the same phone, immediately before/after at
28.7–28.8 °C and thermal status 0. Baseline source imports come from the preserved
snapshot, with the current unchanged benchmark. Three fresh-generator trials,
four 7×7 routes; matching coordinates, plan/admission counts and grid byte counts.
Each row pools 147 unseen chunks, retaining startup and all tail samples.

| Fixture | Median before → after | p95 before → after | Max before → after |
| --- | ---: | ---: | ---: |
| district | 6.4 → 4.3 ms | 10.1 → 7.4 ms | 348.5 → 189.3 ms |
| farm | 4.9 → 2.5 ms | 25.8 → 18.5 ms | 100.8 → 47.2 ms |
| woodland | 5.7 → 2.8 ms | 14.4 → 9.3 ms | 346.5 → 161.2 ms |
| coast | 6.9 → 3.4 ms | 15.2 → 7.3 ms | 100.9 → 51.3 ms |

Median generation falls 33–51%. Cold planning tails survive: trial-two woodland
startup is still 74.3 ms, versus 174.4 ms before. These are fresh planner caches,
not ordinary driving tick cost. In actual optimized driving samples the terrain
generation stage is about 1.4–1.8 ms median, versus 5.6–6.1 ms in qualifying old
drives. Whole authority ticks do not show a clear change in this light workload.

## Validation

- 728 native tests across 98 affected rendering, physics, generation, prediction
  and view files. Existing scene characterization digests pass unchanged.
- New cache edit/visibility/excavation/snapshot and rotated-bounds checks; private
  chassis scratch lifetime, exact vector rounding and retired wheel-grid cells;
  bounded planner caches, nulls, negative/signed-zero owners and public mutation
  isolation. Existing query-order, border, replay and material tests pass.
- Before/after content verification: 392 generated chunks plus 28 streaming
  batches (420 sample records), identical terrain/rail/placement hashes/counts.
- A separate original-chassis oracle compares 1,800 preparation steps and 8,320
  wheel impulses exactly, including coasting, materials, missing contacts and
  moving supports. Historical oracle source stays local; only one runtime kernel.
- Four browser checks on rebuilt production output: GPU depth-shadow/contact
  pixels and embedded-lab lifecycle/scheduling. Both game and labs consume the
  shared `SceneFrame` and chassis code.
- All four TypeScript projects, focused Biome, tightened health ratchet, normal
  build, inventories (2,130 Workshop identities) and streaming readiness pass.
- Native checks use the repository's pinned Node 24.22.1. The shell's Node 27
  alpha exposes an existing pngjs/Inflate incompatibility; no product workaround
  was added. Earlier cross-Node verification is used for content only; performance
  numbers above use the paired physical Chrome runs.

## Next valuable work

1. Reuse predictor snapshot/readback records, with explicit replay ownership.
   This is now a larger relative allocation target; avoid aliasing saved history.
2. Capture the remaining isolated long render callback with CPU attribution.
   Occasional 33 ms intervals remain, including frames near page uploads; do not
   assume they are GC or promise a WASM rewrite will fix them.
3. Make the driving workload repeatable (clear/fixed route, plus a separate jammed
   traffic fixture). Traffic-blocked runs currently consume much of a comparison.
   Remaining cold generation tails are another bounded optimization candidate.
