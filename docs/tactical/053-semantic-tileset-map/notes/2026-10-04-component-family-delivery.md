# Floors, tubes and animated doors — family delivery

Date: 2026-10-04. Owner request: proceed with normalization and quiet presentation
of the three independently reviewed research packets. This adds 46 cards / 59
source records to the existing five sheets: eight families, 131 cards and 191
source records now have compact metadata and exact whole-sheet/piece discussion.
All remain Proposed. Discussion, agent review and successful validation do not
promote metadata or grant game-placement permission.

## Owner-facing scope

- [Floors and stone arches](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/families?family=room-builder): 25 pieces, six closed examples and two open path sections. Joins are bounded by the pictured arrangements; the arch retains source-subfile shadows instead of substituting a different master rendering.
- [Playground tubes](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/families?family=playground-tubes): 19 cards / 25 exports and five assembled examples. Only the crossing and two side entrances have the verified blue/red variants. Cut ends require neighbors; visible entrance mouths have a separate role. Rounded ends and rims retain unknowns.
- [Animated doors](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/families?family=animated-doors): two strips / nine frames, with separate frame selection and manually started source demonstrations. Play/Pause and Next frame replay the companion GIF timings. Leaving the family, hiding the page or reloading stops playback. Playback never changes the selected frame or note target.

The source demonstrations have their own heading. Frames are temporal states,
not pieces to combine. Game timing, triggers, reverse closing, lock mechanics,
collision and placement remain unknown. Reduced-motion preference is compatible
with the paused initial state and explicit manual controls.

The catalog preserves all five earlier family objects and revisions exactly,
including their note targets and approved forest examples. New candidates are
registered through the existing dynamic family batch. Candidate fingerprints
include the source collection and therefore refresh with the two new sources;
family discussion continues to use the unchanged per-family revision.

## Source and revision evidence

The two committed review PNGs are exact byte copies of the frozen A01 originals:

| Committed source | SHA-256 |
| --- | --- |
| `public/assets/semantic-sources/interiors-door-1.png` | `dd13493877176653200007256b6a2c48feb7f3433ef5ce39a6050e9276769165` |
| `public/assets/semantic-sources/interiors-door-1-locked.png` | `dcb3a071c0a5489056f9d83bbdf212eda8902f6067bba1ab5e2011481c9b50a9` |

Original provenance is registered in the art catalog and `public/assets/SOURCES.md`.
Browsing and normal builds require neither downloaded originals nor original GIFs.
No original art, packed atlas, promoted bank, frozen proposal or review was edited.

| Family | Canonical revision |
| --- | --- |
| Floors and stone arches | `ea6a039d20fb017dd60ebe33506a835c6ccea6ff7a4dc62a6d729cbfa81f3422` |
| Playground tubes | `f30af146aa7f9ccd15544286a2b18e623d240cb54a3165c666e2db76ad651bf0` |
| Animated doors | `b6049c97c198489e793bf32885dfd7096f6cbb14edf3ed15d6fd132928771d1c` |

Catalog file SHA-256: `e9c8c02d63d898a1846fde4823de249295136ae6e830ab43882263742ea1a8fe`.
The [adapter record](2026-10-04-component-family-adapter.md) documents deterministic
source/recipe guards. The [independent presentation audit](2026-10-04-component-family-review.md)
replays all 59 records, 58 Room Builder aliases, 30 tube master links, 13 static
examples and nine animation frames. Its alternate-blend test shows 27 changed
visible pixels in the U-shaped tube when replacement is substituted for source-over.

Normalization and coverage are recorded separately in the
[model note](2026-10-04-component-animation-model.md) and
[independent model audit](2026-10-04-component-animation-model-review.md).
The total is 191 source records / 164 proposal units, including duplicate exports
and temporal frames. No whole-pack semantic completion percentage is claimed.

## Application validation

Source adapters: ten main-family tests and ten expansion tests pass. Build output
reproduces from committed source images only. Browser checks cover every family
at 1440px, 966px and 390px widths; all eight fit without horizontal overflow.
The coordinator inspected desktop and phone captures for all three new sheets.
Browser references independently reconstruct all five tube examples. The door
checks exercise every frame, exact timing, independent note selection, hidden-page
pause, reload and family-change cleanup, plus malformed timing rejection.

Initial browser-test corrections were confined to the test harness: a copy check
used the old word “continuation”; paused fake time blocked asynchronous loading;
and a selection assertion needed to wait for the new member heading before
changing its frame. No application timer or source-render defect was found.

`npm run typecheck`, `npm run check`, `npm run build`, `npm run art:catalog`
and `npm run workshop:manifest` pass on the combined checkout. Lint has zero
errors; its existing warnings remain. `npm test -- --maxWorkers=2` passes all
1,541 tests in 182 files. The manifest verifies 569 candidate identities, including
eight family discovery candidates. The full 358-case browser run finished with
356 passed, one opt-in skip and one doorway-reload failure. All 22 family-sheet
tests pass in that run. The unrelated `player-dev-reload.spec.ts` case observed
the remote player at `(0, 0)` after reload instead of the interior arrival
`(72, 248)`; repeated isolated verification is recorded below.

Validation uses
bundled Chromium, isolated authentication/data and distinct ports in a temporary
source snapshot. A concurrent railway session committed its work as `00126a5`;
that committed baseline was included before the full browser run. Its source and
documentation changes belong to the other session.

## Next slice

Continue bounded investigation of unmapped families, emphasizing supplemental
exports, variant exceptions and assembly requirements. Keep failed probes and
alternatives in the plan folder and compact supported facts in the sheets. Owner
comments can refine these proposals without treating uncertain runtime fields as
resolved.

## Final coordinator coverage routing

After independent model review, the coordinator changed only RB01/E03/A01
registry states/descriptions to reconciled/delivered and regenerated the ledger.
The final coverage implementation also distinguishes 170 source-crop references
from 136 named-export references; the coordinator independently recomputed both
counts from the ledger. This terminology correction changes no source records,
proposal units, region links, evidence stages or approval credit. All 16 coverage
regressions pass, and the final generated ledger reproduces with `--check`.

- `scripts/semantic-map-coverage.py`: `b34b5c658d3f931c2fe6f70efc06475affe84a9f79e4711f5b67704c741b3334`.
- `scripts/semantic-map-coverage.test.py`: `be566047d42f0483caae4d54ac82e1c0f96a28a6597d7813c3edd50fc00ebc1f`.
- `docs/tactical/053-semantic-tileset-map/mapping-registry.json`: `efa597a2099118dec2c07c9aff8b284d791bfdb9a25deade067d185a581fe9c5`.
- `docs/tactical/053-semantic-tileset-map/coverage-ledger.json`: `aa69afde2121206be5b476f504600727387602215e195ac6976feab8447c0333`.

Final model regression suite: **22 passed**, with the audited model and script
hashes unchanged. Full-source and committed-only evidence remain separated as
recorded in the model note.

The isolated doorway-reload spec passed all **six checks across three repeats**
without source or test changes. Thus the full-run failure is recorded as an
intermittent unrelated observation, not silently counted as a clean full run.
No gameplay/reload fix was included in this family-sheet work. The app/source
presentation checkpoint is commit `46e9448`; model, coverage and current plan
records are the separate following checkpoint.
