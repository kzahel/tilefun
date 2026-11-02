# Opt-in game character physics

Status: delivered as an opt-in first slice, 2026-11-02.
Owner: [physics engine](../topics/physics-engine.md).

## Plan and invariants

Move beyond the schematic physics proof by adding an explicitly selected Rapier
character backend to normal game authority and PlayerPredictor. Keep ordinary
launches on the existing engine. Retain the existing shared TypeScript movement
intent, acceleration, locomotion friction, sprint, gravity multiplier, jump cutting,
air control, bunny-hop policy, input timing and per-command parameter history.
Rapier owns selected player collision/ground/ceiling resolution; the old player
collision/gravity solver must not also advance that selected step.

The default experimental player shape is a nonrotating axis-aligned cuboid with
the existing 10×6 footprint, 12-pixel height and exact foot-anchor offset. Facing
and rendered animation never rotate the hull. Keep an upright capsule option for
comparison and reusable per-character shape descriptors for later NPC adoption.
No character must become a freely tumbling rigid body.

1. Add a small lazy backend registry, authoritative opt-in configuration and normal
   client synchronization. Preserve exact selected backend in retained movement
   parameters. Unready clients hold prediction rather than stepping a different
   solver. Default clients must not initialize WASM.
2. Adapt the shared on-foot movement step at its collision/gravity boundary.
   Build a bounded nearby Rapier query scene from normal terrain, prop walls and
   planar surface slabs. Preserve logical floor/height conventions and collider
   offsets. Prediction reads its existing collision history and private pushed
   body copies; it must not mutate replica entities.
3. Keep controlled pushing bounded and driven by current intent, with environment
   checks for the recipient. Preserve existing entity/AI/vehicle ownership while
   the on-foot backend is opted in. Moving supports require explicit carry/time
   ownership; never feed solved character velocities back as support intent.
4. Exercise this through the actual game launcher, Worker authority, normal
   renderer, console settings and PlayerPredictor. Add focused native motor,
   geometry, replay/configuration and shape checks; use bundled Chromium for the
   launch/Worker/real-input/render boundary. Retain old lab regressions.
5. Have the requested Sol 6.1 high reviewer inspect the finished diff through
   localhost:3400 Yep Anywhere, address actionable findings, validate and commit.

## Qualification and subsequent integration

This first integration is an experimental controlled-character query backend.
NPC AI and general loose-body/vehicle dynamics retain their existing owners.
The full-WASM small-scene lab remains the dynamic-contact reference; this slice
is not a shipping full-world physics snapshot policy. Preserve shared collision
geometry and motor helpers across these consumers where applicable.

After opt-in game feel review: qualify moving roof departure/landing, independent
clocks and both-active dynamic contacts; choose bounded nearby dynamic replay and
body ownership; qualify save/reload, editing and collider residency under broader
world content; measure Worker/main-thread tails and memory on the actual
Chromebook. Promote interaction categories only after those acceptance checks.

Acceptance for the first slice includes positive pushing, bounded contact speed,
wall clearance, variable gravity/jump behavior, stable box dimensions under facing
changes, capsule comparison, parameter changes during retained-input replay,
bounded query resources and no default-engine regression. Unsupported cases and
measured limits must be recorded before handoff.

## Implementation and review

The normal launcher accepts `?physics=rapier&hull=box` (or `capsule`). The host
can switch with `sv_characterphysics 0|1|2`; guest configuration is synchronized.
World Geometry's deck fixture has the same backend selector. The default shape
is fixed at the existing anchored 10×6×12 box; the optional inscribed capsule is
6×6×12. Facing never rotates either hull. Generic shape descriptors can support
NPC capsules later without changing NPC ownership now.

The native adapter builds and frees a canonical nearby Rapier query scene per
substep. It clips long structures, rebases far-world coordinates, merges equal
terrain cells, clips excavated terrain against exact surface planes and retains
separate ground/water/one-way policies per moving actor. Bounds: 512 colliders,
512px swept XY span, 2048 partition vertices and eight cut planes per cell.
Over-budget scenes reject explicitly. These are prototype bounds, not content or
performance qualification; no WASM speedup is claimed.

The requested review ran through Yep Anywhere at localhost:3400 with
`gpt-6.1-sol`, verified effort `high`, in read-only plan mode. Six initial findings
produced fixes and regressions: private predicted push state cleared at all rebases;
recipient-specific shoreline/platform queries; post-admission landing momentum
conversion; actual wildlife support identity; continuous excavation ramps; and
cumulative per-pusher passive budgets across subdivisions. A further regression
removed refeeding tiny KCC vertical skin corrections into horizontal pushing.
One/four-substep and both seat orders now retain continuous positive pushing;
40-tick recipient travel is 20.77–21.30px, order difference below .15px and overall
subdivision difference below one walking tick. These are native regression values,
not target-device frame measurements.

Landing uses an endpoint support cast: the KCC's grounded flag can anticipate
contact while still above an animal. A real Realm horse landing/mount regression
guards the full side-effect path. Support is recomputed after pair guards, airborne
ground metadata uses the same collision filters as movement, and one-way admission
uses the current gravity-integrated velocity at the apex.

## Validation

- Focused native checks cover the existing Rapier labs, default physics parity,
  normal prediction/replication and Worker host contracts, plus new motor, geometry,
  pushing, replay/configuration, lazy loading and landing regressions.
- Full Chromium checks exercise normal game launch, Worker movement, live hull and
  gravity synchronization, jumping/landing and returning to a legacy startup with
  no backend request; World Geometry exercises the shared box ramp/deck and capsule
  underpass through normal presentation. Default Worker/geometry regressions also
  remain selected for the final run.
- The required isolated default-engine streaming benchmark completed all six
  phases with zero errors/failures and zero final missing, incomplete or stale
  terrain. It is default-path regression evidence, not an experimental backend
  or Chromebook performance comparison. Local report: `/tmp/tilefun-197-streaming/report.json`.
- Typechecks, changed-file Biome, regenerated inventories, production build and
  final requested reviewer disposition are recorded at completion below.

Completion: 166 native tests in 13 focused files pass; all three TypeScript projects
and the production build pass. Changed-file Biome has no errors or new warnings
(four pre-existing non-null assertion warnings). Catalog and manifest are current;
2119 candidate identities were verified in full Chromium at retina scale.
The six selected full-Chromium cases pass: two opt-in boundaries, default Canvas
and GPU geometry movement/reload, Worker-busy presentation and replicated physics
settings/lifecycle. The Sol 6.1 high follow-up reports no remaining blocking or
actionable correctness findings in the complete uncommitted diff; review was
source-only and did not run these checks itself.

Next: owner playtest the fixed box and capsule in ordinary worlds, then measure
nearby query/replay tails on the actual Chromebook before choosing geometry cache
residency or expanding NPC/dynamic-body ownership.

Remaining gates: airborne player recipients, contact chains/crowds, overlap recovery
and live hull expansion, moving roof/vehicle-bed detail, general body rollback,
independent clocks, broad saved-world/editing content and Chromebook CPU/memory tails.
General NPC, loose-body and vehicle dynamics retain their existing solvers.
