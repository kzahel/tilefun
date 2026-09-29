# Indoor Workbench

Open `/tilefun/interior-workbench.html` on the running site. The Interiors atlas catalog also links to it.

The fixture menu contains the small, large, strange, and offset apartment examples. Duplicate a fixture to make a named custom copy. The floor plan and rendered tiles are shown side by side on wide screens. On narrow screens, the Plan and Render buttons switch between views; Split stacks both. Zoom changes both canvases, and Center moves to the selected place or first visible part of the fixture.

## Tools

- **Plan paint:** choose a room, wall, door, or empty-space brush. Drag to paint cells or select Rectangle to fill a zone. A valid sketch recompiles immediately. If the sketch is temporarily invalid, the status shows the parser error and the rendered view clears until it is valid again. The full sketch is also editable as text.
- **Tile paint:** choose a layer and atlas tile, then paint individual 16-pixel rendered cells. These are saved as visual overrides; they do not change the semantic floor plan or collision.
- **Flag:** tap a tile or drag an area in either view, choose the issue type, and write why the placement is wrong. Each flag saves the coordinates, area, plan character, semantic cell, and original generated tile keys. Flags remain separate from painted overrides.
- **Inspect:** tap either view to see the matching plan and rendered coordinates, generated layers, and any override. Selecting a generated tile key makes it the tile brush.
- **Pan:** drag the active canvas. Native scrolling also works; zoom buttons change the pixel scale.

Changes save automatically in that browser. **Export** downloads one JSON document containing the sketch, overrides, and flags. **Import** restores a document from that file. Use Export to share a fixture for review; browser-local changes are not synchronized with the game server.

The current workbench is an architectural editing and review surface. A playable indoor scene with collision and portal transitions remains a separate step.

## Fast review loop

The next architecture and coverage work is specified in the
[wall solver and rapid review plan](tactical/002-interior-wall-solver-plan.md).

Open `/tilefun/interior-review.html` for one-at-a-time visual review. The
workbench header links to it. The deterministic coverage ladder starts with
one-cell rooms and proceeds through doorway positions on
all four sides, dividers, rotated inset corners,
T/cross junctions, and the existing apartment examples. Choose a category to
jump ahead. Cases that cannot compile appear separately under compiler
exclusions, never as approved renders.

- **Space / Looks right:** accept and advance.
- **X / Wrong:** flag and advance; no explanation required.
- **Tap a block** in the render or emoji plan to attach a numbered pin. Double-tapping adds just one pin. Tap its numbered chip to remove it. Pins survive reload and are saved with the next verdict and its screenshot; they do not send a chat message.
- **N:** focus the optional note; Enter submits it as wrong.
- **Right / Skip**, **Left / Previous**, **Backspace / Undo verdict**.
- Two wrong answers pause the batch. Say “ready” in chat to start the next
  agent fix, or choose Keep reviewing. Saving feedback does not start an agent
  turn automatically. You never need to finish the list before reporting a
  problem. Check for updates reloads the current case if mobile live refresh
  has disconnected.

The Vite development service also serves the public deployment, so source edits
refresh the open page through Vite. Browser state preserves position, draft
notes, pins, and unsent feedback. Each judgment fingerprints the actual composed
pixels, dimensions, and sketch. Unchanged renders retain their judgments;
changed renders need review again. If a paused failure changes, the page
resumes on that case after reload. A static build needs a reload after redeploy;
the automatic source-refresh behavior belongs to the development service.

Feedback is automatically posted to `/tilefun/api/interior-review` and appended
to ignored `data/interior-review/feedback.ndjson`. Each record includes the
sketch, case ID, verdict, optional note, render fingerprint, and a PNG of the
judged render. Optional `pins` contain original-render pixel coordinates (`x`, `y`) and `size`: 16 for an atlas tile, 32 for an emoji cell. The PNG includes numbered markers; the fingerprint always describes the unmarked render. Agents can read this inbox directly; no export is needed. Read
records in append order and use the latest record per case. `clear` represents
undo. Always re-render and compare fingerprints before treating an older
report as still current. The GET endpoint exposes latest metadata without PNGs;
the page is a shared review inbox, not separate per-user accounts. Do not put
private information into review notes on the public development deployment.

Offline feedback stays in a browser outbox and retries every five seconds.
The header distinguishes server saves from pending local feedback. The API is
provided in Vite development and preview modes, with bounded JSON records,
same-origin writes, and a capped inbox. Static hosting alone does not provide
server persistence. `INTERIOR_REVIEW_DIR` overrides the inbox location; the
Playwright preview server uses `test-results/interior-review-feedback` to keep
test judgments out of real feedback.

Floor-only variants are collapsed to one case per geometry; existing case IDs
and judgments for retained plans stay intact.

The **Small stress cases** category adds 56 compact cases with nearby junctions, short stepped
dividers, and wall ends in distinct rotations/reflections. These deliberately
probe interactions; they are not pre-approved. Existing case IDs stay unchanged.

Ten focused **Reported join** cases now lead that category. They reduce the pinned
apartment transitions into adjacent south edges, divider/exterior transitions,
and exterior/shared corners, including doors before/after the transition and mirrored counterparts. Review one or two
failures as usual; the full 66-case category is a coverage pool, not a checklist.

### Wall heights and arches

Open `interior-review.html?stage=7` for the 14 height/arch cases: low,
normal, and tall partitions, a native arch, and small mixed-height counterexamples.
Height marks in the plan identify the changed walls; the floor palette is fixed.
Two wrong marks still pause the batch, and notes/pins remain optional.

The 163 approved legacy renders and fourteen approved height/arch renders are preserved in
`tests/fixtures/interior-approved`; a browser test checks their exact pixels.
The height sampler is opt-in and does not replace the workbench's approved wall
renderer. Height specifications are included in feedback for reproducibility.

### Thickness and end joins

Open `interior-review.html?stage=8` for eight new candidates: thin/thick straight,
L, T, and doorway transitions, plus low/tall attachments at the north wall and
south cutaway. The plan outlines thick cells and retains the height marks. These
use 8px/16px footprints with the south/east face anchored; thickening extends to
the north/west. Explicit thickness also makes a horizontal opening exactly one
32px sketch cell wide. Widths are saved with feedback, including optional pins.

The same two-failure pause applies. This is a separate opt-in round; all 177
previously approved renders retain their exact pixels. The new cases are visual
candidates, not accepted baselines or a general gameplay collision system.

The four thickness cases and both north attachments have since been approved and
added to the baseline (183 renders total). The south attachments now join the
foreground cap without an exposed free end. Reload returns the two changed
south cases for review; the six unchanged approvals remain current.

### Responsive loading and remaining counts

The review page loads a dedicated 27-sprite source sheet and index (about 16 KB
combined, 256×71 pixels), instead of the full 20 MB library. `npm run assets:review`
repackages the required source slices without generating any room images. Run it
when a case introduces new sprites; `npm run build` checks that the sheet is current.
Vite gives built sprite assets content-based filenames for normal browser caching.

Only the active unmarked canvas and one reusable scratch canvas are allocated,
in addition to the visible canvas. No generated room images or computed render
fingerprints are cached across reloads. Saved verdicts, notes, pins, and the
offline feedback outbox retain their existing persistence.

The reported/current case is checked first. The rest are regenerated in short
tasks that yield to browser input and painting. Navigation reprioritizes the
background checks. Each category shows unchecked, still-checking, and wrong counts;
an old verdict counts only after its fingerprint matches freshly generated pixels.
The first case is usable before all category counts finish checking.

On a local desktop through the public deployment, the first case appeared around
0.3 seconds; 4× CPU throttling produced a similar first-case time. The previous
1.67-second uninterrupted task at 4× throttling fell below 75 ms. All counts
completed around 2.5 seconds in that run, while the page remained usable. These
are diagnostic desktop measurements, not a phone timing guarantee.

### Unchecked filter and interaction rounds

**Unchecked only**, beside the category selector, is on by default and remembered
across reloads. It hides currently graded cases from forward/back navigation and
shows an empty state when a category is complete. Turn it off to browse or revisit
grades. Changed pixels return to the unchecked queue automatically; the two-report
pause may still display the last flagged case for context. `?unchecked=1` or `0`
can explicitly set the filter on a link.

Three new eight-case categories follow the 185 approved cases:

- `?stage=9`: small profile interactions—mirrored L/T joins, doors beside corners,
  one-cell returns, and thick side-wall attachments.
- `?stage=10`: combined height/thickness changes—straight steps, doors, mixed T
  junctions, and thick north/south attachments with low approaches.
- `?stage=11`: connected rooms—two/three-room layouts, a narrow hall with offset
  doors, and short returns, including mirrors.

These 24 candidates use the same wood floor, fit within a 288px canvas, and reuse
the existing source sprite sheet. They are unapproved until reviewed. Start with
stage 9; one or two failures are enough to begin another fix.

The next review accepted sixteen of those candidates (201 approved renders in
total). The two normal-height east-wall reports now use the same inward-facing
connection as tall partitions. Reload reopens those changed reports; the six
unreviewed room compositions also receive the shared fix. Existing approvals
remain current. The unchecked-only position counter now updates as background
verification finishes, so it reflects the remaining cases without reselecting a
category.

The next review accepted the east thick-shell correction and reported normal
west joins that appeared lower than the shell. Those caps now reach the shell's
inner top rail. This shared fix reopens two older approvals (the west thick-shell
case and the two-room composition); their previous reference images remain
archived pending review. Refresh shows nine unchecked cases: two repaired
reports, those two reopened approvals, and five unreviewed layouts. The other
200 approved images are unchanged.

The three-room repair and short-return composition then passed. The next fix
uses the shell's normal height at side connections: low east walls end within its
face, and tall walls retain their rise above its rail. It reopens three older
low/tall attachment approvals as well as the two new reports. Refresh shows
ten unchecked cases, with 199 current approvals preserved exactly. Historical
references remain archived until fresh review approves their changed versions.

All 209 cases have now passed review and are protected by exact image references.
The next eight-case category is **North & south attachments** (`?stage=12&unchecked=1`):
normal thin walls, then normal/low/tall thick walls at each boundary. These 7×7
sketches fit a 224px canvas and complete the height/width matrix alongside earlier
thin-wall approvals. Only the eight new candidates are unchecked; the same
one-click review and two-report pause apply.

The first three north cases passed. Tall north walls now rise above the shell,
with viewport padding that keeps the entire wall visible and pins aligned.
Normal south walls join the cutaway continuously; tall ones retain the physical
height difference above that normal wall. This reopens four earlier tall
attachments. Refresh shows nine unchecked cases, while 208 approved images stay
unchanged. The rejected reports remain the first priority after reload.

All 217 cases have now passed and their latest approved images are protected.
The next category, **Nearby doors & junctions** (`?stage=13&unchecked=1`), contains
eight candidates: corner-adjacent doors, doors near thickness changes, closely
spaced T junctions, and small wall loops. Mirrored cases exercise both handed
connections. Each complete render fits within 256px; the floor remains wood.
Only these eight new cases are unchecked, and two failures still pause the round.
