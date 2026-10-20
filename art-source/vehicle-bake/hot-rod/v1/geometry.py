"""Own chopped-cab exposed-V8 hot rod, source units, forward-X, ground0.

Front crowns are deliberately uncovered outboard of the narrow chassis. Only
rear wheels get real broad fenders. Axle arms stop just inside tire slabs.
"""

from mathutils import Matrix


def chart(ob, kind):
    uv = ob.data.uv_layers.active.data
    for face in ob.data.polygons:
        for li in face.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            if kind == "cab":
                if abs(face.normal.x) > 0.65:
                    u = (
                        (p.y + 0.90) / 1.8 * 256 + (256 if face.center.x > 0.2 else 0)
                    ) / 512
                    py = 192 + (p.z - 0.45) / 1.25 * 160
                elif face.normal.z > 0.6 and face.center.z > 1.48:
                    u = (p.x + 0.65) / 1.75
                    py = 352 + (p.y + 0.9) / 1.8 * 48
                else:
                    u = (p.x + 0.65) / 1.75
                    py = (p.z - 0.45) / 1.25 * 192
            else:
                u = (p.x - 0.65) / 1.50
                py = 400 + (p.z - 0.35) / 0.85 * 80
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


def rear_pocket(ob):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=CFG["arch"]["cutRadius"],
            depth=1.16,
            location=(1.03, side * 1.20, 0.55),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new("Real rear wheel-local arch and floor pocket", "BOOLEAN")
        mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    ob.data.update()


def loft(name, stations, section):
    vv = [
        (x + sweep * max(0, min(1, (z - 1.0) / 0.6)), y * width, z)
        for x, width, sweep in stations
        for y, z in section
    ]
    n = len(section)
    ff = []
    for i in range(len(stations) - 1):
        for j in range(n):
            ff.append(
                (
                    i * n + j,
                    i * n + (j + 1) % n,
                    (i + 1) * n + (j + 1) % n,
                    (i + 1) * n + j,
                )
            )
    ff += [
        tuple(range(n - 1, -1, -1)),
        tuple((len(stations) - 1) * n + j for j in range(n)),
    ]
    return mesh(name, vv, ff, "paint")


cab_section = [
    (-0.61, 0.50),
    (-0.72, 0.62),
    (-0.74, 1.04),
    (-0.71, 1.36),
    (-0.65, 1.52),
    (-0.50, 1.58),
    (0, 1.60),
    (0.50, 1.58),
    (0.65, 1.52),
    (0.71, 1.36),
    (0.74, 1.04),
    (0.72, 0.62),
    (0.61, 0.50),
]
cab = loft(
    "Chopped closed plum cab actual glass flame roof skin",
    [(-0.50, 0.96, 0.23), (-0.24, 1, 0), (0.73, 1, 0), (0.94, 0.95, -0.08)],
    cab_section,
)
rear_pocket(cab)
chart(cab, "cab")
tail_section = [
    (-0.56, 0.43),
    (-0.70, 0.58),
    (-0.71, 0.85),
    (-0.61, 0.99),
    (-0.40, 1.045),
    (0, 1.06),
    (0.40, 1.045),
    (0.61, 0.99),
    (0.71, 0.85),
    (0.70, 0.58),
    (0.56, 0.43),
]
tail = loft(
    "Short rounded plum rear body and trunk skin",
    [(0.78, 0.92, 0), (1.06, 1, 0), (1.78, 0.97, 0), (1.98, 0.85, 0)],
    tail_section,
)
rear_pocket(tail)
chart(tail, "tail")
cube(
    "Central narrow cab and tail floor",
    (0.63, 0, 0.43),
    (2.42, 0.96, 0.13),
    "paintDeep",
)

# Actual broad rear fenders join the rear body, leaving open wheel-local arches.
# The front intentionally has NO fender geometry.
f = CFG["fender"]
n = f["segments"]
for side in [-1, 1]:
    vv, ff, rr = [], [], []
    for y, rad in zip(f["lateralStations"], f["shoulderRadii"]):
        for j in range(n + 1):
            t = math.pi * j / n
            vv.append((1.03 + rad * math.cos(t), side * y, 0.55 + rad * math.sin(t)))
    for k in range(len(f["lateralStations"]) - 1):
        for j in range(n):
            ff.append(
                (
                    k * (n + 1) + j,
                    k * (n + 1) + j + 1,
                    (k + 1) * (n + 1) + j + 1,
                    (k + 1) * (n + 1) + j,
                )
            )
            rr.append("paintLight" if k < 2 else "paint" if k == 2 else "paintMid")
    base = len(vv)
    for j in range(n + 1):
        t = math.pi * j / n
        vv.append(
            (
                1.03 + f["archRadius"] * math.cos(t),
                side * f["lateralStations"][-1],
                0.55 + f["archRadius"] * math.sin(t),
            )
        )
    last = len(f["lateralStations"]) - 1
    for j in range(n):
        ff.append((last * (n + 1) + j, last * (n + 1) + j + 1, base + j + 1, base + j))
        rr.append("paintDeep")
    # Real inboard wheelhouse cheek closes the open inner shoulder edge into the
    # coachwork. It is inboard of the tire slab, leaving the outboard arch open.
    a = len(vv)
    vv.extend(
        [
            (1.03 - f["shoulderRadii"][0], side * f["lateralStations"][0], 0.45),
            (1.03 + f["shoulderRadii"][0], side * f["lateralStations"][0], 0.45),
        ]
    )
    ff.append(tuple(range(n + 1)) + (a, a + 1))
    rr.append("paintMid")
    mesh(
        "REAR broad integrated plum fender and inner wheelhouse " + str(side),
        vv,
        ff,
        rr,
    )


def tube(name, pts, radius, role="silver", sides=6):
    vv = []
    for i, p in enumerate(pts):
        tangent = (
            Vector(pts[min(i + 1, len(pts) - 1)]) - Vector(pts[max(0, i - 1)])
        ).normalized()
        a = tangent.cross(Vector((0, 0, 1)))
        if a.length < 0.001:
            a = tangent.cross(Vector((0, 1, 0)))
        a.normalize()
        b = tangent.cross(a).normalized()
        for j in range(sides):
            vv.append(
                tuple(
                    Vector(p)
                    + radius
                    * (
                        a * math.cos(j * 2 * math.pi / sides)
                        + b * math.sin(j * 2 * math.pi / sides)
                    )
                )
            )
    ff = []
    for i in range(len(pts) - 1):
        for j in range(sides):
            ff.append(
                (
                    i * sides + j,
                    i * sides + (j + 1) % sides,
                    (i + 1) * sides + (j + 1) % sides,
                    (i + 1) * sides + j,
                )
            )
    ff += [
        tuple(range(sides - 1, -1, -1)),
        tuple((len(pts) - 1) * sides + j for j in range(sides)),
    ]
    return mesh(name, vv, ff, role)


for side in [-1, 1]:
    cube(
        "Exposed narrow front chassis rail " + str(side),
        (-1.16, side * 0.28, 0.30),
        (1.72, 0.08, 0.14),
        "engineDark",
        bevel=0.025,
    )
    cube(
        "Short plum running board " + str(side),
        (-0.16, side * 0.75, 0.47),
        (0.90, 0.16, 0.065),
        "paintMid",
        bevel=0.025,
    )
    tube(
        "Visible diagonal front chassis brace " + str(side),
        [(-0.43, side * 0.30, 0.31), (-1.4, side * 0.84, 0.32)],
        0.025,
        "engine",
        6,
    )
tube(
    "FRONT fixed transverse attachment arm stops short of tire cylinders",
    [(-1.4, -0.905, 0.32), (-1.4, 0.905, 0.32)],
    0.032,
    "rim",
    8,
)
tube(
    "REAR fixed axle stops short of rear tire cylinders",
    [(1.03, -0.635, 0.55), (1.03, 0.635, 0.55)],
    0.038,
    "engineDark",
    8,
)
for x, width in [(-2.05, 0.92), (2.02, 1.14)]:
    cube(
        "Short classic chrome bumper " + str(x),
        (x, 0, 0.32 if x < 0 else 0.45),
        (0.12 if x < 0 else 0.14, width, 0.09),
        "silver",
        bevel=0.022,
    )

# V8 represented by a few broad unlit palette blocks and one round air cleaner.
cube(
    "Exposed V8 dark broad crankcase",
    (-0.99, 0, 0.64),
    (0.88, 0.62, 0.37),
    "engineDark",
    bevel=0.045,
)
for side in [-1, 1]:
    c = Vector((-0.98, side * 0.27, 0.89))
    valve = cube(
        "Exposed V8 broad angled chrome valve bank " + str(side),
        tuple(c),
        (0.83, 0.27, 0.25),
        "silver",
        bevel=0.045,
    )
    valve.data.transform(
        Matrix.Translation(c)
        @ Matrix.Rotation(side * 0.45, 4, "X")
        @ Matrix.Translation(-c)
    )
    valve.data.update()
cube(
    "Exposed V8 central intake block",
    (-0.98, 0, 0.965),
    (0.40, 0.26, 0.18),
    "engine",
    bevel=0.025,
)


def disk(name, center, normal, radius, role, segments=12, depth=0.025, group="body"):
    c = Vector(center)
    normal = Vector(normal).normalized()
    u = normal.cross(Vector((0, 0, 1)))
    if u.length < 0.001:
        u = normal.cross(Vector((0, 1, 0)))
    u.normalize()
    v = normal.cross(u)
    vv = []
    for dep, rad in [(0, radius), (depth, radius * 0.85)]:
        for j in range(segments):
            vv.append(
                tuple(
                    c
                    + normal * dep
                    + rad
                    * (
                        u * math.cos(2 * math.pi * j / segments)
                        + v * math.sin(2 * math.pi * j / segments)
                    )
                )
            )
    ff = [
        (j, (j + 1) % segments, segments + (j + 1) % segments, segments + j)
        for j in range(segments)
    ]
    ff.append(tuple(segments + j for j in range(segments)))
    return mesh(name, vv, ff, role, group)


disk(
    "Exposed V8 single broad round air cleaner",
    (-0.98, 0, 1.045),
    (0, 0, 1),
    0.195,
    "rim",
    segments=16,
    depth=0.07,
)
disk(
    "Air cleaner top broad gray highlight",
    (-0.98, 0, 1.116),
    (0, 0, 1),
    0.15,
    "silver",
    segments=12,
    depth=0.005,
)
cube(
    "Upright simple plum radiator surround",
    (-1.78, 0, 0.70),
    (0.15, 0.65, 0.76),
    "paint",
    bevel=0.06,
)
cube(
    "Upright dark radiator grille aperture",
    (-1.863, 0, 0.70),
    (0.025, 0.51, 0.57),
    "ink",
    bevel=0.025,
)
for y in [-0.20, -0.12, -0.04, 0.04, 0.12, 0.20]:
    cube(
        "Restrained radiator vertical chrome slat " + str(y),
        (-1.88, y, 0.70),
        (0.018, 0.025, 0.50),
        "rim",
    )
for side in [-1, 1]:
    disk(
        "Front gray chrome round lamp bezel " + str(side),
        (-1.78, side * 0.43, 0.72),
        (-1, 0, 0),
        0.123,
        "silver",
        12,
        0.025,
    )
    disk(
        "Front ivory round lamp lens " + str(side),
        (-1.81, side * 0.43, 0.72),
        (-1, 0, 0),
        0.091,
        "cream",
        12,
        0.012,
    )
    cube(
        "Small rear ruby lamp " + str(side),
        (1.995, side * 0.49, 0.78),
        (0.028, 0.15, 0.095),
        "ruby",
        bevel=0.015,
    )
    # Fixed headers and side pipes remain inside the front wheel slabs, and end
    # before the oversized rear wheel envelope. No moving exhaust equipment.
    for i, x in enumerate([-1.23, -1.03, -0.83, -0.63]):
        tube(
            "STATIC V8 header " + str(side) + " " + str(i),
            [
                (x, side * 0.31, 0.86),
                (x + 0.045, side * 0.55, 0.69),
                (x + 0.10, side * 0.67, 0.46),
            ],
            0.035,
            "rim",
            5,
        )
    tube(
        "STATIC fixed side exhaust " + str(side),
        [(-1.12, side * 0.67, 0.46), (0.33, side * 0.67, 0.46)],
        0.055,
        "silver",
        8,
    )
    disk(
        "STATIC exhaust dark open-mouth paint " + str(side),
        (0.332, side * 0.67, 0.46),
        (1, 0, 0),
        0.038,
        "ink",
        8,
        0.001,
    )

# Every wheel has its OWN tire radius/width/track. Mixed radii are not inferred
# from a shared size or the last wheel constructed.
for wid, spec in CFG["wheelSpecs"].items():
    radius, width, nr = spec["radius"], spec["width"], spec["segments"]
    side = -1 if wid[1] == "L" else 1
    vv, ff, rr = [], [], []
    for y, rad in [
        (-width / 2, radius * 0.82),
        (-width * 0.34, radius),
        (width * 0.34, radius),
        (width / 2, radius * 0.82),
    ]:
        for j in range(nr):
            t = 2 * math.pi * j / nr
            vv.append((rad * math.sin(t), y, rad * math.cos(t)))
    for k in range(3):
        for j in range(nr):
            ff.append(
                (
                    k * nr + j,
                    k * nr + (j + 1) % nr,
                    (k + 1) * nr + (j + 1) % nr,
                    (k + 1) * nr + j,
                )
            )
            rr.append("tire" if k == 1 else "tireLight")
    for k in [0, 3]:
        ff.append(tuple(k * nr + j for j in range(nr)))
        rr.append("tire")
    mesh(
        ("Skinny exposed FRONT tire " if wid[0] == "F" else "Oversized wide REAR tire ")
        + wid,
        vv,
        ff,
        rr,
        wid,
    )
    disk(
        "Hot rod gray chrome wheel rim " + wid,
        (0, side * (width / 2 + 0.003), 0),
        (0, side, 0),
        radius * 0.64,
        "rim",
        16,
        0.018,
        wid,
    )
    disk(
        "Hot rod broad chrome dome hub " + wid,
        (0, side * (width / 2 + 0.024), 0),
        (0, side, 0),
        radius * 0.43,
        "silver",
        12,
        0.025,
        wid,
    )
    disk(
        "Hot rod asymmetric dark hub inset " + wid,
        (radius * 0.22, side * (width / 2 + 0.052), radius * 0.15),
        (0, side, 0),
        radius * 0.11,
        "ink",
        8,
        0.002,
        wid,
    )
