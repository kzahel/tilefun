# I01 — Basement sofa components and small seats

Status: mapper proposal revision 1; independent per-member review pending.
Date: 2026-10-04. Scope: **18 normal records plus two render counterparts**.
These are 20 source records / 18 normal proposal units, not unique-object or
pack-completion counts. No human approval or gameplay promotion.

Allowed outputs: this document, [proposal JSON](I01-interior-sofas.json), and
[source-only helper](../../../../scripts/semantic-map-interior-sofas.py).
Shared source art, catalogs, queue, ledger and runtime code remain untouched.

## Bounded assignment and source discovery

The S02-I16 sofa window is visually supported, but its location does not make the
art Living Room content. The survey's no-match result for 122 normal Living Room
singles was a valid limited equality result. A full-origin comparison of all
indexed normal Interior singles with the raw sofa window identified the exact
**Basement** exports. This packet uses the following explicit subset:

| Members | Normal Basement singles | Pixel interpretation |
| --- | --- | --- |
| I01-01–03 | 4, 5, 6 | Blue-gray front sofa: left cap, middle, right cap |
| I01-04–05 | 7, 8 | Blue-gray long padded seats/possible chaise extensions; role unresolved |
| I01-06 | 9 | Small closed upholstered seat; ottoman versus low chair unresolved |
| I01-07–09 | 10, 11, 12 | Pale gray front sofa: left cap, middle, right cap |
| I01-10–11 | 13, 14 | Pale gray long seats/possible extensions; role unresolved; right/left ordering differs from 7/8 |
| I01-12 | 15 | Small closed pale gray seat; ottoman versus low chair unresolved |
| I01-13–15 | 27, 28, 29 | Gray side sofa, tall rail at image right: top, middle, bottom |
| I01-16–18 | 30, 31, 32 | Gray side sofa, tall rail at image left: top, middle, bottom |
| I01-19 | Black-shadow 4 | Render counterpart of normal left cap 4 |
| I01-20 | Shadowless 4 | Render counterpart of normal left cap 4 |

Orange/purple banks, other Basement facings and the remaining render-set members
are excluded. The source context `[32,5456,208,208]` is a navigation crop, not
an object frame or complete segmentation of S02-I16 `[0,5456,256,208]`.

The master is `assets/interiors/1_Interiors/16x16/Interiors_16x16.png`,
**256×17024**, PNG SHA-256
`a35b8ed8ef392657a9339e1ce0831a3efe7b4631bfff69835bb5ef3bc738550b`.
The JSON's source table pins the original singles, all three Basement theme
sheets, the committed packed atlas, and the bounded counterpart corpus. It has
**268 source-file references**, not 268 semantic candidates. All references carry
path, raw PNG hash, size and normalized RGBA hash. The source-ledger pin is
`c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda`;
the packed index pin is
`c2beaba7bbd767b14df8cb7faa042908adbda89e0a43a7fd5c37cb5101a9a02e`.

Rectangles use native top-left `[x,y,width,height]`, right/bottom exclusive.
Changed-mask bounding boxes use explicit `[left,top,right,bottom]`. Source exports,
alpha-visible bounds and packed-atlas aliases remain separate. Every selected
packed frame was bounds-checked and verified against the original single's exact
normalized pixels, so all 20 records can render from committed art without
original-pack files. No atlas repacking or new committed art is needed.

## Exact occurrence and alias accounting

The full master and all three Basement theme sheets were searched at **every
fitting integer pixel origin**, using the existing exact `Matcher(grid=1)`.
Transparent RGB is zeroed only at alpha zero; visible RGBA and alpha must agree.
The result contains **18 exact master occurrences** and **28 theme-sheet
occurrences**. Black-shadow/shadowless cap 4 has no whole master match; its
theme-sheet and packed-alias lineage remain exact and do not imply missing art.

Exact named-alias search covered all **15,964 indexed native16 single files**
across the three render sets. The dimension prefilter retained **12,028** files;
their raw pins and normalized full-frame hashes were checked. The 20 selected
records expose **28 exact file aliases**. Normal 27, 28, 30 and 31 each have three
identical exports across the normal, black-shadow and shadowless sets: those
components carry no differing ground shadow. The other selected records each
have one exact alias. These eight additional aliases are duplicate exports, not
additional concepts or a hidden expansion of the 20-record scope.

The search excludes partial/occluded occurrences and near matches. Other
Interiors theme sheets were not searched as sheet occurrences. The current
named-single corpus is complete within the saved index; exact equality alone
does not establish full regional semantics.

## Proposed roles, topology and uncertainties

Front caps 4/6 and 10/12 close their outer curved side and have a continuous
upholstery cut on the inner side. Middles 5/11 have both horizontal ends cut.
All six are **forbidden as standalone objects**. The proposed normal chains are
`4 → optional 5 repeats → 6` and `10 → optional 11 repeats → 12`, with
16-pixel horizontal advance, constant 32-pixel height, and one palette/render set.
Port-neighbor roles and exact selected member IDs are explicit in the JSON.

Side tops 27/30 have curved top upholstery and an open lower edge. Middles 28/31
are 32×16 bands with open top and bottom; ends 29/32 close the lower edge and
carry feet/shadow. All six are **forbidden as standalone objects**. The proposed
chains are `27 → optional 28 repeats → 29` and `30 → optional 31 repeats → 32`,
with a 32-pixel-wide top of height 32 and middle/end heights 16. The source sampler
places top, then bottom, then middle; reading that raw adjacency as a complete
long sofa would leave an open extension below already closed feet.

I01-19/20 remain partial front-left caps, just like I01-01. Their render variants
do not authorize mixing a cap from one shadow set into a different set's chain.
Their required same-variant neighboring caps/middles are outside the selected
packet, so no complete black-shadow or shadowless sofa assembly is claimed.

Small seats 9/15 have closed rounded upper contours, short front bands and two
feet; standalone **visual** use is proposed. “Ottoman/footstool” and “low chair”
remain alternatives because a raised back is not established. Pieces 7/8/13/14
have long padded tops and visible bottom feet but straight upper cuts. They could
be complete backless seats or chaise/seat-extension modules. Standalone eligibility
and join roles remain **unknown** for these four. Their paired crops are evidence
for discussion, not complete-object declarations. Exported frames alone do not
settle this ambiguity.

Relative front/side views and the side rail's image-left/image-right position are
visible. World compass headings, fabric material, reclining mechanics, colliders,
anchors, footprints, height and walkable surfaces remain unknown. Topology here
is metadata only; no catalog/generator enforcement was added.

## Positive and negative source-only assemblies

All experiments record input member IDs, exact source rectangles, offsets,
operation, canvas size, output RGBA SHA-256, full-master equality search, and
per-join occupied-alpha positions. They use RGBA overwrite with no source resizing.
The captures use uniform nearest-neighbor 4× display zoom.

| Experiment | Exact source or result | Interpretation |
| --- | --- | --- |
| Blue front `4,5,6` | Master `[48,5456,48,32]` exact | Complete closed front sofa supported |
| Gray front `10,11,12` | Master `[96,5456,48,32]` exact | Complete closed front sofa supported |
| Blue short `4,6`; repeated `4,5,5,6` | 32×32 and 64×32; no exact master match | Rendered closed proposals with zero/two middles; not author-provided whole exports |
| Blue wrong caps `6,5,4`; bare `5,5` | Outer cuts and/or caps facing inward | Invalid complete-object topology despite continuous occupied joins |
| Right side short `27,29` | Master `[48,5520,32,48]` exact | Top and bottom close the short sofa |
| Left side short `30,32` | Master `[80,5520,32,48]` exact | Opposite rail short sofa supported |
| Right side `27,28,29` and `27,28,28,29` | 32×64 and 32×80; no exact master match | One/two-middle closed extensions rendered; repeated rail shading remains visible |
| Left side `30,31,32` | 32×64; no exact master match | One-middle closed extension rendered |
| Reversed side `29,28,27` | Feet appear first; upper part ends in an open lower cut | Invalid complete-object topology |
| Source-order `27,29,28` | Master `[48,5520,32,64]` exact | **Exact source equality does not establish complete-object topology**: middle remains below the closed foot end |
| Lower blue `7,8`; gray `14,13` | Master `[48,5488,32,32]` and `[96,5488,32,32]` exact | Paired long-seat probes only; standalone and extension roles unresolved |

These tests support bounded role/repetition proposals. Alpha continuity is
necessary evidence, not seam quality or human acceptance. Repeated side rails
retain their source shading bands; no universal seamless-texture claim is made.
Only the blue front bank has zero/two-middle experiments; gray front is tested
with one. Only the right-rail side family has two-middle evidence. Arbitrarily
long chains, mixed palettes, cross-variant chains, corners and L-sofa attachment
are outside this packet.

## Bounded render-counterpart comparison

Normal, black-shadow and shadowless single 4 share one exact body. Relative to
shadowless 4, normal and black-shadow each change **16 pixels**, all outside the
shadowless body; no body/reflection pixel changes occur. The exact changed tokens
are normal `[167,151,150,255]` and black-shadow `[58,58,80,100]`, replaced with
transparent `[0,0,0,0]` after hidden-RGB normalization.

The helper removes only the observed token for these three selected cap records
and compares their resulting full frames against the entire **240-file Basement
shadowless pool**. All three signatures uniquely match shadowless vendor index 4.
The pool's exact members and hashes are retained. This establishes a bounded
counterpart relation, not an Interiors-wide normalization rule. The cabinet
pilot's body reflection exceptions are neither imported nor ignored here.

## Frozen handoff and verification

Proposal JSON SHA-256:
`75b0910c5565e9bff3db9b819f76fe2cca0e5e268b6438a2ff7023a061a260df`.
Independent review must pin this revision and disposition **I01-01–20**, with
explicit treatment of the four unresolved long seats and the two extra render
counterparts. Human review is unregistered; no agent conclusion is an approval.

```sh
python3 scripts/semantic-map-interior-sofas.py --check
python3 scripts/semantic-map-interior-sofas.py --check --capture-dir /tmp/tilefun-semantic-I01
```

Requires Pillow and restored originals. The helper verifies source/index pins,
dimensions, packed aliases, full-origin occurrences, exact named aliases,
counterpart uniqueness, and all 15 source-only recipes. Root owns the shared
typecheck, unit-test and lint run. No runtime rendering or input code changed.

Disposable evidence:
[contact sheet](/tmp/tilefun-semantic-I01/contact-sheet.png),
[assembly comparisons](/tmp/tilefun-semantic-I01/assemblies.png), and
[raw context](/tmp/tilefun-semantic-I01/context.png).
The helper reproduces these from pinned sources.

Next: independent visual review, then serial reconciliation of the open long-seat
roles and component constraints before any owner-facing family-sheet extension.
