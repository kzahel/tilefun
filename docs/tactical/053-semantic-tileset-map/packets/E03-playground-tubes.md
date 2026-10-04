# E03 — Painted playground tube components

Status: frozen mapper proposal revision 1; independent per-member review pending.
Date: 2026-10-04. Owner: bounded mapping worker. Reviewer: separate handoff pending.
No human approval, metadata promotion or gameplay changes.

Allowed outputs: this packet, [proposal JSON](E03-playground-tubes.json), and
[source-only helper](../../../../scripts/semantic-map-playground.py). Sources,
shared model/registry/queue, other packets and runtime definitions remain untouched.

## Assignment and first observation

Actual raw artwork and surrounding context were inspected before assigning names.
The corrected E10 hypothesis is supported: hollow cylindrical mouths, ribbed curved
shells, bends, continuation cuts and three painted banks sit beside schoolyard
play towers. These are modular playground crawl tubes/tunnels. Generic plumbing
remains a weaker alternative; chairs are refuted by their hollow tube mouths and
absence of seat/back structures. Exact construction material is unknown.

Scope is **25 exported records**: all 19 ochre `School_Yard_Tube_Modular_1` shapes,
plus the blue/red shape 15 cross and shapes 16/17 opposed side mouths. The remaining
32 blue/red exports, playground tower/composition exports, other pipe/tunnel themes,
animations and partial/occluded matches are outside this packet. This is not E10
completion or a 25-distinct-object claim. The initial corrected source window
`[1984,1104,256,288]` is context, not a crop boundary: red shape 16 begins at x=2240,
just outside its right edge. Full-source matching retains that occurrence.

## Exact lineage and search limits

The committed master `public/assets/tilesets/me-complete.png` is **2816×8224**;
PNG SHA-256 `1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
The helper verifies its original alias
`assets/exteriors/Modern_Exteriors_16x16/Modern_Exteriors_Complete_Tileset.png`.
Source ledger SHA-256 is
`c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda`.
The JSON's 76 source entries pin every included file's PNG hash, dimensions and
normalized RGBA hash: masters, all 24 theme sheets and 50 distinct named singles.
Selected exports live in `Modern_Exteriors_Complete_Singles_16x16`; exact aliases
also occur in `ME_Theme_Sorter_16x16/13_School_Singles_16x16`.

`Matcher(grid=1)` searches **every fitting integer pixel origin** in the full
master and all 24 native16 Exteriors theme sheets. Alpha and visible RGBA must
match; RGB beneath zero alpha alone is normalized away. There are 30
record-to-master occurrences, or 28 distinct source rectangles because ochre
shapes 2 and 6 are exact duplicate exports with the same two master occurrences.
Every record has exact committed-source rendering; no fallback reconstruction or
new public image is needed. The JSON also retains exact theme-sheet matches.

The alias corpus is all **12,448** native16 complete/theme singles. Dimension
prefiltering leaves **7,578** files to read and verify against ledger raw hashes
and normalized whole-frame pixels. There are 54 record-to-alias links to 50
unique named files. The 2/6 duplicate each retains four aliases; ordinary pairs
have two. Near matches, clipped art, alternate resolutions, animation files and
baked larger compositions are not claimed as equality lineage.

Coordinates below and in JSON are original native pixels, top-left
`[x,y,width,height]`, half-open. Full export frames, alpha-visible bounds and
legacy atlas-index aliases are distinct fields. Some exports have 14px or more
transparent padding; some shadows extend 2px beyond a 16px body band. Neither
frame width nor alpha bounds alone establish the connection offset.

## Members and proposed topology

All 25 records are **pieces to combine**, with standalone use **forbidden** as
proposed metadata. Every continuation cut requires a neighbor; entrance mouths
and rounded outer ends require none. This restriction has no runtime enforcement.
Ports use image left/right/top/bottom, never world compass directions. Each JSON
port records a local 16px band origin/profile. Opposite profiles need the same
global band origin. Those coordinates describe visual composition only, not
collision or travel geometry.

| Record | Bank_shape | Proposed role | Required continuation neighbors | Every exact master rectangle |
| --- | --- | --- | --- | --- |
| E03-01 | 1_1 | Upper-left bend | right, bottom | [1984, 1152, 16, 16] |
| E03-02 | 1_2 | Horizontal continuation | left, right | [2016, 1152, 16, 32]; [2016, 1216, 16, 32] |
| E03-03 | 1_3 | Upper-right bend | left, bottom | [2048, 1152, 32, 16] |
| E03-04 | 1_4 | Vertical continuation | top, bottom | [2048, 1184, 32, 16] |
| E03-05 | 1_5 | Lower-right bend | top, left | [2048, 1216, 32, 32] |
| E03-06 | 1_6 | Horizontal continuation counterpart | left, right | [2016, 1152, 16, 32]; [2016, 1216, 16, 32] |
| E03-07 | 1_7 | Lower-left bend | top, right | [1984, 1216, 16, 32] |
| E03-08 | 1_8 | Vertical continuation counterpart | top, bottom | [1984, 1184, 32, 16] |
| E03-09 | 1_9 | Down-image entrance | top | [2048, 1248, 32, 16] |
| E03-10 | 1_10 | Down-image entrance counterpart | top | [1984, 1248, 32, 16] |
| E03-11 | 1_11 | Horizontal tube with down-image entrance | left, right | [2016, 1248, 32, 32] |
| E03-12 | 1_12 | Round-topped vertical end | bottom | [2048, 1280, 32, 32] |
| E03-13 | 1_13 | Horizontal tube with upper facing entrance | left, right | [2016, 1280, 16, 48] |
| E03-14 | 1_14 | Horizontal tube with rounded upper branch | left, right | [1984, 1280, 16, 48] |
| E03-15 | 1_15 | Cross-shaped tube with two entrances | left, right | [2016, 1328, 16, 48] |
| E03-16 | 1_16 | Right-facing side entrance | left | [2048, 1328, 16, 32] |
| E03-17 | 1_17 | Left-facing side entrance | right | [1984, 1120, 16, 32]; [1984, 1328, 16, 32] |
| E03-18 | 1_18 | Horizontal segment with right collar | left, right | [2048, 1360, 16, 32] |
| E03-19 | 1_19 | Horizontal segment with left collar | left, right | [1984, 1360, 16, 32] |
| E03-20 | 2_15 | Cross-shaped tube with two entrances | left, right | [2112, 1328, 16, 48] |
| E03-21 | 2_16 | Right-facing side entrance | left | [2016, 1120, 16, 32]; [2144, 1328, 16, 32] |
| E03-22 | 2_17 | Left-facing side entrance | right | [2080, 1328, 16, 32] |
| E03-23 | 3_15 | Cross-shaped tube with two entrances | left, right | [2000, 1104, 16, 48]; [2208, 1328, 16, 48] |
| E03-24 | 3_16 | Right-facing side entrance | left | [2240, 1328, 16, 32] |
| E03-25 | 3_17 | Left-facing side entrance | right | [2176, 1328, 16, 32] |

Shapes 13–15 have lateral cuts at local y=16. In particular, the cross (15) has
**two continuation joins** plus two exterior mouths; treating its four arms as
four arbitrary connector ports would invent geometry. The upper dark opening and
lower bright mouth are source perspectives, not established world headings.
Shape 12 has a rounded upper contour and a bottom cut at local y=32. Shape 14 has
a rounded upper branch above a horizontal continuation. Whether those rounded
ends are capped, turned-away mouths or another view remains unresolved. Shapes
18/19 have visible collars/rims at opposing sides; their precise function and
compatibility are untested. Their continuation-role interpretation remains medium
confidence, explicitly distinct from the tested modules.

Exact compatible neighbors are named per member and per tested port in
`topology.testedCompatibleNeighbors`. Untested cuts retain explicit required
neighbors without pretending that a complete compatibility matrix is known.
All collision, anchors, footprints, height and walkable surfaces remain unknown.

## Alternatives and discriminating experiments

| Claim challenged | Reproduced observation | Result and limit |
| --- | --- | --- |
| Every repeated-looking ochre export is identical | 2↔6: zero differences. 4↔8: 11 RGBA pixels. 9↔10: 10 RGBA pixels. Both latter pairs have identical alpha masks. | Exact duplicate relationship only for 2/6; preserve the shading differences and separate sources for 4/8 and 9/10. |
| Opposed side mouths are simply flipped | Ochre 16 reflected horizontally equals 17 at every normalized RGBA pixel. | Exact mirror supported for that pair only. Blue/red mirror shortcuts were not tested. |
| Cross/side-mouth colors change the silhouette | Each ochre↔blue/red cross changes 517 pixels; each side mouth changes 177 pixels, with zero alpha changes in all six comparisons. | Palette counterparts supported for the selected shapes; no universal recolor transform or physics inheritance. |
| Every arm of a cross is an open assembly cut | Native cross probe uses side mouths joined at y=16; upper/lower mouths remain complete outer contours. Isolated cross exposes two unmatched lateral ports. | Two joins plus two entrance mouths supported; four-cut cross rule refuted. |
| Export frame size is the assembly grid | All native positive probes align 16px body bands despite padded 32/48px export frames. | Native band offsets supported for named tested joins, not arbitrary frame concatenation. |
| Correct-facing caps or near-aligned placement are interchangeable | Wrong-end-facing probe leaves the left cut exposed and puts a mouth against a continuation; 1px-shifted probe exposes unmatched ports and visible seam lines. | These precise negative assemblies fail both proposed port rules and visual comparison. |

All assembly images are created with **unscaled original RGBA pixels** using
Pillow `alpha_composite`, in the listed placement order. The JSON pins canvas
size, placement IDs/offsets, native raster SHA-256, matched port pairs and exposed
ports. Native PNGs preserve transparency; 6× nearest-neighbor copies add a quiet
inspection backdrop only. Source contact sheets use uniform 3× zoom.

Positive tests are a horizontal tube with two mouths and two repeated shape-2
middles; an ochre U with upper bends, vertical continuations and down-image entrances; and the
four-mouth cross assembly in ochre, blue and red. The U uses shape 8 on the left
arm, 4 on the right, 10 at lower left and 9 at lower right, preserving the
source's small shading exceptions. All positive probes have zero unmatched
continuation ports and visually continuous same-palette shells. Negative tests
are an isolated cross, reversed left side end and 1px-spaced chain. Each retains
unmatched ports and its observed visual defects.

This is finite visual evidence, not proof of every possible assembly. The U
shows one vertical continuation per arm; unlimited vertical repetition is
untested. The tested horizontal repetition is two middles, not an arbitrary
length theorem. Same-palette cross assembly is tested for all three banks;
arbitrary mixed-color compatibility is unknown. Surrounding source context has
a baked multicolor composition, which is evidence of some intentional mixing,
not an exact recipe for every color transition. No gameplay connectivity,
traversability or physics is inferred.

## Verification and independent-review handoff

Frozen proposal JSON SHA-256: `4370a63a1308b9ccc844029bfe077bb304faac2e62826923c3ba5a685508143e`.
Reviewer must pin this exact revision and disposition **E03-01–25** individually,
including duplicate/counterpart distinctions, rounded-end uncertainty and collars.
Independent review, owner discussion registration and human approval are pending.

```sh
python3 scripts/semantic-map-playground.py --check
python3 scripts/semantic-map-playground.py --check --capture-dir /tmp/tilefun-semantic-E03
```

Requires Pillow and restored ignored original packs. Checks reproduce exact
source pins, full-origin occurrences, named alias scope, comparison counts,
port-alignment positive/negative assertions and native assembly hashes. Source
drift or changed deterministic JSON fails. The helper changes no source pixels,
repacked atlases or gameplay definitions. Root owns shared npm/build/browser checks.

Disposable evidence: [contact sheet](/tmp/tilefun-semantic-E03/contact-sheet.png),
[source context](/tmp/tilefun-semantic-E03/context-2.png),
[native repeated straight](/tmp/tilefun-semantic-E03/straight-two-mouths-native.png),
[native U](/tmp/tilefun-semantic-E03/u-two-mouths-native.png),
[native ochre cross](/tmp/tilefun-semantic-E03/cross-four-mouths-ochre-native.png),
[native blue cross](/tmp/tilefun-semantic-E03/cross-four-mouths-blue-native.png),
[native red cross](/tmp/tilefun-semantic-E03/cross-four-mouths-red-native.png),
[isolated cross](/tmp/tilefun-semantic-E03/isolated-cross.png),
[wrong-facing end](/tmp/tilefun-semantic-E03/wrong-end-facing.png),
[1px gap](/tmp/tilefun-semantic-E03/one-pixel-gap.png).

Next: independently review this bounded proposal, then integrate exact committed
crops and explicit component restrictions serially. Investigate the remaining
blue/red shapes and ambiguous rounded ends/collars without broadening this frozen
proposal's claims.
