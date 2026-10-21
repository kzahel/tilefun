# Vehicle towing

Working wheel-lift towing is shared by the game and Tow truck playground.
Open **Actions (B on controller, Q on keyboard)** to choose Attach/Release;
D-pad/stick chooses, A confirms and B returns. Touch uses the Actions paddle.
[Vehicles](topics/vehicles.md) owns current status; [169](tactical/169-wheel-lift-towing.md)
records implementation and validation. The previous v1 art and receipts stay frozen.

## Play

Place **Tow truck** and a passenger car from Edit → Vehicles, or park an existing
car by driving it and getting out. Back the tow truck up to the car's **front
wheels**, facing the same direction. Stop, then choose **Attach car** beside the
truck or from its cab. Drive normally; aiming behind reverses. Stop on clear,
level ground and choose **Release car**. The released vehicle can be driven again.
Existing saved tow trucks acquire the new equipment automatically.

Twenty-six measured four-wheel models qualify: compact 1–6, seven unindexed
sedans, police car, Rosso coupe, Beetle, pickup, classic roadster, off-road jeep,
race coupe, woody wagon, microcar, hot rod, rally hatchback, retro taxi and beach
buggy. The committed [profiles](../src/traffic/towing-profiles.json) own exact
eligibility, axle coordinates, radii, game height fit and source model hashes.
Existing paints are preserved.

Occupied cars and standing roof riders cannot be picked up. Heavy vehicles,
boats, trains, motorcycles, chains and a second load are excluded. Back near the
front axle (within 24px and about 26 degrees); the checked pickup movement is
small and bounded. Towing cruises at 64 world px/s (102.4 with the normal sprint boost), reversing
at 32px/s. Reverse articulation stops
at 70 degrees; drive forward to straighten. Both conservative body envelopes
stop at people, props, solid/water tiles, unloaded space or unequal ground levels.
Coupled vehicles do not push other bodies. This is a controlled wheel-lift toy,
not a general rigid-body or terrain-suspension simulation.

## Shared implementation

`Towing.ts` computes the hitch, fitted tire contact, axle lift and rear-axle
following. Unequal front/rear radii and vertically fitted tire ellipses are
accounted for. `drivenCarPose` checks both bodies; TrafficSystem commits both
poses, support riders and contacts atomically. Prediction uses the same step and
private trailer copies. Display sampling pins the front axle to the displayed
hitch without changing simulation.

`TowControl.ts` validates normal `vehicle-tow-action` requests; the shared vehicle
panel owns Attach/Release. The game and real Worker lab use that same authority.
Current partner IDs replicate in nullable uint32 fields (current frame tag
**0x09**, old endpoints rejected; towing introduced these fields in 0x08). Save records store reciprocal **procedural identities**,
not transient numeric IDs. Chunk records can arrive in either order: zero-valued
runtime links preserve a stopped pending relationship until both are resident.
Unloading preserves it; deleting either body releases the remaining partner.
Releasing or deleting the owner restores the target's normal collider and driving.

The qualified target's physical body is a conservative upright envelope, extended
12px at each end and 12px upwards. Ordinary roof support remains conservative;
this is not accurate tilted-roof walking. The thin lift itself has no separate
player support surface. GPU renders the truck and target together in one depth
target, so the far cradle does not draw over the bonnet. Broader whole-group
ordering against external world props retains the existing renderer limitation.

Canvas, disabled/pending/failed meshes use retained actual posed cardinal captures.
The pair stays connected after heading quantization; original paints remain exact.
These sprites keep static wheel phase and approximate the articulated joint with
cardinal headings. Main GPU rendering rolls only the grounded rear wheels. The
two fallback banks add 17.16MiB of decoded RGBA pixels; no mobile frame budget is
claimed by the desktop readiness run.

## Repeatable authoring

1. `scripts/vehicle-bake/tow-truck/equip.py` loads the retained packed v1 scene,
   preserves its body/UVs/four wheels, and adds two atlas-painted rigid groups.
   The default new [v2 bundle](../art-source/vehicle-bake/tow-truck/v2/) contains
   packed Blender source, exact atlas, self-contained GLB and hashed recipe.
   It refuses an existing retained output; use `--output=data/...` to experiment.
2. `npx tsx scripts/vehicle-bake/towing-profiles.ts` measures actual retained
   GLB wheel transforms, per-axle radii and game fits. Eligibility is explicit;
   adding a model requires real source/contact qualification, not just a name.
3. `node scripts/vehicle-bake/capture-towing-fallbacks.mjs --output=data/...`
   captures all eligible paints and both lift poses using the shared GLB loader,
   game projection and inward outline. Final [fallback v1](../art-source/vehicle-bake/towing-fallbacks/v2/)
   retains output PNGs/frames, source hashes and snapshots of mutable construction
   dependencies. Normal builds consume the committed runtime copies.
4. `node scripts/vehicle-bake/replay-towing-fallbacks.mjs` copies only declared
   retained inputs into a fresh ignored workspace and checks exact PNG/frame
   hashes. Its node_modules junction supplies installed, lockfile-pinned tools;
   no old scratch data or user world participates. Qualify the live engine
   separately from historical capture replay.
5. Run native towing, rig/contact, wire/hydration and prediction tests. Then run
   the real Worker/browser boundary and ordinary game captures. Register the new
   exact interactive candidate; retaining source never invents human approval.

Repeat the isolated capture, including normal game and phone controls:

```
npx tsx scripts/instrumentation/towing.ts --game --output=data/3d-investigation/towing-NEW
```

Next extensions: adjustable dollies for rear-first pickup, heavier recovery loads,
and trailers. Each needs its own axle/body/authority qualification.
