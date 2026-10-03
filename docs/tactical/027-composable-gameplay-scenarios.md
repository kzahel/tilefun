# Composable gameplay scenarios

Status: complete, 2026-10-03.
Owner: [Gameplay scenarios](../topics/gameplay-scenarios.md).

## Outcome

Interactive labs run recipes through the shared authoritative gameplay runtime.
The same fixtures support repeatable in-memory integration tests and browser
Worker/client tests. Recipes compose initial content, never physics loops.
Storage is temporary but uses the production persistence contract. Reset creates
a fresh world; reload retains memory records. Ordinary worlds are untouched.

## Delivery and commit sequence

1. Shared recipe/session foundation: typed versioned recipes, explicit memory
   host composition, readiness, manual stepping, serialized replicas, scoped
   settings/definitions and complete disposal. Reuse current record persistence.
2. Browser embedding and traffic: Worker-backed lab session, normal client
   prediction/rendering components and input commands; replace the traffic
   playground loop. Reproduce/fix front/back trapping in shared physics.
3. Furniture and outdoor geometry: reuse preset data as recipes; remove bespoke
   movement/collision loops and separate shared geometry from demo orchestration.
4. Characters: route candidate geometry, motion and animation through authority
   and replicas; preserve useful tuning/overlays and exact review provenance.
5. Validation: headless/Worker parity, reset/reload, concurrent session isolation,
   cleanup, full typecheck/unit/lint/build/browser suites and streaming readiness.

## Contracts

- GameServer/Realm remain the only authoritative simulation. Hosts select memory
  storage and scheduling; browser and tests execute the same domain modules.
- Browser labs run authority in a Worker. Client objects are replicas, never live
  authoritative references. Inputs and tuning cross an explicit message boundary.
- Recipes carry initial world/room content, actors, props, settings and named
  fixture handles. Cameras and review overlays stay in the presentation adapter. Reusable fixtures emit data, not update callbacks.
- Tests explicitly advance fixed steps, await storage/readiness and observe
  semantic state. Seeded simulation randomness and controlled clocks apply where
  exercised; no claim of determinism from generator seed alone.
- Candidate definitions are session-scoped and identical on authority/client;
  editing a lab must not change global entity defaults or another running lab.
- Memory IO copies records and honors async save semantics. Reset, reload and
  close are distinct lifecycle operations, with no writes to ordinary saves.
- Static diagrams/source-sheet/approval renders remain bounded render fixtures.
  Interactive previews migrate. Changed behavior fingerprints reopen honestly;
  immutable art banks and saved human decisions are never rewritten.

## Acceptance

One recipe runs headlessly and in the Workshop Worker, using matching player
inputs and physics. Include stop/jump/ride/walk off each car edge, traffic turns,
furniture support/obstacles, character step/clearance and outdoor geometry.
Exercise binary serialization, two independent instances, save/reload, repeated
mount/unmount, rejected invalid settings and no remaining timers/listeners/Workers.
The standard game continues to use the shared components extracted for labs.

## Execution record

- Plan recorded before implementation. Repository persistence has advanced since
  scoping: format-3 memory record storage and required GameServer dependencies
  already exist and will be reused.

- Foundation committed as `88309a8`: memory records, shared Realm options,
  scoped persisted prop definitions, Worker host and production client predictor.
- Traffic migrated to the Worker client. Four edge regressions reproduce the
  old roof/body mismatch and pass with full body-top support. Existing generated
  braking/jump/ride browser checks pass. The synchronous lane stress harness is
  test-only; no interactive page imports it.

- Furniture motion, outdoor/vehicle geometry and characters now use the same
  Worker client. FurnitureMotion and CharacterTestScene are layout/render models
  with no step loop. Shared furniture collider compilation moved to FurniturePhysics.
- Character behavior fingerprints include recipe/Realm/host sources. Furniture
  motion version 2 reopens older behavior approvals without editing decisions or
  frozen art. Existing exact static image tests remain in the browser suite.
- First browser pass: 26/28; fixed the missing replica animation tick and adopted
  a 0.01px assertion tolerance for serialized outdoor collision positions.

- Traffic migration committed as `8402d67`; remaining labs and review inventories
  committed as `4992a8d`. Final lifecycle fix discards obsolete async preview errors,
  invalidates old readiness attributes and captures input during Worker startup.

## Final validation

- `npm run typecheck`: passed for browser, Node authority and Worker projects.
- `npm test`: 149 files / 1,380 tests passed, including concurrent candidate
  geometry/gravity isolation through reload and actual-Realm junction riding.
- `npm run check`: passed; 124 existing warnings and 32 informational diagnostics.
- `npm run art:catalog`, `npm run workshop:manifest`, `npm run build`: passed.
  Manifest comparison confirms exactly 17 changed behavior identities (11 furniture
  motion, six characters); no vehicle identities or promoted banks changed.
- Full `npx playwright test`: 288 passed, one geometry-preview replacement race
  found. After correcting stale async errors/readiness/input ownership, all nine
  vehicle, outdoor and lifecycle browser tests passed on the rebuilt application.
  No outstanding test failure remains. Existing static approval images were not updated.
- `npm run streaming:bench -- --assert-ready`: passed for regional-v4 and v10,
  with no steady-state missing-data frames and maximum measured prediction replay
  error below 0.000422px. v10 cold start had two missing-data frames within the
  runner's cold-start allowance; this is not a claim of zero cold-start gaps.
- `git diff --check`: passed. Browser tests use isolated Workshop auth/data and
  bundled Chromium. The lifecycle test verifies zero remaining Workers on exit
  and no new IndexedDB databases.

The next step is human movement-feel review of the migrated labs; additional small
scenarios can now compose data and reuse the same host and integration assertions.
