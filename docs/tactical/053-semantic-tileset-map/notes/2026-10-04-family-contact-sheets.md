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


## Owner follow-up: navigation and whole-sheet comments

The owner found that no sidebar item indicated the current family page and that
selecting a piece hid the family discussion entry point. Asset families is now in
the sidebar's native route list, using the existing active-page semantics plus a
stronger inset marker shared by all sidebar links.

**Comment on whole sheet** is always available above the selected-piece details.
Its form has a separate family-wide draft and sends a note with no member target,
even while a piece remains selected. **Discuss this piece** remains a separate
control. Positive prose such as “Everything here looks perfect” is saved as a
whole-sheet comment; this change adds no automatic promotion or approval action.

Browser coverage includes 1440px, the reported 966px viewport, and 390px phone
layouts; active navigation follows family tabs and moves to Source art when
navigating away. Mocked writes verify the whole-sheet context and retained piece
selection. Desktop/tablet/phone captures were inspected.

Follow-up validation: typechecks, lint (existing warnings), catalog/manifest
generation and production build passed. The unit run passed 1,496 tests with one
furniture-physics timeout; all 12 tests in that file passed on a focused rerun.
All eight family-sheet browser tests passed in the full regression run.
The full browser run passed 332 of 333 tests; standalone review was blocked by
the stale-build guard after concurrent shared-rendering changes. Rebuilding
against the current manifest resolved it, and the standalone test passed.


## First owner comments and tree follow-up

Read the shared inbox on 2026-10-04. All four new comments match the current
family revisions and catalog `a6485f487361ff60deb0373aaa65a0e2133fc02e0f8e0234741925d6857a03dd`.
The original private records remain in the inbox; this is a decision/evidence
summary, not a copied event log.

- [Cabinets feedback](https://tilefun.graehlarts.com/tilefun/workshop.html#/thread/art%3A1533a623-2638-48a4-8b1b-8a21bab8deca): positive whole-sheet feedback on the displayed normal-shadow selection.
- [Scrapyard feedback](https://tilefun.graehlarts.com/tilefun/workshop.html#/thread/art%3A676cafe4-78e4-4ced-8c7f-bac948f51368): positive whole-sheet feedback on the original artwork selection.
- [Tree-base question](https://tilefun.graehlarts.com/tilefun/workshop.html#/thread/art%3A8f423e7e-7bf8-42f3-8e44-ad8e78b3dd26): the owner identifies card 4 as a tree base and asks about its color relative to cards 1–3.
- [Forest repetition hypothesis](https://tilefun.graehlarts.com/tilefun/workshop.html#/thread/art%3Aa33d4926-c4de-4d66-8286-99065fca6af7): the large center pieces may repeat to produce a dense forest.

Positive comments are retained as owner feedback on these exact proposals; the
current discussion-only UI has not promoted catalog records or gameplay geometry.
No agent replies or status changes were written to the shared inbox.

### Tree bases

The owner's noun is clearer: these are alternative tree bases. “Replacement” is
an assembly operation, not their object identity. Rechecked the green palette from
pinned Exteriors SHA `1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737`:

| Base | Comparison to displayed complete trees' bottom 64×16 region |
| --- | --- |
| Card 4, B01 at `[2464,80,64,16]` | Exactly equals tree 2; differs from tree 1 in 165 RGBA pixels and tree 3 in 193 |
| Card 5, B02 at `[2464,96,64,16]` | Exactly equals tree 3; differs from tree 1 in 194 RGBA pixels and tree 2 in 193 |

Reproduction: render the first five green variants' recorded layers with RGBA
replacement, then compare the bottom 16 rows of each complete tree to each base.
B01/tree-2 lower bytes hash to
`003a5d26c4bf038584a7903d998f0db8210c39f1d72c5e032525cc0dcc712422`;
B02/tree-3 lower bytes hash to
`de1e8ab9ef070f9e4f5cbde2efd15d95dbdca10f1ba672885fa06036c3f70d1b`.
The current tree display therefore has no different-color mismatch between card 4
and tree 2. The detached base can look different without its surrounding canopy.
Presentation follow-up: label the group Tree bases, name pale/green-tinted bases,
and say explicitly which displayed complete tree each base produces.

### Forest repeat probe

A GPT-6.1 Sol/high investigator checked all three center pieces against pinned
source pixels; the coordinator inspected native-canvas repeat captures. No source
pixels, frozen packets, displayed family metadata or approvals changed.

| Center | Source rectangle | Tested horizontal step | Nonoverlapping vertical step |
| --- | --- | ---: | ---: |
| F02 / card 7 | `[2512,1600,128,112]` | 128px | 112px |
| F05 / card 10 | `[2512,1712,128,80]` | 128px | 80px |
| F08 / card 13 | `[2512,1792,112,80]` | 112px | 80px |

Repeated centers with their own row's end pieces form visually plausible extended
horizontal forest strips: left fragment at x=0, centers at x=48+k×step, right
fragment at x=48+n×step, all top-aligned. A 3×3 grid using the full sprite heights exposes repeated
front/base rows and green ground bands; it does not establish seamless dense fill
in both directions. Painter-ordered row overlap at a 48px vertical step makes a
dense-looking forest, but hides parts of previous trunks/bases and is an alternative
scene composition hypothesis, not an established tile topology rule. Repeating
motifs, corners, mixed-row compatibility, boundaries and collision still need review.

Reproduction: use source-only canvas draws (no scaling while composing), render
left + four centers + right at each row's recorded height; render a 3×3 center grid
at the table's steps; compare vertically overlapping center rows with 16/32/48/64px
steps, back rows before front rows. Use nearest-neighbor enlargement only for display.
The independent probe used bundled full Playwright Chromium and CPU pattern drawing;
temporary captures are [strips and grids](/tmp/tilefun-forest-repeat/nonoverlap.png),
[vertical overlaps](/tmp/tilefun-forest-repeat/vertical-overlaps.png), and a
[side-by-side comparison](/tmp/tilefun-forest-repeat/comparison.png). Exact rectangles and assembly
steps here are sufficient to reconstruct the evidence without those files.

Next display proposal: ordinary tree-base labels and explicit base-to-tree links,
plus a horizontal repeated-center example; keep dense two-dimensional forest fill
as a separate hypothesis for visual review. This checkpoint records findings only.

Feedback checkpoint validation: 1,500 unit tests, typechecks and lint passed
(existing warnings). Only plan/topic documentation changed in this checkpoint.
