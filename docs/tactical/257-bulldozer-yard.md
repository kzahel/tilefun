# 257 Bulldozer yard

The owner asked to start with a slow, high-torque bulldozer that can push other
cars. The [Workshop yard](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=bulldozer-yard#/tool/world-geometry)
stages the dozer beside the player, with a parked Beetle ahead on pavement.
Press E or Interact to board, then hold Up or W to push. The fixture uses the
shared lab controls and **Reset scene** restores the starting arrangement.

The bulldozer uses a 36-unit chassis versus the standard 8, all-wheel off-road
traction, 164 px/s² acceleration and a 44 px/s forward cap. Reverse is half
speed. Shared suspension and contact impulses move the actual parked car,
whose new pose survives save/reload. The model uses the ordinary centered
100 × 64 × 44 px body envelope and steering. The blade stays in its working
pose and the tread belts stay fixed around four rolling road wheels.

The [editable Blender source](../../art-source/vehicle-bake/bulldozer/v1/)
reproduces the exact GLB and unlit UV atlas from its two retained inputs.
The [frozen review](../../public/demos/original-vehicles/bulldozer-v1/) pins
the five-mesh, 3,042-triangle model, the 16 game and 16 study views, signed wheel
poses, clearance proof and browser evidence. The [runtime receipt](../../art-source/vehicle-bake/runtime-bulldozer-v1.json)
pins the actual imported bounds and centered cardinal fallback frames.
The Workshop recipe is a scenario-only vehicle registration. Owner appearance
and pushing feedback will guide any equipment motion or editor rollout.

Focused native coverage checks the speed cap, sustained push, and saved car
position. Full Chromium exercises keyboard boarding, pushing, saved position
after reload and failed-mesh sprite presentation. In the captured run the parked
car traveled 211 px before the driver released the throttle.
