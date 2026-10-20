# Vehicle bed gameplay and extension workflow

The level dump-bed playground runs the normal scenario Worker, binary replica,
player prediction, shared scene collector and selectable game renderer. Find
**Truck bed playground** in Workshop tools, or use
`workshop.html?geometry=truck-bed#/tool/world-geometry` in the checkout you run.
[Tactical 164](tactical/164-playable-truck-bed.md) retains the original proof;
[165](tactical/165-truck-bed-gameplay.md) owns normal-game activation and cargo;
[vehicles](topics/vehicles.md) owns the next product work.

## In the game

Place **Edit → Vehicles → Construction dump truck**, return to play and stand beside the stopped
truck. The normal vehicle panel offers **Ride in bed** and **Drive car**. A bed
rider remains an independent person: walk, jump or use **Climb out** while stopped.
Another player can drive while people ride visibly in the bed. This is separate
from enclosed passenger seats and does not require a character mesh.

Bring a loose ball, fruit, nut, root or twig beside the truck and press **Load
cargo**. **Unload cargo** places the same object on clear nearby ground. These
are real actor identities, with no copying, inventory conversion or rigid seat
attachment. Animal-held/claimed food and growing resource sources are excluded.
Loading/climbing requires stopped motion, nearby ready terrain, free space and
clear external wall/ceiling clearance across the rim. A full bed or blocked exit
reports an error without moving anyone. Cargo and riders save their actual floor
heights; old dump-truck records acquire the qualified hollow profile on restore.

Ordinary generated dump trucks have the same profile. Their normal road-size
admission and autonomous behavior are unchanged. Wait until stopped to board/load.
The current equipment stays level; there is no tipping control yet.

## Playground and clipping inspection

The Workshop fixture includes two loose objects beside the truck. **Stand beside
truck** is an explicit diagnostic teleport; the in-scene game panel then uses the
same normal loading/boarding requests as the game. **Load into bed** remains a
separate diagnostic teleport. WASD/arrows move and Space jumps. **Drive truck**
uses ordinary autonomous traffic on the bounded road. Heading selection resets
the fixture; actual driven turning is separately qualified in native scenarios.

**Show clipping geometry** draws the actual physical floor in green, walls in red,
player/cargo bodies in blue, upright sprite planes in yellow and feet in white.
Cab/chassis prisms are gray. The game exposes the same overlay with
`r_showbboxes 1` or its existing debug view. Pause and step inspect contacts;
paused game controls are locked. Renderer switches preserve the Worker/world.
Reload retains truck, cargo identities and the recessed rider height. The fixture's
traffic target resets to stopped; a saved residual velocity still brakes normally.

## Three representations with one registration

The visible model is the unchanged 3,720-triangle
`public/assets/models/vehicles/dump-truck-v1.glb`
(`eda05b91da120bf76cbb6df9e0e9480cca2706d6d72cc42734a9e3e224201bd3`).
The original Explorer sprite is also unchanged. No new bitmap or mesh is needed
for this prototype.

[VehicleBed.ts](../src/traffic/VehicleBed.ts) holds seven plain prisms: chassis,
floor, cab and four tub walls. A prism has bottom/top XY rectangles and bottom/top
Z heights. Different rectangles express the outward wall slopes. These are
deliberately simple contact shapes; cab/chassis and rim extents are conservative,
not triangle-perfect replacements for the visual model.

Dimensions come from the retained
[geometry](../art-source/vehicle-bake/dump-truck/v1/geometry.py) and
[family registration](../art-source/vehicle-bake/dump-truck/v1/family.json).
The source's export scale is `400/23`; the loader flips forward/side axes into
game coordinates and keeps Z up. Current dump-truck height/lateral fits are 1.
The actual floor top is source Z `1.25`, or `21.73913` world pixels; its center is
game X `-20.34783`. The ordinary broad body remains `112 × 46 × 49` for road
admission, vehicle movement and broad-phase queries.

Authority and prediction query the same prisms for pedestrian side collision and
support tops, including the recessed floor. Moving support preserves an actual
local position and support height rather than always snapping to the roof.
Standing occupants remain loose walkers; they are not parented to a driver seat.
Their existing `10 × 6 × 12` physical player collider is unchanged. It intentionally
does not describe the full painted silhouette or anatomical character depth.

## Rendering and fallback

The collector moves an overlapping player's ordinary sprite item into the truck's
neutral `bedGroup`. No Three.js object enters simulation or scene data. The GPU
backend adds a foot-registered, alpha-tested upright plane to the truck's existing
local depth target, then applies the normal inward outline. Source atlas UVs,
orientation, frame and transparency are preserved. Textures/pool meshes belong to
the backend and are retired on asset replacement, backend disposal or scene clear.

Canvas, GPU-without-meshes and pending/failed meshes draw the original truck sprite
and clip the occupant against rays through the same physical prisms. This keeps
fallback gameplay inspectable, but it is an **approximate visual clip**: the
loaded model uses actual triangles, while fallback uses the simpler contact
geometry and cardinal source image. Do not assert exact fallback/mesh pixel parity.

The group still participates in ordinary whole-object scene ordering. It does
not resolve the cross-group wall conflict demonstrated in
[162](tactical/162-shared-world-depth-comparison.md), and it does not introduce a
shared world depth buffer. Terrain/other props retain their current rendering.

## Profile activation and persistence

Normal dump-truck creation sets `vehicleBed: true`; restored older dump trucks
migrate to the same profile. Other vehicle types retain their existing roof/body
behavior. Adding another profile remains explicit qualification work.

Routed dump trucks retain a continuous `vehicleHeading`, shared by the mesh,
physical bed and moving contents. It remains stable on stopping and reload;
cardinal fallback artwork does not determine the bed's physical yaw. Autonomous
road admission retains the existing routing policy. Airborne bed occupants use
the hollow volume for crossing/push checks, with actual wall motion still checked
before committing the vehicle step. They retain world momentum during a jump.

The flag travels through snapshots, nullable deltas, hydration and `SavedTraffic`.
Frame tag `0x06` requires matching endpoints and rejects older tags. A supported
player's `roofRide` save includes relative `height`; older records without it
retain roof-height semantics. Loose contents remain ordinary durable actor records
at their actual world positions/heights. Shared moving support carries loose
objects only on qualified beds. Cross-boundary dependency tickets keep truck/load
neighborhoods together while active and expire when ordinary activity ends.

Balls resolve floor landings, wall rebounds and support loss against the same bed
geometry. They do not bounce off the truck's broad solid-body proxy. Settled bed
cargo does not expire simply for being an unowned ball. Food retains its existing
resource semantics; tipping/rigid-body sliding is not implemented.

## Repeating the proof or extending to another vehicle

1. Keep the retained visual asset immutable. Read its actual constructor, export
   units, ground origin, source forward axis and game height/lateral registration.
   Derive the floor, inner walls and openings from those dimensions, including
   wall thickness and any conservative approximation. A screenshot alone is not
   sufficient geometry evidence.
2. Add a qualified plain geometry profile and model opt-in. This first proof
   explicitly qualifies only the dump truck; extending the type guard, persisted
   validation and shared fallback pose is part of adding the next profile.
   Keep vehicle road/body admission conservative while hollow actor queries
   use the detailed shapes. Avoid changing every truck implicitly.
3. Use the same pose/shape data for collision, support and debug. Use the actual
   model for loaded visual depth. Verify feet, floor, near/far walls and yaw in
   native pixels with the normal loader and fixed game camera. Do not derive a
   character collision body from its rendered outline.
4. Exercise walking into walls, landing, jumping out, carrying/braking, binary
   replication and reload in `ScenarioSession` tests. Cover prediction rebasing
   separately: every support-height assumption must use the selected surface.
   This prototype found and fixed a client path that still snapped to roof height.
5. Use one focused browser boundary for Worker input, actual GPU composition,
   backend replacement and overlays. Keep shape/yaw/contact variants in native
   tests. Inspect source-pixel UV orientation for both ImageBitmap and HTML images.
6. Register a Workshop geometry candidate with the relevant runtime/renderer
   source identity. Run catalog/manifest generation and the normal validation
   gates. Changed art needs fresh human review; this engine proof creates no art
   approval. Keep all scratch captures and bundles under ignored `data/`.

Capture a self-contained gallery with its own isolated server and full bundled
Chromium (both close when the command completes):

```sh
npx tsx scripts/instrumentation/truck-bed-playground.ts
```

Open `data/3d-investigation/truck-bed/index.html`. It includes center/near-wall
poses, a jump, all four headings, both sprite fallbacks, loaded cargo and clipping overlays.
These sample live authority and are diagnostic captures, not immutable approval
snapshots. A running isolated developer server can instead be supplied with
`--base-url=http://127.0.0.1:PORT`; that borrowed server is left running.
Add `--game` to also capture normal desktop/phone gameplay using that same isolated
server; both test browsers and an owned server close when finished.

To capture actual editor placement, loading, bed walking and phone boarding through
the normal GameClient/Worker, run this against an isolated dev/preview server. Its
fresh test browser owns its temporary worlds and closes afterward:

```sh
npx tsx scripts/instrumentation/truck-bed-game.ts --base-url=http://127.0.0.1:PORT
```

The desktop/390px touch images and ordinary authority/renderer diagnostics are in
`data/3d-investigation/truck-bed-gameplay/`.

## Limits before articulated equipment

The delivered bed is level, with loose toys/food and independent player riders.
Crates, enclosed passenger seats, tilted support/contact queries, tailgate opening
and cargo discharge remain future work. The compiled v1 model has no independent
moving bed; tipping requires a new qualified articulated revision and matching
physics. Local depth still has the external-occluder limitation from tactical 162;
this does not establish a general shared world depth buffer or a mobile budget.
