# Generated shopping centers and road visits

Status: implemented and validated, 2026-10-18.
Owner: [city generation](../topics/city-generation.md), [vehicles](../topics/vehicles.md).

The owner requested main-game integration in every city, multiple centers in
larger cities, the new 3D vehicle default, actual road arrivals/departures, and a
commit on completion. This extends [132](132-parking-shopping-visits.md), including
its shared static-pavement performance fix.

## Contracts and delivered composition

Current regional cities gain one northern shopping center on a 4-column grid or
two on a 6-column grid. Each has the large 64-space layout, seven shopfronts,
painted bays, planted islands, pedestrian spine and two paved driveways onto its
existing northern boulevard. Native parked compacts occupy 18 selected bays.
Villages keep their compact neighborhoods. Existing streets retain their actual
endpoints; expanding district reservation bounds does not extend roads through
lots. Nature and farms reserve the new center footprints.
Promoted banks and frozen review compositions are unchanged.

Visiting compacts remain ordinary TrafficSystem/TrafficRecords vehicles from
road approach through checked forward parking, shopper exit/walk/shop/return,
and a checked connector back onto the westbound road lane. A busy center admits
no second visit; other traffic continues. Native collision and roof carrying
remain shared. An occupied shopper car cannot be taken over by another driver.
Background parked cars use ordinary durable placed-vehicle ownership and can be
driven/deleted; their stable feature identities prevent respawn after edits.

Shopping phase and occupant pose travel in the owning traffic record. Restore
validates the entire batch before publication, binds the trip to the restored
car, and publishes the shopper after terrain readiness. Unload removes the
associated shopper with its car. Full-lot terrain dependencies exist near live
views and are released when those views leave. Simulation remains Worker-owned;
there is no second city shopping loop in the UI.

Playable parking views request the main game's GPU/mesh default, with explicit
Canvas/GPU sprite URLs and native fallback retained. Parked references are native
vehicle bodies. **City road connection** stages one incoming road car in the real
seed-2026 generated city and uses normal Realm behavior thereafter. It offers a
normal new-world handoff. The preview stages its incoming car and parked references;
generated terrain, scenery, shopping authority and persistence remain the ordinary production path.
The four-visit authored comparison and immutable static
layout previews remain separately accessible.

[Generated city preview](https://tilefun.graehlarts.com/tilefun/workshop.html#/tool/parking-lab?play=1&city=1).

## Validation

Typechecks, 2,646 unit tests, lint (119 existing warnings / 34 infos),
245-sheet / 1,137-use art inventory, 816-candidate retina manifest verification
and production build pass. Streaming readiness passes with no missing-data or
incomplete-cache frames across ordinary entry and traversal. Deterministic coverage exercises current city sizes across
seeds, paved approach/exit paths, unchanged road endpoints, prop reconstruction,
complete traffic/shopper journeys, continuity at every phase, durable car identity,
native parked population and deletion, and released remote dependencies.

The complete 641-case browser run passed 640 cases. Its sole failure compared
the paused reload diagnostic's list order: two identical compact models with
equal X positions exchanged order after hydration, with all phases and poses
unchanged. Adding Y as the final diagnostic sort key fixes that assertion.
After rebuilding, all four parking browser cases pass (3.9 minutes), including
Canvas/GPU shopping cycles, frozen reload, phone-width controls, default 3D city
cars, the complete road visit/departure and main-game native parked population.
The full suite was not repeated after this diagnostic-only correction. Ordinary
vehicle driving, shared static-cache pixel/bounds checks and both intercity train
journeys passed in the complete run. All three static parking pixel fingerprints
still match the original committed references; no human approvals were inferred.

[Default mesh timing evidence](../benchmarks/133-shopping-mesh.json) records
sequential production-build samples on Apple M4 Pro with bundled full Chromium,
a 390×844 viewport and 4× desktop CPU throttling. After terrain settles plus ten
seconds, both five-second samples run at roughly 60 FPS: authored lot p95 16.8 ms,
generated city p95 16.7 ms. Each advances authority 301 ticks, builds zero additional
static composites and reports no page errors. Retained composites occupy about
5.1 MiB and 5.0 MiB respectively. This is warmed stationary desktop evidence,
not a physical phone FPS measurement; 132 records the original pavement cost
attribution and sprite-renderer comparison. The unavailable Android testbed
remains a limit. Owned browsers and temporary previews are closed.

Existing development worlds are not migrated or erased. Inspect new generation
in a fresh world; the preview's main-game handoff creates one.

Next: playtest traffic frequency, shopping dwell and additional lot variants.
