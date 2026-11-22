# 264 Forklift

A working forklift and two pallets park along the north side of generated
construction yards. The [Forklift loading yard](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=construction-forklift#/tool/world-geometry)
starts beside the same machine in a smaller practice apron. The pallet and
flatbed are lined up for the first lift. Two loose crates give players a
second exercise.

Board with E or Interact and drive the tines through the gaps under the pallet.
Open **Work forks** with F or D-pad Down. Hold I/K to lift/lower and O/U to
tilt back/forward. The on-screen controls also support touch and controller A
holds. Close the panel with Esc or B to drive. Raise the load above the deck,
level the forks, lower it onto the deck, then reverse to withdraw the tines.
The same steps stack one crate on another.

## Implementation

- The [working Blender revision](../../art-source/vehicle-bake/forklift/v2/)
  retains the original paint, open guard, ground origin and independent
  road-wheel rigs. A tilt pivot holds both mast stages and a sliding fork
  carriage. The tines are sized for the actual cargo runner gaps.
- The same shared fixed-tick motor, body-pose wire and vehicle records serve
  the game and Workshop. Fork lift and tilt accelerate and brake continuously.
  If the authored model fails to load, a simpler 3D model shows the same fork
  motion at the same ground pivot.
- The two tines and mast have Rapier collision shapes. Wooden cargo stays
  freely rotating and rides on contact. Space between its three runners
  leaves channels for the steel tines. The underside probe checks support
  during lowering so the forks can withdraw after the load settles.
- The physical flatbed and crate stacks use the existing shared scene and
  persistence. Fork and tilt positions survive vehicle reload.

## Qualification

Native tests pick up a pallet in the generated yard, carry and deposit a pallet
on the flatbed, stack one crate on another, and verify saved fork pose. The shared
crate run and crane regressions continue to exercise the same loose cargo.


The Workshop recording uses the v2 GLB and shows pickup, tilt, travel and
pallet release on the real deck. An aborted-model run shows the simplified
forklift lifting the pallet. Independent Blender export reproduces the
2,940-triangle GLB byte for byte and matches the four v1 wheel pivots and
roll metadata. The 188 focused tests and typechecks pass.
The production build, generated inventories and streaming readiness also pass.
