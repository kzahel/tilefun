# Retained final vehicle model bundles

Date: 2026-10-11. Owner: [3D assets](../topics/3d-assets.md).

The owner reported that the finished assets and pinned replay template were absent
from fresh checkouts after the source-only cleanup, and explicitly requested that
the exact final assets and required dependencies be committed.

## Retention contract

Blue `compact-1` v7, green `compact-2` v7 and red `compact-4` v1 are copied from
their original retained inspection bundles. Original `.blend`, GLB, atlas, crop,
rig/window and captured paint/uncertainty bytes are checked against the original
receipts and preserved. No final model is rebuilt, repainted or re-exported for
retention. The receipt identities remain historical evidence, not new approvals.

Runtime exports are in `public/assets/models/vehicles/`; source/texture bundles
are in `art-source/vehicle-models/`. `catalog.json` pins the retained bytes and
expected native/novel renders. Portable recipe wrappers use tracked relative
paths and their own frozen crops. Default palette replay now uses a tracked v7
scene/atlas plus tracked final setup, rig and windshield records; all five input
pins are checked before creating a workspace.

Older scenes, comparisons, logs and scratch galleries remain ignored. The exact
final files need no Blender build or ignored-bundle restoration to be available
in a fresh clone. The asset verifier checks every retained pin, portable recipe
dependency, embedded GLB texture pixels and rigid wheel hierarchy. The existing
browser wheel harness gains a bundle mode independent of scratch galleries.
Git attributes preserve captured CRLF/LF bytes and pinned replay inputs across
Windows, Linux and macOS; formatters do not rewrite frozen bundle records.

The game is not yet wired to load these authored GLBs. This change retains its
already tested inputs; GLB axis/ground registration, sprite fallback, runtime
outer ink, drive pose wiring and steering clearance remain separate work.

## Validation

Validation evidence is local in ignored `data/authored-assets/106-retained-vehicles/`.
The fresh-checkout test must contain only tracked files: neither ignored vehicle
templates nor scratch galleries may exist in that test snapshot. Verify exact
bundle hashes, all source/texture dependencies, the three actual exported GLBs,
and the default compact palette replay from that snapshot before handoff.

Completed: the staged tracked-file snapshot contains neither old vehicle templates
nor scratch galleries. All 18 authoring tests and bundle pins pass there, including
an autocrlf-enabled checkout of the pinned inputs. Read-only Blender inspection
opens all three original scenes, confirms every file texture packed, exact active
atlas bytes and identical geometry/UV/hierarchy fingerprints across the variants.
Full Chromium imports all three tracked GLBs and checks 55 meshes/842 triangles,
four grounded independent wheels, signed forward/reverse quarter turns, front-only
steering and fixed body/centers. Isolated browser/server processes are closed.

The fresh snapshot's default one-command red replay reproduces the retained atlas
and all eight native/novel render PNGs byte-for-byte. Portable blue/green recipes
also match their eight captured renders each. The committed files remain the
original captures, not those new replay exports. Production-build copies of the
three GLBs match their retained hashes.

Typechecks, lint and skill validation pass. The full unit suite reports 2,348
passes, ten skips and the same five Windows symlink/SIGKILL failures recorded in
105; static-file setup/teardown also errors on its denied symlink. Catalog and
manifest regeneration retain 245 sheets/1,086 uses and verify all 761 identities
in normal Chromium at retina scale. Their tracked generated files stay unchanged;
production build passes. No game renderer/simulation implementation changed.

Next: integrate these retained GLBs into the shared mesh path, or use the skill's
new-body route for the ambulance without overwriting the compact revisions.
