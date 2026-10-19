# Insects, autonomous run 140

Bee, ladybug, dragonfly, stag beetle, grasshopper and cricket use fresh editable
six-legged scenes with fixed three-link limbs, grounded resting feet, antennae,
rigid closed wing panels and source-driven folding during flight or hopping.
Bee has geometry-based abdominal bands, ladybug red spotted opening wing covers,
dragonfly four narrow wings and five abdomen links, stag beetle opening covers
and branched mandibles, and grasshopper/cricket enlarged folding hind legs.

These profiles use the existing bounded physical airborne arc, with explicit
push/landing times and a 4-10px height. Flight/hop poses match that clock; world
motion supplies the height. Stag beetle uses short flights rather than a new
crawling controller. The existing catch guard protects airborne animals and
allows meals after landing. They do not add unrestricted aerial navigation.

Independent saved-scene audits check quarter-pose limb/antenna/tail endpoints,
wing roots and tip travel, resting contacts, fixed local mesh coordinates/scales,
loop closure and exact delivery/physical-hop duration. Native palette painting
uses actual posed mesh volumes; travel previews also show the physical arc.
Exact registered banks/helpers become immutable; checks are not human approval.
