# RB01 — one Room Builder floor-path material and one stone arch

Date: 2026-10-04. Mapper: bounded Room Builder worker. Revision: 1.
State: frozen agent proposal; independent review pending. No human approval,
art changes, runtime placement rules or gameplay geometry are implied.

The worker owns only this packet, [proposal JSON](RB01-room-builder-path-arch.json)
and [reproduction helper](../../../../scripts/semantic-map-room-builder.py).
Source art is read-only. The coordinator owns registration and integration.

Frozen proposal SHA-256:
`88f2ebcf7f7509e3da1337f9e1bd2dde087f6b342e245f478fb94ddc07b2b6c4`.
The independent review must pin this exact file; edits require another revision.

## Scope and original evidence

This is **25 component crop records**, comprising 17 selected pale-yellow floor
pieces, six stone-arch body cells and two partial-height shadow companions.
It does not map either complete survey region or the entire material bank.
Two wall-texture assembly probes are context only, not additional candidates.

Coordinates are original native pixels `[x,y,width,height]`, top-left origin,
half-open bounds. The JSON lists alpha bounds, normalized RGBA hashes, exact
source occurrences and separately verified packed tile/sheet-offset aliases.

| Original source | Dimensions | PNG SHA-256 |
| --- | --- | --- |
| `assets/interiors/1_Interiors/16x16/Room_Builder_16x16.png` | 1216 × 1808 | `f53d7cd04f275dfa4b3e1f410569d491275105e2710a0f86ec46edeff3ab576f` |
| `Room_Builder_subfiles/Room_Builder_Floor_Paths_16x16.png` | 672 × 192 | `e9864663769910852fbe4e5e5f950d2ddb51d20b298877c56269e13c1e4bf159` |
| `Room_Builder_subfiles/Room_Builder_Arched_Entryways_16x16.png` | 160 × 520 | `f423305bb790d5f4e26776d629f6636df5505a00b059573fb48277905d10aaed` |
| `Room_Builder_subfiles/Room_Builder_Walls_16x16.png` | 512 × 640 | `89c5da4cde0909cc52893fab7c62adca72c74157dc543841eedabafd8e7767b0` |

Subfile paths above are relative to `assets/interiors/1_Interiors/16x16/`.
The JSON also pins all six remaining Room Builder subfiles, the committed
2048 × 8800 packed atlas, source-file ledger and packed index.

Pixels inspected before labels: master context `[0,832,704,256]` (S02-R11),
master context `[960,112,256,592]` (S02-R09), the full floor-path and arch
subfiles, detailed grid views of `[0,0,96,96]` floor and `[0,0,64,64]` arch,
and wall texture context. The embedded “Floor paths” and “3 tiles arched
entryways” captions support vocabulary, not assembly validity. Printed labels,
arrows and transparency backing are not candidates.

## Proposed records and topology

Every crop is an assembly module rather than a complete prop. Standalone prop
eligibility is forbidden in this proposed kit. A fill tile can appear in an
assembly editor without thereby becoming a whole-object prop. All world anchors,
footprints, collision, heights and walkable surfaces remain unknown.

| Record | Role hypothesis | Subfile rectangle |
| --- | --- | --- |
| P01 | Interior fill | `[0,16,16,16]` |
| P02 / P03 | Left / right outside border | `[16,48,16,16]` / `[32,16,16,16]` |
| P04 / P05 | Small inset upper-left / upper-right corners | `[48,0,16,16]` / `[64,0,16,16]` |
| P06 | Inset upper straight edge | `[80,0,16,16]` |
| P07 / P08 | Small inset lower-left / lower-right corners | `[48,16,16,16]` / `[64,16,16,16]` |
| P09 | Lower straight edge | `[80,16,16,16]` |
| P10 | Narrow horizontal continuation | `[48,32,16,16]` |
| P11 / P13 | Downward junction left / right halves | `[16,80,16,16]` / `[64,80,16,16]` |
| P12 | Downward bend outer-right half | `[32,80,16,16]` |
| P14 / P15 | Shaded upper-left / upper-right strip caps | `[48,48,16,16]` / `[64,48,16,16]` |
| P16 / P17 | Narrow lower-left / lower-right strip caps | `[48,64,16,16]` / `[32,64,16,16]` |
| A01 / A02 | Arch upper left / right | `[0,0,16,16]` / `[16,0,16,16]` |
| A03 / A04 | Arch middle left / right | `[0,16,16,16]` / `[16,16,16,16]` |
| A05 / A06 | Arch lower left / right | `[0,32,16,16]` / `[16,32,16,16]` |
| A07 / A08 | Ground shadow companions | `[0,48,16,8]` / `[16,48,16,8]` |

IDs above are prefixed `RB01-` in JSON. Floor identity/role confidence is medium:
pixels establish outlines, but universal tile compatibility is unresolved.
The palette has interior `#f0f0c8`, surrounding `#e8e8a8` and border `#e0d898`.
Other material/color banks are not assigned semantics by resemblance.

The JSON names open interior edges, required neighbor edges and closed outer
edges per record. **Those edge names alone are insufficient to license a join**:
only named recipes give tested compatibility. A continuation window can declare
its uncapped boundary explicitly; it is not a complete standalone assembly.

The fixed inset motif uses P04/P05 above P07/P08, all at 16px advances. Larger
rectangles using P02/P03/P06/P09/P01 are a tested but visually weakened
hypothesis. P14/P15, zero through two paired P02/P03 rows, and P16/P17 form a
separate tested capped strip. Only these repetition counts are demonstrated.

L and T probes use a one-row horizontal arm and a **two-column** vertical stem.
P11/P12 provide the L bend; P11/P13 provide the T junction. They join paired
P02/P03 below, with explicit left/right/bottom continuation boundaries.
Individual junction halves are not whole one-tile elbows.

The stone arch uses six fixed body cells, two columns × three rows, in a 32 × 48
export rectangle. Tight visible body height is smaller because the crop includes
top padding. The two 16 × 8 spill strips attach at y=48, giving 32 × 56 including
shadow; they are optional visual companions, not a fourth arch-body row.
The caption's intended convention remains qualified: actual crop dimensions
independently establish three native rows. No width/height repetition is licensed.

## Experiments, alternatives and failures

All 16 candidate assembly recipes and two contextual wall recipes retain full
output RGBA hashes and canonical render-recipe hashes. Rendering uses source
pixels copied onto transparent canvases without scaling, mirroring or recoloring;
nearest-neighbor scale and gray backing are only for viewing captures.

| Probe(s) | Observation / disposition |
| --- | --- |
| `inset-square-native` | Closed 2 × 2 motif exactly reproduces source `[48,0,32,32]`. Raw adjacency is corroborating evidence, not the entire topology proof. |
| `inset-extension-3x3`, `inset-extension-5x4` | Interior joins, but corners enter white at x=6 while the left straight border enters at x=10. The four-pixel contour change weakens seamless nine-slice interpretation. Compatibility remains unresolved. |
| `shaded-vertical-{0,1,2}-middle-rows` | Separate cap bank aligns with side-strip contours at all three tested lengths. Upper band is shaded; lower cap closes the strip. |
| `L-continuation-window`, `T-continuation-window` | Aligned horizontal arms and paired vertical stem, with declared open network boundaries. |
| `L-reversed-junction-halves` | Reversing halves breaks arm/stem contours. Negative. |
| `side-strip-without-caps` | White interior crosses top/bottom boundaries. Invalid as complete standalone; possible declared continuation only. |
| `wrong-inset-corners` | Reversed corners turn borders into the interior. Negative. |
| `stone-arch-body-three-rows`, `stone-arch-with-shadow` | Exact original subfile reproduction at fixed offsets, respectively 32 × 48 and 32 × 56. |
| `stone-arch-upper-halves-swapped` | Crown and outside rim exchange positions, visibly breaking the curve. Negative. |
| `stone-arch-middle-row-omitted` | A shorter silhouette can be rendered, but source does not establish an optional-height rule. Unresolved alternative retained. |
| `stone-arch-shadow-only` | Shadow has no body. Invalid standalone. |
| `coral-wall-cutout-with-matching-wall` | Context-only 32 × 32 coral cutout `[64,64,32,32]` joins coral wall `[368,0,16,32]`: both seam profiles differ only at rows 27–31 where lower trim is removed around the opening. This wall opening is two rows high, not the three-row stone frame. |
| `coral-wall-cutout-with-wrong-texture` | Wood filler disagrees with coral at rows 6–31 on both seams. Texture compatibility cannot follow from proximity. |

Equal adjacent pixels are diagnostic rather than a universal acceptance test:
shading can legitimately differ, and occupied seams can still reverse an outline.
All rendered quality judgments remain mapper proposals awaiting independent review.

### Exact master/subfile exception

The first stone arch's corresponding master crop is `[1056,160,32,56]`.
Its body shape is related, but **the whole crop is not byte-identical**: 176
pixels change from subfile RGBA `[0,0,0,25]` to master `[0,0,0,48]`, inside
delta bounds `[0,32,32,55]`. The pinned variant experiment preserves both full
RGBA hashes and a changed-mask hash. A05 therefore has no exact master occurrence;
A01–A04 and A06 retain their five exact body-cell master links. The spill strips
have exact repeats across five subfile arches but no exact master matches.
No shadow normalization is used to manufacture aliases or infer other variants.

## Reproduce, validation and limits

```sh
python3 scripts/semantic-map-room-builder.py --check
python3 scripts/semantic-map-room-builder.py --check --capture-dir /tmp/tilefun-semantic-RB01
```

Local disposable evidence:
[contact sheet](/tmp/tilefun-semantic-RB01/contact-sheet.png),
[assemblies](/tmp/tilefun-semantic-RB01/assemblies.png),
[floor master context](/tmp/tilefun-semantic-RB01/context-1.png),
[arch master context](/tmp/tilefun-semantic-RB01/context-2.png),
[evidence index](/tmp/tilefun-semantic-RB01/evidence.json).
Every final candidate and assembly capture was visually inspected.

The helper checks 10 original Room Builder PNG pins/dimensions and the committed
atlas. It verifies **all 3,485 indexed Room Builder tile/sheet pixel lineages**,
then records 57 exact crop occurrences across the declared domain, including
23 master occurrences, 24 packed tile aliases and 34 packed sheet-offset aliases.
These are occurrence/alias counts, not semantic concepts or coverage percentages.

Occurrence search checks every fitting grid16 origin anchored at `[0,0]` in the
Room Builder master and nine subfiles. The 16 × 8 shadow strips use that same
origin grid. Hidden RGB is zeroed only at alpha=0; visible RGBA and alpha are
otherwise exact. No arbitrary-pixel, transformed, clipped, occluded, supplemental
single/theme-sheet, other-pack or Interiors-master search was performed. A failed
match excludes only this domain; it does not establish missing art.

The deterministic reproduction check passed. No shared npm/build/browser jobs
were run by this bounded worker; the coordinator owns project-wide validation.
All geometry, human acceptance and runtime promotion remain unknown/pending.

Next: independently review all 25 record roles and all 16 assembly probes against
these exact pixels, especially corner/side compatibility, shaded upper caps,
network boundary completeness and the shortened-arch alternative. Then register
the pinned proposal and consider only supported bounded relationships for shared
catalog integration.
