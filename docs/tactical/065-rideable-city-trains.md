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

Next: generate curved links and render their tracks through shared terrain caches,
then complete all required checks and full browser/streaming validation.
