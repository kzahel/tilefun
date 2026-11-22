# 261 Mobile crane

The generated construction yard has a six-wheel mobile crane, a flatbed,
two hookable pallets and a stack of movable concrete blocks. The [Mobile
crane Workshop fixture](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=construction-crane#/tool/world-geometry)
starts beside the crane in the same seed-2026 yard used by the excavator.

## Controls

Board with **E** or **Interact**, then open **Work crane** with **F** or
D-pad Down. Hold J/L to slew, K/I to lower or raise the boom, U/O to retract
or extend it, and N/M to reel in or pay out the cable. On touch, hold an
on-screen button. On a controller, focus it and hold A. Each motor accelerates
and brakes on release or at a limit. H hooks or releases a pallet. T swaps
the empty hook for the wrecking ball. Esc or B closes the controls.

Extend the boom toward the nearest pallet and pay out the cable. Hook it,
reel in and raise the boom. Extend and slew toward the flatbed, then lower
and release the pallet. The ball tool swings through the practice stack
when the crane slews at the height of the blocks.

## Shared implementation

- The [working v2 source](../../art-source/vehicle-bake/mobile-crane/v2/)
  rebuilds the model from the retained semantic v1 Blender master and recipe.
  The sleeved boom, turntable and hook use absolute pivots. The six wheel
  rigs and paint charts are retained. The earlier frozen appearance stays
  at v1. The working version awaits human review.
- The crane and excavator share the 60 Hz arm motor. The crane maps the two
  linear controls to actual telescope travel and paid-out cable length.
  The chassis holds its position while working or suspending a load.
- The shared Rapier scene rebuilds the boom contact shape and connects the
  solved load with a unilateral rope joint. The ball and blocks exchange
  impulses, and the flatbed supports pallets at the authored deck height.
  The empty hook is drawn below the boom. A suspended tool draws its cable
  to the solved load.
- The [wooden pallet](../../art-source/construction/pallet-v1/) is a retained 3D
  model. Its loose body turns freely on all axes, with the rope attached to
  the local lift eye. Its quaternion and angular velocity travel through
  prediction snapshots and are saved with its actor record. The flatbed test
  uses the rotated collider's lowest point to check contact with the deck.
- Angles, extension and cable length persist in the ordinary vehicle record.
  Actor persistence retains loose cargo and block positions. A saved
  attachment uses the cargo's durable identity, so the current entity IDs
  can be resolved after reload. Game, Workshop and prediction use one scene
  step and the same held device input.

## Qualification

The native yard test loads a pallet on the physical flatbed, confirms the
ball hits the stack, and checks crane and payload state after reload.

The Workshop browser run used the working GLB, loaded a pallet onto the flatbed
and knocked a block off the top row. An independent Blender export reproduced
the runtime GLB byte for byte. The 151 focused tests, typechecks, production build,
generated inventories and streaming readiness pass.

The pallet follow-up verified a 64-degree tilt and visible twist in the Workshop
lift, then release and settling onto the real deck. The native test checks
off-axis swing and a round trip of the loose body's rotation and angular velocity.
The pallet GLB reproduced byte for byte. The 181 focused tests, typechecks,
production build, generated inventories and streaming readiness pass.
