# Steam Deck and controller menus

Topic: steam-deck-and-menus
Status: shared controller/touch UX and reverse driving delivered; hands-on tuning next.
Updated: 2026-10-21.

## Contextual gameplay actions

[171](../tactical/171-contextual-controller-actions.md) adds **B / Q / Actions**
for nearby vehicle equipment: attach/release, ride/climb out, cargo and tip/lower.
The focused menu uses D-pad/stick and A to select, B to return; keyboard uses
arrows, Enter and Escape. Y/E remains primary interaction (board/exit/talk).
Touch has separate right-side Interact and Actions paddles, above the existing
action cluster. The left-side status sits above the movement area.

The shared menu names one equipment target, preserves authority eligibility and
disabled actions, and closes on target/seat changes, editing, locks, blur and
page hiding. Gameplay input is neutral while open; closing requires a fresh pad
press. Normal game and embedded truck/towing hosts use the same VehicleControl
and ContextActions. Physical hints derive from the same semantic bindings the
input reader consumes. Primary actions require a standard-controller path;
secondary settings/views may remain in controller-accessible menus.


## Direction and ownership

Ship the ordinary Tilefun web engine inside a Linux x64 Electron application.
The Chromium runtime, GPU renderer, committed assets and local authority Worker
are bundled; single-player does not depend on the hosted site. Online P2P uses
the existing PeerJS/WebRTC transport and room directory. This is a Devkit install,
not a Steam storefront release or Deck Verified claim.

The shared menu follows the owner's Minecraft/mclone reference: a short home/pause
screen, separate Worlds, Create, Multiplayer, Character and Options screens, and
secondary tools under More. The existing browser sidebar remains available.
Controller focus, back, directional repeat, on-screen text entry and confirmations
are shared with keyboard/touch DOM controls. No synthetic keyboard mapping is used.

`desktop/` owns the shell. `scripts/build-desktop.mjs` stages and packages it;
`scripts/steam-deck.mjs` calls machine-control's common CLI. Machine-control owns
Devkit transport, registration and launch; this repository owns the payload,
saving, UI, gameplay and acceptance. Never put concrete private device selectors
or credentials in this repository.

## Contracts

- Secure standard origin `tilefun://app/tilefun/` and Electron's stable user-data
  directory preserve IndexedDB independently of the uploaded executable directory.
  Optional `TILEFUN_USER_DATA` isolates smoke-test saves. Browser saves are separate;
  automatic transfer and Steam Cloud are not implemented.
- Renderer sandbox, context isolation and disabled Node integration stay enabled.
  The preload exposes only save/quit handshake operations. External HTTP(S) links
  open outside the game; arbitrary external content cannot load into the game window.
- Hosting, joining and normal desktop quit await authoritative persistence.
  A save failure leaves the game open. Offline play retains the local Worker.
- Standard gamepad snapshots feed semantic gameplay/menu commands. One active
  source, radial dead zone, press edges and bounded UI repeat; neutral input is
  required after blur, reconnect and context changes to prevent action leakage.
- A jump/confirm; B contextual actions/back; X throw; Y interact; RT sprint; RB horn; LB build/play;
  View map; Menu pause. In editing, Y opens controller tools, left stick pans,
  right stick positions the cursor, RT places/paints and LT erases.
  The same screen cursor reaches DOM tools and map controls: A/RT selects, with
  UI holds consumed until release. Cars reverse automatically for rearward aim;
  Options also offers relative throttle/steering. LT/R remains a compatibility
  override. D-pad Up/L toggles vehicle
  lights and D-pad Right/K changes siren style. Jump/Throw retain their meanings.
  Named on-screen paddles and interaction prompts follow the last input source.
- Public invitation links use the hosted game URL, while entering a code/link
  keeps the current installation's origin. P2P needs internet signaling and
  suitable peer connectivity; no new TURN relay is provided.
- Optional `peerServer=http(s)://host:port/path` selects self-hosted signaling.
  Deterministic browser integration uses a local broker and real WebRTC.

## Build and install

```sh
npm ci
npm run desktop:build:linux
npm run deck:doctor
npm run deck:install
npm run deck:launch
```

The resulting `dist/desktop/Tilefun-linux-x64/` contains the game, runtime,
`run.sh` and build receipt. The Linux launcher selects X11 within Gamescope and
clears Steam’s `LD_PRELOAD` overlay injection; the default injected launch hung
Chromium before renderer startup on the measured Deck. GPU acceleration and
the renderer sandbox remain enabled. TouchEvents are explicitly enabled because
Xwayland reports zero maximum contacts despite exposing a native touch device.
The shell watches Gamescope's focus/Steam policy notifications and requests native
touch passthrough only for its own process's focused app. It restores Steam's
current touch policy on focus loss and quit; no durable Steam settings change.
Ordinary Linux desktops without Gamescope keep their native input policy.
Development labs and external workshop
links remain in the browser’s More/sidebar, outside the packaged play menu.
`deck:install` registers `Devkit Game: tilefun` in Gaming Mode without launching it.
`deck:launch` is explicit. The initial payload
uses native SteamOS userspace (`runtime: null`); compatibility beyond measured
hardware remains a separate release gate. For a local platform package use
`npm run desktop:build`.

`MACHINE_CONTROL_CLI` and `TILEFUN_DECK_TARGET` override local tool/target selection.
`TILEFUN_CDP_PORT` is an opt-in loopback debug endpoint for scripted acceptance;
it is absent from the normal launch manifest.

## Acceptance and next work

The packaged baseline passed GPU startup, offline reload with external traffic
blocked, persistence through upgrades, save-failure recovery, normal quit and
real public-signaling multiplayer in both host/guest directions; see 139.

[140](../tactical/140-shared-input-ux-and-reverse.md) delivers the owner's
cursor/tool, native map touch and action-label corrections plus reverse driving.
The physical package passed scripted tool selection, reverse/braking and native
Linux multi-touch delivery through Gamescope/Xwayland/Chromium. Final typechecks,
all 2,876 unit tests, two shell policy tests, lint, production inventories/build
and streaming readiness passed. The full 714-browser run had 709 passes; its five
failures were resolved and passed in focused reruns. The final cursor/focus
scenario passed three consecutive runs. All 880 Workshop identities are retained.

[144](../tactical/144-rolling-car-steering.md) adds shared rolling car turns:
no stationary pivot, opposite steering yaw in reverse and persistent nose bearings.

The Chromebook map regression uses observed native TouchEvents to choose the
contact owner, replacing any provisional touch pointer contact on the first
`touchstart`. It no longer relies on the legacy `ontouchstart` property: hybrid
Chromebooks can emit both event streams without exposing that property, causing
one finger to become a pinch and cancel hold-to-travel. Pointer-only stacks keep
the pointer fallback. Browser regression coverage removes the property on a
desktop touch context and checks first-contact hold travel, pinch, cancellation
and subsequent travel alongside the ordinary mobile path.

The map fix and configurable car controls share the current validation record in
[154](../tactical/154-car-controls-and-contact.md): all 5,744 unit tests and 87
distinct focused browser checks pass, along with typechecks, lint, inventories,
production build and streaming readiness. Final validation on 2026-10-20 passes
all 1,477 browser cases, including the aquatic-hunter assertion that stopped the
earlier map-only run.
The [vehicle topic](vehicles.md#configurable-controls-and-automatic-reverse)
records the driving controls and contact behavior.

Continue hands-on editing, driving and map trials to tune the shared web UI.
Automated standard-gamepad snapshots and native contact injection establish the
input path, not physical button/finger feel or child usability.

[139](../tactical/139-steam-deck-package-and-controller-menus.md) owns execution and evidence.
