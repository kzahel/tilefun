# Reuse stable interest demand

Status: complete, 2026-10-10.
Owner: [performance](../topics/performance.md).

The user authorized profiling and caching the interest assembly hotspot selected
in [093](093-identical-collision-probes.md), with phone measurement and a commit.

## Contract

InterestManager snapshots ordered ticket values at `set`. Equivalent replacement
keeps the assembled demand; changes to ranges, activity, reason, expiry, owner
membership or ticket order invalidate it. Owner insertion order, stable ranking,
combined budget, activity union and distance priority are unchanged. Ticket/range
mutation takes effect through the next explicit `set`; no existing production
caller relies on mutation without resubmission.

A cache is valid only between the newest retained expired lease and the next
live lease expiry. Exact expiry and backwards clock jumps across retained expiry
boundaries reassemble demand; fully expired owners stay removed as before. Empty owner submissions preserve
insertion order until demand prunes them, without invalidating unchanged output.
This matters for the per-tick empty railway/attachment submissions.

Each demand call still returns fresh maps and fresh values, so consumer mutation
cannot poison subsequent reuse. Readiness is not a demand input: RealmStreaming
still invokes residency reconciliation on every update. Loads, retries, saves,
attachment tickets and railway/player/view inputs remain live. The game, Worker,
Node and embedded ScenarioSession consumers share this owner.

## Validation and measurements

Native Pixel 7a/Android 17/Chrome 154, Worker/Canvas/IndexedDB thicket seed 2026,
dog clearing. Eight 15-second samples after two-second warmup, walking then idle,
B/A/A/B per motion, no CPU sampler or deep physics/query wrappers. A frozen
c8e5f9d archive holds companion modules fixed; `--interest-reference` substitutes
the original class. Source hashes, timing, membership, travel, thermal state and
errors are in [sanitized evidence](../benchmarks/094-interest-demand-cache.json).
Exploratory first-prototype captures are excluded: repeated empty submissions
invalidated the original cache prototype and eliminated its useful savings.

| Measure | Original idle | Cache idle | Original walking | Cache walking |
| --- | --- | --- | --- | --- |
| Demand assembly mean per call | 0.272–0.289ms | 0.054–0.056ms | 0.233–0.239ms | 0.051–0.052ms |
| Demand assembly p95 per call | 0.5ms | 0.1–0.2ms | 0.4ms | 0.1ms |
| Streaming mean per tick | 0.793–0.841ms | 0.375–0.381ms | 0.698–0.710ms | 0.349–0.360ms |
| Streaming p95 per tick | 1.2–1.3ms | 0.6–0.7ms | 1.0–1.1ms | 0.6ms |
| Whole tick mean | 7.271–7.541ms | 6.777–6.807ms | 7.624–7.654ms | 7.077–7.430ms |
| Whole tick p95 | 10.0–10.4ms | 9.3–9.6ms | 10.5ms | 10.5–10.7ms |

Demand assembly is called twice per streaming update. Across the two samples,
its mean falls about 80% idle/78% walking; streaming mean falls about 54% idle/50%
walking. Whole-tick mean improves about 0.6ms idle/0.4ms walking, but walking p95
does not improve and maxima still reach 38–39ms. This does not establish a stutter
or desync cure, rare-hitch causality, or the proposed 4–6ms whole-tick p95 target.

All samples have zero errors, about 60Hz authority, final active membership
22 idle/43 walking and resident actors 242 idle/241 walking. Walking travels
624–625px with maximum resimulation under 0.001px; idle has zero resimulation.
rAF p95 is 16.7–16.8ms, with zero or one frame over 25ms per capture. Charging
battery temperatures run 28.3–30.7°C; Android reports thermal status 0 throughout.
An interrupted exploratory page remained open in the background throughout all
eight captures; its background work was not separately profiled. Completed probes
release their own pages/origins/routes. Final cleanup also closes that interrupted
page, clears its origin and releases its USB routes, then verifies restoration of
the original foreground app from the first completed capture's launch history.

Wrappers add overhead and phase percentiles cannot be summed. The phone snapshot predates pinch-zoom commit 352fb78 and excludes concurrent
uncommitted touch/recovery changes; keyboard movement does
not prove native touch controls or performance of the user's original saved world.
Two short samples per policy do not establish sustained thermal behavior.

A frozen original class is the ordered-demand oracle for 2,000 deterministic
operations with overlap, caps, expirations, backwards clocks, releases and retained
owners (8,000 demand comparisons). Behavioral checks cover equivalent and empty
submissions avoiding expansion, independent output maps/values, input ownership,
validation rejection, and unchanged-demand pressure release/read retry progress.

Coherent c8e5f9d archive plus only the new manager/test passes all three
typechecks, 2,246 unit tests across 234 files, lint (118 existing warnings/34 infos)
and production build. Server-only changes do not alter the workshop input digest;
761 committed candidate identities remain current. Final lint also passes in the
combined working checkout with the evidence artifact and instrumentation changes.
The streaming readiness gate passes all six phases with zero final missing,
incomplete or stale terrain. Full browser suite passes 526 checks with one skipped
(527 total, 21.9 minutes).
It uses separate transport ports/test data because another workspace run owned
the default ports; only temporary test/config port literals differ. GPU checks
use bundled full Chromium; production source is unchanged.

Pinch zoom landed as 352fb78 during validation. A second coherent archive of that
parent plus the same manager/test passes build, 28 focused interest/streaming/pinch
unit checks and all five new Canvas/GPU pinch browser checks. The build and five
browser checks also pass in the combined working checkout; the first supplemental
command ran there before its directory was corrected. The full suite stays frozen.

Next: profile NPC ground/support queries for safe reuse across stable position
and geometry. Moving carriers, live edits and readiness changes must invalidate
any cross-call cache. Physics remains much larger than cached demand assembly;
this slice deliberately leaves live grounding and collision behavior intact.
