# Tick-aware NPC separation

Topic: entity-activation
Date: 2026-10-03.
Status: implemented and validated.
Owner: [Entity activation, AI and unloading](../topics/entity-activation.md).

## Bounded outcome

Distant NPCs previously skipped ordinary AI/movement while still entering the
overlap solver and potentially being nudged. Pass the existing entity tick map
from EntityManager to separation, omit unselected NPCs before bucketing, and
use each selected NPC's own accumulated time for its pair nudge. At mixed-rate
boundaries, each participant spends only its own elapsed time; omitted actors
do not participate in separation until selected again.

Keep the existing behavior when no tick map is supplied. Preserve player
penetration correction, mount exclusion, parented/pre-stepped exclusions,
solid-wall checks and Z-range filtering. Sleeping NPCs remain in the ordinary
movement collision index. This slice changes no tier distances, terrain
residency, persistence, ball physics, general service callbacks or rendering.

## Validation and evidence

- `src/entities/entitySeparation.test.ts` covers sleeping crowds with zero
  collision queries, mixed active/inactive neighbors, per-participant elapsed
  time, full-rate parity, wall/Z constraints, player/mount behavior and the
  EntityManager handoff/pre-stepped exclusion.
- `src/server/EntityActivation.test.ts` exercises the real Realm tick path:
  far crowds and camera-driven reactivation, mid-tier accumulation with one
  and two physics substeps, and the union of two distant players' interest.
- `npx tsx scripts/instrumentation/entity-separation.ts` compares a synthetic
  400-NPC coincident sleeping crowd with ungated separation. Solid terrain
  keeps the control stationary. Across 30 passes, tile collision queries fall
  from 159,600 per pass to zero. Initial local median was about 9.30 ms versus
  0.009 ms. This is separation-only evidence, not a whole-Worker or phone FPS
  result; full resident-list scans and other simulation passes remain.
- Validation uses a temporary export of the committed tree plus this slice to
  exclude unrelated concurrent character/Workshop edits. Typecheck, all 1,249
  unit tests, lint (existing warnings only), build and Playwright passed
  (268 passed, one skipped). `art:catalog` remained byte-identical;
  `workshop:manifest` regenerated only the input digest, with all 507 candidate
  records and fingerprints unchanged.
- `npm run streaming:bench -- --assert-ready` passed for regional-v4 and
  regional-v10: walk, sprint and reverse each had zero missing-data or
  incomplete-cache frames. Cold-entry and zoom samples remain outside that
  readiness gate; this run does not establish entity-unloading performance.

## Remaining work

Measure the broader inactive-work costs and define a persistence-aware entity
residency policy before implementing actual unloading. The topic owns that
backlog. Dense nearby campfires and diamond pickup require their own reproduction;
this NPC separation change does not diagnose or resolve that report.
