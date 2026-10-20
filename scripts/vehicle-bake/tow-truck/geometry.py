"""Own short heavy tow chassis, closed cab and static low recovery frame.

Forward-X/upZ/ground0. Rear is a flat platform, never a recessed bed. All work
equipment joins Body_static; only the four standard road wheels roll.
"""


def role_face(ob, face, role):
    idx = keys.index(role)
    for li in face.loop_indices:
        ob.data.uv_layers.active.data[li].uv = (
            ((idx % 16) * 32 + 16) / 512,
            1 - (480 + (idx // 16) * 16 + 8) / 512,
        )


def chart(ob, kind):
    for f in ob.data.polygons:
        for li in f.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            if kind == "cab":
                if abs(f.normal.x) > 0.65:
                    u = (
                        (p.y + 1.15) / 2.30 * 256 + (256 if f.center.x > -0.8 else 0)
                    ) / 512
                    py = 288 + (p.z - 1.0) / 1.35 * 112
                elif f.normal.z > 0.6 and f.center.z > 2.18:
                    u = (p.x + 2.0) / 1.65
                    py = 400 + (p.y + 1.15) / 2.30 * 32
                else:
                    u = (p.x + 2.0) / 1.65
                    py = 144 + (p.z - 1.0) / 1.35 * 144
            elif kind == "front" and f.normal.z > 0.6 and f.center.z > 1.18:
                u = (p.y + 1.15) / 2.30
                py = 432 + (p.x + 2.85) / 2.55 * 16
            elif kind == "deck" and f.normal.z > 0.6 and f.center.z > 1.12:
                u = (p.y + 1.12) / 2.24
                py = 448 + (p.x + 0.36) / 2.84 * 32
            else:
                u = (p.x + 2.85) / 5.4
                py = (p.z - 0.35) / 0.98 * 144
            ob.data.uv_layers.active.data[li].uv = (
                max(0.001, min(0.999, u)),
                1 - max(0.5, min(479.5, py)) / 512,
            )


def pocket(ob, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=0.55,
            depth=1.0,
            location=(axle, side * 1.17, 0.49),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new("Local integrated tow wheel pocket", "BOOLEAN")
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


front = loft(
    "Blue broad short hood coachwork integrated front fenders",
    [(-2.78, 0.91, 0), (-2.63, 1, 0), (-1.70, 1, 0), (-0.45, 1, 0), (-0.34, 0.96, 0)],
    [
        (-0.96, 0.40),
        (-1.09, 0.50),
        (-1.12, 0.93),
        (-1.07, 1.18),
        (-0.89, 1.26),
        (0, 1.28),
        (0.89, 1.26),
        (1.07, 1.18),
        (1.12, 0.93),
        (1.09, 0.50),
        (0.96, 0.40),
    ],
    1,
    1,
)
pocket(front, -1.98)
chart(front, "front")
cab = loft(
    "Cream closed tow cab continuous side front rear roof skin",
    [(-1.94, 0.96, 0.30), (-1.58, 1, 0), (-0.48, 1, 0), (-0.39, 0.96, -0.03)],
    [
        (-0.93, 1.08),
        (-1.02, 1.25),
        (-1.02, 1.90),
        (-0.96, 2.17),
        (-0.81, 2.27),
        (0, 2.30),
        (0.81, 2.27),
        (0.96, 2.17),
        (1.02, 1.90),
        (1.02, 1.25),
        (0.93, 1.08),
    ],
    1.27,
    1.03,
)
chart(cab, "cab")
deck = cube(
    "Blue short flat recovery platform integrated rear wheelhouses",
    (1.055, 0, 0.82),
    (2.83, 2.20, 0.70),
    "paint",
    bevel=0.035,
)
pocket(deck, 1.62)
chart(deck, "deck")
for f in deck.data.polygons:
    if f.normal.z < -0.5:
        role_face(deck, f, "chassis")
for side in [-1, 1]:
    cube(
        "Dark narrow chassis rail " + str(side),
        (0, side * 0.50, 0.40),
        (5.25, 0.12, 0.18),
        "chassis",
        bevel=0.018,
    )
    cube(
        "Cream cab entry step " + str(side),
        (-0.60, side * 1.065, 0.60),
        (0.52, 0.11, 0.12),
        "creamMid",
        bevel=0.02,
    )
cube(
    "Central retained floor inside tire slabs",
    (0, 0, 0.45),
    (5.25, 1.30, 0.16),
    "chassis",
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
    roles = [role] * (sides + 2)
    if role == "orange":
        roles = [
            (
                "orangeLight"
                if j in [1, 2]
                else "orangeShadow" if j in [5, 6] else "orange"
            )
            for j in range(sides)
        ] + ["orangeShadow", "orange"]
    return mesh(name, vv, ff, roles)


for axle in [-1.98, 1.62]:
    tube(
        "STATIC axle attachment arm " + str(axle),
        (axle, -0.695, 0.49),
        (axle, 0.695, 0.49),
        0.045,
    )

# Two planted orange feet and broad converging low folded arms. Top remains
# below the actual cab roof; no extended crane, movable hinge or tow physics.
for side in [-1, 1]:
    cube(
        "STATIC orange recovery planted foot " + str(side),
        (0.12, side * 0.72, 1.20),
        (0.30, 0.27, 0.10),
        "orangeShadow",
        bevel=0.025,
    )
    tube(
        "STATIC low orange folded recovery arm " + str(side),
        (0.12, side * 0.72, 1.24),
        (1.94, side * 0.20, 2.17),
        0.105,
        "orange",
        8,
    )
    tube(
        "STATIC fixed gray brace " + str(side),
        (0.52, side * 0.65, 1.20),
        (1.35, side * 0.36, 1.84),
        0.043,
        "rim",
        8,
    )
tube(
    "STATIC orange recovery low head crossbeam",
    (1.94, -0.25, 2.17),
    (1.94, 0.25, 2.17),
    0.105,
    "orange",
    8,
)
cube(
    "STATIC winch planted mounting block",
    (0.17, 0, 1.215),
    (0.64, 0.72, 0.09),
    "chassis",
    bevel=0.025,
)
# Broad horizontal drum and two flanges, fixed to the platform.
tube(
    "STATIC broad gray winch drum",
    (0.17, -0.25, 1.435),
    (0.17, 0.25, 1.435),
    0.18,
    "chassisLight",
    16,
)
for side in [-1, 1]:
    tube(
        "STATIC gray winch flange " + str(side),
        (0.17, side * 0.25, 1.435),
        (0.17, side * 0.30, 1.435),
        0.22,
        "rim",
        16,
    )
    cube(
        "STATIC winch bearing foot " + str(side),
        (0.17, side * 0.30, 1.30),
        (0.25, 0.15, 0.13),
        "rim",
        bevel=0.02,
    )
# Only two broad straight cable segments; radius .035 =>1.217 world-px diameter.
tube(
    "STATIC gray cable winch to low head",
    (0.22, 0, 1.54),
    (1.94, 0, 2.18),
    0.035,
    "cable",
    8,
)
tube(
    "STATIC gray cable low head to stowed hook",
    (1.94, 0, 2.18),
    (2.72, 0, 1.17),
    0.035,
    "cable",
    8,
)

# One cast C hook in the XZ plane, extruded/tubular gray silhouette. It is behind
# platform, safely above ground and entirely fixed body equipment.
center = Vector((2.72, 0, 0.99))
angles = [90, 135, 180, 225, 270, 315, 350]
nr = 8
vv = []
for angle in angles:
    t = math.radians(angle)
    radial = Vector((math.cos(t), 0, math.sin(t)))
    c = center + 0.155 * radial
    for j in range(nr):
        phi = 2 * math.pi * j / nr
        vv.append(
            tuple(
                c + 0.04 * (radial * math.cos(phi) + Vector((0, 1, 0)) * math.sin(phi))
            )
        )
ff = [
    (i * nr + j, i * nr + (j + 1) % nr, (i + 1) * nr + (j + 1) % nr, (i + 1) * nr + j)
    for i in range(len(angles) - 1)
    for j in range(nr)
]
ff += [
    tuple(range(nr - 1, -1, -1)),
    tuple((len(angles) - 1) * nr + j for j in range(nr)),
]
mesh("STATIC one cast gray C hook stowed above ground", vv, ff, "hook")

cube(
    "Chunky cream heavy front bumper",
    (-2.82, 0, 0.60),
    (0.16, 2.20, 0.24),
    "creamMid",
    bevel=0.04,
)
cube(
    "Short gray recovery rear bumper",
    (2.55, 0, 0.62),
    (0.16, 2.16, 0.20),
    "rim",
    bevel=0.03,
)
cube(
    "Broad dark tow front grille",
    (-2.800, 0, 0.985),
    (0.035, 1.14, 0.36),
    "ink",
    bevel=0.025,
)
for z in [0.89, 0.99, 1.09]:
    cube(
        "Tow grille broad cream slat " + str(z),
        (-2.825, 0, z),
        (0.025, 1.02, 0.035),
        "cream",
    )
for side in [-1, 1]:
    cube(
        "Tow headlamp ink frame " + str(side),
        (-2.793, side * 0.82, 1.045),
        (0.028, 0.32, 0.25),
        "ink",
        bevel=0.03,
    )
    cube(
        "Tow ivory headlamp " + str(side),
        (-2.814, side * 0.82, 1.05),
        (0.025, 0.22, 0.15),
        "creamLight",
        bevel=0.02,
    )
    cube(
        "Recovery rear red lamp " + str(side),
        (2.486, side * 0.93, 0.86),
        (0.025, 0.18, 0.22),
        "ruby",
        bevel=0.02,
    )


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
    mesh("Rounded covered heavy tow tire " + wid, vv, ff, roles, wid)
    disk(
        "Gray heavy tow wheel rim " + wid,
        (0, side * (width / 2 + 0.003), 0),
        (0, side, 0),
        0.30,
        "rim",
        20,
        0.018,
        wid,
    )
    disk(
        "Broad gray heavy tow hub " + wid,
        (0, side * (width / 2 + 0.024), 0),
        (0, side, 0),
        0.20,
        "silver",
        20,
        0.018,
        wid,
    )
    disk(
        "Tow asymmetric hub inset " + wid,
        (0.09, side * (width / 2 + 0.045), 0.055),
        (0, side, 0),
        0.047,
        "ink",
        10,
        0.004,
        wid,
    )
