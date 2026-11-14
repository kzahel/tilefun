# 252 — XR on the shared scene

Status: delivered 2026-11-14 for owner play, measured on a Quest 3 with nobody
wearing it. Comfort and the controller mapping still need a wearer
([owner checks](#owner-checks-on-the-headset)).
Slice 4 of [248](248-renderer-unification.md); delivers
[230](230-3d-cameras-stereo-and-webxr.md) slices 5 to 8.
Owners: [renderer unification](../topics/renderer-unification.md),
[rendering architecture](../topics/rendering-architecture.md).

Play in a headset through the one WebGL context: a floating screen, immersive
first person and a tabletop miniature, with the headset's controllers as seat
0's input device.

## Starting point

- The 3D scene draws first person, a chase camera and the top-down camera into
  regions of the page canvas, through the render host's own renderer (249).
- `GameLoop` runs from the page's animation frames. The earlier WebXR mode and
  its `XRSessionManager` were removed in 226; nothing in the client knew about a
  headset.
- Controllers reach the game as standard gamepads polled from a page animation
  frame (`ControllerInput`), pooled to seats by `LocalPlayers`.
- No headset measurement existed.

## What the Quest 3 does (spike, 2026-11-14)

A 100-line page, loaded in Quest Browser 156 over `adb reverse` and driven over
DevTools with nobody wearing the headset (`quest session` holds it awake):

- DevTools `Browser.setPermission` with the name `xr` lets an immersive session
  start from `Runtime.evaluate` with `userGesture`, without the browser's
  "open immersive experiences" prompt. Device runs can be scripted.
- The session grants `local-floor` and `layers`. A projection layer is one
  3,360 × 1,760 texture (1,680 × 1,760 an eye) with a depth texture; a quad
  layer is accepted beside it.
- Frames arrive every 11.1 ms (90 Hz); 72, 80, 90 and 120 are offered.
- The page's own animation frames stop during the session (23 in 4 s, all at
  the start). The document stays visible but **loses focus**.
- With the controllers asleep there are no input sources, and Touch controllers
  never appear in `navigator.getGamepads()`.
- The room's origin and forward (`local-floor`) are wherever the headset last
  set them, not where the wearer is when the session starts.

So the loop and the controller poll are driven from the session, the rules that
pause input when the page loses focus do not apply in a session, and everything
is placed from the session's first head pose.

## Design

- **Two outputs, one context** (`View3dHost.xr`, `GpuXr.ts`).
  - *Headset screen:* the page keeps drawing its canvas as usual (any view
    kind, split screen included) and the canvas is copied into a quad layer.
    The host owns this session's frame loop; three.js's XR manager is not used.
  - *Immersive:* three.js's XR manager presents the 3D scene through the head
    pose. The manager replaces the camera of every render while it is enabled,
    so it is enabled only around the immersive draw, and off again for the
    sun's map and for anything else the host draws.
- **The rig** (`XrRig.ts`). The view's camera hangs under a parent that places
  the headset's room in the world: a position, a heading and world pixels per
  metre. First person and tabletop differ only in that rig and in what is
  collected. The eyes' view space is in metres, so fog distances are too.
- **Frame driver** (`XrControl.ts`). While a session presents, its frame
  callback polls the controllers and calls `GameLoop.externalTick`; the page's
  loop is stopped and started again when the session ends. A frame that throws
  ends the session, so the headset is never left on a frozen picture.
- **Controllers** (`XrPad.ts`) become one virtual standard gamepad. Seat 0's
  pad pool (`LocalPlayers`) adds it, outside seat assignment, so it never asks
  to join a guest. Everything after that is the existing controller path.
- **Menus.** HTML is not visible in a session, so anything but play on top ends
  the session; the page's flat panel then shows the menu. The click on Resume
  is the user gesture that enters again.
- The fixed view is untouched. Nothing here changes simulation or replication.

## Delivered

Phases 4a, 4c and 4d share the session control and the rig and were committed
together; the controllers (4b) are in the same commit because seat 0's pad pool
also lists the menu's headset choices. The atlas fix below is its own commit.

### 4a — Session, frame driver and headset screen

- The world menu lists **Headset: first person**, **Headset: tabletop** and
  **Headset: screen** when the browser offers immersive sessions (the screen
  only with the `layers` feature). The console has `xr eye|tabletop|screen|off`
  and `xr_rate`. A session starts only from a user gesture.
- A session asks the headset for 72 Hz (`xr_rate`, 0 keeps the headset's own):
  see [the numbers](#quest-3-frame-pacing).
- Leaving play (menu, editor) ends the session and remembers the mode. Resume
  enters it again; the paused menu also lists **Headset: stay on this page**.
- The screen is 2.6 m wide, 2.2 m in front of the head as the session finds it
  and 0.1 m below it. It shows the world canvas, mono. The page's 2D overlay
  (markers, prompts, touch buttons) is a separate canvas and is not on it.
- The headset's own recentre moves the room's origin; the screen, the eye and
  the tabletop take their places again from the next pose.

### 4b — Controllers as seat 0's input device

| Control | In play |
| --- | --- |
| Left stick | Move, relative to where the head faces |
| Right stick, left or right | One 30° turn per flick: the player in first person, the table on a tabletop. On the screen it is the look stick, as on any pad |
| Right stick, up or down | Tabletop: scale the miniature |
| A | Jump |
| B | Menu: ends the session and opens the world menu on the page |
| X | Throw |
| Y | Enter a place |
| Right trigger | Sprint |
| Left trigger | Reverse a car |
| Right grip | Horn |
| Left stick press | Recover a vehicle |
| Left grip | Free (a pad's left bumper opens the editor, which a headset does not show) |

Source indices are WebXR's `xr-standard` layout (0 trigger, 1 grip, 3 stick
press, 4 lower face button, 5 upper face button; axes 2 and 3). The Quest's
menu button is not given to pages, which is why B pauses. Not checked on
hardware: the controllers were asleep in every device run.

### 4c — Immersive first person

- Both eyes draw through the shared renderer in one pass: one scene traversal,
  each object drawn once per eye.
- The head's resting place is the player's eye, seated or standing: the first
  pose is taken as the eye, and it follows a head that walks more than 0.6 m
  away. A metre is 18 world pixels, so a child's standing eye height (about
  1.1 m) is the player's (about 20 pixels).
- Movement and thrown things follow the head's heading. Cards turn to it and
  actors show the row seen from the head.
- One sun shadow map serves both eyes; it is drawn outside the eyes' cameras.
- Comfort rules:
  - turning is by 30° steps, never smooth;
  - pitch and roll are only the head's;
  - a driver's chase camera sits behind the vehicle along the room's heading
    and never swings with the head or the vehicle;
  - on foot the player walks at 60% of stick speed;
  - the room's height eases after the player's, so a jump does not move it.

### 4d — Tabletop

- The world is a miniature on a square table one metre wide, set 0.6 m in front
  of the head and 0.5 m below it when the session starts, north away from the
  player. A metre of table is 600 world pixels by default (250 to 2,000 with
  the right stick).
- The world is cut at the table's edge with clipping planes and stands on a
  base. There is no fog; the room around it is dark.
- The table follows the player once they are 30% of its half-width from the
  middle, gliding back over about half a second. A teleport or a door jumps.
- The player's own body is shown. What is drawn and streamed reaches the
  table's corners (`FirstPersonControl.reach`).

### The page atlas lost pages when it grew inside a session

Found on the Quest, not in the emulator: ground that streamed in during a
session turned black. The atlas grows by half when full and copies its old
layers into the new array. Inside a session on the Quest 3, every way of
reading the old array through a framebuffer returned it without the pages
written since the session began:

| Copy | Pages lost of 73 |
| --- | ---: |
| `copyTexSubImage3D` per layer, as three.js's texture copy does | 45 |
| The same after `gl.finish()` | 45 |
| `blitFramebuffer` per layer | 73 |
| Drawing each layer with a shader that samples the old array | 0 |

No GL error was reported, and reading single pixels back showed the pages
present before the copy. The cause in the browser or the driver was not found.
While a session presents, the atlas now grows by drawing its layers
(`GpuPageAtlas.drawLayers`). Outside a session the copy is unchanged: it had not
been seen to fail there, and the fixed view's path stays as it was.

## Quest 3 frame pacing

`scripts/first-person/xr-quest.mjs`, 10 s per cell, Vite development modules,
Medium view distance, headset lying on a desk. "Late" counts frames that came
more than one and a half intervals after the one before. Page work is the
session's whole frame callback: controller poll, game ticks and drawing. GPU is
the compositor's own figure for the app (`App=` in its log). Full cells:
[evidence](../benchmarks/252-quest-xr.json).

At 72 Hz, the default:

| Scene | Mode | Interval p50 / p95 / p99 ms | Late of frames | Page work p50 / p95 ms | Draws | GPU ms |
| --- | --- | --- | --- | --- | ---: | ---: |
| city | first person | 13.9 / 15.9 / 16.5 | 1 of 719 | 5.7 / 7.3 | 60 | 2.7 |
| city | tabletop | 13.8 / 15.9 / 16.6 | 0 of 721 | 5.1 / 6.6 | 68 | 2.2 |
| city | screen | 13.9 / 15.7 / 16.3 | 0 of 721 | 4.8 / 6.2 | — | 1.0 |
| woods | first person | 13.9 / 16.1 / 18.8 | 4 of 701 | 6.8 / 8.7 | 12 | 2.8 |
| woods | tabletop | 13.9 / 15.8 / 16.5 | 1 of 719 | 5.3 / 6.9 | 12 | 2.1 |
| woods | screen | 13.9 / 15.8 / 16.6 | 1 of 719 | 6.6 / 7.9 | — | 0.7 |

At the headset's own 90 Hz:

| Scene | Mode | Interval p50 / p95 / p99 ms | Late of frames | Page work p50 / p95 ms |
| --- | --- | --- | --- | --- |
| city | first person | 11.1 / 14.0 / 18.3 | 18 of 894 | 5.4 / 7.2 |
| city | tabletop | 11.1 / 13.1 / 17.9 | 9 of 887 | 4.5 / 6.0 |
| city | screen | 11.1 / 13.6 / 17.7 | 18 of 889 | 4.5 / 6.2 |
| woods | first person | 11.1 / 16.4 / 19.6 | 36 of 852 | 5.9 / 8.2 |
| woods | tabletop | 11.0 / 13.9 / 16.2 | 8 of 898 | 5.5 / 7.2 |
| woods | screen | 11.1 / 13.3 / 17.9 | 15 of 886 | 5.7 / 7.5 |

What this shows and does not show:

- 72 Hz holds in every mode. 90 Hz is late for 1 to 4% of frames in every mode,
  the screen included, so it is not the eyes' cost: the screen, which draws no
  eyes, takes 4.5 to 5.7 ms of page work a frame, and the compositor reports 8
  to 13 ms from frame start to submission against an 11.1 ms budget.
- The GPU is not the limit: 0.7 to 2.9 ms a frame, about a third of its time at
  most. The eyes are 1,680 × 1,760 each, without multisampling.
- **Stereo and draw calls.** First person on the headset's flat page draws 25
  calls in the city and 6 in the woods; in the headset it draws 60 and 12.
  Halving the city's calls with the Near view distance (60 → 34) changed page
  work from 4.9 to 4.7 ms and still left 6 late frames of 895 at 90 Hz.
  **Vehicle meshes are not batched in this slice:** draw calls are not what
  misses frames on this headset.
- A CPU profile of first person in the city found no hot function: 32% native
  browser work, 25% idle, and no script frame above 2%.
- Each woods first-person run had one stall of about 0.2 s (190 and 214 ms).
  Not investigated.
- These are development modules, as the phone's scorecard uses. A production
  build was not measured.
- Nobody wore the headset: no head movement, no controllers, and no judgement
  of comfort.

## Owner checks on the headset

Open the game in Quest Browser, then the world menu's **Headset** buttons. The
browser asks once to allow immersive experiences.

1. Controllers: every row of the mapping table, and that B returns to the menu.
2. First person: walking speed, the 30° turn, the eye's height and the world's
   size (18 pixels a metre), and how driving feels from behind the car.
3. Tabletop: where the table is set, its size, the scale stick, and the follow.
4. Screen: its size and distance.
5. Resume from the paused menu goes back into the headset.
6. 72 Hz against 90 Hz (`xr_rate 90`).

## Limits

- **No HUD in a session.** Prompts ("Drive car"), gems, markers and chat are
  HTML or the 2D overlay canvas. Immersive modes and the screen show the world
  only (230 defers the HUD).
- **Seat 0 only** in immersive modes; guests' views are not drawn. The screen
  shows the whole page, split screen included.
- **The emulator has no quad layers**, so the screen was run only on the Quest
  and checked by a headset picture. Browsers without the `layers` feature are
  not offered the screen.
- **No multisampling.** The shared context is created without it, so the eyes
  have hard edges. Changing that changes the fixed view's context too.
- On a tabletop, upright cards foreshorten when seen from above (230), a
  contact shadow that straddles the edge is not cut, and tall buildings at the
  near edge stand between the player and the table.
- A session that stays alive without frames (a tethered headset taken off)
  keeps the page's loop stopped until it ends.
- Phones are not offered the Headset buttons, by the browser's name for itself;
  what a phone's browser reports was not checked on one.
- Not exercised: rooms on a tabletop, doors and realm changes inside a session,
  graphics loss inside a session, a Bluetooth gamepad beside the controllers,
  headsets other than the Quest 3, and desktop browsers with a tethered headset.
- A pad's button press does not count as a user gesture, so Resume pressed with
  a pad returns to the page without entering the session; the menu's Headset
  buttons need a click from the controller's pointer.

## Independent review (2026-11-14)

A read-only review of both commits by a fresh agent with no part in the work
found no high-severity defect. Handling:

- **Fixed:**
  - The atlas's drawn growth covered immersive sessions only. A screen session
    does not go through three.js's manager, so it kept the copy that lost pages.
    The host now flags the atlas for any session.
  - `xr.mjs` and `xr-quest.mjs` recorded their results without checking them.
    Both now fail the run when the contract is broken, and the Quest run takes
    its immersive permission back.
  - The immersive draw left its clear colour on the renderer.
  - A remembered mode never expired: a click long after a menu was closed with
    a pad or Escape could start a session. It now lasts for one return to play.
  - The session switched seat 0's own first-person choice on and off, behind the
    console variable and Options that own it; pressing V in a session freed the
    scene and froze the headset. A session now holds the seat in the 3D scene
    without touching its choice (`FirstPersonControl.hold`).
  - A session whose output failed to start left three.js's idle loop running and
    could leave the renderer without a size.
  - The renderer was sized back to the page as it was when the session started,
    not as it is when it ends.
  - A client destroyed during a session was laid out and restarted by the
    session's late end; its window listeners were never removed.
  - A room without a floor put the tabletop above the head; streaming did not
    reach the table's far corner from a player standing off its middle.
  - A frame without a head pose drew with the last frame's eyes; a session that
    never drew anything was never ended.
- **Fixed without the device to confirm it:** a phone's browser can report
  immersive sessions (a cardboard viewer), which would have put Headset buttons
  in the world menu on phones. Menus now offer them only where the browser does
  not call itself Android or mobile; the console's `xr` still works anywhere.
  The Pixel 7a was not connected to check what its Chrome reports.
- **Documented, not changed:** a session that stays alive but stops sending
  frames (a tethered headset taken off) leaves the page's loop stopped until it
  ends. `GpuXr.ts` and `Headset.ts` have no test below the emulator run.

After the fixes the emulator run passes its checks and the three modes ran again
on the Quest in the city at 72 Hz with no late frame in 432 each.

## Validation

- Node: rig maths against three.js matrices, snap turn, anchor follow, table
  scale (`XrRig.test.ts`); controller mapping, the controller collector fed by
  it and the focus rule (`XrPad.test.ts`); the session control with a fake
  session and browser, covering the loop hand-over, pause and resume, a frame
  that throws, first-person and tabletop placement and recentre
  (`XrControl.test.ts`); seat assignment (`LocalPlayers.test.ts`); the view's
  headset camera, fog and table cut (`FirstPersonView.test.ts`); play's headset
  path (`firstPersonPlay.test.ts`).
- Browser, emulated headset: `node scripts/first-person/xr.mjs` runs Meta's
  WebXR emulator (IWER, a new development dependency) in bundled Chromium. It
  starts and ends first person and tabletop, walks with the left stick, snap
  turns, turns the head, checks the page's loop and sizes come back, pauses
  with B and resumes from the menu.
- Device: `scripts/first-person/xr-quest.mjs` inside a `quest session` lease
  from the machine-control checkout. It grants the run's origin the immersive
  permission through DevTools, in place of the wearer's answer to the prompt.
- Fixed view: its atlas and context-loss browser tests pass
  (`gpu-renderer.spec.ts`). `render:bench` on the Mac, this tree against the
  commit before it, two runs each, main-thread render p50 in the woods at zooms
  1 / 0.25 / 0.1: 1.1 / 1.2 / 2.2 and 1.0 / 1.1 / 2.2 ms against 1.1 / 1.2 / 2.2
  and 1.1 / 1.2 / 2.3 ms. City: 0.7 / 0.8 / 1.2 ms, no missed frame in any cell.
  First person at zoom 1: city 0.6 ms and 21 draws, woods 0.8 ms and 6 draws.
- A bench reading to know about: the woods cell at 0.1× reports GPU time of
  0.71 ms from a temporary copy of the tree and 0.86 to 0.88 ms from the working
  checkout, for the same code (the commit before this work and this tree both
  give 0.71 from a copy). 251's "before" and "after" fixed-view cells differ the
  same way. Compare GPU time only between runs from the same place.

## Scripts

```sh
node scripts/first-person/xr.mjs --out=/tmp/tilefun-xr
<machine-control>/platforms/quest/bin/quest session --reverse tcp:4197=tcp:4197 -- \
  node scripts/first-person/xr-quest.mjs --out=/tmp/tilefun-xr-quest \
    [--scenes=city,woods] [--modes=eye,tabletop,screen] [--rate=90] [--distance=near] [--profile]
```

## Not in this slice

- 230 slice 3 (orbit camera on the page) and slice 4 (stereo on the page).
- 230 slice 9 (HTML menus inside the session).
- A HUD inside the session, hands, passthrough, build mode in the headset.
- 230's two-controller grab, manual recentre and lock for the tabletop.
