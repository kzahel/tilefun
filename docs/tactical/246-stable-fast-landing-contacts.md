# Stable fast landing contacts

Status: repaired and locally qualified, 2026-11-11; owner phone confirmation remains.
Owners: [physics](../topics/physics-engine.md),
[prediction](../topics/player-prediction.md), [vehicles](../topics/vehicles.md).
Reproduction: [245](245-steep-jump-prediction-reproduction.md).

## Cause and repair

The large correction originates in collision response at the car's nose crossing
a coplanar landing-slab join. It is not an extra input, mismatched physics tick,
packet packing or screen refresh issue. Numerical restore/replay introduces tiny
differences in contact state; this landing amplified those into a large physical
sideways kick, followed by reconciliation back to authority.

Scratch instrumentation sampled the authority and every private replay step,
including body transforms/velocities, suspension impulses and Rapier manifolds.
At the problematic step, the wheel impulses agreed closely. The first large
separation happened inside `world.step()`, where the predicted chassis lost
most of its forward speed and acquired a large lateral velocity. The nose was
entering the next convex slab; its contact manifold admitted an oblique edge
normal instead of just the continuous top support. This identifies the collision
boundary, not a missing specific internal Rapier field or a bit-exact rollback
guarantee.

Two small changes stabilize that boundary:

- **One-pixel wheeled-chassis bevel**, replacing 0.16px. The round box keeps its
  outer dimensions; only its corner rounding changes. The existing quarter-
  half-extent bound still limits the bevel for very small bodies. Characters,
  boats and other bodies retain their previous bevel; articulated compounds
  retain their authored shapes. The car is less likely to catch a nearly tangent
  internal edge while landing.
- **At most two CCD substeps**, replacing the default one. Rapier's one-pass CCD
  clamps a fast trajectory at its first impact, retaining velocity for the next
  tick. A second pass allows the remaining interval to continue after the hit.
  The shared public step remains 1/60s: input rates, prediction horizons,
  acknowledgements, replay budgets and world-step accounting are unchanged.

These changes apply to the same PhysicsScene/SceneBody in authority, private
prediction and embedded labs. Terrain/prop volumes, welded static geometry,
suspension arithmetic, wire state and presentation smoothing retain their
existing owners. No correction threshold was increased to hide the jump.
The extra CCD allowance can cost more on fast impacts; this is a correctness
repair, with no phone speedup claim.

Neither change alone was sufficient in independent-clock Worker checks: the
second-pass-only control still reached 2.56px; the bevel-only control reached
5.90px. The retained repair uses both. Separating/unwelding static parts and
rebuilding the private scene were not retained.

## Evidence

The original command remains:

```sh
npx tsx scripts/reproduce-jump-prediction.ts --json=data/scratch/jump-prediction.json
```

| Original three-idle-tick fixture | Before | After |
| --- | ---: | ---: |
| Largest same-tick error, two-tick frame delay | 13.5601 px | **0.0473 px** |
| Largest orientation error in the delayed run | 6.5477° | **0.0085°** |
| Largest same-tick error, immediate delivery | 0.0000156 px | 0.00000195 px |
| Authority peak height | 199.8072 px | 200.4392 px |

`JumpPrediction.test.ts` requires the actual high jump and subsequent landing,
more than 700 executed replay steps, matching physics ticks for every sample,
and <0.1px / <0.1° disagreement. An isolated source-transform control restores
both old settings and fails this new regression at **13.560081 px**.

Three separate real local-Worker runs, without simulated network delay, measured
largest same-tick landing errors of **0.605 / 0.109 / 0.109 px**. The previous
ordinary Worker capture reached 7.207px. These are numeric samples, not a claim
of an exact rendered displacement or an exact replay of the owner's phone.

Supporting native checks vary suspension settling (1/2/4/5 idle ticks) and frame
delay (0/1/2/4 ticks); all 16 repaired runs stay below 0.312px. The real generated
seed-2026 motocross approach, with the F1 replacing the start-line rally car and
nearby actors/rail services retained, stays below 0.0023px across those four
delivery delays. These checks guard against choosing a single lucky landing.
Raw records and rejected experiments remain in ignored
`data/scratch/jump-prediction/`.

## Qualification and remaining work

- Focused native physics, prediction, seats, recipe-client and jump checks:
  145 tests across 26 files. The multi-seat opposed-contact comparison initially
  found a 0.0193px difference between independent replay histories, exceeding
  its old 0.01px comparison allowance. Its correction-comparison tolerance is
  now 0.05px; exact cross-view agreement, overlap and replay-work assertions
  remain. All nine multi-seat checks pass after that adjustment.
- All TypeScript projects and focused Biome checks pass.
- Art/Workshop inventories regenerated for source fingerprints; production
  build passes. No art was changed.
- Four final production full-Chromium checks pass: jump park, Worker car/ramp
  and saved seat, 3D course rotation/recovery/reload, and P2P Worker lifecycle.
  These ran against the rebuilt production output after both runtime changes.
- Final `npm run streaming:bench -- --assert-ready` passes on the repaired source.

Next: owner Save and reload, then repeat the F1 sky jump on the phone. The
specific phone/approach has not been captured here. If a visible issue remains,
record whether it is at takeoff, landing or while already airborne and compare
that bounded event; do not restart a general allocation/rendering campaign.
