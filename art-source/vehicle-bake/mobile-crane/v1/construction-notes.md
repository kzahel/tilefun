# Low orange/yellow mobile crane — rigid stowed v1

This original owns a low orange carrier with six locally open wheel pockets and
integrated arch shoulders, closed front driver cab, small offset closed glazed
operator pod, three broad stepped solid yellow boom sections, fixed low turntable/
pedestal/roof cradle, real short cable and gray J hook, and four short retracted
outrigger caps. All work equipment is joined into Body_static. Only six road
wheels move. No lifting, telescoping, cable or outrigger animation/gameplay.

Front-X, up+Z, ground0; world scale80/4.6. Explicit axle definitions areF=-2.70,
M=0,R=2.45 source. Wheel IDsFL,FR,ML,MR,RL,RR each have r0.51 source/world
8.869565217391306 and their own Steer>Roll>mesh assembly. Only front steer flags
are enabled; nonzero steering/suspension remains unqualified.

The own constructor retains local mesh/cube/tube/disk and wheel/guard utilities
originally from immutable delivery-van source (SHA-256
`e0923c6dc4d730ab34b9b726bfa6162b2b732966c8d13ef889225036cab0678f`).
Semi-truck provided read-only six-wheel tool/wrapper patterns. No prior-family
source/geometry is read at model replay time. Crane hull/cabs/equipment geometry,
UV charts, palette, wheel bounds and finite crown region are independently owned.

`master.blend` retains58 editable semantic components; `car.blend` retains7 runtime
meshes. Both pack the actual opaque512 atlas and an explicitly unused palette
planning image. Economical semantic component master uses runtime topology, not
a separate high-poly transfer workflow. Driver cab, visible carrier front, low
carrier skin, operator pod and fixed yellow boom faces have explicit paint owners.
Glass is opaque actual skin paint with continuous dark frames, never overlay panes.

Actual boom top heights2.32/2.58/2.80 and widths0.72/0.58/0.44 source are probed on
the exported GLB. The offset pod roof is2.56; gray tip shoe bounds maximum equipment
height2.83. Actual hook/cable triangle hits and four cap outer faces atY±1.29 are
retained. Raised real inner-boom vertices and a false extended cap both fail the
stow envelope, then exact reset restores original hits. This qualifies a fixed
stowed visual state only. Whole-body six-cylinder clearance includes all equipment.

The actual v2 audit declares all6 IDs and rejects four bad inventories. V2 clearance
proves all6 envelopes and injects/rejects6 separate body collisions with reset;
an omitted-middle-wheel clearance declaration fails. Own crown region derives from
r0.51/width0.34 and passes25/25 each wheel plus positive/negative controls. All6
actual decoded radii match rig metadata within0.0001 world. Captured independent
quarter/reverse/pivot/absolute reset keeps the entire equipment body fixed.

Native256/radius128 expands transparent padding at unchanged world density and
origin (study128,156;game128,128). All32 headings and16 signed-phase frames plus
both wireframes are inspected. Shared centered128 game crop parity is exact at
all16 headings. Four actual cardinals fit192×224 origin96,144 with every occupied
RGBA pixel exact by integer translation(-32,+16), no resize or vehicle-origin move.

Actual full dimensions7.345×2.614×2.830 source include the small front hook, gray
tip shoe, caps, mirrors and hub/guard width. The recorded centered world enclosure
is130×46×50 with no tolerance fudge. All maximum equipment height remains close
to the cab/operator roof range; this is not a tower crane pose.

Minimal fresh isolated replay needs six retained constructor/config inputs and
both catalog-v2.py/underlying catalog.py. GLB,atlas,recipe reproduce byte for byte;
data locations are outputs only. Packed blend byte determinism is not claimed.
Actual v2 adapters/underlying helpers are hash-pinned. Parent owns independent
QA/freeze/root registration/runtime/docs/global checks. Agent QA is not formal
human approval. Completed v1 bytes are immutable.
