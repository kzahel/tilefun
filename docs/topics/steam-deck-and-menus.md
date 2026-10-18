# Steam Deck and controller menus

Topic: steam-deck-and-menus
Status: implemented and accepted on the physical Deck; hands-on playtesting next.
Updated: 2026-10-18.

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
- A jump/confirm; B back; X throw/siren; Y interact; RT sprint; RB horn; LB build/play;
  View map; Menu pause. In editing, Y opens controller tools, left stick pans,
  right stick positions the cursor, RT places/paints and LT erases.
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
the renderer sandbox remain enabled. Development labs and external workshop
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

The physical Deck passed GPU startup, offline reload with external traffic blocked,
save persistence through upgrades, save-failure recovery, normal quit and real
public-signaling multiplayer in both host/guest directions. The full browser run
passed 699 tests; its five failures were resolved and verified in focused reruns.
All 2,856 unit tests, typechecks, lint, production inventory/build checks and the
streaming readiness assertion passed. See the tactical for evidence boundaries.

Next: play a parent/child session using the physical controls to assess focus
travel, text entry, editor aiming and menu wording. Automated standard-gamepad
snapshots cover behavior; physical button feel has not been manually evaluated.

[139](../tactical/139-steam-deck-package-and-controller-menus.md) owns execution and evidence.
