"""Original cobalt/cream static tapered drum six-wheel mixer. Forward -X, up Z."""


def role_face(ob, face, role):
    idx = keys.index(role)
    for li in face.loop_indices:
        ob.data.uv_layers.active.data[li].uv = (
            ((idx % 16) * 32 + 16) / 512,
            1 - (480 + (idx // 16) * 16 + 8) / 512,
        )


def chart(ob, kind, side=0):
    for f in ob.data.polygons:
        for li in f.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            if kind == "cab":
                if abs(f.normal.x) > 0.65:
                    u = (
                        (p.y + 1.30) / 2.60 * 256 + (256 if f.center.x > -1.3 else 0)
                    ) / 512
                    py = 144 + (p.z - 1.0) / 1.85 * 112
                elif f.normal.z > 0.6 and f.center.z > 2.67:
                    u = (p.x + 2.85) / 2.05
                    py = 416 + (p.y + 1.30) / 2.60 * 16
                else:
                    u = (p.x + 3.15) / 2.35
                    py = (p.z - 1.0) / 1.85 * 144
            elif kind == "front":
                u = (p.y + 1.30) / 2.60
                py = 432 + (p.x + 3.15) / 2.35 * 16
            else:
                raise ValueError(kind)
            ob.data.uv_layers.active.data[li].uv = (
                max(0.001, min(0.999, u)),
                1 - max(0.5, min(479.5, py)) / 512,
            )


def pocket(ob, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=0.56,
            depth=1.0,
            location=(axle, side * 1.24, 0.50),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new("Mixer separate wheel-local pocket", "BOOLEAN")
        mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    ob.data.update()


def loft(name, stations, section):
    n = len(section)
    vv = [
        (x + sweep * max(0, min(1, (z - 1.40) / 1.40)), y * w, z)
        for x, w, sweep in stations
        for y, z in section
    ]
    ff = [
        (i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j)
        for i in range(len(stations) - 1)
        for j in range(n)
    ]
    ff += [
        tuple(range(n - 1, -1, -1)),
        tuple((len(stations) - 1) * n + j for j in range(n)),
    ]
    return mesh(name, vv, ff, "paint")


front = loft(
    "Cobalt blunt forward nose integrated real front fenders",
    [(-3.27, 0.94, 0), (-3.11, 1, 0), (-1.13, 1, 0), (-0.98, 0.96, 0)],
    [
        (-1.04, 0.43),
        (-1.20, 0.55),
        (-1.25, 1.04),
        (-1.19, 1.32),
        (-1.00, 1.40),
        (0, 1.42),
        (1.00, 1.40),
        (1.19, 1.32),
        (1.25, 1.04),
        (1.20, 0.55),
        (1.04, 0.43),
    ],
)
pocket(front, -2.45)
chart(front, "front")
for f in front.data.polygons:
    if f.normal.z < 0.5:
        role_face(front, f, "paint" if f.center.z > 0.88 else "paintMid")
cab = loft(
    "Closed cobalt cab continuous side front rear cream roof glass skin",
    [(-2.91, 0.97, 0.35), (-2.49, 1, 0), (-1.18, 1, 0), (-1.07, 0.96, -0.035)],
    [
        (-1.04, 1.15),
        (-1.14, 1.41),
        (-1.14, 2.24),
        (-1.08, 2.48),
        (-0.90, 2.59),
        (0, 2.62),
        (0.90, 2.59),
        (1.08, 2.48),
        (1.14, 2.24),
        (1.14, 1.41),
        (1.04, 1.15),
    ],
)
chart(cab, "cab")
# Roof has its own cream chart; no overlaid glass planes.
for f in cab.data.polygons:
    if f.normal.z > 0.6 and f.center.z > 2.48:
        for li in f.loop_indices:
            p = cab.data.vertices[cab.data.loops[li].vertex_index].co
            cab.data.uv_layers.active.data[li].uv = (
                (p.x + 2.85) / 2.05,
                1 - (416 + (p.y + 1.30) / 2.60 * 16) / 512,
            )
base = cube(
    "Cream rear chassis deck integrated middle last axle wheelhouses",
    (1.82, 0, 0.90),
    (2.98, 2.50, 0.60),
    "cream",
    bevel=0.035,
)
for axle in [1.12, 2.45]:
    pocket(base, axle)
for f in base.data.polygons:
    role_face(
        base,
        f,
        (
            "cream"
            if f.normal.z > 0.4
            else "paintMid" if f.center.z > 0.87 else "paintDeep"
        ),
    )


def tube(name, a, b, radius, role="chassisLight", sides=8):
    a, b = Vector(a), Vector(b)
    t = (b - a).normalized()
    u = t.cross(Vector((0, 0, 1)))
    if u.length < 0.001:
        u = t.cross(Vector((0, 1, 0)))
    u.normalize()
    v = t.cross(u)
    vv = [
        tuple(
            p
            + radius
            * (
                u * math.cos(2 * math.pi * j / sides)
                + v * math.sin(2 * math.pi * j / sides)
            )
        )
        for p in [a, b]
        for j in range(sides)
    ]
    ff = [
        (j, (j + 1) % sides, sides + (j + 1) % sides, sides + j) for j in range(sides)
    ]
    ff += [tuple(range(sides - 1, -1, -1)), tuple(sides + j for j in range(sides))]
    return mesh(name, vv, ff, role)


for side in [-1, 1]:
    cube(
        "Dark longitudinal mixer underframe rail " + str(side),
        (0, side * 0.55, 0.48),
        (6.28, 0.15, 0.21),
        "chassis",
        bevel=0.02,
    )
    cube(
        "Gray cab step " + str(side),
        (-1.35, side * 1.13, 0.66),
        (0.44, 0.18, 0.14),
        "rim",
        bevel=0.02,
    )
    for x in [-0.24, 2.24]:
        cube(
            "STATIC cream drum bearing pedestal " + str(side) + " " + str(x),
            (x, side * 0.50, 1.34),
            (0.28, 0.22, 0.38),
            "steelMid",
            bevel=0.03,
        )
        tube(
            "STATIC broad drum cradle brace " + str(side) + " " + str(x),
            (x, side * 0.68, 1.20),
            (x, side * 0.38, 1.67),
            0.075,
            "rim",
            8,
        )
cube(
    "Narrow central floor preserving wheel local pockets",
    (0, 0, 0.48),
    (6.28, 1.48, 0.16),
    "chassis",
)
for axle in [-2.45, 1.12, 2.45]:
    tube(
        "STATIC axle attachment arm " + str(axle),
        (axle, -0.805, 0.50),
        (axle, 0.805, 0.50),
        0.045,
    )
for x in [-3.31, 3.31]:
    cube(
        "Short cream gray mixer bumper " + str(x),
        (x, 0, 0.61),
        (0.18, 2.42, 0.20),
        "rim",
        bevel=0.035,
    )
cube(
    "Broad dark mixer front grille",
    (-3.283, 0, 1.055),
    (0.025, 1.32, 0.37),
    "ink",
    bevel=0.025,
)
for z in [0.95, 1.06, 1.17]:
    cube(
        "Broad cream grille slat " + str(z),
        (-3.301, 0, z),
        (0.025, 1.20, 0.035),
        "cream",
    )
for side in [-1, 1]:
    cube(
        "Mixer headlamp ink frame " + str(side),
        (-3.275, side * 0.94, 1.10),
        (0.025, 0.32, 0.25),
        "ink",
        bevel=0.025,
    )
    cube(
        "Mixer cream headlamp " + str(side),
        (-3.295, side * 0.94, 1.105),
        (0.025, 0.22, 0.15),
        "white",
        bevel=0.018,
    )
    cube(
        "Mixer rear red lamp " + str(side),
        (3.335, side * 1.08, 0.88),
        (0.025, 0.18, 0.24),
        "ruby",
        bevel=0.02,
    )
# Tapered real circular drum. Ring centers lie on the slightly angled axis.
D = CFG["drum"]
origin = Vector(D["origin"])
axis = Vector(D["axisUnnormalized"]).normalized()
u = Vector((0, 1, 0))
v = axis.cross(u).normalized()
nr = D["segments"]
rings = D["rings"]
vv = [
    tuple(
        origin
        + axis * s
        + r * (u * math.cos(2 * math.pi * j / nr) + v * math.sin(2 * math.pi * j / nr))
    )
    for s, r in rings
    for j in range(nr)
]
ff = [
    (k * nr + j, k * nr + (j + 1) % nr, (k + 1) * nr + (j + 1) % nr, (k + 1) * nr + j)
    for k in range(len(rings) - 1)
    for j in range(nr)
]
ff += [
    tuple(range(nr - 1, -1, -1)),
    tuple((len(rings) - 1) * nr + j for j in range(nr)),
]
drum = mesh(
    "STATIC tapered round drum longitudinal angular spiral UV skin", vv, ff, "cream"
)
drum["drum_axis_source"] = list(axis)
drum["drum_origin_source"] = list(origin)
drum["drum_ring_specs"] = str(rings)
drum["uv_owner"] = (
    "longitudinal s / angle turn; atlas pixels y256..416; wrap seam cream padding"
)
for f in drum.data.polygons:
    if f.index < (len(rings) - 1) * nr:
        k, j = divmod(f.index, nr)
        coords = [
            (rings[k][0] / rings[-1][0], j / nr),
            (rings[k][0] / rings[-1][0], (j + 1) / nr),
            (rings[k + 1][0] / rings[-1][0], (j + 1) / nr),
            (rings[k + 1][0] / rings[-1][0], j / nr),
        ]
        for li, (s, a) in zip(f.loop_indices, coords):
            drum.data.uv_layers.active.data[li].uv = (
                0.5 / 512 + s * 511 / 512,
                1 - (256.5 + a * 159) / 512,
            )
    else:
        role_face(drum, f, "paintDeep" if f.index == (len(rings) - 1) * nr else "cream")
# Fixed broad rear hopper with visible open top and inner floor, then one short
# stowed trough. No wheel metadata, armatures, drum rotation or chute animation.
hopper_floor = cube(
    "STATIC rear hopper actual inner floor",
    (2.95, 0, 2.10),
    (0.52, 0.52, 0.08),
    "steelMid",
)
for side in [-1, 1]:
    vv = [
        (2.65, side * 0.26, 2.10),
        (3.20, side * 0.26, 2.10),
        (3.25, side * 0.43, 2.57),
        (2.60, side * 0.43, 2.57),
        (2.67, side * 0.20, 2.14),
        (3.18, side * 0.20, 2.14),
        (3.18, side * 0.35, 2.57),
        (2.67, side * 0.35, 2.57),
    ]
    mesh(
        "STATIC cream hopper side inner outer wall " + str(side),
        vv,
        [
            (0, 1, 2, 3),
            (4, 7, 6, 5),
            (0, 4, 5, 1),
            (3, 2, 6, 7),
            (0, 3, 7, 4),
            (1, 5, 6, 2),
        ],
        ["cream", "steelMid", "steelShadow", "steelLight", "cream", "cream"],
    )
for x in [2.65, 3.20]:
    cube("STATIC hopper end wall " + str(x), (x, 0, 2.33), (0.06, 0.76, 0.46), "cream")
# Folded chute is low and centered, clear of both rear tire slabs.
vv = [
    (2.90, -0.22, 1.88),
    (3.29, -0.22, 1.43),
    (3.29, 0.22, 1.43),
    (2.90, 0.22, 1.88),
    (2.90, -0.22, 2.00),
    (3.29, -0.22, 1.55),
    (3.29, 0.22, 1.55),
    (2.90, 0.22, 2.00),
]
mesh(
    "STATIC short stowed gray chute trough floor lips",
    vv,
    [(0, 1, 2, 3), (0, 4, 5, 1), (3, 2, 6, 7), (0, 3, 7, 4), (1, 5, 6, 2)],
    ["rim", "cream", "cream", "steelMid", "rim"],
)
tube("STATIC chute support", (2.88, 0, 1.20), (3.06, 0, 1.60), 0.065, "chassisLight", 8)


def disk(name, center, normal, radius, role, segments=16, depth=0.018, group="body"):
    c = Vector(center)
    normal = Vector(normal).normalized()
    u = normal.cross(Vector((0, 0, 1)))
    if u.length < 0.001:
        u = normal.cross(Vector((0, 1, 0)))
    u.normalize()
    v = normal.cross(u)
    vv = [
        tuple(
            c
            + normal * dep
            + rad
            * (
                u * math.cos(2 * math.pi * j / segments)
                + v * math.sin(2 * math.pi * j / segments)
            )
        )
        for dep, rad in [(0, radius), (depth, radius * 0.88)]
        for j in range(segments)
    ]
    ff = [
        (j, (j + 1) % segments, segments + (j + 1) % segments, segments + j)
        for j in range(segments)
    ]
    ff.append(tuple(segments + j for j in range(segments)))
    return mesh(name, vv, ff, role, group)


for wid, spec in CFG["wheelSpecs"].items():
    r, width, nr = spec["radius"], spec["width"], spec["segments"]
    side = -1 if wid[1] == "L" else 1
    vv, ff, roles = [], [], []
    for y, rad in [
        (-width / 2, r * 0.84),
        (-width * 0.36, r * 0.97),
        (0, r),
        (width * 0.36, r * 0.97),
        (width / 2, r * 0.84),
    ]:
        for j in range(nr):
            t = 2 * math.pi * j / nr
            vv.append((rad * math.sin(t), y, rad * math.cos(t)))
    for k in range(4):
        for j in range(nr):
            ff.append(
                (
                    k * nr + j,
                    k * nr + (j + 1) % nr,
                    (k + 1) * nr + (j + 1) % nr,
                    (k + 1) * nr + j,
                )
            )
            roles.append("tire" if k in [1, 2] else "tireLight")
    for k in [0, 4]:
        ff.append(tuple(k * nr + j for j in range(nr)))
        roles.append("tire")
    mesh("Rounded mixer road tire " + wid, vv, ff, roles, wid)
    disk(
        "Gray mixer wheel rim " + wid,
        (0, side * (width / 2 + 0.003), 0),
        (0, side, 0),
        0.30,
        "rim",
        16,
        0.018,
        wid,
    )
    disk(
        "Broad gray mixer hub " + wid,
        (0, side * (width / 2 + 0.024), 0),
        (0, side, 0),
        0.20,
        "silver",
        16,
        0.018,
        wid,
    )
    disk(
        "Mixer asymmetric hub inset " + wid,
        (0.09, side * (width / 2 + 0.045), 0.055),
        (0, side, 0),
        0.047,
        "ink",
        8,
        0.004,
        wid,
    )
