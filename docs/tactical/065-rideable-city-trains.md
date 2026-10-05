# 065 — Rideable city-to-city trains

Status: in progress.
Owner: [trains](../topics/trains.md).

The user authorized autonomous implementation and commits on 2026-10-05,
superseding their earlier motion/layout gate for this scope. No human art
verdicts are inferred. Keep native train pixels and immutable banks.

## Scope

Deliver an accessible two-city service with broad level curves, procedural
pixel tracks derived from the service alignment, roof riding and saved rides.
One train exclusively owns each bounded route. Water/unsupported crossings and
building conflicts reject routes; existing accepted straight crossings remain.
Switches, shared-track traffic, express services and curved grades are later work.

## Checkpoints

- Shared roof support now includes trains. Authority carries passengers by the
  committed pose and preserves roof-relative positions at native pose switches.
  Train sweeps include passenger ceiling clearance. Prediction uses replicated
  carriage velocity; center-rider corrections stay below 0.15px in the fixture.
- Saved rides restore by stable carriage identity after railway preparation,
  including offsets wider than a car and the carriage's absolute roof height.
- Train labs provide a roof-start control using an ordinary Realm command.
- Five new real-Realm regressions pass: off-center rides in both directions,
  mid-turn reload, trackside jumping/momentum, prediction and low ceilings.
  Existing curved-motion and car-riding regressions pass; typechecks pass.

- Eligible pairs now receive dry tangent arcs and usable city platforms, with
  deterministic road/terrain admission and retained straight fallback services.
- Analytic native-scale pixel tracks share the service path, chunk replication
  and ordinary Canvas/GPU terrain cache. No train sprite pixels changed.
- Fresh seed 2026 boards from Willowhaven and reaches Willowbridge. The real-Realm
  regression covers ordinary jump boarding, both bends, streaming, mid-bend reload,
  station arrival and alighting. Game profile resume preserves saved roof support;
  explicit travel still resets height. Generated bridges use 96px decks/384px ramps
  for passenger headroom while the low-ceiling lab retains its blocking case.
- Added a production city-train Workshop fixture and candidate; curved lab tracks
  share the production renderer. Native cardinal pose switches remain visible.

- Full browser travel exposed a missing-input gravity seam: sub-chunk carriages
  were indexed only by origin, so exact foot-cell queries could miss their roof.
  The shared spatial hash now indexes every footprint crossing a cell boundary
  and refreshes after same-cell pose changes. Dedicated spatial/gravity regressions
  pass; the Canvas game completes the full saved trip. Full suite: 1,567 unit tests.

Next: finish GPU/full browser and streaming validation and record final evidence.
