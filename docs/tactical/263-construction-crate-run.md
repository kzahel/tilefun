# 263 Construction crate run

The south apron of each generated construction yard has a parked racing coupe
and a three-tier stack of nine wooden crates. A straight run-up lets the
low nose take out the bottom supports so the crates above can tip and fall on
their own. The [Crate run preview](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=construction-crate-run#/tool/world-geometry)
starts beside the coupe in the actual regional yard. Press E or Interact to
board, then hold forward. Reset scene in Workshop rebuilds the stack.

The crates share the pallet’s loose rigid-body rotation and the normal
game renderer. The [crate source](../../art-source/construction/crate-v1/)
reuses the wooden pallet's paint and geometry at 19 × 15 × 18 world pixels,
matching its collision box. Crates remain ordinary saved actors after impact.
Their lower mass and slight bounce let them scatter without changing
car handling or the crane's pallet. Generation uses stable identities and
admits new crates into previously seeded chunks through ordinary actor additions.

The native yard test waits for the stack to settle, drives through it on
ordinary device input, checks that at least three crates tip past 81 degrees
and confirms that at least six move more than 20 world pixels.

The Workshop recording verifies keyboard boarding, a drive-through with
the crate GLB loaded, visible tumbling and a reset to the original stack.
The crate export reproduced byte for byte. The 136 focused tests,
typechecks, production build, generated inventories and streaming readiness pass.
