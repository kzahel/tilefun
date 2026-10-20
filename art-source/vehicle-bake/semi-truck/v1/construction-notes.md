# Rigid purple tractor and cream/teal box trailer v1

This original is a rigid visual combination: tall purple tractor cab and a long
cream box trailer with broad teal stripe. A real open space separates the volumes
above an actual low fifth-wheel plate, fixed saddle, short visual kingpin and frame
bridge. Two restrained silver stacks end below trailer roof. The exported low is
one Body_static plus six independent road-wheel meshes. No articulated joint,
hitch gameplay or separate trailer physics is implemented or qualified.

Front is -X, up+Z, ground0, world scale80/4.6. Three explicit axle definitions are
tractor frontX=-3.45 (FL/FR), tractor driveX=-0.75 (ML/MR), trailer rearX=3.45
(RL/RR). All six have source r0.50/world r8.695652173913045, their own Steer>Roll>
mesh assemblies and roll_axis_gltf[0,0,-1]. Only front steer flags are enabled;
nonzero steering and suspension remain unqualified.

The constructor retains local mesh/cube/tube/disk, wheel and guard utilities that
originated in the immutable delivery-van constructor (SHA-256
`e0923c6dc4d730ab34b9b726bfa6162b2b732966c8d13ef889225036cab0678f`).
Flatbed/motorhome provided read-only wrapper patterns. There is no old-family
geometry/source read at replay time. Cab/trailer shape, six-axle inventory,
coupling/frame/stacks, UV charts, palette and crown region are semi-owned.

`master.blend` retains65 named editable semantic components; `car.blend` retains
seven runtime meshes. Both pack the actual opaque512 atlas and an explicitly
unused palette-planning image. This economical component master uses runtime
topology, not a separate high-poly transfer workflow. Tractor glass/ends/roof and
trailer sides/ends/roof have explicit actual skin charts. No glass overlays/PBR,
logos, transparent glazing or view-dependent texture projection.

The explicit multi-axle-v2 review config declares exactlyFL,FR,ML,MR,RL,RR.
Builder and source audit call catalog-v2.audit_glb(...,wheel_ids=all6), pinning
catalog-v2.py and underlying catalog.py. Capture uses family-capture-v2.mjs and
offline assembly uses family-package-v2.py with its unchanged underlying package.
All6 clearances and all6 collision-negative controls pass clearance-v2.py; coverage
automatically discovers all6 actual roll pivots, checks25/25 each and runs controls.
Four bad actual wheel inventories and an omitted-middle-wheel clearance declaration
are explicitly rejected. Earlier pinned tools remain byte-identical.

Actual coupling proof measures0.730000 source between cab-rear/trailer-front
triangles. Six lateral rays pass through real empty space; three downward rays
hit low plateZ1.19, and frame/saddle rays hit actual fixed triangles. Filled-gap
geometry is rejected; exact reset restores every hit. Fourteen actual triangle/
barycentric UV probes verify cab/trailer/glass/stripe/roof/door/grille, plate,
frame, stack and guard ownership. All fixed triangles participate in six-cylinder
neutral-roll proof; per-wheel decoded radii match rig metadata within0.0001 world.

Native288/radius144 adds transparent padding at unchanged world-pixel density and
vehicle origin. Study/game anchors144,172 /144,144. Actual extents would touch or
exceed224 and256 centered viewports, while all32 complete288 views have clear
borders. Shared centered128 game crop proof is exact at all16 headings. All four
actual cardinals fit192×224 origin96,144 by integer translation(-48,0) with every
occupiedRGBA pixel exact, no resize or origin shift.

Actual full source dimensions9.215×2.525×3.030 include bumpers, mirrors, six guards
and stacks. Minimal fresh isolated replay needs six retained constructor/config
files and both catalog helpers; GLB,atlas,recipe reproduce byte for byte. Data
locations are outputs only. Packed blend byte determinism is not claimed.
Parent owns independent QA/freeze/root registration/runtime/docs/global checks.
Agent QA is not formal human approval. Completed v1 bytes are immutable.
