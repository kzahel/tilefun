# 140 — Shared input UX and reverse driving

Owning topics: [Steam Deck and menus](../topics/steam-deck-and-menus.md),
[touch movement](../topics/touch-movement.md), [vehicles](../topics/vehicles.md).
Status: complete — shared UX validated in browsers and on the physical Deck.

## Owner feedback and audit

The Deck trial exposed a right-stick editor cursor that could paint the world but
could not select DOM tools. The map's existing pinch math used only PointerEvents;
the gesture had no native TouchEvent path or continuous two-to-one finger handoff.
Canvas buttons used A/B/R labels unrelated to the connected pad, and emergency
vehicles silently reused Jump/Throw for style/siren. Interaction prompts always
advertised E. Cars had directional forward driving but no held reverse action.

The Deck is a proving ground for one shared web/game UX. No packaged-only input
mapping, renderer, vehicle simulation or menu fork is introduced.

## Delivery contract

- One viewport cursor reaches DOM tools and the editor canvas. Right stick moves;
  A or RT selects. Selection consumes the hold until release. World edits stop
  over UI, scrollable palettes auto-scroll at their edges, mouse movement reclaims
  the pointer, and D-pad/Y focus navigation remains available. D-pad navigation
  reclaims A from the previous pointer target; keyboard and real pointer input
  also release the virtual cursor.
- The same pointer reaches map toolbar buttons and selects a map point. Explicit
  Travel to selected point uses that target, or the center if no point is selected.
- Map touch uses native contacts independently of mouse/pen pointer capture.
  Pointer-only browsers retain the original contact path. Two fingers pan and zoom
  together; lifting one continues panning without arming travel. Cancellation/focus loss clears contacts and travel holds.
- Named action paddles replace misleading A/B/R labels. Hints follow the most
  recently used keyboard, controller or touch input. Fast stays in a fixed slot;
  Jump and Throw keep their meanings. Interact always enters/exits/uses a nearby
  object. Context prompts share the same Y/E hint and avoid the action paddles.
- Lights use L / D-pad Up; style uses K / D-pad Right; Horn remains H / RB.
  Emergency actions no longer borrow Jump/Throw. Shared Traffic inspection keys
  follow those same meanings.
- Reverse uses a held paddle, R or LT. Without steering it backs along the current
  nose; directional input steers the nose while backing. Reverse is half base
  speed without boost, uses normal acceleration/braking/collision/push/roof checks,
  and runs through the same binary input, authority and prediction as forward.
  Replicated sprite facing orients GPU meshes and signed backward wheel travel;
  no extra renderer-owned vehicle physics or durable gear state is introduced.

## Validation and remaining work

The audit also found Steam converting the game's physical touchscreen contacts to
one emulated mouse click. Gamescope exposes the native touch device but Chromium
reports zero maximum contacts. The launcher enables TouchEvents. The shell watches
Gamescope focus and Steam policy notifications, requests native passthrough only
for its own process's focused app, and restores Steam's current policy on blur or
quit. No durable Steam configuration or shared game mapping is changed.

- Typechecks and all 291 unit files / 2,876 tests passed. Additional bounded shell
  tests cover own-app focus, late Steam policy updates, restoration and non-X11
  platforms. Lint retains only the existing 119 warnings / 34 infos.
- Production inventory/build checks passed; all 880 Workshop candidate identities
  remain unchanged. Focused browser checks passed after correcting test expectations
  for touch hints and CDP finger-release semantics.
- Streaming readiness passed with the shared execution/prediction path.
- The physical Deck package reports GPU/device ready. Scripted standard Gamepad API
  snapshots selected Entities with RT and Vehicles with A using the right-stick
  pointer, including LT activation before moving the stick.
- A temporary Linux uinput touchscreen sent real native contact events through
  Gamescope/Xwayland/Chromium. With the automatic shell policy, the map received
  two contacts, changed zoom from 1 to 1.823 while panning, then continued with one
  finger. The temporary device was removed. This checks the native delivery path,
  not a human finger trial or just DOM/CDP gesture emulation.
- Scripted LT reversed a placed compact car about 53 world pixels with its nose
  unchanged, then release braked to zero. The interaction prompt showed Get out / Y.
  Candidate save/quit used normal WM_DELETE_WINDOW and the authority flush handshake.

The full 714-case browser run completed with 709 passes. Four warning-beacon
checks still sent the retired B shortcut; these now use L and assert that Jump,
Throw and style do not alter warning lights. The standalone Workshop freshness
check encountered the older build after final source edits. All five passed
against the coherent final build. The final focused run passed its other 15
checks; its cursor test driver was then corrected to ease toward small targets
on slower GPU frames, and the entire cursor/tool/map/focus scenario passed three
consecutive runs. Final typechecks, all 2,876 units, two shell tests, lint,
inventory/build checks and streaming readiness are green.

The normal launcher is restored after isolated acceptance; final delivery is
packaged from the clean commit and installed through machine-control. Next is an
owner editing/driving/map trial to tune cursor feel and paddle placement in the
same shared web UI. Automated pad snapshots and native contact injection do not
establish physical button/finger feel or child usability.
