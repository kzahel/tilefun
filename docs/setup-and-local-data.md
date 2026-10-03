# Fresh-machine setup, assets and local data

A fresh clone contains the art and code needed to run the game, Art Workbench,
Building Lab (including street, road and dense-neighborhood runs), room review,
Indoor Workbench and World / Terrain Explorer. Original downloaded asset packs
are not required for normal development or builds. Saved feedback and worlds
are separate state and do not travel with Git.

## Start a fresh checkout

Use Node.js 24 and npm 11.19 or newer, consistent with the engines and lockfiles
in `package.json` and `worker/package.json`. From the cloned repository:

```sh
npm ci
npm --prefix worker ci
npm run dev
```

Open the `/tilefun/` URL printed by Vite, normally
`http://localhost:5173/tilefun/`. The workspace is
`http://localhost:5173/tilefun/workshop.html`, also linked from the game sidebar.
Direct localhost access needs no login. Run `npm run workshop:auth -- setup`
for access through public/LAN hosts; credentials are written privately to
`data/workshop/initial-login.txt`. See
[Workshop setup and API](tilefun-workshop.md). Old `tools.html` bookmarks work.
The worker install supplies the Cloudflare types needed by `npm run typecheck`;
it is not needed simply to run the browser game/labs. No Cloudflare deployment
is required for those local tools.

For validation:

```sh
npm run typecheck
npm test
npx biome check .
npm run build
npx playwright install chromium
npx playwright test
```

Playwright uses its own Chromium and an isolated preview on port 4174. Its
feedback goes under `test-results/`, not the human review inbox. On Linux,
Chromium may also need the system dependencies installed by
`npx playwright install --with-deps chromium`.

The shared human review deployment is
<https://tilefun.graehlarts.com/tilefun/workshop.html>. Visiting that deployment
from another machine uses its existing server inbox; running a local clone
creates a separate inbox. Changing origin (host, port or HTTP/HTTPS) also changes
which browser-local state is visible.

## What is checked in

| Content | Repository location | Available in a fresh clone? |
| --- | --- | --- |
| Complete Modern Exteriors sheet | `public/assets/tilesets/me-complete.png` | Yes, including the giant source sheet used by our art tools |
| Extracted Modern Exteriors terrain strips and metadata | `public/assets/tilesets/me-autotile-*.png`, `me-autotile-metadata.json` | Yes |
| Modern Exteriors named slices | `public/data/me-atlas-index.json` | Yes |
| Packed Modern Interiors atlas and index | `public/assets/tilesets/modern-interiors-atlas.png`, `public/data/modern-interiors-atlas.json` | Yes |
| Room-review sprite subset | `src/interiors/review/assets/review-sprites.png` and `.json` | Yes |
| Other runtime sprites, props, tiles and audio | `public/assets/` | Yes |
| Blender tiger walk demo, pixel masters, editable source and builders | `public/demos/blender-tiger/`, `art-source/blender/`, `art-source/pixel-tiger/`, `scripts/blender/` | Yes; see [the workflow guide](blender-pixel-characters.md) |
| Art inventory and source-use tracking | `public/data/art-catalog.json` and `scripts/build-art-catalog.ts` | Yes |
| Building/street/surface recipes and pinned dense-city assets | `src/generation/regional/`, `src/road/` | Yes |
| Downloaded original packs | Root `assets/`, ZIPs, `Sprout-Lands-Tilemap-addon/` | No; gitignored |
| Local skill checkouts and art experiments | Root `skills/` | No; gitignored; reproducible tiger sources and final demo are committed separately |
| Shared notes, review events and filesystem worlds | Root `data/` or configured data directories | No; gitignored |
| Browser drafts, queues, editable fixtures and local worlds | Local Storage / IndexedDB for each browser origin | No; outside the checkout |

`/assets` in `.gitignore` excludes the **repository-root** originals directory;
it does not exclude `public/assets/`. Likewise, `public/data/` is explicitly
included despite the general `data/` ignore rule. Indexed original filenames in
the catalogue are provenance, not runtime dependencies: the tools crop pixels
from the committed sheets/packed atlas.

The asset audit on 2026-10-01 found all 91 art-catalogue sheets tracked. A build
from a temporary `git archive HEAD` containing only committed files passed,
using the already-installed npm dependencies; no ignored original packs or
saved feedback were copied into that build.

## Rebuilds that do and do not need original packs

| Command | Inputs | Needs ignored originals? |
| --- | --- | --- |
| `npm run build` | Committed assets, indexes and recipe definitions; checks generated files | No |
| `npm run workshop:manifest` | Committed art and shared renderers; Playwright Chromium | No |
| `npm run art:catalog` | Committed sheets/indexes and source-use definitions | No |
| `npm run assets:review` | Committed Interiors atlas and index | No |
| `npx tsx scripts/build-gameplay-furniture.ts` | Committed Interiors index and furniture catalogue | No |
| `npm run assets:interiors` | Original files under `assets/interiors/1_Interiors/16x16` and `assets/interiors/6_Home_Designs` | Yes; repacks the full atlas/index |
| Original-pack extraction/indexing scripts | Their original image, XML or Godot inputs | Yes; inspect the script's inputs before running |

Do not run `assets:interiors` as a fresh-clone setup step. Restore the original
pack only when intentionally repacking/importing source art. Repacking may
change atlas coordinates and fingerprints, so inspect the resulting diffs and
review affected recipes. For attribution see [Asset Sources](../public/assets/SOURCES.md).

`src/generation/regional/dense-city-assets-v1.json` is a pinned promotion
snapshot, not generated build output. Do not regenerate it from current review
candidates. See [the dense-city plan](tactical/007-dense-city-districts-and-street-life-plan.md)
for the versioning contract.

## Transfer shared review history

These files hold the server records. Review histories are append-only; play ideas
are individual records whose status can change and which the owner can delete:

| Review system | Default file | Directory override |
| --- | --- | --- |
| Art notes and Building Lab building/street/surface/district approvals/reports | `data/art-notes/notes.ndjson` | `ART_NOTES_DIR` |
| Room Builder and Furniture Movement Lab reviews, including stored screenshots | `data/interior-review/feedback.ndjson` | `INTERIOR_REVIEW_DIR` |
| Play ideas (text, PNG and status) | `data/workshop/play-ideas/<UUID>.json` | `WORKSHOP_DATA_DIR` parent |
| Workshop commands and discussion | `data/workshop/events.ndjson` | `WORKSHOP_DATA_DIR` |

Vite development, `npm run preview` and standalone Node provide the same
protected art/interior/Workshop APIs. Static hosting of `dist/` alone provides
none. Standalone defaults all private directories beneath `DATA_DIR`; Vite uses
the defaults above. Explicit overrides take precedence.

Back up `workshop/play-ideas/` too when transferring gameplay suggestions. It contains
private text and game pictures, with no credentials or audio.

Copy all three review histories together, while writes are stopped. Workshop commands
materialize events in the original stores; preserving both avoids lost discussion
or retry identity. Exclude `sessions.json`, `owner.json` and `initial-login.txt`
from review archives. Configure the new machine's own login; sessions do not
travel with feedback. Those auth files are private and gitignored.

Start both machines on the same repository revision to compare review state;
then use the following one-time transfer into a fresh destination:

1. On the original browser, refresh/sync each review tool and wait until it
   reports no pending server saves. Unsynced outbox entries are still only in
   that browser.
2. Stop the source server accepting feedback, and stop the destination server.
   Copy the **complete original NDJSON files**, retaining event IDs, dates,
   verdicts, replies and screenshots. Use the configured directories if the
   defaults were overridden.
3. Put the copies at the destination paths above, then start Vite/preview there.
   If the destination already has feedback, preserve its files separately;
   this recipe is a restore into an empty inbox, not an automatic merge.
4. Sign in, open the Workshop and refresh feedback. Verify the notes and approval
   counts. Approvals apply only when case/source/recipe/render fingerprints
   still match. A legitimately changed appearance remains unchecked.

For the default directories, these shell examples archive and restore the three
histories. Omit a path if it does not exist. Transfer the
archive between machines yourself, placing it in the destination’s `data/`
directory. Keeping the archive under `data/` also keeps it gitignored.

```sh
# On the source, from the repository root, while feedback writes are stopped:
# Include only the Workshop history, never credentials/sessions:
tar -czf data/tilefun-review-history.tgz -C data art-notes interior-review workshop/events.ndjson

# On the destination, from its repository root, with fresh/empty inboxes:
mkdir -p data
tar -xzf data/tilefun-review-history.tgz -C data

# Verify the art inbox; room/furniture records are in the second NDJSON file:
npm run art:notes -- --status=all
```

These are POSIX-shell examples for macOS/Linux; the same files can be copied
with a file manager on Windows. Environment overrides must be set before the
server/CLI starts. For example, POSIX shells use
`ART_NOTES_DIR=/path/to/inbox npm run dev`; PowerShell uses
`$env:ART_NOTES_DIR = 'C:\path\to\inbox'` followed by `npm run dev`.

The art API's GET response and `art:notes -- --status=all --json` expose the
latest event per thread, not the entire event log. The Art Workbench **Export**
downloads JSON containing current notes and an outbox, not an NDJSON server
backup. Keep that export to preserve unsent feedback; there is currently no
built-in import/restore button for it. Do not replace `notes.ndjson` with that
JSON export. Copying the original logs preserves full history.

## Browser-local drafts, queues and fixtures

Server log transfer restores shared judgments; it does not restore navigation,
local batch pause state, drafts, outboxes or editable fixture settings. Browser
sync is not a repository backup of those values. If those details matter, use
the browser's developer tools to copy the relevant **Local Storage key/value
strings** at the original origin, close destination tool tabs, restore them at
the destination origin, and then reload the tools. Back up existing destination
values before replacing them. This is a manual transfer, not cross-origin sync.

| Tool/state | Local Storage keys |
| --- | --- |
| Play idea unfinished draft | `tilefun.idea-draft.v1` (unsent submissions use IndexedDB `tilefun-play-ideas-v1`) |
| Workshop drafts, pins, per-batch queues and native outbox | `tilefun.workshop.v1` |
| Art Workbench view, drafts, cached notes and outbox | `tilefun.art-workbench.v1` |
| Building Lab shared feedback cache/outbox and note drafts | `tilefun.building-feedback.v1`, `tilefun.building-drafts.v1` |
| Building, street, surface and district queue selection/pause | `tilefun.building-review.v1`, `tilefun.street-review.v1`, `tilefun.surface-review.v1`, `tilefun.district-review.v1` |
| Room Builder Review drafts, pins, queue and outbox | `tilefun.indoor-review.v1` |
| Furniture Movement Lab edits, physics, verdict cache and outbox | `tilefun.furniture-motion.v1`, `tilefun.furniture-motion-physics.v1`, `tilefun.furniture-motion-verdicts.v1`, `tilefun.furniture-motion-outbox.v1` |
| Indoor Workbench editable fixtures | `tilefun.indoor-workbench.v1` |

For Indoor Workbench fixtures, prefer its existing **Export** / **Import**
buttons: export each edited fixture on the source and import its JSON on the
new machine. Export is per selected fixture. See [Indoor Workbench](interior-workbench.md).
After restoring an outbox, allow it to sync and verify the pending count clears;
retained event IDs let retries be recognized rather than creating new events.

## Worlds and player profiles

Local browser worlds and profiles are in IndexedDB, not in the NDJSON review
logs or Local Storage keys above. There is currently no general world/profile
export/import UI. To retain them, migrate the browser profile/site data using
the browser's supported procedure, keeping the same origin, or continue using
the original browser. Opening a different port/domain will show separate state.
A seed/revision explorer link reproduces initial generation, not saved edits,
deletions, interiors or player progress. Current player locations are stored in
`tilefun-world-__player_locations__-records-v3` (IndexedDB), separately from per-world visit
history. Include this database when migrating browser state.

Server-hosted worlds use filesystem state: `data/registry.json` and
`data/worlds/` by default. Each world stores outdoor and interior namespaces together in
`records.sqlite` with its WAL and a separate `writer.sqlite` lease database. There is one
shared writer per open world, not one database per interior.
Browser world record databases use the `-records-v3` suffix. Format 3 intentionally
does not load old saves; create a new world to use the new runtime. For the standalone server, `DATA_DIR` changes that
root; the Vite game server currently uses `./data`. Stop the game server before
copying its registry and complete worlds directory together, and restore them
into an empty destination data root. The reserved `worlds/__player_locations__/`
directory holds current player locations and must be copied too; it is not a
playable world. Review-only archives above do not contain
these worlds. Connecting from another machine to the same running game server
uses that server's existing worlds; a new browser may still have a new local
player profile.


Gameplay room edits are saved with the world, as versioned `roomPlan` interior
metadata; they are not Workshop notes or `tilefun.pattern-drafts.v1` browser drafts.
Copy/export the world container (including its interior namespaces and procedural furniture
edits) to transfer playable edits. A seed/revision link reproduces the generated
starting room, not its edited plan. See [gameplay room controls](tilefun-workshop.md#editing-gameplay-rooms).
