# Playable level truck-bed occupant

Date: 2026-10-20. Owner authorized the bounded playable bed-occupant proof after
[162](162-shared-world-depth-comparison.md). Implementation and focused checks
complete; final broad checkpoint below. No art approval is inferred.

Owners: [vehicles](../topics/vehicles.md),
[rendering](../topics/rendering-architecture.md),
[embedded labs](../topics/embedded-engine-labs.md).
[Reusable workflow](../vehicle-bed-prototype.md) owns usage, dimensions and
extension instructions.

## Delivered behavior

The Workshop **Truck bed playground** hosts the ordinary scenario Worker,
production Realm, binary state view, prediction and shared renderer. It uses the
unchanged dump truck and Explorer sprite. The controlled person walks on a real
recessed floor, meets four sloped walls, jumps over the rim, rides while the truck
moves/brakes and restores the bed support height on reload. Manual load/outside
buttons are explicit diagnostic teleports, not implemented boarding mechanics.
The route is straight and bounded; heading selection resets the fixture.

An explicit `vehicleBed: true` profile enables seven plain collision/support
prisms for this truck. Ordinary trucks retain their existing behavior. Loaded
visuals use actual model triangles and a character sprite plane in the truck's
local depth target. The two sprite fallbacks use approximate source-derived
physical clips. Debug wire overlays show floor/walls, player body, sprite plane
and feet without changing physics/depth. Pause/step and live backend switches
preserve the Worker/world; reset/reload use ordinary memory record ownership.

The support height survives snapshot/delta hydration, traffic records and optional
relative player support height. Frame `0x06` rejects old endpoints. Matching
simulation/prediction changes apply through shared engine modules; there is no
private lab physics or rendering implementation.

The browser proof caught a missed predictor rebase path that lifted the person
from the floor to the old roof height. It now preserves the selected support
surface, with a native regression that repeats prediction and presentation
against successive carrier poses.

## Evidence

The repeatable capture command is
`npx tsx scripts/instrumentation/truck-bed-playground.ts`. It starts an isolated
Workshop server without the unrelated filesystem game-server plugin, uses full
bundled Playwright Chromium, and closes its browser/server. Eight captured states
include center/near-wall, jumping, both sprite fallbacks and all headings.
The source/model hashes, engine diagnostics and gallery stay under ignored
`data/3d-investigation/truck-bed/`. No generated mesh, texture, user world or
feedback history is committed by the capture workflow.

The diagnostic view confirms the intended partial clipping and unchanged palette.
It also makes the approximation explicit: the player remains a sprite plane with
its existing smaller physical body, and cab/chassis/rims use conservative contact
geometry. Neither screenshots nor successful automated checks count as human art
approval.

## Validation

- Native contact/transport/reload tests: 3/3. Shape/yaw/ray tests: 2/2. Repeated
  recessed-height prediction/presentation regression passes. The relevant ten
  existing/new suites initially passed 351 cases; the subsequent focused
  prediction/contact rerun passed all ten cases after the rebase correction.
- One focused full-Chromium test passes actual Worker prediction, near-wall
  walking, geometry overlays, exactly one paused tick, Canvas/GPU/mesh switching,
  unchanged entity IDs, moving support and reload (6.0s).
- Typechecks, repository lint and the browser-free node integration case pass.
  Lint reports 121 warnings and 39 informational diagnostics; no new-file lint
  errors remain.
- After the final changes, 51 focused native cases in four suites pass. The
  production build passes all asset/freshness gates. Catalog generation records
  695 sheets / 1,393 source uses; the manifest registers 1,899 candidates and
  verifies their identities in normal Chromium at retina scale. New candidate
  `geometry:truck-bed-v1` has no inferred review decision.
- The built application passes the new bed boundary and existing mesh
  rotation/composition/atomic-fallback case in full Chromium (2/2, 8.6s), using an
  owned preview port and isolated auth/data. The alternate dev/capture/preview
  servers and owned browsers are closed after validation.
- Full bounded Windows Vitest: 6,438 passes, eight failures, ten skips in 354
  files (614.50s). Five failures are the known filesystem-symlink/process-death
  cases; the other three are orca reload, goat ground-height and farm-animal
  spawn-count assertions outside this bed slice. The goat/farm code is being
  changed concurrently in 163. Static-file symlink setup/cleanup hooks also fail.
  No bed/prediction/transport regression remains in the focused native owners.
- `streaming:bench -- --assert-ready --renderer=gpu --meshes` passes on the real
  single-player Worker. Its report has no scenario failures/errors and ready
  terrain after traversal. This is normal-game readiness evidence, not a bed
  population performance budget or a mobile-device pacing claim.
- Collection verification records 824 browser cases, one browser-free comparator,
  three HTTP/WS cases and six opt-in captures. The single new bed case is its
  browser-dependent lifecycle boundary. The original 403-template audit stays
  frozen. The helper's direct installed-CLI invocation fixes its Windows `npx`
  ENOENT without adding a shell dependency.

Portable checkpoint: [validation.json](164-playable-truck-bed/validation.json).
Captures are reproducible with the documented isolated command; live jump poses
sample the real clock and need not be byte-identical. The retained model and
sprite bytes remain unchanged.

## Remaining work

Add a real loose crate before introducing bed articulation and tipping. Qualify
relative support motion, release and persistence for that cargo explicitly.
Multiple passengers/seats, real boarding, tilted contacts, cross-group occluders,
broader model qualification and device populations remain separate work. This
slice does not change the default renderer or activate hollow beds in ordinary
worlds. The public review deployment must be verified before sharing its new
playground link; a different checkout is not automatically updated.
