# Single-car transporter

The normal **Car transporter** in **Edit → Vehicles** carries one real passenger
car. It also participates in ordinary eligible road traffic; parked placements
work in existing roadless worlds. [Vehicles](topics/vehicles.md) owns current
status; [173](tactical/173-single-car-transporter.md) records delivery and evidence.

## Play

1. Park on level dry ground, leaving a clear approach behind the truck.
2. Open **Actions · B / Q / touch**, then **Deploy ramp**.
3. Enter a passenger car with **Y / E / Drive car**. Approach the ramp from behind,
   facing the same way as the truck, and drive straight onto the deck. Stop with
   the whole car on the platform; get out.
4. Open Actions beside the truck and **Secure car**, then **Stow ramp**. Securing
   checks the small centering movement before committing it. The car keeps its
   identity and paint. Enter **Drive transporter** and drive normally.
5. Stop with clear level space behind, deploy the ramp, and **Release car**.
   Get out of the cab, stand beside the rear half and enter **Drive car**. Reverse
   off the ramp. Hold **Reverse · R / LT / touch** to back straight down an
   angled ramp without steering. The released vehicle remains the same drivable car.

D-pad/stick selects actions, A confirms and B backs out. The ramp must be stowed
before driving the truck. An unsecured car blocks stowing; occupied/roof-ridden
cars cannot be secured or released. Only the cab's driver controls occupied
equipment. All 26 measured towing-profile passenger models qualify, with their
existing paints. Heavy vehicles, boats, motorcycles, chains and second loads do
not. The empty original Flatbed truck and Tow truck remain separate vehicles.

The Workshop **Car transporter playground** consumes the same Worker, authority,
binary replica, prediction and controls. Its two **Stand beside…** buttons are
diagnostic teleports; actual loading uses ordinary driving. Pause, step, reload
and renderer changes retain that same simulated world.

## Geometry and simulation

The 156 × 53 × 42px truck has a 110 × 48px support deck, rear X −76 to front
X +34, at Z 24.65. Its ramp reaches X −152 at ground level. Coordinates are
truck-local world pixels. `CarTransporter.ts` owns these simple support planes,
full-body lateral/forward fit and actual front/rear axle contacts from the
retained towing profiles. The two axle heights provide continuous elevation and
visual chassis pitch across ground/ramp/deck joins; this is bounded kinematic
loading, not suspension or general rigid-body physics. Upright body envelopes
remain the collision representation. Cars must face forwards and stay aligned;
sideways entry through the ramp is blocked. The ramp changes endpoints instantly.

`drivenCarPose` is shared by authority and prediction. A secured car follows the
truck-local center, with its wheels stationary. Both bodies and any roof
passengers are checked before either move commits. Obstacles at loaded-car
height, water/solid tiles and unloaded terrain stop the pair. Loading/deployment
requires clear, level terrain; deployed ramps lock truck motion.

`TransporterControl.ts` validates the normal `vehicle-transporter-action`
requests. Nullable `vehicleRamp`, `transportLoadId` and `transportedBy` fields
replicate in frame tag **0x09**; older endpoints are rejected. Durable records
use reciprocal procedural identity strings, resolving either chunk arrival
order. Cars on unrelated floors above or below the truck are excluded from its
loading support. Pending partners stop both vehicles. Eviction preserves ownership;
deletion releases it. Driver occupancy retains the normal vehicle save contract.

## Appearance and repeatable authoring

The new original derives its orange cab, palette and four independent wheel
assemblies from retained Flatbed v1, adding a longer/wider recentered platform,
relocated rear axle/guards, low guides, cab guard and separate ramp rig.
It uses **2,822 triangles, six meshes/draw groups and one existing palette atlas**.
All previous vehicle models, source bundles and receipts stay immutable.
The new appearance awaits owner inspection; automated qualification is not approval.

Retained source: [car-transporter/v2](../art-source/vehicle-bake/car-transporter/v2/).
Normal builds consume its committed GLB and cardinal images without Blender.
The GPU groups truck and car into one depth target during loading and transport.
Canvas, disabled/pending/failed meshes use actual captured ramp endpoints and
the car's own painted cardinal sprite. That fallback stays upright on slopes,
as with existing world-grade sprites. It does not promise pitched pixel parity.
Ordinary whole-group sorting against external props remains unchanged.

The commands below replay the current v2 into fresh output directories. For a
changed revision, first copy the versioned constructor and capture/retention
helpers, then point them at a new model filename and retained revision. Qualify
that revision before updating the runtime catalog; never overwrite retained v2
assets or receipts. Geometry dimensions and pivots remain family-specific:

```
blender --background --python scripts/vehicle-bake/transporter/author-v2.py -- --output data/vehicle-bake/transporter-NEW
node scripts/vehicle-bake/transporter/capture.mjs --output data/vehicle-bake/transporter-capture-NEW
python scripts/vehicle-bake/transporter/retain.py data/vehicle-bake/transporter-NEW data/vehicle-bake/transporter-capture-NEW art-source/vehicle-bake/car-transporter/NEW
node scripts/vehicle-bake/transporter/replay.mjs art-source/vehicle-bake/car-transporter/NEW --blender=BLENDER_EXECUTABLE
```

Capture reads the current runtime GLB; stage the new constructor GLB at its
intended runtime path first. Inspect all native headings, far tire crowns and
loading joins before retaining. Run the existing `clearance.py` whole-cylinder
proof and collision negative, the decoded rig/endpoint/native-frame checks,
headless loading/prediction/persistence tests and the focused game/Worker browser
boundaries. Capture retention snapshots every declared mutable source; replay
copies only those inputs into a fresh ignored workspace and compares all 34
PNG hashes. Constructor replay copies the four inputs named in its separate `recipe.json`
plus the repository root marker from retained snapshots; it reproduces the model
and atlas before pixel qualification. The initial unpublished UV-join prototype
is ignored; v2 gives added surfaces the same semantic UV-layer name before joining
them into the chassis, preserving steel colors. Both sprites add 5.16MiB of decoded
RGBA pixels; no physical-device frame-budget claim is made.

Next: owner playtest of loading alignment and ramp appearance. Multiple decks,
reversed loading, a towed carrier trailer, visible straps, articulated deployment
are separate follow-ons. [175](tactical/175-vehicle-depot-and-walkable-ramps.md)
adds ordinary pedestrian support on the measured deck and both steel ramp tracks,
including local-depth fallback clips, standing passengers and occupied-ramp locks.
See [vehicle depots](vehicle-depot.md) for a generated place to play with it.
