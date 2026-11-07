# Shared-physics towing and car transporter

Status: delivered and qualified locally; ready for owner play review.
Owner request, 2026-11-07: after 222's dump bed, bring back all the retired
special vehicle behaviors autonomously. This slice restores wheel-lift towing
(169) and the single-car transporter (173), which also makes the generated
depot lanes (175) work again. Racetrack racers and parking visitors follow
separately. Owners: [vehicles](../topics/vehicles.md), [physics engine](../topics/physics-engine.md).

## Delivered

- **One equipment request and button.** `vehicle-equipment` (`tip`, `lower`,
  `attach`, `release`, `deploy`, `stow`) replaces 222's bed-only request.
  `server/EquipmentControl.ts` applies the same operator guards to every
  action: the cab driver, or a grounded, unmounted person within 32px; the
  vehicle stopped and upright; nobody else driving. The contextual equipment
  button (F, D-pad down, touch) shows the next useful action for the nearest
  dump truck, tow truck or transporter. The same button still says Right car
  when a car is overturned.
- **Durable couplings.** `vehicleLink` stores the partner's procedural identity
  on both records (`link: {kind, lead, partner}`). `VehicleLinks` publishes the
  replicated runtime IDs (`towTargetId`/`towedBy`,
  `transportLoadId`/`transportedBy`) once both vehicles are resident, in either
  arrival order. Deleting either vehicle releases the other. A lead whose
  partner is not resident stays drive-locked.
- **Joints in the shared world.** `physics/VehicleCouplings.ts` turns the
  replicated links into Rapier joints. Authority and replay build the same joint
  from the same fields, with contacts between the pair disabled.
  - **Tow:** a spherical joint holds the car's measured front axle (from
    `towing-profiles.json`) at the cradle, `TOW.lift` above its rest height. The
    car pitches nose-up and coasts on its rear wheels (no braking, lateral grip
    only), so it trails like a trailer.
  - **Reversing:** the tow truck cannot reverse further once the pair bends
    70°; drive forward to straighten. Towed and carried cars cannot be entered.
- **Transporter body.** `physics/TransporterBody.ts` compiles the retained deck,
  cab, guard and guides into a compound. Deploying the ramp adds a full-width
  ramp from the toe to the deck and holds the truck as a fixed body. That
  locks driving and stops loading cars or walkers from shoving or yawing the
  truck through the long ramp lever.
  - Deploying needs the ramp's footprint (just above level ground) clear of
    terrain and props.
  - Stowing needs the ramp space clear of other bodies. It secures a
    qualified, aligned, unoccupied car standing wholly on the deck with a fixed
    joint at the load point (x −21). Deploying again releases it.
  - Cars on the deck are entered from the ground (32px reach).
  - Its collider is frictionless: cars ride on their wheels, not by scraping.
- **Presentation.** The tow boom/cradle and transporter ramp rigs follow the
  replicated state (`EquipmentMeshPose`). Towed, carried or deck-standing cars
  draw in the truck's local depth target. People and cargo on the transporter
  join its bed group, as they do in the dump bed (`scene/VehicleGroups.ts`).
- **Lab.** World geometry → `car-dynamics` gains **tow** and **transport** starts
  in a south-east equipment yard. The `geometry:wheel-lift-towing-v1` and
  `geometry:car-transporter-v2` Workshop candidates open them instead of the
  deferred page.
- **Structure.** Body construction moved from `PhysicsScene` into
  `physics/SceneBody.ts`, and rail blocking, support motion and couplings into
  their own modules. Frame tag `0x16`: entity fields 20–24 carry the couplings
  and ramp state; golden wire digests regenerated.

Departures from 169/173, chosen for the shared simulation: the joint lifts the
car physically (no cosmetic pitch or offset); securing happens when you stow
the ramp, not as a separate action; the physics ramp is one full-width surface
(cars wandering off the narrow visible tracks would otherwise drop into the
gap); the deployed truck is anchored rather than braked.

## Validation

- Native `physics/VehicleCouplings.test.ts`:
  - Towing holds the front axle within 6–8px through driving and a 90° turn,
    pitches the car nose-up, and puts it back level on release.
  - Transporter: a compact drives up the ramp, is secured and carried at the
    load point, then reverses off the ramp to the ground.
- Native `scenarios/VehicleDynamicsRecipe.test.ts`, through ScenarioSession:
  - Attach, refusing to enter the towed car, towing, reload with the link
    re-resolved, then release.
  - Deploy, drive a beetle aboard, get out, stow (secures it), drive away with
    it, then deploy (releases it).
  - The bed start retains its cargo.
- Full native suite: 4,646 of 4,658 pass. The 12 failures are all in
  `OriginalVehicles.part1–3`: stale race-tune expectations from commit
  `5e705fe6` (car jump park). They fail identically on that commit without
  these changes.
- Browser (production build, GPU meshes): all six `tests/vehicle-geometry.spec.ts`
  cases pass, including a new one that attaches and releases the tow with F and
  the button, then deploys and stows the transporter ramp.
- Typechecks, Biome on changed files (existing warnings only), knip, art catalog
  and Workshop manifest (2,122 identities) and the production build pass. The
  ratchet accepts VehicleChassis +1 line/+1 complexity (the coast flag).
  PhysicsScene shrank to 1,037 lines. `WorldGeometryPage`/`WorldGeometryCandidate`
  growth comes from commit `5e705fe6`, not this slice.

Not measured: phone or Chromebook cost of coupled pairs; the stability of long
tows over rough terrain; carrying a car across steep grades.

## Next

Racetrack racers and parking-lot shopping visitors (traffic behaviors retired
by 205), then owner play review of the depot lanes.
