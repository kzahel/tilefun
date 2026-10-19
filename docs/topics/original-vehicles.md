# Original vehicle authoring

Topic: original-vehicles
Status: owner accepted corrected red-coupe appearance; gameplay integration pending.
Updated: 2026-10-19.

Owns original vehicles beyond the existing sprite bank: high-detail art masters,
pixel-style transfer, low-poly deliverables, reusable authoring instructions and
the expansion backlog. [Vehicle porting](vehicle-model-porting.md) continues to
own the 45 existing sprite ports; these prototypes do not change those counts.

## Current decision and gate

The owner prefers [141](../tactical/141-sports-car-style-experiments.md)'s approach 3,
especially characteristic outer and internal outlines. [142](../tactical/142-red-car-low-poly-pipeline.md)
tests that look on economical textured GLBs. Preference and authorization to
experiment are not an exact-revision production art approval.

The red-car appearance gate is now cleared for the corrected v3. Beetle,
school-bus and pickup are the next queued pipeline experiments under the owner's
earlier instruction; none started during this asset-commit checkpoint.

The owner likes the style but flagged upper tire crowns above the fenders.
`a-reduced-projection/mid-fenders-v3` corrects the source geometry with integrated
shoulders and a modest inward track adjustment. It is 2,299 exported triangles,
one unchanged 512² palette atlas, five draw meshes and four independent wheels.
The coordinator inspected both 16-heading camera sets and verified actual GLB
clearance/roll. On 2026-10-19 the owner reviewed this version, said "good looks
better" and requested committing the final assets. This records appearance
feedback for GLB SHA-256
`05de49fc16a281db97fb6854d94252e44bb8f1502a5749e8580d95cba908df64`.
Frozen review snapshots keep their original review-time metadata.

The coupe currently has **no gameplay spawn entry or automatic road traffic**.
It is registered only as a Workshop authoring/review candidate. Gameplay vehicle
definitions and traffic selection still derive from `src/traffic/vehicles-v1.json`.
Integration needs entity/visual registration, collision dimensions, native fallback
and road selection/handling validation. The asset commit does not activate it.

## Pipeline invariants

- Keep immutable high-detail sources, target pixel drawings and retained revisions.
- Use one view-independent UV atlas; outer pixel ink belongs in the renderer.
- Keep wheel paint/rigs independent and count the actual exported geometry/materials.
- Compare the actual GLB at native scale and intermediate headings, including roll.
- Inspect far-side tire coverage beneath real fender surfaces independently of
  nonintersection; the owner flagged exposed upper tire crowns in the first pilot.
- Reusable recipes must run from retained inputs without ignored scratch state.
- Human style review precedes expansion and any runtime activation.

## Queue and evidence

[`art-source/vehicle-bake/roster.json`](../../art-source/vehicle-bake/roster.json)
owns the machine-readable queue. [Vehicle status](../vehicle-status.md) is its
generated review table. Source instructions and experiment contract live in
[`scripts/vehicle-bake/README.md`](../../scripts/vehicle-bake/README.md).
