# Explorer motorboat and large wildlife lakes

Status: implemented and validated; original appearance pending human review. Owner
requested a working boat, larger naturally generated lakes, boats beside shores,
varied water creatures and a final commit. Appearance remains pending human review.

The original Explorer motorboat shares ordinary authority, prediction, boarding,
safe dry-shore exit and durable traffic records. Its 80px square footprint covers
all sixteen qualified headings; every swept hull cell must be loaded water.
Land, solid terrain, props and bodies block movement. Boats have gentler
acceleration/braking, rolling steering and reverse, never road routing or pushes.
The open driver seat stays visible in Canvas, GPU sprites and own-mesh rendering.
Production resume now validates an actual saved boat before restoring its seated
player over water; explicit travel still uses ordinary safe arrival.

An independent bounded 512-tile owner bank provides irregular lakes around
108–140 by 76–108 tiles, with an open northern boarding beach. Admission preserves
infrastructure and existing small water refuges. Each lake has one durable natural
boat, sixteen fish in four schools, four other water species and one aquatic
hunter. Existing AI, food-web and delayed natural-only replacement apply. Moved
or deleted boats are not recreated at their mooring. Old saved edits remain intact;
new terrain appears in fresh worlds or newly generated territory. The zebra lab
inspection was relocated to a valid clearing under the current generator.

The World Geometry lab lake case shares the same simulation and rendering:
<https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-lake&landscape=thicket#/tool/world-geometry>.
Use E / Drive boat beside the hull; WASD/arrows steer, R reverses and E exits
beside clear dry shore. One driver is supported; passenger benches are decorative.

Editable packed Blender source, palette UV atlas, GLB, native cardinal fallback,
frozen viewer and sixteen actual exported-model captures are retained under
`art-source/vehicle-models/explorer-boat/v1/` and
`public/demos/original-vehicles/explorer-boat-v1/`. The candidate is registered
pending appearance review, with provisional gameplay explicitly authorized by the
owner. Exact source-only Blender replay reproduces model SHA-256
`6239c017a8b9bf0c3ad9bd7937e1df6786a6d0388fc69066c46d452fd376e788`.
Use an absolute `--output` path when replaying the frozen builder.

Validation evidence so far:

- Typecheck, lint and production build pass. Lint retains 119 baseline warnings
  and 35 informational diagnostics. Art catalog and normal full-Chromium retina
  Workshop inventory pass with 1,770 candidates. All three previous complete
  original-vehicle candidate objects and their source registry remain exact.
- An isolated HEAD plus named boat-file snapshot passes typecheck, production
  build/inventory freshness and all five boat asset/physics/lake/persistence tests.
  It uses installed dependencies but no working-tree source outside that snapshot.
- Ninety affected driving, placement, prediction and realm tests pass; 94 water/
  generation checks and nine zebra residency checks pass. The natural habitat
  probe finds every eligible species at its current inspection location.
- All six new bundled full-Chromium boat cases pass in Canvas, GPU sprites and
  3D, including actual Worker shutdown/save/reopen and occupied-seat restoration.
  Twenty-four aquatic hunting, 76 Animal Browser and 25 authored-vehicle browser
  cases also pass. The broad exploratory browser run was bounded after 141 passes;
  the remaining per-species gameplay matrix was not claimed as complete.
- Full units complete: 5,720 pass, five known Windows failures and ten static-file
  skips in 652.94s. Remaining failures are three symlink EPERM cases, the Windows
  process-death/WAL test and the private-data symlink test; static-file hooks also
  require unavailable symlink permissions. No boat diagnostics remain. This full
  run precedes the last mooring alignment test; 51 focused boat/resume checks pass
  after that correction, including fractional negative-coordinate shorelines.
- Seventeen focused road/train/robin/generation browser cases and four zebra
  motion/ball/deletion cases pass. Streaming `--assert-ready` passes with no final
  missing, incomplete or stale terrain. The final boat-only repeat follows the
  mooring correction and regenerated inventory: six cases pass again in 48.2s.
  All four sampled lake moorings pass full-body water admission and dry-bank
  boarding reach; the playground lake is available in all four landscape profiles.

Local diagnostic logs/captures use the ignored `data/boat-152-*` paths. Reproduce
with the normal repository checks, `src/boats/Boat.test.ts`,
`tests/boat-lakes.spec.ts`, existing aquatic/vehicle/browser/generation specs and
`tests/fauna-gameplay.spec.ts --grep zebra`.

Next: owner play/appearance review, then optional wake/rocking effects, wildlife
camera improvements and passenger seating. No appearance approval is inferred.
