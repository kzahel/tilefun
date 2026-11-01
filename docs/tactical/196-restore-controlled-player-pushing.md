# Restore controlled-player pushing

Status: delivered and validated locally for owner inspection, 2026-11-01.
[Physics engine](../topics/physics-engine.md) owns the continuing direction.

## Required behavior

The owner rejected 195's no-push behavior: walking into another player must move
that player. Removing pushing while fixing feedback was a gameplay regression.
The idle actor had zero inward-motion weight in 195, so the response removed only
the moving actor's approach. Its stability checks did not assert positive pushing.

Preserve pushing, sliding and release while retaining the fixes for runaway
velocity, continuing glide, overlapping capsules and wall penetration. Authority
and prediction must use the same response.

## Shared response

Rapier continues to sweep the actual controlled capsules against both current
motion proposals. For side contact, split the normal response equally between
the equal-mass motors. Walking into an idle actor shares forward movement;
equal opposing movement resists, and tangential motion remains available. The
recipient therefore moves without needing its own input.

This operates on fresh environment-clipped proposals each tick, preserving 195's
exclusion of player bodies from KCC moving-platform friction. A previous solved
player velocity never becomes new movement intent. Releasing both motors stops
the push. Vertical contact retains the existing landing/ceiling response.

Bound the combined horizontal result of walking and pushing to the larger of
walking displacement and the original environment-carried displacement. This
prevents adding a sideways shove to full-speed walking from producing a speed
burst, while retaining an existing support-motion budget. Environment rechecks
and the final relative sweep retain wall clearance and capsule separation.

**Players pushing / release** is a new cube-free shared script: the host walks
into an idle guest during ticks 30–89, followed by an idle tail. Either seat can
also be controlled manually through existing keyboard/controller/touch input.

## Evidence and validation

- Raw physics regressions now require the idle recipient to move more than one
  metre in both seat orders. The existing head-on/glancing speed, separation,
  height and post-release drift bounds remain; no-push behavior fails acceptance.
- Additional focused tests exercise the recipient's perpendicular walking plus
  the shove, and pushing an idle actor against a wall. Follow, jump, wall sliding,
  ramps, lift and bridge checks remain in place. Full snapshots exactly replay
  the new push script, and normal Realm/input/replication converges under jitter.
- `npx tsx scripts/benchmark-physics-presentation.ts --output=docs/benchmarks/196-player-pushing.json`
  records 21 native lanes, seven scripts × three display modes, at 200 ms RTT
  and ±20 ms per-direction jitter. It records positive authority displacement,
  horizontal speed, release drift, corrections and physics hashes independently
  of displayed motion. These are desktop correctness samples, not GPU timings.

The new push script moves the input-idle guest **1.35 m**. The three player-only
scripts peak below **4.53 m/s**, with post-tick-141 horizontal drift below **0.02 mm**. Authority
hashes match across display policies within all seven scripts; no late inputs or
recoveries occur. Both-active opposing-cube display corrections remain around
1.10 m and are still a separate migration blocker.

Validation:

- 71 focused native tests pass across physics, presentation, replay, real Realm
  hosting, scheduling and bounded transport. All three TypeScript projects and
  focused Biome checks pass.
- Production build and all three full-Chromium physics cases pass. The co-op
  Worker case selects **Players pushing / release**, requires positive guest
  authority displacement with zero guest input, then checks both actors remain
  still across the release tail. Existing input, reset/pause and teardown checks
  remain. Both original bridge/support/delay/stall cases pass.
- Inspected browser capture shows the contacting pair in both views. Existing
  rendered first-cube-push gap remains 8.96 cm with matching player/cube display
  ticks and sources.
- Catalog/manifest regenerate and verify 2,119 identities with 137 exclusions;
  only the excluded physics candidate and source digest change. Normal scenario
  and local-server Worker hashes/sizes remain unchanged. Physics Workers become
  5,499.20/5,499.59 kB; the experimental page is 4,394.44 kB / 1,689.56 kB gzip.
- All six `streaming:bench -- --assert-ready` stages pass with zero missing-data
  frames, final missing data and incomplete caches. Browser checks use isolated
  data/auth and bundled Chromium. No primary browser or player world is opened.
  Diff whitespace checks pass; whole-repository suites were not rerun.

## Limits and next work

This is still the two-controlled-motor reference with equal character masses.
General initial overlaps, crowded simultaneous contacts, moving player supports
and Chromebook headroom remain unqualified. Independent remote-input uncertainty
still causes both-active dynamic-object correction; this change does not solve
that timeline problem.

Inspect **Players pushing / release** and manual pushing from either seat. Keep
positive pushing, bounded speed, release and wall clearance as acceptance criteria
while addressing both-active cube prediction and independent clocks next.
