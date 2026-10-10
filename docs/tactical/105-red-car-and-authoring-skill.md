# Red compact and reusable authoring skill

Date: 2026-10-10. Topic: [3D assets](../topics/3d-assets.md).
Status: retained diagnostic delivered; validation checkpoint below. Ambulance is
the next proposed family, not part of this delivery.

The owner said the compact was good enough, requested the little red car and a
repeatable skill, then suggested an ambulance afterwards. `compact-4` is the red
variant in the original vehicle bank. It has exactly the same alpha masks and
physical metadata as compact-1 in all four drawings, and all 27 observed colours
have consistent cross-view correspondence. This permits texture transfer over
the fitted v7 geometry without pretending to fit a different car body.

## Delivered process

- `.agents/skills/tilefun-vehicle-authoring/` is the canonical project skill; a
  local discoverable copy is installed for subsequent sessions. It routes compact
  variants versus new geometry families and captures the observed failures:
  oversized fenders, continuous side-window islands, duplicated corner glass,
  missing native windshield-top ink and centered independent wheel pivots.
- `author_variant.py` performs a source-checked transfer, actual Blender bake/render,
  native inspection, packed editable source and fixed-body wheel animation into
  one new offline workspace. `compact-variant-template.json` pins v7 inputs and
  explicit material roles for authored colours. Different shapes, physical layouts,
  inconsistent palette correspondence and unmapped colours are rejected.
- `inspect_vehicle.py` retains native source contours and novel angles; optional
  model-space top-band probes check final pixels rather than atlas counts.
- New candidate presentation comes from its immutable record through the shared
  hash-validating `buildAuthoredVehicleCandidate`, preserving old identities.

## Retained evidence

Source: `art-source/vehicles/compact-red/blender-v1/`, four exact reference crops,
recipe/config and self-contained `car.blend`.
Blend SHA-256: `fbca03e16641fb582174d09b556c813daa5dac9d770f9f0aea20e1d58732d7c1`.
55 meshes, 842 triangles, ten rigid rig nodes. Same mesh fingerprint as v7.

Thirty exact artifacts in `public/demos/authored-car/red-v1/` include 4×2 sheet,
four native source/render pairs, atlas, GLB, raw projection, uncertainty mask,
contour differences, novel angles and actual wheel motion. Candidate
`projection:authored-compact-4-v1`, batch `authored-car-093`, is discoverable but
excluded from formal production approval. All v1–v7 source/artifact pins verified
unchanged. Original sprites, game rendering and collision metadata are unchanged.

Native silhouette overlap E/W/N/S: 92.24%, 92.29%, 95.64%, 92.82%, including
painted sprite shadows. Mean bidirectional contour distance: .909/.903/.439/.717
pixels. Top-window ink is continuous over every checked aperture pixel in all
four matched views. Twenty-four wheel frames keep body/centers fixed.
Raw projection distinguishes 210,455 observed texels, 86,479 unseen, 13,354
overlapping and 27,137 source disagreements; cleaned paint does not alter those
statuses. Its authored-fill diagnostic still references the starting blue atlas;
the retained raw draft/mask is the observation evidence, not that filled image.

An independent one-command replay matches the cleaned atlas and all four
native/novel PNG renders byte-for-byte. Blender container-byte identity is not
claimed. Existing hood, pillars and side-profile differences remain visible;
native checks do not establish human acceptance. Outer ink needs a runtime pass;
steering clearance and game integration remain open.

## Validation checkpoint

Fifteen Python checks pass, including rejection of changed silhouettes, physical
anchors and conflicting palette semantics. The compact runner rejects the ambulance
before creating output. Skill validation passes for the project source and installed
copy, whose files match exactly. Blender source audit verifies all mesh vertices,
faces, UVs, hierarchy/transforms unchanged and the own raw draft/clean red atlas packed.
Full Chromium verifies 55 meshes/842 triangles, tire ground contact, signed
forward/reverse quarter turns, independent roll and front-only steering with body
and wheel centers fixed. Desktop 1440 and phone 390 galleries load every image
without overflow/errors; test browser/server are closed after this check.

Typecheck and lint pass (existing 118 warnings/34 infos). The complete unit run
reports 2,102 passed, ten skipped and the same five existing Windows symlink/SIGKILL
failures; static-file setup/teardown also errors after its symlink is denied. Catalog
retains 245 sheets/1,098 uses. Manifest verifies 769 identities in normal Chromium
at retina scale, with 21 diagnostic/compiler exclusions, and the inbox is current
with `authored-car-093` discoverable and no pending requests. Production build passes.
The full 504-case Playwright run completes in 21.6 minutes: 498 pass, one skip,
five fail outside the changed art/Workshop paths. Failures are Building Lab and
hotel-sign phone bounds, GPU train-riding player height, GPU room/editor reference
pixels and indexed-batch accounting. All tools-index, vehicle Workshop, car
projection, traffic, vehicle-grade and gallery/exported-rig checks pass. This task
changes no game simulation or renderer implementation; broader failures remain
separate from the passing asset checks. Bundled test Chromium and preview servers
are reaped by the test runner. WSL Git whitespace checks pass.
Local evidence belongs in ignored `data/authored-assets/093-red-car/`.

## Source-only commit and runtime readiness

The owner subsequently requested a clean committed tree with scratch demos and
generated artifacts ignored. All 097–105 local vehicle scenes/exports/galleries
remain on disk in ignored `art-source/vehicles/` and `public/demos/authored-car/`.
Their scratch-only Workshop tool/batches, candidate builders and digest inputs
were removed, returning the production manifest to its previous committed bytes.
The earlier registration/inbox numbers above record the inspection checkpoint,
not the final source-only checkout. No generated experiment file is committed.

Reusable scripts, hand-authored family parameters, the skill and written findings
remain tracked. Six original geometry/paint/export constructors were preserved
under `scripts/authored-assets/compact-pilot/` with a fresh ignored workspace;
shader/GLB-import/wheel helpers live in `scripts/authored-assets/runtime/`.
Fresh clones can build the game without the local experiments. Exact palette
replay requires the separately retained v7 scene/atlas/rig/aperture bundle;
missing inputs fail explicitly rather than bypassing their hash pins.

The current exported GLB is self-contained and already loads in Three.js without
Blender. Gameplay still constructs the diagnostic car in `CarMeshAsset.ts` and
needs the authored GLB loader/axis-ground registration/resource-fallback adapter,
native outer ink and wheel pose wiring. The model's rigid pivots and atlas ink
are ready inputs to that integration, not an existing gameplay connection.

Source-only validation: typechecks, lint, both skill copies and all 15 Python
authoring checks pass. The relocated pilot reproduces its original geometry and
three atlas/coverage images exactly, then exports/renders/audits a fresh
47-mesh/438-triangle self-contained GLB. Catalog/manifest regeneration verifies
761 identities and 13 exclusions and leaves the tracked generated files unchanged.
The production build and all three tools-index browser cases pass. The full unit
rerun again reports 2,102 passes, ten skips and the same five Windows failures
described above. Full Chromium also verifies the moved GPU outline helper against
reference bytes and the red GLB's independent wheel transforms, static body/centers,
ground contact and signed roll; both gallery sizes load without errors/overflow.
The isolated browser/server processes are closed. Local validation logs and
pilot outputs are ignored.

Next: use the skill's different-body route to author an ambulance cab/box template,
measure its directional landmarks, preserve graphics/window ownership and recheck
fenders/axles/native outline and independent wheels.

Rebase note (2026-10-11): upstream independently allocated tacticals 085–093.
The vehicle records were renumbered to 097–105 and their documentation links
updated. Historical local batch IDs, evidence paths and template hashes retain
the original numbers; those labels are not the current tactical filenames.
