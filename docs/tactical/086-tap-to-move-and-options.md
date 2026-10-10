# Tap to move and accessible Options

Status: complete implementation; child device trial next. Updated 2026-10-10.
Requested by the owner on 2026-10-10 for children around two or three who
have not learned the joystick. [Ideas](../ideas.md#presentation-and-usability)
routes this slice. The tuning below still needs the child's device trial;
automated validation does not establish child usability.

## First experience

In Play mode, choose **Tap to move**. Tap a place in the world, lift your
finger, and the character walks straight toward it. A bright ground ring shows
the destination. Another tap replaces it immediately. Tap near the character's
feet to stop. The ring disappears on arrival or fades when movement is blocked.
No reading, finger holding or joystick dragging is needed to walk.

Use ordinary walking speed and existing collision, acceleration and friction.
Stop within a generous arrival radius and let normal friction brake the
character. The existing physics normalizes directional input, so lowering axis
magnitude does not reduce speed. This slice preserves ordinary physics and
cancels steering once within half a terrain tile (8 world pixels), with no
continued target correction or oscillation. An unreachable destination
must expire after a short period without meaningful progress toward it; start
with roughly 0.75 seconds and tune against ordinary acceleration and streaming
waits. Do not keep pushing or sliding along a wall indefinitely. Brief correction
or missing streamed terrain must not be mistaken for arrival.

This first version walks a straight line. It does not navigate around trees,
buildings or water, choose a staircase, jump automatically, board a vehicle,
or follow a moving animal. Children can tap an intermediate clear spot to go
around something. Ordinary door approaches and the existing door button still
work; crossing a realm boundary cancels the old destination.

Keep the existing Jump, Throw and Sprint controls for this slice. Changing
their labels or offering fewer buttons can follow the first child trial. Do
not combine the movement prototype with a new physics preset or a general
"toddler mode" that changes unrelated game rules.

## Options entry and layout

Add a consistently visible **gear button** beside the existing hamburger at
the top left, with an accessible name of **Options**. Also link to the same
panel from the hamburger and main menu, so it is available during setup and
play. Keep clear of Map, editor tools and device safe areas.

Use a compact, responsive DOM dialog, not the debug panel or world-management
screen. Center it on larger screens; let it fill the available width on a
phone. Its first screen is deliberately small:

```text
Options                                 Close

Movement
[ Tap to move ]          [ Joystick ]
Tap a place to walk there.

[ Back to game ]
```

The choices are two large selectable cards rather than a small switch. Show
the selected state clearly, with a simple finger/joystick symbol and text;
make primary controls at least 48 CSS pixels tall, with generous spacing.
Keep Close and Back to game visible in portrait and short landscape screens.
Support keyboard selection, Escape, focus containment and returning focus to
the opener. Ensure the dialog appears above the browser fullscreen surface.
Opening or closing it must not issue a world tap.

Apply choices immediately and remember them **per local player profile on
this browser**, using an optional touch movement preference. A parent can keep
Joystick while the child uses Tap to move. Missing or invalid preferences retain
the existing Joystick default. If saving fails, keep the session choice and
show a brief message that it will not be remembered. No world-save, server or
cross-device settings synchronization is needed.

Start with Movement only. Sound, camera zoom and other ordinary play options
can be added when selected for a later slice; do not copy debug CVars into this
panel or turn this into a complete menu redesign.

## Input rules and existing interactions

- Enable world tap movement only in Play and only for the selected touch mode.
  Hide/disable the joystick in that mode. Keyboard and gamepad walking continue
  to work and cancel a tap destination when used.
- Recognize a completed tap on release, allowing small finger wobble and a
  longer contact than the current joystick's 300ms tap limit. Begin with about
  800ms and 20 CSS pixels of total excursion, then try it on the child's device.
  A drag, canceled contact or second world finger must not create a destination.
- Action buttons and all DOM UI claim their touches before world movement.
  Holding Jump while tapping a destination can still work. Suppress compatibility
  mouse clicks so one touch cannot trigger a second movement or interaction.
- Taps already send `player-interact` to befriend animals. Preserve existing
  eligible interaction hits: those consume the tap and cancel walking; other
  world taps set a destination. Use the existing hit/range and eligibility rules
  through a shared helper rather than inventing different client semantics.
  Authority still performs the interaction. Do not send an interaction for every
  movement tap or add automatic interaction on arrival. If replica data cannot
  identify eligibility faithfully, resolve that boundary before implementation.
- Clear destination and gesture state on Options/menu/map/Idea opening, entering
  Edit, profile/world changes, door travel, respawn/teleport, disconnect, input
  locks, focus loss, hiding the page and teardown. Returning to Play requires a
  fresh tap. Merely covering the canvas with the hamburger is insufficient.
- Opening Options stops local walking; it does not promise to pause other
  players, vehicles or the multiplayer world. Send neutral input through the
  normal scene/authority policy so the last movement is not retained.

## Implementation boundaries

The current entry points are `GameClient.onPlayTap` / `onPlayClick`,
`TouchJoystick`, `TouchButtons`, `ActionManager.getMovement`, and PlayScene's
quantized `player-input` submission. `MainMenu` currently owns world management;
`GameClient.createEditorButton` builds the hamburger containing Edit/Play, Menu,
Idea and Debug. `PlayerProfileStore` already stores local player choices.

Add a small testable destination controller under `src/input/`, separate from
gesture recognition and the DOM Options view. It owns target, arrival, progress
and cancellation, and returns ordinary directional input. PlayScene combines
that with manual input before existing axis quantization, prediction and
transport. Send the same sampled axes to authority and prediction; replay stored
axes, not newly computed target steering. Never mutate player position or bypass
collision to arrive exactly at the target. No destination protocol or server
pathfinding is needed.

Resolve CSS/client coordinates into canvas coordinates using the canvas rect
and actual dimensions. Unproject using the view the child actually saw, including
zoom, pixel snapping and the presented camera position, then store a fixed world
destination. Camera following or first-tap fullscreen resize must not drag the
destination along with the screen. The current `Camera.screenToWorld` assumes
ground height zero; use the player's current walking/support plane for elevated
views. This is a plane choice, not multi-level surface picking. Markers must use
the same plane and shared projection on Canvas and GPU; verify ordinary ramps
and roof starts without promising navigation between overlapping floors.

Read [client/server ownership](../client-server-architecture.md) and
[embedded labs](../topics/embedded-engine-labs.md) before implementation.
Keep physics/prediction/projection shared. Labs need not acquire a game Options
menu, but any changed shared behavior must remain aligned with their consumers.

## Delivery and acceptance

1. **Options foundation:** accessible dialog, gear/menu entry points, local
   profile preference and reliable input cancellation. Keep the control choice
   unavailable until the movement controller is wired; do not ship a dead toggle.
2. **Walking slice:** gesture routing, destination controller, interaction
   priority and neutral-input lifecycle handling; add the world destination ring.
   Deliver these together as the first usable feature.
3. **Phone trial:** choose Tap to move, walk to several visible spots, redirect
   while walking, stop, tap behind a tree, befriend an animal, enter/leave a door,
   use Jump and reopen Options. Test portrait and landscape, including slower
   taps and finger wobble. Record whether the child understands the ring and
   whether stopping at obstacles is confusing before choosing the next feature.

Behavioral unit coverage should establish arrival without oscillation, target
replacement, stall expiration, cancellation, manual override and profile
fallback. Browser coverage should exercise the real Worker game, claimed button
touches, interaction preservation, canceled/dragged/multiple contacts, one action
per tap, first-tap fullscreen, scroll/close isolation, focus restoration,
reload/profile switching, camera/zoom/resize targeting and Canvas/GPU marker
alignment. Confirm the existing Joystick and mobile editor flows still work.
Browser automation verifies behavior; it cannot establish suitability for a
two-year-old or Safari behavior without a device trial.

For implementation, run `npm run typecheck`, `npm test`, `npm run check`,
`npm run art:catalog`, `npm run workshop:manifest`, then
`npm run build && npx playwright test`, using isolated auth/data and bundled
Playwright Chromium. Do not regenerate immutable review snapshots.

Next decision after the trial: tune taps/arrival feedback first. If obstacles
regularly frustrate the child, consider bounded local avoidance or pathfinding
as a separate plan. Fewer action buttons and more ordinary Options are also
separate follow-ons.

## Implementation checkpoint (2026-10-10)

Delivered the gear, hamburger and main-menu entry points, native modal Options,
large movement cards, per-profile IndexedDB preference, failure feedback and
keyboard/focus/fullscreen handling. The closed hamburger is now inert, so its
offscreen controls are not reachable through assistive navigation.

`TapMovement` owns fixed world destinations, an 8-pixel arrival tolerance,
0.75-second progress timeout and 0.4-second blocked-ring fade. `TouchTap` resolves
the target from a copied presentation view and current support plane at contact
start. It accepts contacts up to 800ms with at most 20 CSS pixels of excursion;
drags, cancellations and multiple world fingers are rejected. Claimed action
touches are excluded. Compatibility mouse clicks are suppressed after touch.

PlayScene samples normal axes before quantization and prediction; it forwards
the same effective movement to door approaches. Neutral input is sent on UI and
scene cancellation, with no destination protocol or movement physics changes.
For automatic door travel, queue the request before neutral input: authority
validates the approach using its last directional input. The busy door
presentation locks the next sample, and accepted travel clears the destination.
A peer's door animation message leaves local walking active; local (`self`)
travel cancels it.
Water respawn/hit invincibility onset clears gestures and walking intent,
including short respawns below the general 64-pixel teleport guard.
The ring uses shared projection on the UI surface for both Canvas and GPU.

Live authority `befriendable` tag eligibility is now included in the existing
three-byte AI state using presence/value bits 5/6. Baselines, deltas, reconstructed
AI and both replica consumers honor it. The existing point-radius rule remains
24 world pixels and is shared by authority and tap routing; procedurally disabled
friendship is no longer mistaken for an interaction by the client. No tag list
or client-side interaction authority was added.

Validation against an isolated export of the staged commit:

- Typechecks pass for client, server and Worker.
- 222 unit files / 2,120 tests pass, including normal-physics arrival, gestures,
  captured support-plane projection and live interaction eligibility replication.
- Lint passes with the existing 118 warnings and 34 informational diagnostics.
- Art catalog and Workshop manifest regenerate; all 761 candidate identities
  remain unchanged. The production build passes.
- All 20 final focused browser checks pass: the 12 new mobile tests cover both
  renderers, door entry, collision stalls, animal taps, water respawn, fullscreen, focus,
  profile reload/switching, peer door isolation and save failure; six existing door
  tests and two city-train checks also pass.
- The Options panel was visually checked at 390×844 and 844×390.

The full browser run completed with 512 passing, one skipped and three failing
checks. All 12 new mobile checks passed in that run. The two historical wildlife
review checks require absent archived evidence and fail identically on base
revision `2d8248e`; their candidate identities were preserved. The GPU city-train
reload check failed during the two-worker full run, then passed on both the base
revision and this change with one worker. The final focused run also covers the
last peer-door cancellation filter. These results do not establish Safari or
child usability.

Next: try the feature with the child on the actual device and tune tolerance and
feedback from that observation. Route finding and simpler action buttons remain
separate follow-ons.
