"""Original six-wheel yellow cab, deep level sloped dump tub and fixed rams.

Forward-X/upZ/ground0. No tipping hinge rig, animated cargo or bed motion.
"""


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
            elif kind == "floor":
                u = (p.x + 0.67) / 3.72
                py = 352 + (p.y + 1.0) / 2.0 * 64
            elif kind == "side" and f.normal.y * side < -0.5:
                u = (p.x + 0.80) / 3.95
                py = 448 + (p.z - 1.20) / 1.25 * 32
            elif (
                kind in ["frontwall", "tailgate"]
                and f.normal.x * (-1 if kind == "frontwall" else 1) < -0.5
            ):
                u = (
                    (p.y + 1.30) / 2.60 * 256 + (256 if kind == "tailgate" else 0)
                ) / 512
                py = 448 + (p.z - 1.20) / 1.25 * 32
            else:
                u = (p.x + 0.80) / 3.95
                py = 256 + (p.z - 1.15) / 1.35 * 96
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
            location=(axle, side * 1.26, 0.50),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new("Dump truck separate wheel-local pocket", "BOOLEAN")
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
    "Yellow stout short nose integrated front fenders",
    [(-3.07, 0.92, 0), (-2.93, 1, 0), (-1.00, 1, 0), (-0.84, 0.95, 0)],
    [
        (-1.06, 0.43),
        (-1.23, 0.55),
        (-1.27, 1.02),
        (-1.20, 1.32),
        (-1.01, 1.40),
        (0, 1.42),
        (1.01, 1.40),
        (1.20, 1.32),
        (1.27, 1.02),
        (1.23, 0.55),
        (1.06, 0.43),
    ],
)
pocket(front, -2.30)
chart(front, "front")
for f in front.data.polygons:
    if f.normal.z < 0.5:
        role_face(front, f, "paint" if f.center.z > 0.88 else "paintMid")
cab = loft(
    "Yellow closed dump cab continuous side front rear roof glass skin",
    [(-2.78, 0.96, 0.36), (-2.37, 1, 0), (-1.01, 1, 0), (-0.91, 0.95, -0.035)],
    [
        (-1.05, 1.15),
        (-1.16, 1.41),
        (-1.16, 2.33),
        (-1.10, 2.66),
        (-0.91, 2.77),
        (0, 2.80),
        (0.91, 2.77),
        (1.10, 2.66),
        (1.16, 2.33),
        (1.16, 1.41),
        (1.05, 1.15),
    ],
)
chart(cab, "cab")
# Continuous broad steel-blue lower rear body is below the open tub and carries
# both rear axle arches. It is a real chassis/fender bridge, not detached caps.
base = cube(
    "Steel blue lower rear body integrated middle last axle wheelhouses",
    (1.775, 0, 0.89),
    (2.65, 2.56, 0.58),
    "steelMid",
    bevel=0.035,
)
for axle in [1.12, 2.40]:
    pocket(base, axle)
for f in base.data.polygons:
    role_face(
        base,
        f,
        (
            "steel"
            if f.normal.z > 0.4
            else "steelMid" if f.center.z > 0.87 else "steelShadow"
        ),
    )

# True level floor and outward sloping side walls with independently painted
# inside skins. Floor overlaps lower wall thickness, so no painted fake tub.
floor = cube(
    "Deep open steel blue dump bed actual floor",
    (1.17, 0, 1.21),
    (3.62, 1.86, 0.08),
    "floor",
)
chart(floor, "floor")
for side in [-1, 1]:
    # outer bottom front/back, outer top front/back, inner bottom and top.
    vv = [
        (-0.65, side * 1.00, 1.22),
        (2.99, side * 1.00, 1.22),
        (3.10, side * 1.24, 2.42),
        (-0.78, side * 1.24, 2.42),
        (-0.56, side * 0.86, 1.25),
        (2.90, side * 0.86, 1.25),
        (2.99, side * 1.10, 2.42),
        (-0.67, side * 1.10, 2.42),
    ]
    ff = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (3, 2, 6, 7),
        (0, 3, 7, 4),
        (1, 5, 6, 2),
    ]
    wall = mesh(
        "Sloped steel dump side wall inner outer skin " + str(side), vv, ff, "steel"
    )
    chart(wall, "side", side)
    for f in wall.data.polygons:
        if f.normal.z > 0.7:
            role_face(wall, f, "steelRim")
        elif f.normal.z < -0.7:
            role_face(wall, f, "steelShadow")
    cube(
        "STATIC broad dump top side rim " + str(side),
        (1.16, side * 1.24, 2.425),
        (3.94, 0.12, 0.07),
        "steelRim",
        bevel=0.025,
    )
    # Three broad vertical ribs follow the actual outward wall slope.
    for x in [-0.10, 1.10, 2.30]:
        vv = [
            (xx, side * y, z)
            for xx in [x - 0.065, x + 0.065]
            for y, z in [(1.005, 1.28), (1.065, 1.28), (1.288, 2.36), (1.228, 2.36)]
        ]
        ff = [
            (0, 1, 2, 3),
            (4, 7, 6, 5),
            (0, 4, 5, 1),
            (1, 5, 6, 2),
            (2, 6, 7, 3),
            (3, 7, 4, 0),
        ]
        mesh(
            "Broad dump side rib " + str(side) + " " + str(x),
            vv,
            ff,
            ["steelMid", "steelMid", "steelLight", "steelLight", "steelRim", "steel"],
        )

for kind, label, sign in [
    ("frontwall", "Sloped dump front bulkhead actual inside skin", -1),
    ("tailgate", "Closed steel dump tailgate actual inside skin", 1),
]:
    if sign < 0:
        xo0, xo1, xi0, xi1 = -0.69, -0.80, -0.56, -0.67
    else:
        xo0, xo1, xi0, xi1 = 2.99, 3.10, 2.90, 2.99
    vv = [
        (xo0, -1.00, 1.22),
        (xo0, 1.00, 1.22),
        (xo1, 1.24, 2.42),
        (xo1, -1.24, 2.42),
        (xi0, -0.86, 1.25),
        (xi0, 0.86, 1.25),
        (xi1, 1.10, 2.42),
        (xi1, -1.10, 2.42),
    ]
    ff = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (3, 2, 6, 7),
        (0, 3, 7, 4),
        (1, 5, 6, 2),
    ]
    wall = mesh(label, vv, ff, "steel")
    chart(wall, kind)
    for f in wall.data.polygons:
        if f.normal.z > 0.6:
            role_face(wall, f, "steelRim")
        elif f.normal.z < -0.6:
            role_face(wall, f, "steelShadow")
    cube(
        "STATIC dump top " + kind + " rim",
        (xo1, 0, 2.425),
        (0.10, 2.40, 0.07),
        "steelRim",
        bevel=0.025,
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
        "Dark heavy underframe rail " + str(side),
        (0, side * 0.55, 0.48),
        (5.92, 0.15, 0.21),
        "chassis",
        bevel=0.02,
    )
    cube(
        "Gray cab step " + str(side),
        (-1.15, side * 1.16, 0.66),
        (0.46, 0.18, 0.14),
        "rim",
        bevel=0.02,
    )
    tube(
        "STATIC fixed stowed underbed ram " + str(side),
        (-0.40, side * 0.32, 0.64),
        (0.35, side * 0.32, 1.145),
        0.070,
        "rim",
        8,
    )
    cube(
        "STATIC underbed ram lower mount " + str(side),
        (-0.40, side * 0.32, 0.64),
        (0.24, 0.22, 0.16),
        "chassisLight",
        bevel=0.02,
    )
    cube(
        "STATIC small rear bed hinge block " + str(side),
        (3.10, side * 0.78, 1.08),
        (0.18, 0.22, 0.18),
        "rim",
        bevel=0.02,
    )
cube(
    "Retained narrow central floor no full axle tunnels",
    (0, 0, 0.48),
    (5.92, 1.52, 0.16),
    "chassis",
)
tube(
    "STATIC rear bed hinge pin",
    (3.12, -0.85, 1.10),
    (3.12, 0.85, 1.10),
    0.055,
    "chassisLight",
    12,
)
for axle in [-2.30, 1.12, 2.40]:
    tube(
        "STATIC axle attachment arm " + str(axle),
        (axle, -0.845, 0.50),
        (axle, 0.845, 0.50),
        0.045,
    )
for x in [-3.11, 3.11]:
    cube(
        "Short heavy gray dump bumper " + str(x),
        (x, 0, 0.61),
        (0.18, 2.46, 0.20),
        "rim",
        bevel=0.035,
    )
cube(
    "Dark broad dump front grille",
    (-3.087, 0, 1.055),
    (0.025, 1.34, 0.37),
    "ink",
    bevel=0.025,
)
for z in [0.95, 1.06, 1.17]:
    cube(
        "Broad yellow grille slat " + str(z),
        (-3.106, 0, z),
        (0.025, 1.22, 0.035),
        "paintLight",
    )
for side in [-1, 1]:
    cube(
        "Dump front headlamp ink frame " + str(side),
        (-3.075, side * 0.95, 1.10),
        (0.025, 0.32, 0.25),
        "ink",
        bevel=0.025,
    )
    cube(
        "Dump ivory headlamp " + str(side),
        (-3.095, side * 0.95, 1.105),
        (0.025, 0.22, 0.15),
        "cream",
        bevel=0.018,
    )
    cube(
        "Dump rear red lamp " + str(side),
        (3.13, side * 1.12, 0.85),
        (0.025, 0.18, 0.24),
        "ruby",
        bevel=0.02,
    )


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
    mesh("Rounded dump road tire " + wid, vv, ff, roles, wid)
    disk(
        "Gray dump wheel rim " + wid,
        (0, side * (width / 2 + 0.003), 0),
        (0, side, 0),
        0.30,
        "rim",
        16,
        0.018,
        wid,
    )
    disk(
        "Broad gray dump hub " + wid,
        (0, side * (width / 2 + 0.024), 0),
        (0, side, 0),
        0.20,
        "silver",
        16,
        0.018,
        wid,
    )
    disk(
        "Dump asymmetric hub inset " + wid,
        (0.09, side * (width / 2 + 0.045), 0.055),
        (0, side, 0),
        0.047,
        "ink",
        8,
        0.004,
        wid,
    )
