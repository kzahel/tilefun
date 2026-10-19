# 144 — Rolling car steering

Date: 2026-10-19.
Status: Complete.
Owner: [Vehicles](../topics/vehicles.md).

The owner requested car-like maneuvering: the body should turn only as it rolls
forward/backward. They authorized implementation and a completion commit.

## Contract

Directional controls remain shared across keyboard, controller and touch. Car
velocity follows its nose, with acceleration/braking along a signed longitudinal
axis. Steering changes angle in proportion to signed rolling distance divided
by body-derived turning radius (40px minimum). Forward input aims the nose;
reverse yaw has the opposite sign and naturally settles with the rear toward
the requested direction. Without directional input, reverse backs straight.
Reverse remains half speed without boost. Release brakes without a nose flip.

Authority and prediction use the same pure small-step planner. Blocked ground,
body or passenger plans commit neither travel nor turn. Gentle pushes and small
animal roadkill keep their shared atomic gates. Approved cardinal collision
footprints/sprite views, asset pixels and wheel rest steering are unchanged.
Long vehicles use wider radii. Automatic traffic and trains retain their owners. Authored NPC parking waypoints
retain their directional integrator via `routedCarPose`; rolling input and routed
parking share `checkedCarPose` collision/passenger validation.

Optional float32 vehicleHeading retains the continuous nose through stops,
parking, streaming and reload. Old saves fall back to cardinal facing. Traffic
restore validates headings before publishing any batch. Binary baselines expand
the presence mask to u32 (heading bit 16); u32 delta change/null masks add bit 17.
Endpoints require matching builds. Snapshots, deltas, reuse, mount cloning,
reconciliation and bounded replay all carry the same state. Shared presentation
interpolates shortest arcs at the sampled source time, including the -pi/pi
seam; local predicted presentation uses its previous admitted heading. GPU
meshes consume the bearing and wheels keep signed travel. No renderer owns turns.

## Validation

All 4,414 unit tests across 310 files pass (two workers), alongside typechecks,
lint (existing 119 warnings / 35 infos), coherent production inventories/build
and all six streaming readiness scenarios. Each has zero final missing/incomplete
terrain and zero stale-cache frames. All 74 bounded vehicle, renderer, multiplayer,
Worker and smoke browser regressions pass, in addition to the two new steering
cases. The full browser gate has existing wildlife failures described below.
New coverage exercises launch into a curve,
crawl-speed turning, long-body radius, forward/reverse yaw, a rolling gear change,
zero-speed holds, blocked atomic turns, saved occupied/parked diagonal noses,
binary baseline/delta/removal and delayed authority/prediction replay at 30/60Hz.

The fresh Canvas/GPU steering browser cases both pass. Their stop check reads
actual driven speed (the old lab diagnostic incorrectly retained autonomous speed
zero during inside driving), then allows presentation to settle. World-position
assertions respect float32 wire precision. Earlier straight-motion mesh checks
now bound the small chord/nose difference during a rolling curve rather than
requiring a renderer-owned exact chord heading. Both mesh car-board/drive cases
pass with the new curvature bound.

Inventories verify all 1,391 candidates in full Chromium at retina scale. Eleven
behavior identities renew: two excluded parking studies, four unapproved racetrack
compositions and five excluded geometry studies. All 180 approved vehicle identities
and source artwork remain unchanged. No human approval is inferred.

## Next

Try parking and tight forward/reverse maneuvers on Deck and web; tune shared
turning feel from hands-on feedback. Front-wheel steering art and rotated body
collision need their own clearance work if pursued.

### Existing broad-suite failure characterization

The full browser run includes older aquatic-hunter assertions that expect fish
population to remain constant through a meal. An isolated archive of unchanged
HEAD `56cddd4e`, served with its original source and an isolated Vite cache/data,
reproduces the orca assertion: initial fish 3, paused feeding fish 2. This matches
the already-delivered delayed natural replacement contract; no driving changes
are present in that reproduction. The temporary bundled Chromium process and
baseline server were closed afterward. These wildlife tests are outside steering.

### Physical Deck candidate acceptance

The Linux candidate passed on actual SteamOS/Gamescope/Electron with GPU ready.
A bounded standard-Gamepad-API snapshot stream drove the same main-game input,
authority and prediction in an isolated flat world. After 180ms from rest it
rolled 2.66px forward and 0.088px sideways, turning only 0.067rad. Continued
forward steering stopped at 0.905rad; LT reverse steered back to 0.043rad and
braked to zero. The nose and position remained unchanged during the final hold.
The GPU capture was visually inspected. This establishes the device input and
motion path; physical button feel and child usability still need hands-on play.

The isolated session exited through the normal acknowledged save/quit path.
Its temporary debug launcher was replaced with the normal launcher and shortcut
registration. Clean release delivery packages the committed production build,
installs through the public machine-control CLI and launches the normal shortcut.
Acceptance checks compare the installed build receipt with the clean commit,
verify GPU readiness and the normal data path, and ensure debug access is off.

The broad 1,091-case attempt was stopped after 20.2 minutes: 231 passed, ten
aquatic-hunter failures, two fauna cases interrupted and 848 not run. All ten
failures are in the same meal/population assertion group characterized above.
The affected vehicle/controller/renderer/networking checks are completed as a
bounded regression set; this does not claim a green full-project browser suite.
