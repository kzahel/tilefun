# Furniture playtest presentation host

Status: complete; identified interactive presentation migrations delivered.
Date: 2026-10-04.
Owner: [Embedded engine labs](../topics/embedded-engine-labs.md).

## Scope and contracts

Replace the furniture playtest's private 120 Hz accumulator, manual sprite item and
native room drawing with the existing scenario presentation host. Keep placement,
path planning, physics controls, offline reporting and exact static approval renders.

- `presentInterior` prepares/submits cached room geometry and ordered actors for both
  gameplay and the lab. Actors come from `collectScene`, including support depth and
  production shadows; furniture colliders remain available when their prop sprites
  are excluded from the actor pass.
- `ScenarioPresentationHost` owns the Worker, production 60 Hz clock, prediction
  interpolation, frame storage, room cache, renderer and assets. Indoor scenes omit
  outdoor terrain/grass/surface passes. Diagnostic Canvas UI is drawn only after
  backend-owned world presentation. Fixed-room framing can request jump headroom
  from the same interpolated pose used for the actor.
- Scene/physics/placement changes dispose the old session; CSS resizing retains it.
  Renderer query parameters survive scene selection. Borrowed atlas/player images
  remain usable across resets. The host handles hidden-page stop/resume.
- Report capture renders the current pose without stepping authority and combines
  GPU world plus diagnostic UI. Review buttons remain disabled while a replacement
  session starts or a report is being prepared, preventing dropped review clicks.
- `drawFurnishedInterior`, immutable image fixtures and static approval renderer
  remain unchanged. Live motion signatures gain `presentationVersion: 1` because
  timing and actor presentation changed. The eleven movement cases reopen for
  human review, with historical screenshots/verdicts preserved.

## Validation

- Typechecks passed; 1,481 unit tests passed across 172 files.
- Repository lint/check passed with existing warnings; changed TypeScript files
  pass without diagnostics.
- `art:catalog`, `workshop:manifest` and production build passed. All 553 candidates
  verified in normal Chromium at retina scale. Exactly eleven motion identities
  changed; the other 542 candidate records are byte-for-byte unchanged.
- All 19 focused furniture browser tests passed. Coverage includes all eleven
  automatic walks, collision, jumping/support, opaque-pixel hit testing/placement,
  offline report/approval flows, Canvas/GPU room capture, renderer query retention,
  resize alignment and Worker/GPU cleanup. Full Chromium captures were visually
  inspected for both backends. The existing review-click regression exposed and
  verified the readiness/button fix during this migration.
- Streaming readiness passed all six scenarios, with zero final missing,
  incomplete or stale chunks. This is functional readiness evidence, not a
  comparative frame-pacing measurement.
- Full browser run: 318 passed; one existing Outdoor Geometry GPU test raced
  `ResizeObserver` immediately after viewport resize. Both modes passed all six
  unmodified repeat runs. The test now polls the same overflow/alignment conditions
  through the normal assertion deadline; all six final repeat runs passed. No
  production resize change was needed. Final typechecks and repository check passed.

## Next

The identified interactive migrations are complete. Measure matched Traffic/game
scenes on one device/backend to return to the original frame-rate concern; shared
architecture and functional tests do not establish frame-pacing improvements.
