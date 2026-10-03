# Tilefun Workshop

Current agent review contracts: [art review topic](topics/art-review.md).

Open [Tilefun Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html).
The game sidebar and world menu link here. The old tool index and HTML bookmarks
still work and provide a return link.

Workshop uses React, TypeScript, React Router, Zustand and TanStack Query with
Vite. The game, terrain generators, sprite factories and renderers are shared
TypeScript modules. Buildings, roads, streets, districts, room reviews and source
annotations and Pattern studio have native Workshop views. The room editor, movement playtest,
world explorer and smaller demos run through same-origin iframe adapters so their
existing input/event loops stay isolated. This is a deliberate first release;
those editor controllers can become components later.

## Daily review loop

- **Review inbox:** every registered batch appears, even with no feedback. Start
  with unchecked/changed work. Approved cases hide by default; Show all brings
  them back. Buildings, roads, streets, districts and room stages have independent
  queues. Next/Previous, jump, filters and keyboard shortcuts preserve drafts.
- **Requests & fixes:** source-art ideas and Needs changes reports from both old
  feedback stores. Open a thread for original context, full history, screenshots,
  replies and status. Resolving a request never approves the art.
- **Play ideas:** anonymous gameplay suggestions with text, captured game images,
  spoken readback and New/Planned/Done status. Only the owner can read or manage
  them. See [Play ideas](topics/play-ideas.md) for capture, delivery and limits.
- **Activity:** the combined append-only history, newest first, with pagination.
- **All tools:** descriptions and useful shortcuts to every registered tool,
  including the complete Modern Exteriors sheet and packed Interiors atlas.

In a native review, Looks right applies only to the exact current source,
composition and rendered pixels. Needs changes requires a reason; room reviews
also accept block pins. Two reports pause that batch. Say **ready** in chat when
ready for the agent to implement the reported fixes. Changed pixels/recipes
return to review. The agent must never manufacture human approvals.

Review previews support wheel/two-finger scroll zoom around the cursor. Panning
uses one-finger click-and-drag on a touchpad, left/middle-button mouse dragging,
or touchscreen dragging. Wheel input always zooms, including diagonal,
horizontal-only and Shift+wheel events; it never switches to panning.
Ctrl/Cmd+wheel also zooms. Use the zoom buttons or scale choices for precise
inspection; **Fit** recenters the whole candidate. With the preview focused, arrow keys pan,
plus/minus zoom and Home fits. Each candidate starts fitted. Room taps still pin
the original tile after zoom/pan; dragging never adds a pin. These camera controls
change only the displayed view, preserving the candidate's exact render identity.

Source art supports tap/drag regions, pan, zoom, named-slice search, source-use
links and shareable selections. Save a shared note to put an art request into the
same inbox. World explorer judgments remain labeled browser-local; they are not
shared approvals. Indoor Workbench fixture export/import remains in its editor.

The pending-save indicator includes both native and legacy browser outboxes.
Expired login or an offline server retains submissions; signing back in retries
with the original IDs. Drafts and room pins survive navigation/reload. Browser
storage failures show a warning and export action; keep the tab open until saves
finish. Unsynced drafts/outboxes belong to that browser origin, not Git.

## Vehicles

[Vehicles](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/vehicles)
shows four directional views per car, bus and service truck. Edit the ground
bounding box and physical height, inspect the height diagram, and walk around
the proposal with production collision. Approve each view, save a correction,
or report changes; drafts and offline saves use the shared Workshop workflow.
The global Vehicle geometry batch lists every view before feedback exists.
See [vehicle review](topics/vehicles.md) for identity and promotion contracts.

## Pattern studio

Open [Pattern studio](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/patterns)
from the sidebar. Four families draw on actual art: rooms, fenced-tree strips,
terrain and city surfaces. A gesture previews from the current document and
commits once on release. Invalid doors or unsupported tree fragments are rejected
without changing history. Disconnected room drafts are allowed with a warning;
playable prefabs still require strict entrance reachability.

Wheel input zooms about the viewport center without panning. Hold Shift to pan
with drag or wheel; middle-button drag also pans. Focus the canvas for arrow-key
panning and Ctrl/Cmd Z (Shift for redo). Escape cancels the current stroke.
Use Fit, grid/geometry overlays, erase and undo/redo to inspect joins. Fenced-tree
strokes snap east/west to their starting row, with the fence facing south. The v1
candidate kit requires 4–128 cells per connected run; an erased gap must leave
supported ends. Ground collision is distinct from canopy overhang.

The **Fenced tree pattern kit** batch has five fixed review cases in the global
inbox, with the same approve/comment/next and two-report pause workflow as other
batches. Reviews pin source, rule/document revision and rendered pixels. Editable
drafts are separate and never confer approval. The source-art inspector links
recorded cap/repeat uses back to Pattern studio.

Drafts live under `tilefun.pattern-drafts.v1:FAMILY` in browser Local Storage.
Export/import JSON to transfer them; they are not shared server documents. The
family is versioned, cells are semantic intent, and the compiler derives art.
Keep matching kit/compiler revisions when moving documents.

The outdoor game editor now exposes a **Patterns** tab for the same fenced-tree
kit, including erase/split, row-stroke undo/redo and host validation. City asphalt
and City paving use the existing Road tab/backend. Tree runs persist through
ordinary world props with versioned identities and derived collision, and replicate
normally to other players. Undo refuses to overwrite a row changed since the
stroke. Inside a building, the editor switches to **Rooms** and an indoor
furniture palette. Room strokes use the same `rooms-v1` document, interpolation,
rectangle operation and apartment compiler as Workshop. Existing game terrain/road
queues remain incremental, without whole-gesture undo.

## Editing gameplay rooms

Enter a building in [the game](https://tilefun.graehlarts.com/tilefun/), then press
Tab or click Edit. **Rooms** offers floor, kitchen floor, wall, door and room
rectangle brushes on a 32px semantic grid. Drag to preview; releasing commits a
whole stroke. Right click or Paint / erase removes cells. Shift/middle drag and
arrow keys pan; wheel zooms. Undo/redo buttons and Ctrl/Cmd Z / Shift Z operate on
whole room strokes; Escape cancels a stroke. **Props** places the supported indoor
furniture; use Delete or the existing Prop Editor to remove/move furniture.

For a first extension, draw a room rectangle beside the original room: from cell
4,0 to 10,4, sharing its east wall. Add a door at 4,3, then return to Play and walk
right through it. The current art requires two vertical wall cells above a side
door; invalid placements explain that constraint. Unconnected draft rooms can be
built before adding doors. Every current resident must retain a physical route to
the original street entrance, and the entrance/landing cannot be erased.
Furniture footprints and access areas must remain on usable floor and clear of
doors; edits that would invalidate them are rejected without deleting furniture.

Each interior realm saves a versioned `roomPlan` in its world metadata, alongside
existing furniture edits. The host owns revisions and broadcasts the same plan
and derived collision to clients. Stale strokes and conflicting undo are rejected;
undo also rechecks current furniture/players. Histories are session-local and clear
on leaving/reloading. The renderer caches static shell/depth bands per changed plan;
furniture and actors stay live. Old interiors keep their original recipe and
boundary until edited, and undo back to their starting document restores that path.
Workshop browser drafts remain separate from saved gameplay plans; the Studio link
opens its independent drafting tool. Prefab promotion/worldgen is still a follow-on
review step. `npm run gameplay:bench -- --headed --edited-room` compares edited and
original room performance in isolated bundled Chromium.

See [the phased plan](tactical/011-shared-pattern-brushes-and-room-drawing.md).

## Owner login

Public game/art rendering stays accessible. On public and LAN hosts, private
feedback reads and all new and legacy **review** writes require the owner cookie.
The separate public `POST /tilefun/api/play-ideas` endpoint accepts bounded
anonymous gameplay suggestions; reading or managing those ideas remains private.
There is no registration.

Direct localhost access skips login automatically: `localhost`, `127.0.0.1` and
`[::1]`, with a loopback TCP peer and no forwarded headers. The header shows
**Local access**. This works even before an owner account is configured. Public
reverse-proxy traffic requires login even when the proxy's TCP peer is loopback;
the host and forwarded headers prevent a bypass. Local writes retain same-origin
and CSRF checks. Set `WORKSHOP_LOCAL_AUTH_BYPASS=0` to require login locally too;
auth/browser tests use this setting explicitly. Private runtime files remain
blocked on every host.

```sh
npm run workshop:auth -- status
npm run workshop:auth -- setup
# To change the password and revoke existing sessions:
npm run workshop:auth -- reset
```

Setup generates a random password and writes it to ignored
`data/workshop/initial-login.txt` with owner-only file permissions. It never
prints the password. Save it in a password manager and remove that handoff file.
The username defaults to `owner`; set `WORKSHOP_OWNER` to override. For scripted
setup, pass a password of at least 16 characters in `WORKSHOP_SETUP_PASSWORD`
in the environment, never as a CLI argument.
`WORKSHOP_AUTH_DIR` selects another private directory. No configured account
means public/LAN private APIs fail closed. HTTPS deployments must preserve the
public Host or set `WORKSHOP_PUBLIC_ORIGIN` to their exact external origin. The existing
`tilefun.graehlarts.com` host uses Secure cookies with upstream TLS.

Passwords use salted scrypt. Opaque sessions are stored server-side by token hash,
expire after 30 days and survive server restarts. Cookies are HttpOnly,
SameSite=Strict and Secure on HTTPS. Mutations require `X-Workshop-CSRF` from the
session endpoint and same-origin requests. Login attempts are throttled. Session
credentials never enter URLs or browser Local Storage. Vite denies private
runtime directories through source, raw/import, encoded, filesystem and symlink
paths; `.gitignore` alone is not an HTTP access boundary.

## Data and API

There is no SQL database in this release. These private append-only files retain
all historical IDs, timestamps and human decisions:

| Data | Default path | Override |
| --- | --- | --- |
| Source notes and city review events | `data/art-notes/notes.ndjson` | `ART_NOTES_DIR` |
| Room and movement feedback/screenshots | `data/interior-review/feedback.ndjson` | `INTERIOR_REVIEW_DIR` |
| Workshop commands, author/time and interior discussion | `data/workshop/events.ndjson` | `WORKSHOP_DATA_DIR` |
| Owner hash and private sessions | `data/workshop/owner.json`, `sessions.json` | `WORKSHOP_AUTH_DIR` |

New commands are recorded before their compatibility event is materialized in
one of the original logs. A restart/retry replays the exact validated payload
and timestamp; repeated IDs do not create duplicate decisions. Back up all
three histories together while writes are stopped. Do not copy session cookies
or `sessions.json` to a new machine; configure its own login. The owner hash and
handoff credential are private configuration, never repository artifacts.

Vite dev, Vite preview and standalone Node use the same service. Standalone
feedback/auth directories default beneath `DATA_DIR`; specific overrides win.
Static `dist/` hosting alone cannot save feedback. A fresh clone contains the
public art/catalogue/manifest but no owner account or private history.

| Endpoint under `/tilefun/api/` | Method | Result |
| --- | --- | --- |
| `auth/session` | GET | Configured/authenticated state; owner and CSRF token when signed in |
| `auth/login` | POST | `{username,password}`; sets session cookie |
| `auth/logout` | POST | Revokes the current session |
| `art-notes` | GET / POST | Existing latest-thread read / append ArtNote compatibility schema |
| `interior-review` | GET / POST | Existing latest-case read (without screenshots) / append ReviewFeedback schema |
| `workshop/manifest` | GET | Tool/batch/candidate registry plus input-current flag |
| `workshop/inbox` | GET | Candidate states and unresolved source/report threads |
| `workshop/activity?offset=0&limit=50` | GET | History events, total and next offset; limit max 200 |
| `workshop/threads/:id` | GET | Full history and discussion; IDs `art:<threadId>` / `interior:<caseId>` |
| `workshop/events` | POST | Idempotent source note, exact review or reply/status command |

The command union is defined in `src/workshop/WorkshopTypes.ts`. New command
identity/time comes from the server; compatibility imports retain original IDs
and times. Login failures/expired sessions return 401, CSRF/origin failures 403,
conflicting retries/stale appearances 409. Trusted local CLIs use files directly:

```sh
npm run workshop:inbox
npm run workshop:inbox -- --json
npm run art:notes -- --status=all
```

## Adding review work

`ToolRegistry.ts` defines tools and city batches. `ReviewCandidates.ts` derives
city cases from actual recipes; `InteriorCandidates.ts` derives room/movement
cases from existing fixtures. The legacy/native city canvas hash and room
render/fingerprint helpers are shared. District approval previews draw chunk
caches at native size with deterministic pixel shadows. This avoids GPU versus
headless differences in nearest-neighbor overscan and ellipse antialiasing.
Gameplay retains its existing overscan and smooth shadows; review uses explicit
options on the same renderers. Normal Chromium at retina scale is included in
the browser regression tests, alongside the default headless-shell. A real
headless Chromium pass builds `public/data/workshop-manifest.json`, including every candidate before it has
received feedback. It contains public definitions and identities, never notes,
passwords or approvals.

```sh
npm run art:catalog
npm run workshop:manifest
npm run build
```

Manifest generation needs the project Playwright Chromium (`npx playwright
install chromium`) and committed runtime art, not the ignored original packs.
Build and API checks detect changed inputs. A stale registry disables judgments
and shows candidates as unchecked until regeneration. New rendered
fingerprints preserve matching approvals and reopen only changed appearances.

See [the implementation plan](tactical/008-tilefun-workshop-plan.md) and
[setup/data portability](setup-and-local-data.md). Future city art remains governed
by [the dense-city plan](tactical/007-dense-city-districts-and-street-life-plan.md),
including frozen regional-v4 assets.

The current district review and its Explore / play link use `regional-v5`
(seed 2026, tile 300,519), with continuous pavement from the visible door/step
thresholds to the street sidewalks, including secondary condo and butcher doors.
Door thresholds are audited against the pinned source frames; player interaction
offsets are not used as the paving edge. V4 remains unchanged for saved worlds and
the default for new worlds; v5 is selectable as **Connected entrances (v5, review)**
while awaiting human review. The Workshop handoff is generated from the actual
candidate descriptor and center. Agent replies to the original note do not
approve the changed district pixels.

The native Outdoor assets tool (`#/tool/outdoor`) browses committed semantic
catalog/coverage outputs and shared human metadata proposals. Workshop events
add two authenticated variants alongside source/review/reply:

- `asset`: source rectangle/fingerprint, catalog revision, exact metadata,
  verdict (`note`, `approved`, `changes`) and comment. Saved as an `ArtNote`
  `assetAnnotation`, with immutable original decision time and metadata hash.
- `scene`: whole-neighborhood candidate/fingerprint, world-pixel rectangle,
  feature IDs, up to twelve exact asset suggestions and a comment. The server
  derives generation, seed and world bounds from the registered scene and
  validates the selection and source/metadata revisions. Saved as an `ArtNote`
  `sceneAnnotation`; it is not a source-sheet selection or an approval.

These use the existing append-only Workshop command log and art inbox, restart
replay, idempotent event IDs, owner login/CSRF, browser drafts and outbox. They
appear in Requests, Activity and full thread history, and `npm run art:notes`
prints their metadata/world targets for agent consumption. Shared annotations
remain ignored local state; the public catalog contains committed definitions.
