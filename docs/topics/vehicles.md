# Vehicle sprite and geometry review

Topic: vehicles
Status: Workshop geometry candidates ready for human review; driving is not implemented.
Updated: 2026-10-03.

[Vehicles in Workshop](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/vehicles)
is the review entry point, linked from the sidebar, All tools and the global
Vehicle geometry batch. It registers all 180 directions across 45 sets (including
two fire-truck ladder states), even with no feedback. The original
[source audit and driving proposal](../research/road-vehicles.md) owns provenance
and the proposed later traffic architecture.

## Reviewing

Choose a vehicle, then north/east/south/west. Each direction has its own review.
The diagram shows the native sprite crop, ground bounding box, physical height,
anchor and sorting line. One grid cell is 16 world pixels. The ground box has
editable X, Y, width and depth; physical height is a separate value above the
road. Anchor and depth sorting are in the expandable controls. These are
hand-selected family proposals, not accepted collision or gameplay defaults.

The walker uses the production prop renderer and collision implementation.
Use arrows/WASD on the focused scene or the on-screen direction buttons to test
walking around, in front of and behind the vehicle. The diagram's raised pink
box visualizes physical height; the walker itself stays at ground level.

**Approve view** saves the exact selected sprite and edited geometry and advances.
**Needs changes** requires a reason; two reports pause this vehicle batch.
**Save geometry / reopen** saves a correction without approving it and reopens a
previously approved view. **Reset to proposal** restores the committed candidate
in the local editor. The Show filter controls Previous/Next navigation; the
vehicle selector and direction tabs always allow explicitly opening another view.
Drafts are per direction and candidate revision and survive navigation/reload.
The shared Workshop outbox handles offline retry and pending-save status.

## Identity and ownership

- `src/assets/vehicles/VehicleCatalog.ts` combines the exact source audit with
  proposed family geometry. It does not register runtime factories or change
  existing parked-car props, generators or promotion banks.
- Three new candidate crops remove one stray top row from the police west and
  ambulance side rectangles. Original source pixels and audited rectangles remain
  intact. These new crops require human review like every other vehicle view.
- `VehicleDiagram.ts` is shared by the manifest and UI. Each candidate fingerprint
  pins the verified source PNG, directional definition, geometry and diagram pixels.
  The UI checks its render against the manifest before enabling submission.
- Authenticated `asset` events include the vehicle candidate ID and fingerprint.
  The server validates the current candidate, exact source rectangle, direction,
  ground box and finite positive height. Saved annotations contain the complete
  edited geometry and base proposal; replies preserve the human decision time.
- Vehicle decisions are scoped independently of ordinary Outdoor asset metadata.
  Changing a candidate definition/source/render reopens its review; resolving an
  agent request or replying does not approve it. Human geometry stays in ignored
  feedback data until explicitly promoted to new committed gameplay identities.
- The fire-station building and garage truck fragments remain source inventory;
  the vehicle batch does not imply a prepared enterable fire station.

## Validation and next work

Unit coverage checks complete directional inventory, clean candidate crop
provenance, actual finite-height collision, exact edited approvals across service
restart, stale/invalid submissions and review invalidation. Browser coverage checks
inbox discovery, four-direction selection, geometry persistence, real walker
collision, phone layout, offline retry, required reasons and two-report pause.
Existing review identities are compared during delivery to protect approvals.

Delivery checks: all three typechecks, 1,224 unit tests, lint and production build
passed. The 260-test browser run passed 259; the remaining assertion expected the
old 16-tool index. After updating it for Vehicles, all six vehicle/tools-index
checks passed, including oversized numeric input, offline saves and review pause.
All 327 previous candidate identities are unchanged. Desktop/phone previews were
inspected; the live deployment serves the 180-view manifest and the live local
review renders with enabled controls and no page errors. Test feedback used only
isolated data; no human approvals were written.

Next: human review of wheel contact, dimensions, height, clipping and sorting.
After accepted geometry is promoted, implement the separately proposed bounded
traffic loop only when requested.
