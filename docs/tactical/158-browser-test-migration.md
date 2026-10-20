# 158 — Browser-test migration

Status: in progress, 2026-10-20. Owner: [testing](../topics/testing.md).

Implements [audit 157](157-browser-test-audit.md) end to end. Preserve that audit as
a dated baseline. Resolve every portable, mixed and capture-only source template,
with existing/replacement native coverage, retained browser boundaries and focused
validation. Browser rows remain unless a concrete duplicate/weak assertion is
established. Commit completed slices; finish with full local validation and green CI.

## Sequence

1. Reconcile food-chain assertions and move comparator self-tests to a genuinely
   browser-free lane, run once by the check job.
2. Move animal ball-command semantics to production Realm/replica tests. Preserve
   real input and audio dispatch: implementation review found frog and robin ball
   bodies assert client croak/chirp dispatch, which the baseline audit missed.
3. Resolve wildlife and vehicle roster matrices against existing native owners,
   retaining distinct real Worker, storage, input and GPU/asset-load contracts.
4. Resolve remaining scenarios, server endpoints, validators and client controllers.
5. Separate opt-in captures and meaningful regressions; remove proven smoke overlap.
6. Measure the residual suite, adjust CI distribution/artifact work where justified,
   run all local checks, push and verify the final commit's CI.

## Execution

Baseline guidance/audit committed as `d32bfa12`. The source audit's inventory checker
is intentionally a baseline checker and will report drift after migrations; current
inventory and resolution evidence belong here, not in rewritten historical counts.

Food-chain: preserve initial count and exact type-list reload in FoodChain.test;
retain the existing live wolf-pack browser case for sound, Pause and Save/reload.
Comparator: retain exactly the same Playwright PNG tolerance/missing-geometry/size
expectations in tests-node, without browser fixtures or browser/server setup.
Focused validation: FoodChain 3/3, browser-free comparator 1/1, real browser
food-chain/interior-approved 16/16, and build passed.

[Resolution ledger](158-browser-test-migration/resolutions.json) tracks all 403
baseline templates: retained browser contracts, completed migrations and remaining
work. Template keys refer to the frozen audit source locations.
