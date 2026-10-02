# Tilefun Workshop

Status: implemented and deployed, 2026-10-02.

## Goal and first release

Make the existing art, generation and review tools one discoverable workspace.
The home screen must reveal newly available and changed review candidates even
when nobody has opened them or left feedback. Keep the build → review → comment
→ approve loop, exact appearance approvals, two-report pause, saved drafts and
existing bookmarks. The public game remains accessible; authoring writes require
an owner login enforced on the server.

The first release includes the complete tool inventory, global review inbox,
request inbox, activity and full thread history, authentication, common navigation,
source-art annotation, and unified review of buildings, roads, street props,
districts and interiors. Existing editing, movement and exploration controllers
are integrated through an isolated tool adapter inside the same workspace. Their
canvas/event-loop ownership stays intact; generation and rendering are not
reimplemented. Old HTML URLs continue to work and link to the Workshop.

## Stack and ownership

- React and strict TypeScript for the Workshop shell, source browser, review,
  inbox, history and login components; retain Vite.
- React Router for bookmarkable workspace/tool/batch/case URLs and browser history.
- Zustand for workspace preferences, per-batch navigation/pause, drafts and
  a durable offline event outbox. Do not treat it as the server database.
- TanStack Query for authenticated server reads, mutations and invalidation.
- Existing TypeScript factories, generators, renderers, source indexes and
  feedback parsers remain the authority for art and gameplay.
- Keep append-only NDJSON feedback. A common service adapts both existing stores;
  no SQLite migration is required for this release.

## Registry and exact appearance

Register every tool and review batch centrally. Derive candidate identities and
composition from existing definitions, not copied UI lists. Generate a checked-in
manifest using the real offscreen browser renderers. It includes case identity,
source/composition/pixel fingerprints and deep links. Verify its input digest at
build time and when serving the inbox; stale identities must not be represented
as current approvals. Regenerate with a deterministic CLI when candidate inputs
change. No generated approvals or live test feedback.

Review state and request status are separate. An agent resolving a request is not
an approval. A changed candidate returns to unchecked; existing judgments and
historical source selections remain inspectable. A known older judgment makes a
candidate "changed"; absence of a judgment makes it "unchecked". Register available
batches even with zero events. Unsupported/excluded cases are listed separately
from reviewable cases. World explorer's browser-local judgments must be explicitly
labeled; they are not silently promoted into shared approvals.

## API

Existing compatibility endpoints retain their payloads and append semantics:

- GET/POST `/tilefun/api/art-notes`
- GET/POST `/tilefun/api/interior-review`

Add:

- GET `/tilefun/api/auth/session`; POST `/login`, `/logout` under the same prefix.
- GET `/tilefun/api/workshop/manifest`, `/inbox`, `/activity`.
- GET `/tilefun/api/workshop/threads/:id` for full history.
- POST `/tilefun/api/workshop/events` for authenticated comments, judgments,
  replies and request status updates, with event IDs for idempotent retries.

Serve the same handlers from Vite development, preview and standalone Node.
Use shared runtime validation, bound request sizes, safe thread identifiers and
server-authoritative identity/time for new commands. Preserve historical IDs and
timestamps during compatibility writes and trusted local CLI operations.

## Login and deployment

One owner account, no public registration. Store a salted password hash in private
configuration, never Git. Provide a local setup/reset CLI, generate a private
initial credential if necessary, and document its location. Sessions use random
opaque tokens, expiry and server-side revocation with an HttpOnly cookie; use
Secure on HTTPS and SameSite. Protect mutations with a session CSRF token and
same-origin checks. Rate-limit login attempts. Session secrets never enter URLs
or browser Local Storage. Missing configuration fails closed for private APIs.

Both legacy and Workshop writes must authenticate; protecting only the new UI
would leave a bypass. Private feedback reads also require login. Public art and
game rendering can remain accessible. A 401 must retain pending submissions and
show a sign-in action, then retry after login. Trusted local CLI access remains
filesystem-based. Do not turn a game admin token into a Workshop password.

The live deployment is the existing `tilefun.graehlarts.com` origin. Local tests
use isolated data/auth directories and Playwright Chromium. Configure and verify
this deployment without writing test notes to the human inbox.

## Implementation slices

1. Record this plan; implement registry, manifest generation and unified read model.
2. Share both feedback services across hosts, add login/session protection and CLI.
3. Build React Workshop inbox, navigation, activity/history and integrated tools.
4. Implement shared native review and source annotation; preserve old drafts,
   outboxes and navigation, and integrate existing editors/playtest/explorer.
5. Validate API/auth boundaries, preserved judgments, unseen/changed discovery,
   offline/session-expiry recovery, phone navigation and shared render parity.
   Run typecheck, unit tests, formatting, production build and browser suite.
6. Commit meaningful slices, configure the live owner login, verify live read-only
   behavior and deliver the central review URL. Update this document with results.

## Later work

Return to rounded road corners/curves, islands, divided intersections and curb
ramps, with new batches automatically discoverable in the Workshop. Then resume
city furnishing, parking and public-space phases from tactical 007. Multiple
accounts/roles, SQLite indexing, push notifications and deeper editor-controller
componentization are follow-on work, not prerequisites for this release.


## Delivered checkpoint

Implementation commit: `595da66`.

- Shared React workspace with 14 tools, 21 batches and 301 registered candidates:
  31 buildings/blocks, nine roads, six street cases, three real districts,
  241 room cases and 11 movement configurations. No compiler exclusions.
- Native source annotations and exact render review, global requests, activity,
  full history/replies, independent pause/queues, previous/next/jump, room pins,
  retained drafts/intent, and native/legacy retry outboxes.
- Owner login protects new and old APIs on Vite dev/preview and standalone Node.
  Private runtime files are denied through Vite's source/file access, including
  encoded and symlink paths. Missing owner configuration fails closed.
- Editors and explorer retain their functional controls through same-origin
  adapters. Existing bookmarks, IDs and historical decisions remain compatible.
- Setup, API, backups and registry generation are documented in
  [Workshop usage and operations](../tilefun-workshop.md). A trusted local
  `npm run workshop:inbox` reads the same combined projection.

Validation: all three typechecks, 1,101 unit tests, production build and Biome
(no errors, 74 pre-existing warnings). The final full browser suite covers
194 tests, including standalone login/compatibility routes, phone controls,
exact rendered identities, unseen/changed discovery, independent pause/reopen,
source requests/replies, legacy draft/pin/outbox import, and expiry/offline retries.
Command replay is tested after removing materialized compatibility rows to
simulate an interrupted write, preserving exact timestamps and verdicts.

Live HTTPS login/logout and phone inbox, district and full-sheet annotation
views were checked using isolated Playwright Chromium. Private paths returned
403, anonymous feedback access returned 401, and cookies were Secure/HttpOnly.
Both human review histories remained byte-size unchanged during the read-only
checks. All 31 building approvals and all nine road approvals are preserved;
three neighborhood views and six street starter cases remain unchecked. No
live test notes or human approvals were created. Owner credentials remain in
private ignored configuration; sessions and passwords are not committed.

Next checkpoint: human Workshop/navigation review and the three dense-neighborhood
views, then a new road batch for curves, islands and divided intersections.
Keep regional-v4 and its promoted assets frozen; new output requires a new
revision/bank. Continue the city furnishing/parking/park phases after those
foundations have been reviewed.
