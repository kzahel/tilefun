# Contextual controller actions

Owner authorized 2026-10-21. Implemented and validated; physical Steam Deck trial next.

Primary on-screen actions must support standard controllers, including Steam Deck;
secondary settings and views may live in reachable menus. The project AGENTS.md
now records this guardrail and routes to the Steam Deck topic.

## Delivered

- B / Q / touch Actions opens one focused contextual equipment menu.
- D-pad/stick navigates, A confirms and B closes. Keyboard uses arrows, Enter,
  Escape. Y/E retains primary interaction; A jump, X throw, RT fast, LT reverse,
  RB horn, LB build/play, D-pad lights/style and View/Menu remain unchanged.
- Tow Attach/Release and bed boarding, cargo and tipping share that menu. Existing
  authority eligibility/requests remain; moving/occupied/locked targets are guarded.
- Right-side primary/Actions paddles keep the movement area clear. Status remains
  above the left joystick. The dialog fits narrow/short screens and scrolls.
- Menu activation/cancel clears gameplay holds in GameClient, and the controller
  collector fences held inputs across menu changes. Blur, hiding, context/seat
  changes and authority locks close stale menus. Input stays neutral while open.
- Shared embedded truck/towing hosts use the same menu and canvas-relative controls.
  Scoped controller sampling avoids a second gamepad animation loop.
- Physical hints derive from semantic default keyboard/controller bindings.
  Capture runners and existing equipment browser checks use the real menu.

## Verification

Native input tests own semantic bindings, press edges and neutral/release fences.
One normal-game browser case owns DOM focus/routing, authoritative towing, held
steering suppression, primary Y boarding and phone touch/layout. Existing menu,
truck-bed and towing browser cases retain their separate boundaries.

Final validation (2026-10-21):

- All three typecheck targets pass. Lint passes with the existing 121 warnings
  and 42 infos; no new diagnostics. Whitespace checks pass.
- Full native run with two workers: 6,566 pass, five existing Windows environment
  failures, ten skips (6,581 cases; 943.52s). The existing failures are three
  FsSecurity symlink EPERMs, privateDataPlugin symlink EPERM and SqliteRecordStore
  process-death recovery; staticFiles also has its Windows symlink setup/cleanup
  errors. The separate Node comparator passes. Input-binding cases all pass.
- Eight focused browser checks pass. Full production browser run: 826 pass / four
  fail (830 unique cases, 39.5 minutes). Two screenshot writes hit ENOSPC; the
  unchanged Beetle and school-bus cases pass after deduplication. Canvas train
  startup travel passes unchanged serially. Standalone used an older default
  `dist`, while the suite preview used the isolated output. Refreshing the normal
  build fixes its login/render/vote check. All 830 unique cases pass across runs;
  no assertion or timeout was weakened.
- Normal and isolated production builds pass (final normal bundle 13.17s).
  The final normal-build pass runs B/Q/touch actions, towing, truck-bed lifecycle
  and strict standalone login/render/vote: four pass in 32.6s.
- Catalog: 710 sheets / 1,396 source uses. Manifest: 1,948 Chromium/retina
  identities, 135 exclusions. Migration inventory verifies 830 browser cases
  with all 403 historical decisions intact.

Local evidence: `data/vehicle-bake/context-validation.json`, the `context-*.log`
files beside it, and `data/3d-investigation/controller-actions/index.html` with
production-build phone HUD/menu screenshots. Every qualified source hash remains
unchanged after the final run. Generated evidence and build copies remain ignored.
The isolated build's 21,047 identical image copies were SHA256-verified and
atomically replaced with hard links, preserving every path and byte while
recovering 525,090,651 duplicate bytes; source assets were not rewritten.

Next: physical Deck/phone trials for thumb reach, focus feel and child usability.
No new vehicle art, formal appearance approval, physical-device acceptance or
deployment is claimed.
