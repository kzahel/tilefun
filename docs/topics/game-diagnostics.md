# Automatic game diagnostics

Topic: game-diagnostics
Status: automatic fault intake, durable browser outbox, local authority watchdog and owner inbox delivered; synthetic crash/hang/reload and streaming validation complete.
Updated: 2026-10-17.

Owns fault collection, delivery, retention, access and hang detection. The original
intermittent map/streaming report remains unreproduced; see the
[recovery investigation](../research/local-server-recovery-investigation.md).
[095](../tactical/095-game-fault-reports.md) records implementation and validation.

## Live development freeze (2026-10-17)

During a Chromebook play session, the live development tab retained a stopped
Worker transport while client prediction/rendering continued and no fault was
reported. The Vite service log showed `playwright-report/index.html` reload events
at the failure checkpoint. Vite broadcasts `vite:beforeFullReload` before checking
whether an HTML path matches the current page; our handler unconditionally shut
down the authority even when Vite then left the game page open. This is an
intentional lifecycle shutdown, so the hang watchdog had already been cleared.

The handler now applies Vite's current-page HTML matching before saving/shutting
down. The dev watcher also excludes `playwright-report` and `test-results`.
A bounded check against the running Vite service kept the same page and advancing
replicated ticks (32 → 93 → 154) after an unrelated Workshop HTML update and a
test-report write; touching game code then performed a real reload with healthy
authority. Typechecks and focused lint passed. The broad browser suite was stopped
at the user's request in favor of live iteration. This fixes the identified
development reload path; it does not establish a cause for independent
production/storage stalls. The user switched to the static
GitHub Pages build during inspection, where authority ticks and chunk residency
were healthy. Live debugging uses the existing device via Machine Control's
ChromeOS native CDP route; private device details stay outside the repository.

## Collection and recovery

The normal game enables reports automatically. Fatal errors preserve their stack;
map/travel and other typed RPC timeouts retain the request type. Worker probes
run every five seconds and retain a bounded authority/residency summary. Two
cumulative chunk persistence failures trigger one report per Worker instance.

A visible, running local Worker with no probe reply or no simulation tick progress
for 30 seconds is terminated and shows the existing error screen with Reload.
Hidden pages, startup and intentional shutdown are exempt; returning to visibility
starts a fresh window. A main-thread sampling gap over ten seconds also resets
the window because OS suspension cannot prove Worker failure. Probes bypass the
ordered gameplay channel so backpressure can be distinguished from an absent
executor. During active play the existing channel bound may fail first; that
fatal queue error is also reported. There is no automatic authority restart or
claim of recovering unacknowledged saves. Browser record stores allow up to five
seconds for an existing writer lock to release during reload, then reject the
competing authority. This grace period never steals the lock. A healthy Worker
with one unresolved
storage/arrival promise may instead produce an RPC timeout; this does not kill it.

Reports whitelist build ID, browser user agent, world ID/generation descriptor,
position, last replicated tick, visibility, original message/stack, the latest
Worker summary and 24 recent typed request names/timestamps. They do not capture
request arguments, player profiles, commands, authentication data, screenshots,
audio or saved world contents. Error strings/stacks are diagnostic text, not
trusted identity. No routine frame-by-frame or player-activity uploads occur.

A page captures at most eight distinct faults and suppresses repeated kind/message
pairs. Up to eight pending reports live in Local Storage `tilefun.fault-outbox.v1`;
a full queue drops its oldest report. Persistence happens before upload. Retries
run at startup, online, pagehide and every minute, with an eight-second HTTP deadline.
Only a matching UUID acknowledgment removes a report; retries are idempotent.
Storage denial keeps an in-memory copy and still attempts delivery. Clearing site
data removes unsent reports. Reporting failures never throw into gameplay.

## Backend and owner review

Vite dev/preview and standalone share `FaultReportsService` via WorkshopService.
Static-only hosting cannot receive reports. Intake needs same-origin JSON and an
Origin header; it does not require player login or send cookies. Requests are at
most 32,000 bytes. Socket-peer limits are ten attempts/minute, global sixty/minute;
forwarded addresses do not bypass limits and limits reset on server restart.

Records live in `WORKSHOP_DATA_DIR/fault-reports/<UUID>.json` (default
`data/workshop/fault-reports`). The inbox holds at most 500 records; full intake
rejects uploads and devices retain their bounded queues. Files are private local
state, never committed or included in static assets. There is no automatic expiry;
the owner can remove reviewed records.

- Public `POST /tilefun/api/fault-reports`: validated, whitelisted, serialized atomic writes and UUID acknowledgment.
- Owner `GET /tilefun/api/fault-reports?offset=0`: 30 metadata entries per page.
- Owner `GET /tilefun/api/fault-reports/:id`: full diagnostic detail.
- Owner + CSRF `DELETE /tilefun/api/fault-reports/:id`: permanent deletion.

[Workshop → Game diagnostics](https://tilefun.graehlarts.com/tilefun/workshop.html#/diagnostics)
provides refresh, pagination, full detail and deletion. Deployment needs the updated
client assets and the Workshop API process; an old server/static-only site leaves
reports pending rather than claiming delivery.

Next evidence: capture the original device failure and use its build, stack,
request history, tick progress and residency counts to choose a reproduction.
Synthetic failures validate collection/recovery, not the original cause.

Validation: 2,290 unit tests, typechecks, lint and production build pass. The final 12 fault/Worker/map/standalone browser checks pass; two unchanged interaction assertions that failed once in the broad run pass three serial repeats each. All six streaming stages have zero missing-data and incomplete-cache frames. [095](../tactical/095-game-fault-reports.md) records the broad-run limits and recovery evidence.
