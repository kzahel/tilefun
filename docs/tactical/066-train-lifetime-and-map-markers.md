# Train lifetime and active map markers

Topic: [trains](../topics/trains.md)
Status: planned; deferred by the user on 2026-10-05. No runtime changes delivered.

## Goal

Let an unattended active train finish its current leg and park at the next station
before unloading. Show active services on the world map for all players in the
same world, including trains outside their local entity replication range.

## Current behavior

`RailwaySystem.update` admits up to four services based on player proximity to
their routes, prioritizing ridden services. This is independent of camera visibility.
Each active service supplies footprint/braking-halo dependency tickets to the
shared `InterestManager`. Losing admission immediately freezes the service,
saves it through a finite snapshot barrier and removes its bodies. Returning
restores the saved route position, which may be between stations. There is no
wall-clock catch-up. The map currently shows generated routes and stops only.

## Proposed lifetime contract

1. Player interest or passengers keep a service running normally. Define one
   occupancy contract for roof riders and future interior passengers; camera
   visibility alone must not decide whether a passenger's train can retire.
2. When player interest disappears, retain a travelling service in a
   **finishing leg** state. Keep its moving dependency ticket until it reaches
   its next scheduled stop. Do not grant interest to the whole route.
3. At that stop, park without starting another leg. Persist station position,
   destination and dwell state before removing the physical bodies and ticket.
   A service already waiting at a station can park immediately.
4. Renewed player interest cancels parking, including during a pending save.
   Recheck interest after the save barrier before removing any bodies.
5. An unloaded service has no map marker and does not advance with wall time.
   On activation, reconstruct it at its saved station and give players a
   predictable boarding dwell. Decide the exact wake-dwell rule during implementation.
6. World shutdown still saves immediately at the current position. A permanently
   blocked finishing train needs a bounded timeout and an explicit saved frozen
   state; do not teleport it to a station or retain its ticket forever.

Keep finishing services inside a deliberate service/chunk budget. Resolve how
they compete with new player-near services before changing the current four-service
cap; passengers have priority, and repeatedly discovering routes must not cause
unbounded background trains. Terrain readiness and persistence pressure remain
authoritative reasons to pause. Timeout policy must account for those pauses.

## Map replication contract

Publish a small authoritative summary of active services to sessions in the
same outdoor world: stable service ID, world position, direction, next stop and
moving/waiting/finishing state. Replicate a train once, rather than each carriage.
Use bounded low-rate snapshots/deltas with explicit removals and a server time/tick
if marker interpolation is used. Late joiners receive the current active set.

This channel is independent of spatial carriage baselines/deltas. Reading a map
summary must not request remote terrain or instantiate remote physics entities.
Markers remain visible while a service finishes its leg and disappear after
retirement. Clear summaries on world transitions, disconnect and controller
shutdown; do not expose services from another world or unrelated interior.
The existing generated route/stop layer remains useful when no train is active.

## Implementation sequence

- Add explicit service lifetime states and stop-arrival reporting through the
  shared railway controller, for straight and curved services alike.
- Establish bounded admission, renewed-interest races and blocked-service policy
  using deterministic controller/persistence tests.
- Add the world-scoped active-service summary to the shared protocol and
  replication path for Worker, P2P and Node hosts.
- Render one distinct train marker per service in the shared map presentation;
  verify desktop/phone layout and teardown.
- Keep embedded train labs on the same controller and lifecycle. Fixture controls
  can demonstrate loss/renewal of interest without substituting a lab simulation.

## Acceptance evidence

- Loss of all player interest mid-leg reaches the next stop, saves and retires;
  the train does not reverse and start a new leg unattended.
- Interest returning during travel or the save barrier preserves one live service
  and its complete carriage group. Occupied trains cannot retire.
- Blocked tracks, missing readiness, failed writes and budget contention stay
  bounded and preserve valid service records. Shutdown mid-leg resumes exactly.
- A remote player sees the active marker without receiving carriage entities or
  loading the train's chunks. Late joins, removals and world changes are correct.
- Both straight/curved services and desktop/phone maps pass. Run standard checks,
  rendering/browser checks, inventories if presentation/protocol recipes change,
  and `streaming:bench -- --assert-ready` for the lifecycle change.

Rider prediction, warning sounds, train interiors, multi-town generation and a
global timetable are separate work. Investigate steady-speed rider jitter first.
