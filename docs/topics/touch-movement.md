# Touch movement and Options

Topic: touch-movement
Status: Joystick, tap and hold movement delivered; all validation passes, child device trial next.
Updated: 2026-10-10.

Options is available from the gear, hamburger and main menu. It offers Joystick
(default), Tap to move and Hold to move, remembered per local browser profile.
Missing/invalid preferences fall back to Joystick; failed persistence leaves the
chosen mode usable for the session with feedback in the dialog.
[086](../tactical/086-tap-to-move-and-options.md) records the original tap slice.

## Hold contract

The owner's first child trial found that a two-year-old kept a finger down long
enough for completed-tap recognition to reject it. Hold to move starts on world
contact-down, continues toward that screen position without a tap timeout or
stall expiry, and stops when no movement contacts remain. Ordinary collision and
friction still apply. Within eight world pixels of the feet, steering is neutral;
the contact remains active so dragging farther away resumes movement.

Each sample resolves the newest held world finger using the latest copied
presentation camera and current support plane, including zoom and CSS scaling.
Camera following therefore keeps the direction moving rather than turning it
into a fixed destination. Dragging changes direction. Additional fingers replace
the direction deterministically; lifting the newest resumes the newest remaining
finger. Moving an older finger never changes priority. Contacts originating on
DOM UI or claimed canvas action buttons never enter the movement set.

Cars steer toward the finger, using the existing close-target throttle scaling.
Trains use left/right screen halves while held and brake on release; they never
latch or toggle a direction in this mode. Keyboard/gamepad movement cancels the
hold; Jump/Throw/Sprint can be used while steering on foot. A short completed tap
on a befriendable animal retains the existing interaction on release; ordinary
releases never create a destination. Mouse-down/drag/release also supports the
mode, with compatibility mouse input suppressed after touch.

Menus, editing, mode/profile/world changes, doors, boarding/exiting, respawn,
teleport, disconnect, storage/input locks, focus loss and page hiding clear held
contacts. Canceled touches clear all movement contacts. Returning requires a
fresh down; dragging an old finger cannot restart movement.

`TouchHold` supplies ordinary axes through PlayScene's existing quantization,
prediction/replay and authority submission. No physics, transport, generator or
embedded lab simulation contract changes. The optional game context input owner
keeps labs using their existing controls.

## Evidence and next work

Typechecks, all 2,188 unit tests (231 files), lint (existing 118 warnings / 34
infos), regenerated inventories and the production build pass. All 761 Workshop
candidate identities remain unchanged. The 20 focused browser checks pass on
Canvas/GPU, including the four new held-walking/train checks, saved preference,
release/Options cancellation and existing tap/joystick/vehicle regressions.
Options was visually inspected at 390×844 and 844×390.

Unit coverage exercises long holds, live resolution, dragging, finger
priority/fallback, claimed/UI touches, train sides, mouse input and cancellation.
All 529 browser checks pass in the full run, including mobile editor, embedded
Canvas/GPU labs, both complete city-train journeys and all movement/vehicle tests.
[Unit log](/tmp/tilefun-hold-unit-final.log),
[focused browser log](/tmp/tilefun-hold-browser-final-focused.log),
[full browser log](/tmp/tilefun-hold-browser-full.log).

The first unit run overlapped inventory generation and hit manifest-digest
invalidation in seven Workshop checks; after generation, all unit tests pass.
The initial focused run missed the short-lived redirected tap destination on
both renderers while the unit suite ran; both unchanged checks pass in the final
focused run. New multi-touch test injection now lifts the intended contact; its
initial error and an invalid no-contact CDP cancellation were test-harness fixes.

Next: try Hold to move with the child on the actual device, especially extra
fingers, steering and train release. Automated checks do not establish child
usability or physical Safari behavior.
