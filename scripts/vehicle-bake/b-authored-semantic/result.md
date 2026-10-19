# B authored semantic coupe — final handoff

**Complete and immutable:** `v4` and `budget-low-v4`. Both reports have
`status: complete`; this records delivery/inspection, not human art approval.
Only the red approach-3 coupe was authored. No shared files, inventories,
engine code or other routes were changed; no commits, branches, agents or broad
npm checks were run. The read-only art inbox/notes checks reported no pending work.

| Candidate | Actual triangles | Exported vertices | GLB bytes | Meshes / primitives / materials |
| --- | ---: | ---: | ---: | --- |
| `v4` | 2,378 | 1,991 | 86,712 | 5 / 5 / 1 |
| `budget-low-v4` | 1,324 | 1,203 | 55,632 | 5 / 5 / 1 |

Final candidate paths:

- `public/demos/vehicle-bake/b-authored-semantic/v4/`
- `public/demos/vehicle-bake/b-authored-semantic/budget-low-v4/`
- Editable sources: `art-source/vehicle-bake/b-authored-semantic/v4/` and
  `art-source/vehicle-bake/b-authored-semantic/budget-low-v4/`.
- Combined target/high/low sheet:
  `public/demos/vehicle-bake/b-authored-semantic/ladder-comparison.png`.

Each final output includes `model.glb`, `atlas.png`, eight 128px views,
`comparison.png`, `turntable.gif`, `report.json`, native/4× sheets,
intermediate-heading/roll sheet, contour differences and an optional coarse
wireframe sheet. Each source includes a packed `car.blend` with contract camera,
atlas, semantic ownership/uncertainty maps, source-mask palette histograms,
recipe, inspection receipt, export audit, retained targets/full-resolution actual
GLB captures, exact replay script snapshot and a 63-file immutable manifest.

## Method and source fidelity

The body deliberately samples the exact 141 approach-3 width/deck/superellipse
functions; the windshield, rear glass, roof, side apertures, wheel centers,
fender arcs, splitter and rear trim use its retained landmarks. This is an
authored economic retopology, not the old approach-4 car. Static details are
joined into one body, with four independent wheel assemblies. There are no
high-poly children or modifiers hidden in the export.

The single opaque, nearest-sampled 512×512 atlas is byte-identical between budgets
and embeds as 4,692 PNG bytes. Semantic regions own body ramps, dark glass
frames, restrained glass reflections, hood/door seams, intakes, three deck slats,
tread and five-spoke caps. Interior features survive actual GLB round-trip
rendering. Final 128px processing is only nearest reduction, fixed (0,+28)
translation, alpha threshold and one-pixel inward alpha-boundary ink. No screen
patches, projection planes, view-switched textures or dynamic lighting are used.

The palette comes from the chosen route's retained palette, checked against its
actual target/semantic masks. Raw projection is not used; the empty rejection map
is explicit about that. Opposing studio highlights are replaced by a symmetric
surface-owned ramp. Hidden underside, well walls and tread are explicitly authored.

## Inspection and validation actually performed

- Inspected all eight own rendered headings at native and 4× nearest, target
  comparisons and contour differences; also four intermediate headings and four
  quarter-turn roll poses for each final candidate. No obvious broken UV ownership,
  leaked glass, stray atlas islands or body/tire clipping remained.
- Parsed actual exported GLB indices, attributes, material extension, embedded
  atlas pixels, primitives, hierarchy and world transforms. Confirmed one opaque
  `KHR_materials_unlit` material and five draws. Source meshes have one UV layer
  and no modifiers; the packed Blender atlas is retained.
- Verified all four `Wheel_FL/FR/RL/RR_Steer > ..._Roll > tire_hub` hierarchies,
  front-only steering flags, glTF +Y steering / -Z rolling axes, radius metadata
  `0.34 * (80/4.6)`, independent rolling and absolute reset, plus ground contact.
- Clipped every actual body triangle against every wheel axial slab and proved
  separation from its entire neutral-steer swept cylinder. Minimum gaps are
  about 1.07017 world units high and 0.99509 low. An inserted-collision negative
  probe is rejected. These proofs cover all neutral roll angles, not just samples.
- Coordinator separately reports actual shared-component captures and cylinder
  proofs passing both final revisions, including collision-negative controls and
  all neutral roll angles. This is recorded as coordinator-supplied evidence;
  the route did not modify or run the shared harness.
- Replayed both final candidates using their **retained script snapshots** into
  new `replay-check-high` / `replay-check-low` folders. Exact atlas and all eight
  final PNG bytes match. Both GLBs reproduce identical JSON, vertex attributes
  and oriented triangle multisets. Low GLB bytes match exactly; Blender reorders
  some equivalent high-body triangles between runs, so high GLB bytes differ.
  The frozen final GLB remains unchanged. Receipt:
  `data/vehicle-bake/b-authored-semantic/replay-audit.json`.
- Both 63-file completion manifests verify. `seal.py --verify --revision NAME`
  checks them without rendering or mutation. Blender used background CPU rendering
  with exactly four threads throughout.

## Honest remaining limits

The glass frames and slats are clean and useful, but the hood seams are heavier
than the chosen drawings. The body is more angular and the highlight design more
regular than the target/source-reduced route. Low-budget UV interpolation bends
and thickens some hood lines; twelve-sided tires and the reduced cabin sampling
show additional faceting. Narrow far-side details and slats can merge under native
sampling. The optional wireframe sheet undersamples thin edges and is not the
authority for topology counts.

Mean eight-view silhouette IoU improved from about 0.950 in v1 to 0.962 in v4;
the low budget is about 0.954. The coordinator's separate four-view draft metric
was about 0.948 for B versus 0.977 for source-reduced A. These use different view
sets and should not be treated as identical metrics. B does not claim to beat A
on silhouette fidelity. Steering clearance remains unqualified and is held neutral.
The lower rear buttress tapers to preserve conservative cylinder clearance.

Earlier `v1`/`v2`/`v3` and `budget-low-v3` are unpromoted draft history; the
`replay-check-*` folders are verification outputs. Final completion applies only
to the two locked v4 candidates above. Future changes require new revision folders.

No shared-harness issue blocked this route. Next coordinator step: register these
exact final candidates and present the red-car budget/style comparison for owner
review. Further vehicle families remain gated on that review.
