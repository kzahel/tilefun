# Play ideas

Topic: play-ideas
Status: delivered and automatically validated; real-device speech trial next.
Updated: 2026-10-03.

Owns child-friendly gameplay suggestions and their private Workshop inbox.
The delivery plan and test evidence live in [Tactical 016](../tactical/016-play-ideas.md).
The proposed extension into companion and builder-agent sessions lives in
[Voice agents](voice-agents.md); current submissions remain feedback only.

## Experience and contracts

- Game hamburger menu → **💡 Idea**. Capture a downscaled game canvas PNG and
  world/realm, generation descriptor, player coordinates, capture time and build
  identifier when that menu opens. This is a game image, not desktop capture.
- Enable microphone separately, then hold the large button (pointer or Space /
  Enter) and speak after the chime. Release stops listening and waits for final
  recognition results. Pointer drift remains captured; cancellation, focus loss,
  hidden page and closing stop recognition. Recording is limited to 60 seconds;
  finalization times out after six seconds. Interim words cannot be sent.
- Tap the transcript bubble to hear the exact submitted text via browser speech
  synthesis. Try again replaces the words. Language defaults to the browser's;
  English and German choices are provided. Typing remains available when speech
  is unsupported or permission is denied. Opening the modal pauses local game
  input and lowers game audio; it does not pause other multiplayer participants.
- No audio files or streams are retained/uploaded by Tilefun. Browser recognition
  can use its provider's online service. Recognition availability, child speech
  accuracy and available voices depend on the device/browser.
- Anonymous players can submit. Only authenticated Workshop owners (or existing
  direct-local access) can list, read, change status or delete ideas. Suggestions
  do not count as art reviews, approvals or instructions to implement changes.

## Storage and delivery

Text is bounded to 2,000 characters; the attached PNG to 640 pixels per side and
500,000 data-URL characters. Input is whitelisted server-side. Submissions need
same-origin JSON with an Origin header. Limits are ten attempts/minute per socket
peer and sixty/minute overall; reverse-proxy clients share the socket-peer limit.
Forwarded addresses are not trusted for rate limiting. Limits reset on restart.
The inbox holds at most 500 ideas; the owner can delete old items to make space.

One unfinished text/picture draft is retained in Local Storage under
`tilefun.idea-draft.v1`. Up to eight submitted, unsent ideas live in IndexedDB
`tilefun-play-ideas-v1`, store `ideas`. The game retries at startup, on reconnect,
every minute while open, and through **Retry sending saved ideas**. Server
acknowledgment must match the original UUID before the local copy is removed.
Saved-on-device and sent messages are distinct. If device storage fails, Send
attempts direct upload and retains the open draft until acknowledgment. Browser storage is not a server
backup; clearing site data removes unsent ideas. Storage failures remain visible.

Server records live in `WORKSHOP_DATA_DIR/play-ideas/<UUID>.json`, defaulting to
`data/workshop/play-ideas/`. Standalone honors the existing `DATA_DIR` fallback.
Writes are serialized and replace files atomically. Repeated identical IDs are
idempotent; changed payloads conflict. Status is New / Planned / Done. Deleting
removes the text and image file permanently. Back up this directory while writes
are stopped, separately from owner/session credentials. No play ideas belong in
Git. Vite's existing private directory protection covers these files.

## Interfaces and next evidence

- `POST /tilefun/api/play-ideas`: public bounded submission; no login required.
- `GET /tilefun/api/play-ideas?offset=0`: owner-only metadata, 30 per page.
- `GET /tilefun/api/play-ideas/:id`: owner-only text, context and image.
- `PATCH /tilefun/api/play-ideas/:id`: owner + CSRF; `{ "status": "planned" }`.
- `DELETE /tilefun/api/play-ideas/:id`: owner + CSRF, permanent deletion.

Dev, preview and standalone share the service; static-only hosting cannot save
ideas. The Workshop page is
[Play ideas](https://tilefun.graehlarts.com/tilefun/workshop.html#/play-ideas).
`VITE_BUILD_ID` can label a deployment; otherwise Vite supplies its start/build
UTC timestamp. Context is player-supplied diagnostic evidence, not trusted identity.

Next: try holding, releasing and readback with the child's actual device and
speech. Automated speech doubles establish UI/lifecycle behavior, not recognition
quality or browser-provider availability.
