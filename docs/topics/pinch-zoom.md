# Touch pinch zoom

Topic: pinch-zoom
Status: Optional gameplay pinch zoom delivered; physical device trial next.
Updated: 2026-10-10.

The gear, hamburger and main-menu Options dialog has a **Two-finger pinch to
zoom** checkbox. It defaults to off and is remembered per local browser player
profile. Missing or invalid values stay off. Storage failure leaves the selected
setting usable for the session and reports that it could not be remembered.

## Gesture contract

Pinch uses exactly two world-canvas contacts. Both may arrive together, or the
second must arrive within 200 ms of the first, before the first moves more than
eight CSS pixels. A dragged joystick, including one dragged back to its center,
or a finger already held longer than that window cannot be reclaimed for zoom.
The first neutral joystick contact is canceled when a valid pinch takes over.
This short handoff keeps ordinary one-finger joystick movement immediate.

Action-button contacts and DOM UI contacts never participate. An action-button
contact, third finger or canceled contact stops an ongoing pinch. Claimed world
contacts stay excluded from movement until lifted; lifting one pinch finger
cannot turn the remaining finger into a joystick or completed destination tap.
A pinch cancels existing touch movement through the ordinary game input owner.

Spreading fingers zooms in; bringing them together zooms out, relative to their
initial distance and camera scale. Zoom uses the existing camera/DebugPanel path
and its 0.05–3 range; it does not pan the camera or change movement authority.
Menus, Options, editing, travel, focus loss and other play-input cancellation
reset the gesture. New contacts are required after cancellation.

`TouchPinch` attaches after canvas action buttons and before world movement.
It shares their claimed-touch set. The optional GameContext input owner is
installed only in the main game; embedded labs retain their own controls, camera
policies and simulation contracts. World Map pinch remains its independent
map navigation gesture.

## Evidence and next work

Fifteen unit checks cover sequential/simultaneous recognition, both zoom
directions, limits, movement/held/returned joystick rejection, buttons, DOM UI,
disabled input, close contacts, extra fingers, cancellation, reset and disposal.
Browser checks cover both renderers, preference persistence in both states,
keypad exclusion, joystick continuation, destination cancellation and Options
cancellation. Options is visually inspected at 390×844 and 844×390, including
saved-status feedback. Short wide screens use a wider, compact dialog so the
checkbox and Back to game button remain visible without scrolling.

Typechecks, all 2,268 unit tests, lint (existing 118 warnings / 34 infos) and
the production build pass in the working checkout. The isolated commit version
also passes typechecks, lint, its 15 gesture unit checks, the build and all five
new browser checks. Regenerated inventories preserve all 761 Workshop candidate
identities in the isolated commit; the manifest changes only its source digest.

The full browser run completed with 533 passes and five failures: three exposed
a landscape Back-button cutoff, corrected by the compact layout; two lab
reload-readiness failures passed against the stable build. All five pass in the
final focused rerun. That 25-test rerun passed 24 checks and missed the transient
destination in an existing first-tap check; both Canvas/GPU first-tap checks pass
on unchanged recheck. No lab simulation or first-tap behavior was altered.
[Full run](/tmp/tilefun-pinch-browser-full.log),
[focused rerun](/tmp/tilefun-pinch-browser-final-focused.log),
[first-tap recheck](/tmp/tilefun-pinch-first-tap-recheck.log).

Next: try two-finger zoom on the child's actual device and check that the short
second-finger window is comfortable without changing ordinary joystick play.
