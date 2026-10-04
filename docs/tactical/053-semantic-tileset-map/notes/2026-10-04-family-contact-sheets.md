# Three family contact sheets — 2026-10-04

The owner requested all three investigated families in a quiet, visual form.
The implementation presents cabinets, trees and scrapyard pieces in one native
Workshop view, available from All tools, Source art and one registered inbox batch.
The sheets expose proposed knowledge for discussion; they create no human approval.

## Delivered scope

| Sheet | Visible cards | Source records | Controls and grouping |
| --- | ---: | ---: | --- |
| Cabinets | 9 | 27 | Three shadow styles; complete cabinets separate from four assembly-only pieces |
| Trees and forest | 14 | 29 | Four colors for three whole trees and two replacement strips; nine fixed forest pieces in matching-row groups |
| Scrapyard and debris | 29 | 29 | Wrecks, loose scrap, mounds, modular refuse, loose signs/components and utility structures |

The 52 cards account for all 85 pilot source records. Assembly examples add no
new source-record completion claims. Pixel zoom stays on integer steps; small
screens fit the art within the sheet. Member selection and variant are shareable
URL state. Source IDs, proof hashes and research terms stay out of normal labels.
Short facts preserve non-standalone restrictions, join needs and meaningful unknowns.

Cabinet pieces 41–44 and tree replacement strips cannot stand alone. Loose scrapyard
signs and box pieces retain unknown standalone suitability. Forest row compatibility
is explicit; repeating centers, corners and arbitrary terrain use remain unproved.

## Data and review boundaries

`scripts/build-family-sheets.py` produces `public/data/family-sheets.json` from
frozen proposals, reviews, topology and the two committed atlases. It checks
source hashes, crop bounds, aliases, available pixel hashes and record coverage.
Each family revision includes the fingerprints and dimensions of its used sources,
so changed pixels also change saved-link and draft identity. The browser checks
catalog/family revisions and source pins, then hashes the image bytes it decodes.
Tree variants use explicit RGBA replacement layers, including transparent pixels.
No original packs, new art exports or repacked atlas are required for browsing.

The adapter retains source frames rather than trimming sprites. It checks the
cabinet and scrap saved pixel hashes; P01 has no saved normalized whole-image hash
for every named tree, so its fresh-clone checks use pinned source occurrences and
the recorded replacement relations without claiming to reread ignored named PNGs.

Three `family:*` discovery candidates appear in one Asset families batch. Their
fingerprints identify source/metadata proposals, not an approved rendered scene.
They redirect to the sheets and carry no art/geometry approval payload.
Shared notes use the existing source-event outbox and inbox. Their stored context
pins family revision, catalog revision, member, selected variant and every rendered
layer; the source rectangle is an anchor for that context. Drafts are scoped to the
same selection. Old proposal links visibly identify the mismatch and block new
notes until the current proposal is opened. Saving notes does not modify metadata.

The existing shared data model and exact review process still need fuller integration
before family-level approval/promotion. This delivery satisfies the visual discussion
slice; it does not complete V01's general normalized lineage/topology validator or
the mapping of remaining themes.

## Validation

Source adapter check and seven Python regressions passed. Typechecks, 1,494 unit tests
and lint passed (existing 114 warnings / 32 informational diagnostics). Art catalog
and Workshop manifest were regenerated; manifest identities agreed in headless and
normal Chromium. Production build and seven targeted family browser tests passed.

The browser checks all three card inventories at desktop and 390px phone width,
actual shadow/color pixel changes, cabinet join metadata, shareable selection,
draft scope/reload, exact note payloads, source-byte rejection and old-proposal guards.
Notes are mocked or use isolated test data; no human inbox writes were performed.
The full 328-test browser run produced 325 passes and three failures: an obsolete
tool count (updated for Asset families), a preview-server port collision (preview
stopped), and a stale-manifest guard during concurrent proposal regeneration.
After freezing data and rebuilding the manifest/build, all 13 tests across family
sheets, tool index, server security and standalone Workshop passed, including
every earlier failure and the new source-pin mismatch check.

Reproduction: `python3 scripts/build-family-sheets.py --check`,
`python3 scripts/build-family-sheets.test.py`, the standard repository checks, then
`npx playwright test tests/family-sheets.spec.ts` after a build. The browser spec
writes six contact-sheet captures under `/tmp/tilefun-family-*-{desktop,phone}.png`.
The coordinator inspected the desktop and phone captures; they are disposable
evidence reproducible from committed data and source images.
