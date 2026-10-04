# E04 — Civic broadleaf trees, flowerbeds and small pots

Status: frozen mapper proposal revision 1; independent per-member review pending.
Date: 2026-10-04. Owner: bounded mapping worker. No human approval, promotion or
gameplay changes. Allowed outputs: this packet, [proposal JSON](E04-plants-planters.json)
and [reproduction helper](../../../../scripts/semantic-map-plants-planters.py).

## Bounded assignment and visual interpretation

The source pixels, all 15 City Props Tree exports, neighboring master context and
the selected flower/pot exports were visually inspected before finalizing scope.
This packet maps **19 native16 exported records**, through **seven presentation
cards**. These are source-record/card counts, not unique-object or pack-completion
counts.

The complete selected subfamilies are the eight broadleaf City Props trees
(`Tree_1,2,9–14`), all seven `Flower_Bush_1–7` exports and all four `Pot_1–4`
exports. The two broadleaf sizes each have bare-trunk, grass-tuft, square planted
base and rounded planter-base variants. The flowers contain six boxed flowerbeds
and one unboxed flowering bush. Small plants are baked together with their pots.
Their closed visual silhouettes have no required neighboring piece.

`Tree_3–8` and clipped conical `Tree_15` form a separate topiary/conical-strip
investigation, explicitly **unmapped and queued**. Their original files are pinned
as inspected exclusion context; they are not credited as completed semantics.
Bare bases, `Flowers_1–5`, Garden/Villas/Additional Houses vegetation, animations,
alternate resolutions and larger baked scenes are outside this packet. No whole
master window or vegetation-pack completion is claimed. Several topiary exports
lack a whole-frame master match; this is a future lineage question, not evidence
that their art is missing. The boundary is the broadleaf subfamily, not availability
of a convenient rectangle.

## Source pins and equality domain

The committed master is `public/assets/tilesets/me-complete.png`, **2816×8224**,
PNG SHA-256 `1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
Its original alias is
`assets/exteriors/Modern_Exteriors_16x16/Modern_Exteriors_Complete_Tileset.png`.
The helper verifies raw file pins and normalized master equality. Named originals
are in `Modern_Exteriors_Complete_Singles_16x16` under the exact
`ME_Singles_City_Props_16x16_*.png` names.

The JSON source table pins **71 files**: both masters, every one of the 24 native16
Exteriors theme sheets, 38 selected complete/theme single aliases and seven
excluded topiary/conical exports. Each entry has `id`, `path`, raw PNG `sha256`,
`dimensions` and `normalizedRgbaSHA256`. Source ledger SHA-256 is
`c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda`;
the manifest, matcher implementation and legacy index are pinned separately.

For **each candidate**, `Matcher(grid=1)` searches every fitting integer origin in
the full master and all 24 theme sheets twice: once for the whole original export
frame, once for its measured alpha-visible crop. RGB is zeroed only where alpha
equals zero; visible RGB and all alpha values must agree. There are **16 full-frame
master occurrences** and **19 alpha-visible master occurrences**. Theme sheets
have 17 full-frame and 19 alpha-visible occurrences. These views are separate;
an alpha-visible match is never silently reported as a full-frame match.

Whole-export alias searching covers all **12,448** complete/theme singles.
Dimension prefiltering requires reading, raw-hash verification and normalized
whole-frame comparison of **5,154** fitting-size files. Every candidate has exactly
two aliases, one complete and one theme sorter: **38 links / 38 named files**.
No additional differently named full-frame duplicate occurs in that domain.
Near matches, occlusion, embedded appearances in larger exports, animation and
other resolutions remain outside this equality claim.

## Exact native frames and committed rendering

All rectangles are top-left native `[x,y,width,height]`, right/bottom exclusive.
`sourceRect` is the whole original export; `alphaVisibleRect` is local to that
export; `committedRendering.rect` is an independently measured master crop.
Delta `changedBoundsXYXY` instead uses `[left,top,right,bottom]`. Legacy index
rectangles are navigation aliases, not replacements for measured source evidence.

| Records | Export group | Whole native frame | Committed master rectangle |
| --- | --- | --- | --- |
| E04-01/02 | Tree 1/2 | 32×48 | [256,48,32,48]; [288,48,32,48] |
| E04-03/04 | Tree 9/10 | 32×64 | visible crops [352,52,32,52]; [320,52,32,53] |
| E04-05/06 | Tree 11/12 | 48×64 | [256,96,48,64]; [304,112,48,64] |
| E04-07/08 | Tree 13/14 | 48×64 | [352,121,48,64]; [400,121,48,64] |
| E04-09–11 | Flower_Bush 1–3 | 32×16 | [448,16,32,16]; [416,16,32,16]; [384,16,32,16] |
| E04-12–14 | Flower_Bush 4–6 | 48×16 | [480,16,48,16]; [432,32,48,16]; [384,32,48,16] |
| E04-15 | Flower_Bush 7 | 16×16 | visible crop [225,80,14,13] |
| E04-16–19 | Pot 1–4 | 16×16 | [2768,5360,16,16]; [2288,5632,16,16]; [2288,5616,16,16]; [2288,5648,16,16] |

`committedRendering` has the explicit keys `sheetId`, `sourceId`, `rect`,
`operation`, `frameSize`, `offsetXY` and `normalizedRgbaSHA256`. A `direct-crop`
copies the full crop into an equally sized transparent RGBA frame at `[0,0]`.
`crop-into-transparent-frame` copies the smaller crop without an alpha mask into
the declared transparent native frame at the local offset. E04-03/04 use
`frameSize:[32,64]`, `offsetXY:[0,11]`; E04-15 uses `[16,16]`, `[1,2]`.
The helper verifies the resulting **whole-frame normalized RGBA** equals the
original export for all 19 records. No source copying, recoloring, scaling or
pixel synthesis is needed for committed-only browsing.

The missing three full-frame matches are padding effects. At inferred master
frames `[352,41,32,64]`, `[320,41,32,64]` and `[224,78,16,16]`, adjacent master art
occupies respectively 224, 224 and 32 pixels that are transparent in the original.
Every changed pixel has original alpha zero; the tree/bush pixels themselves are
exact. Treating those master crops directly as original frames is refuted. Using
the typed crop-and-padding recipe above is exact.

## Identity, variants, bases and alternatives

Per-candidate fields record value, confidence, evidence, alternatives and proposal
disposition for identity, family, role, facing and variant. All candidates have
`kind:"whole"`, `topology.standaloneEligibility:"allowed"`, empty
`requiredNeighbors`, `compatibleMembers` and `openJoinEdges`. This permits only
standalone **visual** interpretation; it is not runtime enforcement or a gameplay
decision. Anchor, footprint, collision, height and walkable surfaces remain null.

Trees show closed green crowns above branched trunks. Their planted bases show
either a straight gray/violet border or a rounded tan shaded rim around green
fill. “Tree with planted base” is supported; raised planter versus bordered ground,
rim material, species and exact seasonal identity remain unknown. There is no
required separate tree/base component. This packet does not offer extracted bases
or infer a detach-and-recombine attachment recipe.

Six exact aligned crown comparisons support the two tree variant groups. Small
Tree1's `[0,4,32,27]` equals Tree2 `[0,3,32,27]`, Tree9 and Tree10
`[0,11,32,27]`. Large Tree11 `[0,9,48,38]` equals Tree12 `[0,7,48,38]` and
Tree13/14 `[0,0,48,38]`. Every comparison changes zero RGBA/alpha pixels. These are
explicit upper-crown facts, not claims that entire trunks/bases can be substituted.
Square versus rounded base comparisons change 472/461 RGBA pixels and **159 alpha
pixels each**, refuting a pure recolor interpretation.

Narrow flowerbed color pairs differ at 105 RGBA pixels with identical alpha.
Wide flowerbed comparisons differ at 71 and 94 pixels, again retaining alpha.
Their complete borders support original color/content variants; botanical species,
portability, bed height and material remain unresolved. Flower_Bush7 has no visible
pot/border and is presented separately as a small flowering bush; low shrub versus
compact flower clump remains uncertain.

Pot3/4 differ at 28 RGBA pixels and zero alpha pixels, all in local bounds
`[4,9,12,16]`, supporting identical arching foliage with pot-color changes.
Pot1/2 differ at **61 RGBA and 12 alpha pixels**, in `[2,4,12,14]`; the tan-pot
version also has shorter/slightly different leaves. These are upright-plant
variants, with that difference stated explicitly, not a claimed exact recolor.
World-facing directions, plant species and pot materials remain unknown.

## Exact owner annotation correspondence

The owner notes at `[352,112,48,80]` and `[400,112,48,80]` refer respectively to
Tree13/E04-07 and Tree14/E04-08. The saved pending records are
`325cfc61-57ac-4e20-a96c-c7491f0d0f62` at `2026-10-02T20:32:30.521Z`
(“tree in like a planter thing”) and `20a19458-4424-40ed-8995-ff7945f122e8` at
`2026-10-02T20:32:38.655Z` (“tree in a square planter thing”). Both pin the master
hash above. Each 48×80 annotation equals its 48×64 original export placed at
`[0,9]` in a transparent 48×80 frame. Extra annotation padding is not object
geometry. The JSON preserves these exact evidence snapshots and selection hashes.
They are identity clues, **not approval**; the worker has not replied to or
resolved the notes.

## Quiet-sheet proposal and finite positive examples

Family title: **Plants and planters**. Description: “Broadleaf trees, flowerbeds
and small potted plants from the civic set.” Shared facts: “Complete objects,”
“Tree bases and flower colors have original variants,” and “Plants and containers
are drawn together.” The proposed sheet has seven cards, each with original-member
selection and member-specific facts; all remain Proposed.

| Card | Exact member IDs | Original variants |
| --- | --- | --- |
| Small broadleaf tree | E04-01–04 | Bare trunk; with grass; square base; rounded base |
| Large broadleaf tree | E04-05–08 | Bare trunk; with grass; rounded base; square base |
| Narrow flowerbed | E04-09–11 | Pink; red/yellow; white/yellow |
| Wide flowerbed | E04-12–14 | Red/white mix; pink/white mix; white/yellow |
| Small flowering bush | E04-15 | One unboxed source form |
| Upright potted plant | E04-16/17 | Red-brown pot; tan pot with shorter leaves |
| Arching potted plant | E04-18/19 | Red-brown pot; tan pot |

The JSON `presentation`, `groups`, `variantGroups`, `label`, `kind` and
`selectedFacts` encode this proposal explicitly. These seven cards partition all
19 source records without hiding members. The 19 exact complete-source renders
are finite positive examples. No modular assembly is proposed; inventing combined
plant/container recipes would overstate the evidence. A contact sheet is suitable
because the objects are complete.

## Frozen evidence and review handoff

Frozen proposal JSON SHA-256:
`8fbca92889dd7bc587093eaa38d276b36d6ccbe22a8f748c79d4b4f6c4554f36`.
Frozen helper SHA-256:
`8fc4a26872684f7719dbc8586c7356598b398f4110d7056543791eea983080c5`.
Independent review must pin those files and give per-member dispositions for
E04-01–19, including the three crop/padding recipes, upright-pot exception and
the distinction between planter appearance and unknown gameplay geometry.

```sh
python3 scripts/semantic-map-plants-planters.py --check
python3 scripts/semantic-map-plants-planters.py --check --capture-dir /tmp/tilefun-semantic-E04
```

Requires Pillow and restored originals. `--check` reruns the complete declared
equality search, raw pins, alias domain, exact reconstruction, aligned crown/delta
experiments and annotation correspondence, then compares the deterministic JSON.
It does not rewrite the proposal. Capture mode produces source-only nearest-neighbor
evidence at uniform 3× zoom, 6× for owner crops, plus native originals and their
committed render counterparts. No shared sources, model, catalogs or UI were edited.
Root owns repository-wide typecheck, tests and lint; these artifacts do not alter
render/runtime/input behavior.

Disposable inspection artifacts: [contact sheet](/tmp/tilefun-semantic-E04/contact-sheet.png),
[scope boundary](/tmp/tilefun-semantic-E04/tree-scope.png),
[top civic context](/tmp/tilefun-semantic-E04/context-1.png),
[distant red pot](/tmp/tilefun-semantic-E04/context-3.png),
[three adjacent pots](/tmp/tilefun-semantic-E04/context-4.png),
[rounded-base owner crop](/tmp/tilefun-semantic-E04/E04-07-annotation.png) and
[square-base owner crop](/tmp/tilefun-semantic-E04/E04-08-annotation.png).

Next: independent visual/source review, serial normalization and quiet-sheet
integration; keep the topiary/conical-strip family queued as unmapped.
