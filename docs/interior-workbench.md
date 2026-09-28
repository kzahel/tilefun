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

Open `/tilefun/interior-review.html` for one-at-a-time visual review. The
workbench header links to it. The deterministic coverage ladder starts with
one-cell rooms and proceeds through doorway positions on
all four sides, dividers, rotated inset corners,
T/cross junctions, and the existing apartment examples. Choose a category to
jump ahead. Cases that cannot compile appear separately under compiler
exclusions, never as approved renders.

- **Space / Looks right:** accept and advance.
- **X / Wrong:** flag and advance; no explanation required.
- **N:** focus the optional note; Enter submits it as wrong.
- **Right / Skip**, **Left / Previous**, **Backspace / Undo verdict**.
- Two wrong answers pause the batch. Say “ready” in chat to start the next
  agent fix, or choose Keep reviewing. Saving feedback does not start an agent
  turn automatically. You never need to finish the list before reporting a
  problem. Check for updates reloads the current case if mobile live refresh
  has disconnected.

The Vite development service also serves the public deployment, so source edits
refresh the open page through Vite. Browser state preserves position, draft
notes, and unsent feedback. Each judgment fingerprints the actual composed
pixels, dimensions, and sketch. Unchanged renders retain their judgments;
changed renders need review again. If a paused failure changes, the page
resumes on that case after reload. A static build needs a reload after redeploy;
the automatic source-refresh behavior belongs to the development service.

Feedback is automatically posted to `/tilefun/api/interior-review` and appended
to ignored `data/interior-review/feedback.ndjson`. Each record includes the
sketch, case ID, verdict, optional note, render fingerprint, and a PNG of the
judged render. Agents can read this inbox directly; no export is needed. Read
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

Current batch: 86 unique layouts, 78 renderable with the present compiler.
Eight rotated inset-corner cases throw `Bay front ... has no floor above it`;
these are ready-made compiler repros independent of visual feedback.
