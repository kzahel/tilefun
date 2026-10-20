"""Original small open cart: real well, independent bench, slim fixed canopy.

Source forward-X, upZ, ground0. Natural nose/rear tub wheel pockets stay local.
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
            if kind == "nose":
                u = (p.y + 0.85) / 1.7
                py = (p.x + 1.65) / 1.1 * 128
            elif kind == "roof":
                u = (p.x + 1.15) / 2.35
                py = 128 + (p.y + 0.85) / 1.7 * 64
            elif kind == "screen":
                u = (p.y + 0.62) / 1.24
                py = 192 + (p.z - 0.83) / 0.67 * 128
            elif kind == "seat":
                u = (p.y + 0.65) / 1.3
                py = 320 + (p.z - 0.64) / 0.55 * 80
            elif kind == "rear":
                u = (p.y + 0.80) / 1.60
                py = 400 + (p.x - 0.74) / 0.82 * 48
            else:
                u = (p.y + 0.52) / 1.04
                py = 448 + (p.x + 0.68) / 1.56 * 32
            ob.data.uv_layers.active.data[li].uv = (
                max(0.001, min(0.999, u)),
                1 - max(0.5, min(479.5, py)) / 512,
            )


def pocket(ob, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=CFG["arch"]["cutRadius"],
            depth=0.80,
            location=(axle, side * 0.90, 0.31),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new("Local natural wheel arch pocket", "BOOLEAN")
        mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    ob.data.update()


section = [
    (-0.65, 0.38),
    (-0.79, 0.46),
    (-0.82, 0.63),
    (-0.79, 0.73),
    (-0.65, 0.79),
    (0, 0.81),
    (0.65, 0.79),
    (0.79, 0.73),
    (0.82, 0.63),
    (0.79, 0.46),
    (0.65, 0.38),
]
stations = [(-1.55, 0.82), (-1.46, 1), (-0.82, 1), (-0.60, 0.90)]
n = len(section)
vv = [(x, y * w, z) for x, w in stations for y, z in section]
ff = [
    (i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j)
    for i in range(len(stations) - 1)
    for j in range(n)
]
ff += [
    tuple(range(n - 1, -1, -1)),
    tuple((len(stations) - 1) * n + j for j in range(n)),
]
nose = mesh(
    "Low blunt rounded mint front nose integrated natural front fenders",
    vv,
    ff,
    "paint",
)
pocket(nose, -1.05)
chart(nose, "nose")
for f in nose.data.polygons:
    if f.normal.z < 0.25:
        role_face(nose, f, "paint" if f.center.z > 0.61 else "paintMid")

# A real rear tub with independent low floor and broad natural side fenders.
rear = cube(
    "Mint rear bag tub integrated natural rear fenders",
    (1.145, 0, 0.56),
    (0.82, 1.60, 0.46),
    "paint",
    bevel=0.045,
)
bpy.ops.mesh.primitive_cube_add(size=1, location=(1.20, 0, 0.85))
cutter = bpy.context.object
cutter.scale = (0.58, 0.92, 0.66)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.context.view_layer.objects.active = rear
mod = rear.modifiers.new("Actual open rear bagwell cavity floor at .52", "BOOLEAN")
mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter, do_unlink=True)
pocket(rear, 1.04)
chart(rear, "rear")
for f in rear.data.polygons:
    if abs(f.center.y) < 0.48 and 0.90 < f.center.x < 1.50 and f.center.z < 0.785:
        role_face(rear, f, "floor" if f.normal.z > 0.5 else "paintShadow")
    elif f.normal.z < 0.25:
        role_face(rear, f, "paint" if f.center.z > 0.62 else "paintMid")

floor = cube(
    "Actual low open passenger footwell floor",
    (0.10, 0, 0.275),
    (1.56, 1.02, 0.09),
    "floor",
)
chart(floor, "floor")
for side in [-1, 1]:
    cube(
        "Mint open side entry step " + str(side),
        (-0.09, side * 0.625, 0.29),
        (1.03, 0.25, 0.10),
        "paintMid",
        bevel=0.025,
    )
    cube(
        "Dark narrow underfloor chassis rail " + str(side),
        (0, side * 0.33, 0.23),
        (2.66, 0.10, 0.12),
        "chassis",
        bevel=0.015,
    )

# Seat is visibly above the deep well, supported by a real underseat box.
cube(
    "Fixed dark underbench pedestal",
    (0.48, 0, 0.50),
    (0.58, 0.98, 0.36),
    "chassis",
    bevel=0.025,
)
cushion = cube(
    "Tan broad bench cushion actual upholstery skin",
    (0.46, 0, 0.715),
    (0.72, 1.30, 0.15),
    "seat",
    bevel=0.065,
)
chart(cushion, "seat")
back = cube(
    "Tan bench back actual upholstery skin",
    (0.835, 0, 0.965),
    (0.15, 1.30, 0.43),
    "seat",
    bevel=0.055,
)
chart(back, "seat")
for ob in [cushion, back]:
    for f in ob.data.polygons:
        if f.normal.z < -0.4 or (ob == back and f.normal.x > 0.6):
            role_face(ob, f, "seatShadow")


def tube(name, a, b, radius, role="ink", sides=8):
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


# Four restrained <1-world-pixel diameter supports, with endpoints in real
# nose/rear deck and canopy underside. Entire fixed cage belongs to Body_static.
for side in [-1, 1]:
    tube(
        "STATIC front slim canopy support " + str(side),
        (-0.65, side * 0.66, 0.73),
        (-0.82, side * 0.66, 1.72),
        0.024,
        "ink",
    )
    tube(
        "STATIC rear slim canopy support " + str(side),
        (0.90, side * 0.66, 0.77),
        (0.96, side * 0.66, 1.72),
        0.024,
        "ink",
    )
roof = cube(
    "STATIC white flat softly edged canopy own roof skin",
    (0.02, 0, 1.75),
    (2.30, 1.70, 0.10),
    "roof",
    bevel=0.035,
)
chart(roof, "roof")
for f in roof.data.polygons:
    if f.normal.z < -0.5:
        role_face(roof, f, "roofShadow")
    elif f.normal.z < 0.4:
        role_face(roof, f, "roof")

# Own opaque thin solid screen, away from body; frames/glass live on its actual
# skin, never an intersecting glass overlay on a cabin mesh.
vv = [(-0.68 + dx, y, 0.83) for dx in [-0.009, 0.009] for y in [-0.62, 0.62]] + [
    (-0.79 + dx, y, 1.50) for dx in [-0.009, 0.009] for y in [-0.62, 0.62]
]
ff = [
    (0, 1, 5, 4),
    (2, 6, 7, 3),
    (0, 4, 6, 2),
    (1, 3, 7, 5),
    (4, 5, 7, 6),
    (0, 2, 3, 1),
]
screen = mesh("STATIC small framed blue front windscreen own skin", vv, ff, "glass")
chart(screen, "screen")
for f in screen.data.polygons:
    if abs(f.normal.x) < 0.6:
        role_face(screen, f, "ink")

# Fixed ordinary steering controls, no new animation or driver mesh.
tube(
    "STATIC steering column",
    (-0.40, -0.28, 0.55),
    (-0.32, -0.28, 0.98),
    0.022,
    "chassis",
    8,
)
normal = Vector((0.8, 0, 0.6))
u = Vector((0, 1, 0))
v = normal.cross(u)
center = Vector((-0.31, -0.28, 0.995))
nr = 12
verts = [
    tuple(
        center
        + normal * dep
        + rad
        * (u * math.cos(2 * math.pi * j / nr) + v * math.sin(2 * math.pi * j / nr))
    )
    for dep, rad in [(-0.012, 0.14), (-0.012, 0.105), (0.012, 0.14), (0.012, 0.105)]
    for j in range(nr)
]
faces = []
for a, b in [(0, 1), (2, 3), (0, 2), (1, 3)]:
    faces += [
        (a * nr + j, a * nr + (j + 1) % nr, b * nr + (j + 1) % nr, b * nr + j)
        for j in range(nr)
    ]
mesh("STATIC small steering wheel ring", verts, faces, "ink")
for angle in [0, 2 * math.pi / 3, 4 * math.pi / 3]:
    tube(
        "STATIC broad steering spoke " + str(angle),
        center,
        center + 0.115 * (u * math.cos(angle) + v * math.sin(angle)),
        0.013,
        "chassisLight",
        6,
    )

for axle in [-1.05, 1.04]:
    tube(
        "STATIC axle attachment arm " + str(axle),
        (axle, -0.515, 0.31),
        (axle, 0.515, 0.31),
        0.035,
        "chassisLight",
        8,
    )
for x in [-1.55, 1.55]:
    cube(
        "Short gray cart bumper " + str(x),
        (x, 0, 0.40),
        (0.10, 1.40, 0.11),
        "rim",
        bevel=0.025,
    )
for side in [-1, 1]:
    cube(
        "Small cart headlamp ink frame " + str(side),
        (-1.553, side * 0.48, 0.635),
        (0.024, 0.25, 0.13),
        "ink",
        bevel=0.022,
    )
    cube(
        "Small cart warm headlamp " + str(side),
        (-1.568, side * 0.48, 0.639),
        (0.024, 0.18, 0.075),
        "cream",
        bevel=0.015,
    )
    cube(
        "Small rear red lamp " + str(side),
        (1.563, side * 0.62, 0.65),
        (0.024, 0.12, 0.11),
        "ruby",
        bevel=0.015,
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
    radius, width, nr = spec["radius"], spec["width"], spec["segments"]
    side = -1 if wid[1] == "L" else 1
    vv, ff, roles = [], [], []
    for y, rad in [
        (-width / 2, 0.255),
        (-width * 0.36, 0.30),
        (0, radius),
        (width * 0.36, 0.30),
        (width / 2, 0.255),
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
    mesh("Small rounded black cart tire " + wid, vv, ff, roles, wid)
    disk(
        "Lightgray cart rim " + wid,
        (0, side * (width / 2 + 0.002), 0),
        (0, side, 0),
        0.178,
        "rim",
        16,
        0.012,
        wid,
    )
    disk(
        "Broad lightgray cart hub " + wid,
        (0, side * (width / 2 + 0.016), 0),
        (0, side, 0),
        0.125,
        "silver",
        16,
        0.012,
        wid,
    )
    disk(
        "Cart asymmetric hub inset " + wid,
        (0.055, side * (width / 2 + 0.032), 0.035),
        (0, side, 0),
        0.032,
        "ink",
        8,
        0.004,
        wid,
    )
