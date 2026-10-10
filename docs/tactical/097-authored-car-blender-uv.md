# 097 — Authored compact car and Blender UV paint

Owner: [3D assets](../topics/3d-assets.md). Started: 2026-10-10.
Status: Completed bounded pilot; owner art judgment remains open.

The owner authorized a single compact-car experiment after discussing authored
Blender geometry, sprite projections as draft paint and manual UV cleanup.
Scope: editable source, cleaned atlas, portable GLB, actual angle/stage/game-size
inspection and a discoverable Workshop experiment. No game or physics promotion.

## Implementation and evidence

- Freeze all four genuine compact-1 directional crops from the committed approved
  bank; verify the original source atlas SHA-256. Do not modify source artwork.
- Author a body with actual wheel arches, separate cylindrical tires and hubs,
  cabin, hood, roof, glass, fascia and closed lower body/wheel-well surfaces.
  47 named mesh objects, 438 triangles; one 512×512 atlas with named regions.
- Replace the previous per-triangle UV patchwork with larger body/cabin/panel
  islands. UVs are attached by vertex identity after normal recalculation so
  winding changes cannot scramble paint.
- Keep raw projected sprite paint separate from the clean atlas. Approximate
  east/west/north camera formulas and missing opacity samples are recorded.
  All final atlas pixels are authored interpretations using original palette and
  design cues; glass, stripes, roof and hidden surfaces are deliberately painted.
- Save editable Blender geometry, camera/lights and packed clean/draft textures.
  Export a self-contained Y-up GLB; preserve world-pixel scale, front -X and Z=0
  ground in the source. Visual bounds are 56×23.64×20.2, independent of existing
  56×20×24 side-view collision metadata, which is unchanged.
- Retain 36 actual Blender renders, a 24-frame orbit GIF, six-view sheet, clay →
  projected → clean stage sheet, original-versus-candidate game-scale sheet,
  labeled UV layout, provenance, fresh saved-scene audit and artifact hashes.
- Register a separate discoverable excluded diagnostic candidate in Workshop;
  it has no approval or promotion action. Changed bytes require a new revision.

Source and replay: [Blender pilot](../../art-source/vehicles/compact-car/blender-v1/README.md).
Gallery: `public/demos/authored-car/index.html` (Workshop → Authored car).
Browser evidence: ignored `data/authored-car/085-validation/`.

## Visual judgment and limitations

The cleaned atlas removes projection streaks/checkers and produces a coherent
roof/hood/glass layout across top, side and oblique views. Tires have real volume
and four independently verified ground contacts. Agent inspection of the six
views and native-scale sheet finds the candidate readable, but plainer/softer
than the original pixel art. The source directions are stylized, not calibrated;
no all-view pixel match or human acceptance is claimed. Cabin/window proportions,
painted outline treatment and camera matching are the next review concerns.

The projection opacity sample fraction is approximately 80%; it is not observed
surface coverage or a fidelity score. Rendering appearance and collision/support
metadata remain separate. No general asset schema, runtime mesh integration,
device budget, occlusion fix or second asset is included.

## Validation

Fresh saved-scene audit: 47 meshes, 438 nonzero-area triangles, finite UVs,
unchanged authored vertices, four ground contacts, packed textures and one
embedded GLB image. The portable export is approximately 60 KB.
Bundled full Chromium verifies 48 artifact hashes, all gallery images and controls,
no horizontal overflow at 1440×1000 and 390×844, and an actual Three.js GLB render.
The imported export has 438 triangles, four wheels, the expected Y-up bounds and
an embedded texture; no browser/network errors occur. The GIF has 24 real frames.
Typecheck, lint (pre-existing warnings) and production build pass. Art catalog
and Workshop manifest are rebuilt; all 761 prior candidate records stay identical,
and 762 identities pass normal-Chromium retina verification.

The first full Windows unit run reports 2,084 passed, ten skipped and eleven
failures. Re-running the four timeout-affected suites serially passes all 59 tests.
The remaining five failures concern existing Windows symlink permissions and
process-kill semantics (`FsSecurity`, `SqliteRecordStore`, `privateDataPlugin`),
also recorded before this experiment in 073; no runtime change was made here.
Full repository browser run: 496 passed, one skipped, seven failed (504 total).
One failure was the old tool-count assertion, corrected and passing all three
tools-index tests on rerun. Remaining failures are the two standalone hotel
mobile layouts, two GPU/Canvas parity assertions, and city-pet/garage scene
reload checks. A serial follow-up checks the latter four independently.
The city-pet and garage checks pass on the serial follow-up. Both GPU parity
assertions persist (six room pixels; indexed-batch maximum channel error two
against a threshold of one). Together with the two baseline hotel layout checks,
these are the four outstanding browser failures outside the authored-car path.

The two standalone hotel mobile-review failures reproduce with the prior
`ToolRegistry.ts` loaded in an isolated baseline runner: vote buttons end at
853.796875 pixels in an 844-pixel viewport, independent of the new car entry.
The new tool does require updating the tools-index test's explicit count from
25 to 26; that test also checks the authored-car heading and served destination.
All three tools-index browser tests pass after that update, including the new
gallery destination and desktop/phone tool navigation.
An isolated normal-Chromium renderer-lab check with the prior registry reproduces
the same six room pixels / maximum error 22. Renderer and simulation code are
unchanged by this offline pilot; do not weaken their quality gates to pass it.

The live origin was checked read-only: the new candidate URL returns the existing
HTML fallback rather than the exact JSON, so this checkout's new gallery is not
verified deployed and no live review link is offered.

### Follow-up: four-direction camera comparison

At the owner's request, a read-only camera study loads the frozen Blender source
and renders four new views into ignored `data/authored-car/matched-projection/`.
`sprite-vs-blender-4x2.png` places genuine east/west/north/south sprites above their
renders on equal 64×64 canvases, enlarged 4× with nearest-neighbor sampling.
The mesh and texture stay identical across all views. Side cameras use 42°
elevation and longitudinal cameras 70°; recorded horizontal scale, vertical
screen stretch and offsets approximate the hand-drawn source projection.
These are landmark-guided camera choices, not a calibrated pixel-perfect fit.
The earlier fixed-camera sheet compressed the side renders vertically.
The new sheet aligns the side roof and overall size more closely while exposing
hood/cabin proportions, missing details and painted-outline differences.
`render.py`, `compose.py` and `cameras.json` retain the local replay and parameters.
All 48 registered artifact hashes and the frozen Blender source remain unchanged.
No runtime or registered candidate bytes change in this comparison.

Next: obtain owner judgment on the silhouette and paint, refine this candidate
as a new revision if needed, then compare a simple table or playground frame
before generalizing authoring.
