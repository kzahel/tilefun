"""Original mustard forklift with real seat/footwell/guard/mast/fork spaces."""


def role_face(ob, face, role):
    idx = keys.index(role)
    for li in face.loop_indices:
        ob.data.uv_layers.active.data[li].uv = (
            ((idx % 16) * 32 + 16) / 512,
            1 - (480 + (idx // 16) * 16 + 8) / 512,
        )


def counter_chart(ob):
    for f in ob.data.polygons:
        for li in f.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            if f.normal.x > 0.65:
                u = (p.y + 0.8) / 1.6
                py = 256 + (p.z - 0.30) / 0.8 * 128
            elif f.normal.z > 0.55:
                u = (p.x - 0.18) / 1.25
                py = 384 + (p.y + 0.8) / 1.6 * 64
            else:
                u = (p.x - 0.18) / 1.25
                py = (p.z - 0.30) / 0.8 * 256
            ob.data.uv_layers.active.data[li].uv = (
                max(0.001, min(0.999, u)),
                1 - max(0.5, min(479.5, py)) / 512,
            )


def rear_pocket(ob):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=0.31,
            depth=1.0,
            location=(0.92, side * 0.92, 0.25),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new("Forklift own rear wheel-local open pocket", "BOOLEAN")
        mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    ob.data.update()


def loft(name, stations, section, sweep_start, sweep_height):
    n = len(section)
    vv = [
        (x + sweep * max(0, min(1, (z - sweep_start) / sweep_height)), y * w, z)
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


def disk(name, center, normal, radius, role, segments=20, depth=0.018, group="body"):
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


counter = loft(
    "Mustard rounded rear counterweight actual wheelhouse skin",
    [(0.25, 0.88, 0), (0.39, 1, 0), (1.20, 1, 0), (1.34, 0.94, 0), (1.40, 0.80, 0)],
    [
        (-0.57, 0.28),
        (-0.73, 0.38),
        (-0.775, 0.69),
        (-0.72, 0.91),
        (-0.54, 1.02),
        (0, 1.05),
        (0.54, 1.02),
        (0.72, 0.91),
        (0.775, 0.69),
        (0.73, 0.38),
        (0.57, 0.28),
    ],
    1,
    1,
)
rear_pocket(counter)
counter_chart(counter)
cube(
    "Mustard narrow central chassis front wheels deliberately outboard",
    (-0.20, 0, 0.26),
    (1.48, 0.90, 0.08),
    "paintMid",
    bevel=0.035,
)
cube(
    "Actual open footwell lower floor",
    (-0.22, 0, 0.33),
    (1.02, 0.82, 0.06),
    "floor",
    bevel=0.015,
)
for side in [-1, 1]:
    cube(
        "Mustard footwell low side sill " + str(side),
        (-0.17, side * 0.44, 0.44),
        (0.91, 0.08, 0.18),
        "paint",
        bevel=0.025,
    )
cube(
    "Low seat actual pedestal",
    (0.22, 0, 0.53),
    (0.32, 0.37, 0.32),
    "chassis",
    bevel=0.025,
)
cube(
    "Low dark driver seat cushion actual volume",
    (0.16, 0, 0.73),
    (0.48, 0.57, 0.14),
    "seat",
    bevel=0.045,
)
cube(
    "Dark seat back actual volume",
    (0.48, 0, 0.935),
    (0.15, 0.59, 0.59),
    "seatLight",
    bevel=0.045,
)
# Four slim guard posts; front crossfoot is connected to narrow body and ends
# well above the exposed front rolling envelopes.
for x in [-0.50, 0.70]:
    cube(
        "STATIC guard lower crossfoot " + str(x),
        (x, 0, 0.72),
        (0.10, 1.25, 0.10),
        "mast",
        bevel=0.012,
    )
    for side in [-1, 1]:
        cube(
            "STATIC vertical overhead guard pillar " + str(x) + " " + str(side),
            (x, side * 0.59, 1.385),
            (0.065, 0.065, 1.37),
            "mast",
            bevel=0.009,
        )
for side in [-1, 1]:
    cube(
        "STATIC overhead guard side roof frame " + str(side),
        (0.10, side * 0.59, 2.055),
        (1.31, 0.065, 0.07),
        "mast",
        bevel=0.009,
    )
for x in [-0.53, 0.73, -0.12, 0.32]:
    cube(
        "STATIC overhead open roof crossbar " + str(x),
        (x, 0, 2.055),
        (0.06, 1.24, 0.07),
        "mast",
        bevel=0.009,
    )
# Tall twin mast rails are front and inboard of the exposed road tire slabs.
for side in [-1, 1]:
    cube(
        "STATIC tall twin mast rail " + str(side),
        (-1.01, side * 0.39, 1.15),
        (0.12, 0.095, 2.0),
        "mast",
        bevel=0.012,
    )
    cube(
        "STATIC mast gray inner runner " + str(side),
        (-1.079, side * 0.39, 1.16),
        (0.018, 0.035, 1.76),
        "mastLight",
    )
for z in [0.26, 0.75, 1.35, 2.07]:
    cube(
        "STATIC mast crossbar " + str(z),
        (-1.01, 0, z),
        (0.11, 0.82, 0.085),
        "mast",
        bevel=0.01,
    )
cube(
    "STATIC low fork carriage",
    (-1.09, 0, 0.39),
    (0.12, 0.87, 0.22),
    "mastLight",
    bevel=0.018,
)
# Each actual tine has a narrow vertical heel and a long tapered low blade.
for side in [-1, 1]:
    cube(
        "STATIC fork vertical heel " + str(side),
        (-1.15, side * 0.32, 0.33),
        (0.11, 0.12, 0.46),
        "fork",
        bevel=0.012,
    )
    vv = [
        (x, side * 0.32 + y, z)
        for x, z0, z1 in [(-2.30, 0.10, 0.13), (-2.18, 0.10, 0.17), (-1.10, 0.10, 0.18)]
        for y, z in [(-0.06, z0), (0.06, z0), (0.06, z1), (-0.06, z1)]
    ]
    ff = [
        (k * 4 + j, k * 4 + (j + 1) % 4, (k + 1) * 4 + (j + 1) % 4, (k + 1) * 4 + j)
        for k in range(2)
        for j in range(4)
    ] + [(3, 2, 1, 0), (8, 9, 10, 11)]
    mesh(
        "STATIC actual low narrow forward fork blade " + str(side),
        vv,
        ff,
        ["fork", "fork", "forkLight", "fork"] * 2 + ["fork", "fork"],
    )
for axle, end, r in [(-0.78, 0.485, 0.32), (0.92, 0.455, 0.25)]:
    tube(
        "STATIC own unequal axle arm " + str(axle),
        (axle, -end, r),
        (axle, end, r),
        0.028,
        "chassisLight",
        8,
    )
tube("STATIC steering column", (-0.30, 0, 0.42), (-0.43, 0, 0.93), 0.027, "mast", 8)
# Open steering ring, no extra wheel roll metadata.
n = 12
vv = [
    (-0.43 + r * math.cos(2 * math.pi * j / n), r * math.sin(2 * math.pi * j / n), z)
    for z in [0.925, 0.955]
    for r in [0.115, 0.16]
    for j in range(n)
]
ff = []
for j in range(n):
    j1 = (j + 1) % n
    ff += [
        (j, j1, n + j1, n + j),
        (2 * n + j, 3 * n + j, 3 * n + j1, 2 * n + j1),
        (j, 2 * n + j, 2 * n + j1, j1),
        (n + j, n + j1, 3 * n + j1, 3 * n + j),
    ]
mesh("STATIC open steering ring", vv, ff, "mast")
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
    mesh("Independent forklift road tire " + wid, vv, ff, roles, wid)
    disk(
        "Gray forklift wheel rim " + wid,
        (0, side * (width / 2 + 0.003), 0),
        (0, side, 0),
        r * 0.62,
        "rim",
        16,
        0.018,
        wid,
    )
    disk(
        "Broad gray forklift hub " + wid,
        (0, side * (width / 2 + 0.024), 0),
        (0, side, 0),
        r * 0.42,
        "silver",
        16,
        0.018,
        wid,
    )
    disk(
        "Forklift asymmetric hub inset " + wid,
        (r * 0.20, side * (width / 2 + 0.045), r * 0.12),
        (0, side, 0),
        r * 0.10,
        "ink",
        8,
        0.004,
        wid,
    )
