# Play ideas: speech, readback and context

Status: delivered and validated. Requested 2026-10-03.
Continuing owner: [Play ideas](../topics/play-ideas.md).

## Agreed experience

The game hamburger menu gains **💡 Idea**. Capture the game canvas and
world/player context when that menu opens. A large microphone control uses
**hold to speak, release to finish**, then displays the recognized words in a
large tappable bubble. Tapping reads those exact words through browser speech
synthesis. Try again replaces the message; Send submits it and returns to play.
No original audio is recorded, retained or uploaded by Tilefun. The browser's
speech provider may process audio remotely.

First-use microphone permission is a separate setup action. Show readiness,
listening, finalization and errors clearly; stop on cancellation, focus loss,
close and teardown. Support pointer capture and keyboard holds, keep game
input out of the dialog, and offer typed input when speech is unavailable.
Use the browser language initially, with an explicit language choice.

## Delivery

1. Implement bounded public text/PNG/context submission, idempotent retries,
   disk persistence under the existing private Workshop directory, same-origin
   checks, rate and capacity limits. Owner authentication continues to protect
   reads, status changes and deletion; no public inbox or player login.
2. Implement the game dialog, browser speech lifecycle, exact-text readback,
   screenshot capture, durable pending submission and retry after connectivity
   returns. Clearly distinguish local retention from server acknowledgment.
3. Add authenticated **Play ideas** to Workshop with screenshots, full text,
   context, New/Planned/Done status and deletion. Keep art approvals separate.
4. Add focused server and browser coverage for authorization, validation,
   speech lifecycle, input isolation, retries, capture and Workshop management.
5. Update owning documentation and run typecheck, unit tests, lint, generated
   inventories, build and the full Playwright suite. Commit the completed slice.

## Acceptance and limits

An anonymous player can submit an idea without exposing existing feedback;
the owner can review and manage it after a server restart. Retries retain their
ID and never duplicate a submission. Failed recognition cannot send interim
words as a finished idea. No MediaRecorder or audio upload is introduced.
Browser tests use deterministic speech doubles and bundled Chromium; actual
recognition quality, permissions and voices on the child's device still need
a human trial. Static-only hosting cannot receive ideas.

## Execution evidence

Implemented the shared public submission service, game modal and speech
controller, local draft/outbox, and authenticated Workshop page. Service data
uses the existing Workshop private root across dev, preview and standalone.

- Typecheck passed for client, server and Worker.
- Unit tests: 120 files, 1,216 tests passed, including five new API cases covering
  private reads/mutations, public submissions, origin/CSRF checks, validation,
  idempotence, restart persistence, rate limits and the 500-record capacity.
- Lint passed with existing repository warnings; the eleven new source/test
  files have no diagnostics. Build and generated inventories passed.
- Eight focused browser cases passed on the final implementation. They cover exact spoken readback, text/image-only submission, private owner
  management, offline reload/retry, permission denial, speech errors/interim
  results, early release, focus loss, storage failure and touch input.
- Visual QA exposed fullscreen top-layer ordering on mobile. The modal now
  reopens above the fullscreen root; touch tests check actual hit testing.
  Finished speech switches to transcript/Send/Try again so landscape controls
  stay visible. Final portrait/landscape screenshot QA passed, including the
  assertion that Send fits within the viewport.
- Full Playwright run: 254 passed, three Idea tests initially failed because
  they expected a disabled Send button after the layout refinement hid it until
  text exists. Updated those assertions to require Send to be hidden and reran
  all eight Idea cases: eight passed. No production changes followed the full
  run; all 257 browser cases are covered by that run plus the focused rerun.
  Bundled Chromium, isolated auth/data and existing approved visual references
  were used. The regenerated manifest changed only its input digest; candidate
  pixels and review identities were unchanged.

Remaining human evidence: actual child speech, browser-provider availability,
permission prompts and voices on the play device. This does not block the
implemented feature; no real-device speech accuracy is claimed by the mocks.
