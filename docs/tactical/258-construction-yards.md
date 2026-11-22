# 258 Construction yards

The owner requested a city-edge construction yard, a working excavator and
screenshots of the machine in use. The yard occupies the dry east infield of
each admitted motocross park, between the race lanes and clear of the practice
rollers. A paved route and loading bay, dirt dig zone, loose rubble, a shed and
a parkable bulldozer and dump truck share the ordinary regional generator.
The world map lists the named yard and travels to an open spot beside the cab.

The [Workshop construction yard](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=construction-yard#/tool/world-geometry)
opens the actual seed 2026 regional site. Board with E or Interact. F, D-pad
Down or the on-screen **Work arm** button opens eight controls. Hold J/L for
the cab, K/I for the boom, U/O for the stick or N/M for the bucket. Touch and
hold a button, or use the D-pad or stick to focus it and hold A. Release to
brake the joint. Esc or B resumes driving.

## Shared behavior

- The stopped cab driver sends a held direction with the ordinary movement input.
  The physics scene advances the four powered joints at 60 Hz and rebuilds their
  contact shapes on the ordinary Rapier chassis. The joint motor integrates angular velocity
  at 1/64-degree position resolution. It limits acceleration and reserves
  enough travel to brake at a joint limit or when the input is released. The
  cab can slew continuously through a full turn. The boom accelerates more
  slowly than the dipper or bucket. Terrain and props can stop a stroke. The
  chassis stays still while the arm moves.
- Curl near the pile to scoop a loose rock. Raise the boom, reach out, swing
  over the truck, and open the bucket. The dropped rock is an ordinary rigid
  body and lands in the truck's existing physical bed. The dump truck can tip its
  bed using the existing controls.
- The four joint angles and loaded bucket persist with the vehicle. Loose rocks
  use the ordinary actor store. One replicated packed pose drives every vehicle
  view. Physics replay carries the current pose, angular speed, held direction
  and target. Reloading leaves the arm at its saved angle. Earlier packed pose records
  retain their original angles when loaded.
- This slice works loose rubble. The dirt ground is the working surface. The
  emergency sprite fallback shows the resting pose.

## Evidence

The [editable Blender source](../../art-source/vehicle-bake/excavator/v1/)
replays the exact GLB and UV atlas from its two retained inputs. The
[frozen art candidate](../../public/demos/original-vehicles/excavator-v1/) pins
the 2,840-triangle model, four independent road-wheel rigs and 32 static
game/study views. The cab, boom, stick and bucket share authored pivots with
the authority. Agent inspection covers the actual articulated gameplay clip.
Formal appearance review is pending.

Native checks exercise the generated yard, scooping, physical truck loading,
pose/cargo persistence, a real roof obstruction, bounded acceleration through
the exact stop, a steady full turn, held-input timeout and mid-stroke wire replay.
Full Chromium verifies keyboard, mouse, touch and controller holds in the
generated Workshop scene. The 3D scoop-and-drop recording includes a 60-degree
boom stroke and a continuous 92-degree cab swing.
