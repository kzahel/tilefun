# Independent wheel-coverage diagnosis

The exposed crowns originate in the retained approach-3 geometry, not wheel
inflation during export. The main defect is missing broad upper fender/shoulder
coverage; a narrow arch tube is insufficient. Track contributes, but tucking it
alone cannot repair the low hood above the front tire.

Read-only inspection of actual `budget-mid` and `v5` GLBs confirms source wheel
centers `(±1.4, ±0.87, 0.34)` and radius `0.34` in source units. The source torus
is centered at `|Y|=.89`, with outer tread at `.972`. Source coachwork half-width
at the axles is approximately `.932` front / `.961` rear: slight outboard tread
overhang exists. More decisively, the original **uncut** shape equations give
heights `.556` front / `.651` rear at the tread centerline, below the `.680` tire
crown. The separate arch tubes span only about `.044` across the tread.

The source already cuts radius-`.405` local pockets, reaching Z `.745` over the
axle. A's post-reduction radius-`.375` safety cutter is smaller. It can remove
bridged QEM triangles, but is not evidence that a later enlarged cutter caused
this inherited gap. Clearance-safe open pockets do not provide an overhead panel.

## Measured coverage, not art approval

New diagnostic: `scripts/vehicle-bake/coverage.py`. It imports the actual GLB;
optional retained `.blend` inspection uses the explicit coupe source rig names.
It samples +Z above the full-radius swept wheel envelope at five longitudinal
positions across ±0.6 radius and five tread positions across ±0.75 tread half-width.
The source tire cross-section is declared, not guessed from hub-cap width.

UV/normal duplicates are position-welded for connected-component analysis.
Panel candidates require axial breadth/area, a nonvertical face, and five lateral
support rays across a `.30R` band. Thus a narrow arch hit does not count as a
covering panel. Reports retain every uncovered point, raw/qualified hits, gaps,
signed vertical margins when a surface exists, nearest-panel distances, component
dimensions and the full family configuration. Missing overhead geometry has no
invented numeric gap; the nearest-panel distance remains available.

| Actual input | Qualified samples per wheel (FL / FR / RL / RR) |
| --- | --- |
| Retained approach-3 source | 0 / 0 / 0 / 0 of 25 |
| A `budget-mid` | 0 / 0 / 0 / 0 of 25 |
| A `v5` | 0 / 0 / 0 / 0 of 25 |
| A `mid-fenders-v1` | 25 / 25 / 25 / 25 |
| A `mid-fenders-v2` | 25 / 25 / 25 / 25 |
| A `mid-fenders-v3` | 25 / 25 / 25 / 25 |

For `budget-mid`, 3 / 6 / 4 / 0 samples hit trim/ineligible geometry only.
At the central crown, nearest broad-panel distance is approximately `.266` front
and `.118` rear in source units. V3's upward panel gaps are `.02896–.03500`
source units, approximately `.504–.609` exported world units. These are vertical
coverage gaps, **not** minimum body/wheel collision distances.
V3's actual wheel pivots are tucked to `|Y|=.79` from `.87`, with radius `.34`;
the diagnostic follows those exported pivots rather than the old source track.

Real-body removal changes V3 from 25 to 0 covered points on every wheel. Isolated
synthetic broad-panel controls cover all samples; moving those panels outside the
region gives zero. Controls make no changes to candidate geometry. Body removal
is explicitly uninformative on the already-uncovered baseline.

Retained receipts beside this note: `baseline.json`, `corrected.json` and
`source-unchanged.json`. Other source/budget/cap-trial comparisons were diagnostic
scratch under `data/vehicle-bake/`; they are not required to replay this probe.
V3 GLB SHA-256: `05de49fc16a281db97fb6854d94252e44bb8f1502a5749e8580d95cba908df64`.

## Separate visual acceptance

V1's red semicircular caps cover every sample yet visibly create the flagged
humps in 0°/180° study views. This is a useful counterexample: **perfect coverage
cannot approve the silhouette**. Prefer smoothly integrated longitudinal shoulders,
modest track tuck if needed, and local clearance-sized inner surfaces rather than
four independent circular outer caps. Preserve the low continuous sports-car
profile; do not replace tire half-moons with red half-moons. A owns that correction.

For owner review, keep three independent gates:

1. Existing actual-GLB neutral-roll nonintersection proof.
2. Declared coverage evidence above, with denser boundary sampling if a changed
   region warrants it. Finite vertical samples cannot prove continuous coverage
   or camera-space occlusion; the full cylinder is conservative for toroidal tread.
3. Actual fixed-camera/game renders at 16 headings, especially opposite 0°/180°,
   plus wheel phases. A useful future diagnostic is wheel/body ID rendering:
   measure visible **far-side upper-tread** pixels in a declared crown region and
   distinguish them from legitimate near-side wheels in open arches. Review the
   body-only outer profile too, against declared smooth shoulder landmarks, so
   red humps fail even when tire exposure is zero. Agree any native-pixel tolerance
   explicitly; no universal aesthetic threshold or art approval is claimed here.

Replay example (choose a fresh output path):

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/coverage.py -- --input public/demos/vehicle-bake/a-reduced-projection/mid-fenders-v3/model.glb --family approach3-coupe --output data/vehicle-bake/coverage-new.json
```

Only the new diagnostic and these data receipts/note were written. Source and
candidate files were not saved or edited. Original `.blend` SHA-256 before and
after inspection is unchanged:
`b636af46a30799126151e7cf9f8bfd2db3b6e3490a69787a7a3e8dbcc56f0296`.
Proof: `source-unchanged.json` beside this note.
