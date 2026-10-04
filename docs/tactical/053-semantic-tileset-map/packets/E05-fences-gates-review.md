# E05 — Independent fence and gate review

Date: 2026-10-04. Reviewer: coordinator, separate from mapper.
Disposition: pass with bounded qualifications. No human approval or runtime promotion.

## Initial interpretation

Before reading the proposal, the coordinator inspected native exports and the
master context around the Fence_1 bank. Thin gray/violet pickets, rails, narrow
side strips, corner cuts and stepped diagonal fragments support a component kit.
Neither wood nor metal is established by these pixels. The four Garden images
show closed ornamental gate fronts with cropped foliage sides. Bush_6 looks like
a complete outlined shrub, so treating it as a seamless gate extension would
require separate evidence. These are two distinct kits, with no demonstrated
cross-kit joins. Initial captures: [source view](/tmp/tilefun-E05-independent-source-view.png)
and [master context](/tmp/tilefun-E05-fence-master-context.png).

## Frozen inputs and independent evidence

- [E05-fences-gates.json](E05-fences-gates.json): `238778d9b00baadfa7de2799b3d55a0f834be22237b0994c77e731efba1e2870`.
- [E05-fences-gates.md](E05-fences-gates.md): `824e2ea62e5be00317b757d05d4383ea0941e257ad6abfe82ca7e8d5b8614a97`.
- Helper: `1284587d22eb12fe975fbd84c7e56af4c802b8e5df0d0378a981cf808328c066`.

The helper's complete `--check --capture-dir` replay passed. Separately written
Pillow checks verified all 58 raw PNG pins, all 27 native/master pixel matches,
48 declared occurrence links, 70 named aliases and all 14 recipe output hashes.
Every independent recipe was composed from original native frames and inspected
at integer zoom. All ten pair comparisons plus both gate-side/shrub comparisons
were independently checked for normalized RGBA differences, alpha differences,
changed bounds and mask hashes. Only alpha-zero RGB is ignored.

A separate spatial-bucket port audit reproduced every matched-pair and unmatched
count: the three enclosures have 8, 8 and 12 joins; each diagonal pair has one;
the open upper run has two joins and two exposed cuts. Reversed corners expose
six cuts, the shifted side post four, the width-stepped diagonal two and the
isolated corner two. These are finite diagnostic joins, not runtime placement
rules. Full-domain absence and seam measurement generation use the mapper helper;
the independent checks replay declared correspondences and inspect actual seams,
not a second exhaustive matcher implementation.

The helper and independent rasters agree. The thin side-post color changes are
retained; equal alpha alone does not identify a duplicate. Exact corner duplicates
stay separate named records. Diagonal pair ends look bounded in the tested forms,
but those forms establish neither arbitrary repetition nor junctions. The Garden
extension visibly adds distinct outlined shrubs; lowering them worsens the contour.
Standalone gate use, side completion and gate mechanics therefore remain unknown.

One presentation correction was requested before freeze: gate cards use `unknown`
so their badge agrees with their unresolved standalone topology. The mapper also
removed unsupported handle wording. Source pixels and recipes were unchanged.

## Candidate dispositions

| Record | Interpretation | Disposition |
| --- | --- | --- |
| E05-01 | Upper-left corner | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-02 | Upper horizontal section | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-03 | Upper-right corner | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-04 | Right vertical section | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-05 | Right vertical section · alternate shading | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-06 | Lower-right corner | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-07 | Lower horizontal section | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-08 | Lower-left corner | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-09 | Left vertical section | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-10 | Left vertical section · alternate shading | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-11 | Upper-left corner | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-12 | Upper-right corner | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-13 | Lower-right corner | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-14 | Lower-left corner | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-15 | Rising diagonal · lower half | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-16 | Rising diagonal · upper half | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-17 | Falling diagonal · upper half | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-18 | Falling diagonal · lower half | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-19 | Rising diagonal · alternate upper half | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-20 | Rising diagonal · alternate lower half | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-21 | Falling diagonal · alternate lower half | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-22 | Falling diagonal · alternate upper half | Supported component; recorded neighbor cuts required in the checked kit. |
| E05-23 | Narrow garden gate · cool frame | Qualified gate hypothesis; outer hedge closure and standalone use unknown. |
| E05-24 | Narrow garden gate · warm frame | Qualified gate hypothesis; outer hedge closure and standalone use unknown. |
| E05-25 | Wide garden gate · cool frame | Qualified gate hypothesis; outer hedge closure and standalone use unknown. |
| E05-26 | Wide garden gate · warm frame | Qualified gate hypothesis; outer hedge closure and standalone use unknown. |
| E05-27 | Upright shrub · hedge trial | Supported whole shrub hypothesis; hedge extension compatibility unproven. |

## Recipe dispositions

| Probe | Observation | Disposition |
| --- | --- | --- |
| `closed-picket-48` | Two upper corners, one top/bottom middle and one side-post row; every declared cut has a neighbor. | Supported finite closed form. |
| `closed-picket-48-duplicate-exports` | Duplicate corner exports preserve their separate names; the alternate vertical shade cells remain exact native pixels. | Supported finite closed form. |
| `closed-picket-64` | Two middle advances and two side-post rows; tested finite extension, not an unlimited enclosure rule. | Supported finite closed form. |
| `rising-diagonal-a` | Two halves at the same x and 16px y advance make a continuous short rising diagonal. | Supported finite closed form. |
| `falling-diagonal-a` | Two halves at the same x and 16px y advance make a continuous short falling diagonal. | Supported finite closed form. |
| `rising-diagonal-b` | Alternate source pair, preserved separately; no universal interchangeability. | Supported finite closed form. |
| `falling-diagonal-b` | Alternate source pair with slight edge/shadow differences; named pairing only. | Supported finite closed form. |
| `open-upper-run` | Horizontal joints align, but both downward side-post cuts need continuation. Not a complete isolated fence. | Supported only as an explicitly open section. |
| `reversed-upper-corners` | The corner rails point away from the middle; outer horizontal cuts and both downward cuts remain exposed. | Refuted for intended closed placement. |
| `side-post-shift-one-pixel` | Moving only the right vertical row by one pixel disconnects both post joins. | Refuted for intended closed placement. |
| `diagonal-export-width-step` | Advancing by export width as well as height splits the diagonal into separate pieces; measured x advance is zero. | Refuted for intended closed placement. |
| `isolated-upper-left-corner` | Cannot stand alone: rail cut right and side-post cut below remain unmatched. | Refuted for intended closed placement. |
| `garden-gate-hedge-extension` | Upright hedge blocks placed beside the gate remain a visual hypothesis; gate foliage differs from the block and dark outline seams persist. | Unresolved; no compatible-member rule granted. |
| `garden-gate-hedge-extension-low` | A one-tile vertical shift exposes an irregular hedge silhouette; this does not resolve cropped side closure. | Weakened; shifted shrub silhouette does not close the gate. |

## Reconciliation limits and presentation

All 27 records / 27 proposal units may be normalized with exact direct master
lineage. Four duplicate pairs mean 23 distinct pixel states, not 27 unique objects.
The quiet sheet may group the four gate records into two width cards, retaining
both exact styles, for 25 cards overall. Seven closed forms may be shown as checked
examples, and the upper run separately under **Open fence sections** with its
continuing-post requirement. Four failed and two unresolved Garden probes remain
research evidence. Materials, species, world compass directions, collision,
walkability, height and opening behavior remain unknown. Approval is unregistered.

This review does not establish whole-region completeness or cover Fence_2,
Fence_3, Props_Fence, other gates or the wider Garden shrub bank. The next useful
boundary investigation is the gate-side continuation, prompted by owner discussion
if these gate forms matter to them.

[Independent assembly contact sheet](/tmp/tilefun-E05-review/all-assemblies.png).
Source-only captures and helper captures are disposable, reproducible evidence.
