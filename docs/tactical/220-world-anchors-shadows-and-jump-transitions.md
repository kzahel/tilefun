# Anchored resources, ramp shadows and jump transitions

Status: in progress. Owner feedback 2026-11-04.
Owners: [physics](../topics/physics-engine.md), [prediction](../topics/player-prediction.md),
[rendering](../topics/rendering-architecture.md), [resource behavior](../topics/wildlife-behaviors.md).

## Scope and contracts

- Audit edible plants and other resource markers. Anchored ground supplies/sites
  must stay put; actual carryable loose items retain normal physical interactions.
  Classify authority and replica consistently without requiring private work state.
- Reproduce the vehicle footprint falling through a ramp crest to terrain. Select
  finite receivers using the displayed caster geometry and retain underpass/depth
  behavior. No new art, shadow maps or second collision authority.
- Reproduce display/camera discontinuities as a rider lands on or leaves a train,
  using production prediction, normal buffered presentation and delayed frames.
  Repair timeline/contact handoffs without another movement/carry solver.
- A fresh airborne jump press held through landing queues exactly one jump.
  Release cancels the held request; consuming it cannot auto-repeat indefinitely.
  Queue state must survive ordinary binary replay and clear on explicit relocation.
- Commit qualified checkpoints, update owning docs, run affected native/browser
  boundaries and inventories/build, and mark playable delivery ready.

## Resource and jump queue checkpoint

The editor's Edible plant is a nongrowing `greens` resource. The old rule made
all work items without growth/storage metadata loose, including greens, ground
seeds, nectar and water. Classification now anchors all noncarryable supplies/sites;
only actual carryable resource types become loose. Type identity works on replicas
without private work state. Native coverage audits every forage/source kind and
walks through a planted resource while still physically pushing loose fruit.
Existing moved plants stay at their current saved location; the change stops new
physics displacement rather than inventing an original placement.

The common motor records a fresh airborne press while held. It consumes that
single queue on the next grounded tick, cancels on release/expired controls, and
clears on explicit relocation. Holding the original takeoff press never loops.
Frame 0x14 adds one byte per body for the queue, with malformed-flag rejection.
Native checks restore a queued midflight state through the normal binary frame,
verify one landing jump and exact replay, then release/relocation cancellation.

Both changes keep the one shared world step and ordinary input/prediction owners.
No species art, ledgers or asset approvals change.
