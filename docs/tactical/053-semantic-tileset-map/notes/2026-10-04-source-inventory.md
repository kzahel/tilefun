# Native source reconciliation — 2026-10-04

S01 is ready. [Source manifest](../source-manifest.json) pins the included PNGs,
scope groups, coordinates, exclusions and existing-index audit.
[Source files](../source-files.json) contains one compact row per PNG:
repository path, file SHA-256, width, height, byte count, scope group and Git
tracking state. [Inventory script](../../../../scripts/semantic-map-inventory.py)
reproduces both artifacts without repacking or editing source images/indexes.

The exact vendor release is unverified. The content-derived included-originals
revision is `5d85c3fa77f0273a21e1625ae3a4497087ad5d2133624c3a338b61042bf04ea2`.
This digest hashes sorted UTF-8/LF compact JSON lines containing repository path,
PNG SHA-256, width and height. It identifies the declared included source set,
not an asserted vendor release or the entire downloaded archive.

## Included inventory

There are **29,449 original PNG occurrences** plus two committed reference PNGs.
Occurrences retain duplicate content at distinct paths and are not counts of
distinct objects. Each ledger path is unique.

| Group | PNG files |
| --- | ---: |
| Exteriors complete master | 1 |
| Exteriors complete singles | 6,224 |
| Exteriors current theme sheets | 24 |
| Exteriors current theme singles | 6,224 |
| Exteriors animation PNG sheets/frames | 541 |
| Exteriors native autotiles | 28 |
| **Exteriors original total** | **13,042** |
| Interiors complete master | 1 |
| Interiors Room Builder master / subfiles | 1 / 9 |
| Interiors normal / black-shadow / shadowless theme sheets | 26 / 26 / 25 |
| Interiors normal / black-shadow / shadowless singles | 5,381 / 5,253 / 5,330 |
| Interiors native animation PNGs | 311 |
| Interiors native home-example PNGs | 44 |
| **Interiors original total** | **16,407** |
| Committed complete Exteriors / packed Interiors reference | 1 / 1 |

All 6,224 same-named Exteriors theme singles are byte-identical to the complete
singles. Their separate source occurrences remain in the ledger. Five old
sorting sheets nested inside the Exteriors theme folder are explicitly excluded,
as are the 22 PNGs under Interiors `Old stuff`. Other resolutions, characters,
UI, RPG conversions, palette references, non-PNG exports and derived runtime,
review and promotion artifacts are excluded. Native autotiles are included as
assembly evidence. The manifest owns the exact inclusion/exclusion rules.

## Original sheets versus committed inputs

The Exteriors original master is 2816×8224 and is byte-identical to committed
`public/assets/tilesets/me-complete.png`, SHA-256
`1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`.
Existing Exteriors index rectangles therefore use the original master space.
All 4,816 indexed names resolve to actual complete-single paths and match their
indexed crops after normalizing RGB under zero alpha, following the existing
indexer's comparison rule. They occupy 4,624 distinct indexed rectangles.
The 1,408 complete singles not named in that index remain source inventory;
this audit performs no new matching search and does not claim their art is absent.

Interiors original `Interiors_16x16.png` is 256×17024, and original
`Room_Builder_16x16.png` is 1216×1808. Neither original master is committed.
The committed 2048×8800 Interiors atlas is a packed selection rather than either
whole master. Its 19,493 entries reference 16,017 distinct original source paths:
15,964 variant singles, nine Room Builder subfiles and 44 home-example PNGs.
The nine subfiles contribute both nine whole-sheet entries and 3,476 tile entries.
Every indexed `sourceRect` matches its packed `rect` exactly in decoded RGBA,
including transparent RGB. Bounds and declared atlas dimensions/counts also pass.

The remaining 390 in-scope Interiors PNGs are unreferenced by the committed
packed index: the two masters, 77 theme/shadow sheets and 311 animation PNGs.
These are available source evidence, not proof of missing art or semantic gaps.
Packed origins need not align to 16px; original and packed coordinates must
remain distinct in later packets.

All 29,449 original PNGs are Git-ignored and absent from fresh clones. Only the
two named committed reference PNGs and the existing index/builder files used
by this audit travel with Git. Full source verification requires restoring
these exact originals; normal builds continue to use their committed inputs.

## Reproduction and verification

```sh
python3 scripts/semantic-map-inventory.py
python3 scripts/semantic-map-inventory.py --check
python3 scripts/semantic-map-inventory.py --check --committed-only
```

Hashing, PNG IHDR sizes, ledger writing and committed-only verification use
Python stdlib. Full indexed crop verification also uses Pillow. `--check`
does not mutate either artifact. `--committed-only` checks the saved ledger
hash/revision and committed PNG/index/builder bytes without needing ignored
originals or Pillow; it does not imply that missing original pixels were checked.

Verified a repeated generation produced byte-identical outputs and a full
`--check` passed without mutation. A temporary fresh-clone-shaped input tree
passed committed-only verification, rejected full verification because originals
were absent, and rejected independent committed-PNG and ledger corruption.
No assets, indexes, promoted banks, feedback records or approval state changed.
The coordinator owns repository-wide typecheck, unit-test and lint validation.

Next: use the pinned original masters for thematic reconnaissance and preserve
source-to-packed relationships in the three contrasting trial packets. Inventory
and index counts are baseline denominators, not semantic completion or approval.
