# 265 Construction playground

The city-edge construction yard gains a crane-fed marble run on its north apron
and a vehicle seesaw on its west apron. The Workshop also opens each activity
with a vehicle parked at the start.

- [Giant marble run](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=construction-marble-run#/tool/world-geometry).
  Board the crane and open **Work crane**. Raise the boom about halfway, extend
  it fully, and select **Switch hook / ball**. Select **Hook / release** to drop
  the steel ball into a three-slope track ending at a stack of wooden crates.
  The green exit chute has enclosed side fork slots. Lift it from those slots
  to carry it to a new position.
- [Vehicle seesaw](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=construction-seesaw#/tool/world-geometry).
  Board the car and drive onto the yellow end. The load on either side of the axle
  determines which end goes down.

The shared Worker and the local predictor use the same rigid bodies. The marble
spins about all axes and the crane releases its existing rope constraint. The
seesaw's translation is constrained at its centre of mass and its rotation is
free around the axle only. Physical contact with the ground limits the travel.
The attraction layouts and parked vehicles are shared between regional
generation and the Workshop recipes.

The [Blender sources](../../art-source/construction/physics-playground-v1/)
read the same geometry as the Rapier compound colliders. The shared renderer
uses the solved body quaternions for the entirely three-dimensional models.
The normal sprite assets supply loading fallbacks.

Native scenario tests cover the crane drop, actual travel along the movable
chute, the crate impact, forklift pickup and transport, and the car changing the slope of the
seesaw while its axle holds position. The generated-yard fixture verifies both
attractions and their staged vehicles are admitted alongside the previous yard.

The Workshop gameplay capture exercises the three actions in the unified
renderer with the authored GLBs loaded. The 59 focused tests, typechecks,
generated inventories and production build pass.
