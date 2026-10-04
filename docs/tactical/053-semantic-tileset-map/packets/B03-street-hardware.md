# B03 — Street lights, poles and hardware

2026-10-04. Broad first-pass proposal for owner discussion; no human approval,
normalized-model reconciliation, runtime promotion or measured accuracy claim.
The owner requested a much larger plausible sheet with traffic signals **and**
street poles/hardware. This uses the compact broad-packet contract.

## Scope and visual interpretation

**155 cards expose all 381 selected native exports once**, with 379 distinct pixel
states. Cards: 105 whole, 48 components, two unknown; records: 281 whole,
97 components, three unknown. These are browsing/proposal counts, not unique
physical objects or pack completeness.

I inspected every native overview page from four complete City Props banks:
95 signal/support/head exports, 68 older signs/modular parts, 117 newer short-post
signs and 101 street-hardware exports. I also inspected committed master contexts
for early street lamps/signals, the later upright signal bank, the ornamental
signal examples, utility poles and service cabinets. This is a visual first pass;
no exhaustive all-origin, alias or absence search ran.

The sheet includes upright and side-arm signals; green/amber/red, unlit and rear
views; ornamental poles, separate signal heads, hanging plates/brackets and
original fitted pole examples. It also includes all five civic lamp exports,
utility poles/cabinets, charging kiosks, hydrants, parking meter, drinking fountains,
telephone booths, mailbox, utility covers/grilles, bollards, cones, barriers,
raised/lowered vehicle gate arms, notices and modular sign/rail pieces.
The giant ice-cream kiosk is excluded despite its cone filename. Buildings and
special-purpose military/beach/station/house fixtures remain outside this civic
street scope.

Whole support bodies are distinguished from detached heads/plates. Signpost
pieces and modular rails cannot stand alone; their card facts state supporting
post/surface or matching rail-neighbor requirements. The utility pole with wires
cut at both outer edges has unknown wire-network closure/standalone eligibility.
Loose lettering/notice fragments have no established backing or attachment and
remain unknown. No head/plate/post compatibility, collision, wire network,
operating signal sequence, gate motion or legal traffic meaning is inferred.

Old signposts remain individual cards. The large short-post sign bank groups
original printed designs by visible shape and image-plane face with **Sign design**
selectors. Grouping does not assert a matching identity across angles or a shared
legal meaning. Tiny pictograms, information fragments, cabinet function and some
fountain/charging interpretations are provisional; uncertainty stays on cards.
All original records and exact images remain selectable.

## Exact rendering and exceptions

345 exports match full native crops at existing `ME_Singles_City_Props` legacy
index coordinates. The other 36 have no selected entry in that index and use
byte-identical PNG copies in
`public/assets/semantic-sources/broad/street-hardware/`, with unique
`street-source-*` ArtSheet IDs. All 37 committed sources are pinned in JSON.
Every source retains its exact original pathname, native frame size and normalized
RGBA hash. No scaling, trimming, palette change, alpha-mask paste or repacking
enters a displayed member. Transparent padding is preserved unchanged.

Copied native exceptions, retained in the browsing sheet:

- Classic `Traffic_Light_1–4` and `Traffic_Light_6–16` (15).
- `Traffic_Light_New_Front_Diagonal_Right_Up_1` (one support).
- `Traffic_Lights_Back_1` and `Traffic_Lights_Right_1` (two short poles).
- `Traffic_Sign_New_64–65` (two angled warning signs).
- `Drinking_Fountain_2`, `Hydrant_2–3` (three service props).
- `Info_Sign_1–6`, `Mailbox_1`, `Phone_Booth_2/4` (nine notices/service props).
- `Street_Lamp_1–4` (four curved/straight-arm lamps).

Missing selected legacy entries are **not** whole-master absence claims. These
copies provide exact original-only rendering references; broader master/alias
correspondence remains unsearched. The helper never substitutes a similar crop.

## Representative assembly challenge

A finite obvious-head-overlay trial layered each `Traffic_Lights_*_Mod_2` colored
head at `[0,0]`, using native RGBA source-over, on
`Traffic_Lights_Off_Frontal_2` (16×80). Comparing against the corresponding complete
classic signal exports refuted exact counterpart reconstruction:

| Head | Complete comparison | Changed normalized RGBA pixels | Overlay output SHA-256 |
| --- | --- | --- | --- |
| Green | `Traffic_Light_2` | 7 | `edbf4e40c735b5894b0d188b8beacb6dbe5c1539e297f8ed9d5996db5fa0e896` |
| Amber | `Traffic_Light_3` | 5 | `2fcd28ab5d1fc6b3cefc2fe0f4ab366c40cc3e0984bbd272d24d1521005e0f86` |
| Red | `Traffic_Light_4` | 7 | `9bfe60d77f3494046bc603402d9d7663d34fdc21802e48ca97e48d972970e43b` |

This small challenge grants no attachment rule. Original fitted signal exports
remain whole source variants; no newly composed example is advertised as proven.
Detailed join work can follow an owner request without delaying broad discussion.

## Reproduction and captures

```sh
python3 scripts/semantic-map-broad-street.py --check --capture-dir /tmp/tilefun-B03/reproduced
```

This checks every selected indexed crop/native-frame equality, each copied PNG's
byte identity, source/index pins, exact once-only record/card coverage and the
three finite overlay measurements. Normalization zeros RGB only at alpha zero;
translucent RGBA remains exact. Without `--check`, it writes only the owned packet
and authorized byte-copy source folder. It neither edits original art nor
executes exhaustive matchers or shared inventory/model generation.

Disposable evidence:
[native signals](/tmp/tilefun-B03/signals-0.png),
[native hardware](/tmp/tilefun-B03/hardware-2.png),
[short-post signs](/tmp/tilefun-B03/new-signs-0.png),
[master ornamental signal context](/tmp/tilefun-B03/reproduced/new-signals.png),
[representative cards 1](/tmp/tilefun-B03/reproduced/cards-0.png),
[cards 2](/tmp/tilefun-B03/reproduced/cards-1.png),
[cards 3](/tmp/tilefun-B03/reproduced/cards-2.png),
[cards 4](/tmp/tilefun-B03/reproduced/cards-3.png).
The contact-sheet background and integer zoom are visual aids, not source pixels.

Next: targeted source/proposal audit and reusable broad-sheet adapter integration,
then owner discussion. The assignment remains proposal-ready until stronger review
and explicit normalization justify further coverage credit. No npm/browser or
Git mutation ran in this worker.
