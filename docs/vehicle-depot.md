# Vehicle depot

Eligible city speedways in the current regional generator have a **Vehicle depot**
inside the oval. Open **Map · G / controller View**, find the orange truck icon,
select the named depot button and choose **Travel to selected point**. Touch,
keyboard focus and the shared controller menu all reach the same destination.
The map's normal regional detail/feature budgets apply; zoom in if landmarks are
omitted at a broad overview scale.

Use a fresh regional world or **Recreate with same seed** to see the complete
new layout. Existing saved terrain is not repainted or regenerated automatically.
Classic, island and flat worlds do not generate depots. Not every city has a
speedway; depot admission is exactly the existing speedway admission.

## Play

- Transporter loading lane: deploy its ramp through **Actions · B / Q / touch**,
  drive the Beetle aboard, get out, secure it and stow the ramp. The normal
  [transporter controls](vehicle-transporter.md) handle carrying and unloading.
- Recovery lane: use the Tow truck and compact car for ordinary attach/release
  practice. Both are independently drivable parked vehicles.
- Practice bridge: drive the red sports car over its two ramps, or use its open
  underpass with a small car. The bridge is 48px high with a 40px clear underside;
  taller vehicles cannot pass underneath it.
- A dump truck and pickup provide more vehicles to play with. Existing dump-bed
  boarding, cargo and tipping remain in the shared Actions menu.
- On foot, walk up either **steel track** on a deployed transporter ramp. The
  central gap is open. Walk along the deck, jump or walk off, and ride standing
  while another player drives with the ramp stowed. Cab/guard collision and
  overhead clearance use the same shared simulation and local depth group.

Seven parked slots have stable procedural identities. Moving a car preserves it
at its saved location; deleting it leaves an ordinary tombstone. Visiting or
reloading the depot does not refill those slots with duplicates.

## Ownership

`VehicleDepotPlanner` composes the existing dry reserved infield. It never moves
the racing circuit, spectator IDs, wildlife ownership pools or natural refuges.
`NaturalStrategy`, normal TrafficSystem persistence, overview sampling and map
presentation consume that same plan. The three bridge parts are ordinary saved
surface props, included across their full collider footprints at chunk seams.

`TransporterSurface` registers the retained v2 deck, cab/guard and two ramp tracks.
Authority, prediction, collision indices, landing/ground support, moving riders,
GPU local depth and sprite fallback clips share it. An occupied ramp cannot be
stowed. Deployment remains instantaneous; this adds no new vehicle art, seat
attachments, suspension or multi-deck carrier.

Current status and evidence: [175](tactical/175-vehicle-depot-and-walkable-ramps.md).
Next: owner playtest of depot discovery, the bridge and walking/loading feel.
