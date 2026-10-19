"""Family-owned short SUV geometry, executed by build.py after shared primitives.

Units are source metres, forward -X. This file owns proportions, shell stations,
skin charts, wheel pockets, crown shoulders and the static rear spare.
"""


def chart(o, kind):
    uv = o.data.uv_layers.active.data
    for face in o.data.polygons:
        for li in face.loop_indices:
            v = o.data.vertices[o.data.loops[li].vertex_index].co
            if kind == "cabin":
                if abs(face.normal.x) > 0.65:
                    u = (
                        (v.y + 1.1) / 2.2 * 256 + (256 if face.center.x > 0 else 0)
                    ) / 512
                    py = 192 + (v.z - 0.35) / 1.85 * 160
                else:
                    u = (v.x + 1.05) / 3.15
                    py = (v.z - 0.35) / 1.85 * 192
            elif kind == "roof":
                u = (v.x + 1.05) / 3.15
                py = 352 + (v.y + 1.1) / 2.2 * 48
            elif kind == "hood":
                u = (v.x + 2.4) / 1.7
                py = 400 + (v.y + 1.1) / 2.2 * 80
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


def pocket(o, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20,
            radius=CFG["arch"]["cutRadius"],
            depth=1.1,
            location=(axle, side * 1.25, CFG["wheelRadius"]),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new("Wheel-local open pocket", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    o.data.update()


def loft(name, stations, section, role, kind=None):
    # Each station is x, lateral width multiplier, vertical multiplier.
    vv = [(x, y * w, z * h) for x, w, h in stations for y, z in section]
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
    ff.extend(
        [
            tuple(range(n - 1, -1, -1)),
            tuple((len(stations) - 1) * n + j for j in range(n)),
        ]
    )
    obj = mesh(name, vv, ff, role)
    if kind:
        chart(obj, kind)
    return obj


# The lower coachwork is a broad, bevel-edged volume. Local openings remove
# only tire pockets and leave a central floor/chassis, never an axle-wide tunnel.
lower = cube(
    "Burnt orange continuous lower coachwork",
    (-0.12, 0, 0.815),
    (4.22, 1.90, 0.77),
    "paint",
    bevel=0.07,
)
for axle in CFG["axles"]:
    pocket(lower, axle)
for f in lower.data.polygons:
    role = (
        "paintLight"
        if f.normal.z > 0.5
        else "paintMid" if f.center.z < 0.66 else "paint"
    )
    idx = keys.index(role)
    for li in f.loop_indices:
        lower.data.uv_layers.active.data[li].uv = (
            ((idx % 16) * 32 + 16) / 512,
            1 - (480 + (idx // 16) * 16 + 8) / 512,
        )

# Upright greenhouse, actual continuous skin glass. The roof is a distinct fixed
# owner and does not share glass UVs. Small width tapers soften the box corners.
cabin_section = [
    (-0.87, 0.56),
    (-0.96, 0.68),
    (-0.96, 1.24),
    (-0.94, 1.86),
    (-0.89, 2.02),
    (0.89, 2.02),
    (0.94, 1.86),
    (0.96, 1.24),
    (0.96, 0.68),
    (0.87, 0.56),
]
cabin = loft(
    "Upright framed greenhouse actual skin",
    [(-0.88, 0.95, 1), (-0.78, 1, 1), (1.83, 1, 1), (1.98, 0.94, 1)],
    cabin_section,
    "paint",
)
for axle in CFG["axles"]:
    pocket(cabin, axle)
chart(cabin, "cabin")

roof = cube(
    "STATIC contrasting removable-style hardtop",
    (0.565, 0, 2.045),
    (2.91, 1.96, 0.19),
    "roof",
    bevel=0.07,
)
chart(roof, "roof")
for side in [-1, 1]:
    cube(
        "Hardtop continuous lower weather edge " + str(side),
        (0.57, side * 0.957, 1.973),
        (2.82, 0.045, 0.055),
        "roofEdge",
        bevel=0.015,
    )

# Flat rounded engine hood: wide top and rounded forward corners, no domed
# passenger-car profile. Front face is tall enough for the simple vertical grille.
hood_section = [
    (-0.78, 0.69),
    (-0.88, 0.80),
    (-0.89, 1.18),
    (-0.80, 1.29),
    (-0.65, 1.32),
    (0.65, 1.32),
    (0.80, 1.29),
    (0.89, 1.18),
    (0.88, 0.80),
    (0.78, 0.69),
]
hood = loft(
    "Flat rounded short engine hood",
    [(-2.27, 0.95, 0.96), (-2.19, 1, 1), (-0.90, 1, 1), (-0.80, 0.98, 1)],
    hood_section,
    "paint",
)
pocket(hood, CFG["axles"][0])
chart(hood, "hood")
cube("Central narrow chassis", (-0.12, 0, 0.39), (4.22, 1.30, 0.16), "roofEdge")

# Thick fenders have a finite broad upper panel across the wheel tread. Their
# inner edge is in the coachwork and their outer lip defines the open arch.
f = CFG["fender"]
n = f["segments"]
r = CFG["wheelRadius"]
for axle in CFG["axles"]:
    for side in [-1, 1]:
        vv, ff, rr = [], [], []
        for y, rad in zip(f["lateralStations"], f["shoulderRadii"]):
            for j in range(n + 1):
                t = math.pi * j / n
                vv.append((axle + rad * math.cos(t), side * y, r + rad * math.sin(t)))
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
                rr.append(
                    "paintLight" if k in [0, 1] else "paint" if k == 2 else "paintMid"
                )
        base = len(vv)
        for j in range(n + 1):
            t = math.pi * j / n
            vv.append(
                (
                    axle + f["archRadius"] * math.cos(t),
                    side * f["lateralStations"][-1],
                    r + f["archRadius"] * math.sin(t),
                )
            )
        last = len(f["lateralStations"]) - 1
        for j in range(n):
            ff.append(
                (last * (n + 1) + j, last * (n + 1) + j + 1, base + j + 1, base + j)
            )
            rr.append("paintDeep")
        mesh(
            "Broad integrated open wheel fender " + str(axle) + " " + str(side),
            vv,
            ff,
            rr,
        )
for side in [-1, 1]:
    cube(
        "Short side sill step " + str(side),
        (-0.06, side * 1.0, 0.43),
        (1.47, 0.18, 0.13),
        "roof",
        bevel=0.025,
    )
for x in [-2.35, 2.06]:
    cube(
        "Short stout bumper " + str(x),
        (x, 0, 0.47),
        (0.20, 2.02, 0.20),
        "roof",
        bevel=0.04,
    )
    cube(
        "Bumper face broad metal strip " + str(x),
        (x + (-0.103 if x < 0 else 0.103), 0, 0.49),
        (0.015, 1.44, 0.07),
        "rim",
    )


def disk(name, center, normal, r, role, segments=12, depth=0.025, group="body"):
    c, normal = Vector(center), Vector(normal).normalized()
    u = normal.cross(Vector((0, 0, 1)))
    if u.length < 0.01:
        u = normal.cross(Vector((0, 1, 0)))
    u.normalize()
    v = normal.cross(u)
    verts = []
    for dep, rad in [(0, r), (depth, r * 0.85)]:
        for j in range(segments):
            verts.append(
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
    faces = [
        (j, (j + 1) % segments, segments + (j + 1) % segments, segments + j)
        for j in range(segments)
    ]
    faces.append(tuple(segments + j for j in range(segments)))
    return mesh(name, verts, faces, role, group)


cube("Front black vertical grille field", (-2.282, 0, 0.98), (0.03, 1.12, 0.43), "ink")
for y in [-0.42, -0.28, -0.14, 0, 0.14, 0.28, 0.42]:
    cube(
        "Simple vertical grille slat " + str(y),
        (-2.304, y, 0.98),
        (0.02, 0.055, 0.35),
        "rim",
    )
for side in [-1, 1]:
    disk(
        "Round front headlamp metal bezel " + str(side),
        (-2.26, side * 0.73, 1.055),
        (-1, 0, 0),
        0.172,
        "roofEdge",
        segments=12,
    )
    disk(
        "Round front headlamp ivory lens " + str(side),
        (-2.29, side * 0.73, 1.055),
        (-1, 0, 0),
        0.131,
        "cream",
        segments=12,
        depth=0.012,
    )
    cube(
        "Front amber lower lamp " + str(side),
        (-2.27, side * 0.75, 0.785),
        (0.035, 0.14, 0.075),
        "amber",
    )
    cube(
        "Rear vertical ruby lamp " + str(side),
        (1.995, side * 0.76, 1.02),
        (0.035, 0.14, 0.23),
        "ruby",
        bevel=0.012,
    )
    cube(
        "Rear ruby broad highlight " + str(side),
        (2.016, side * 0.76, 1.065),
        (0.015, 0.10, 0.05),
        "rubyLight",
    )


def rubber(name, width, radius, group, axis="Y", center=(0, 0, 0), segments=20):
    vv, ff, rr = [], [], []
    for axial, rad in [
        (-width / 2, radius * 0.82),
        (-width * 0.34, radius),
        (width * 0.34, radius),
        (width / 2, radius * 0.82),
    ]:
        for j in range(segments):
            t = 2 * math.pi * j / segments
            p = (
                (rad * math.sin(t), axial, rad * math.cos(t))
                if axis == "Y"
                else (axial, rad * math.sin(t), rad * math.cos(t))
            )
            vv.append(tuple(Vector(center) + Vector(p)))
    for k in range(3):
        for j in range(segments):
            ff.append(
                (
                    k * segments + j,
                    k * segments + (j + 1) % segments,
                    (k + 1) * segments + (j + 1) % segments,
                    (k + 1) * segments + j,
                )
            )
            rr.append("tireLight" if k != 1 else "tire")
    for k in [0, 3]:
        ff.append(tuple(k * segments + j for j in range(segments)))
        rr.append("tire")
    return mesh(name, vv, ff, rr, group)


for axle in CFG["axles"]:
    for side in [-1, 1]:
        wid = ("F" if axle < 0 else "R") + ("L" if side < 0 else "R")
        width = CFG["wheelWidth"]
        rubber("Chunky road tire " + wid, width, r, wid)
        disk(
            "Road steel rim " + wid,
            (0, side * (width / 2 + 0.003), 0),
            (0, side, 0),
            0.282,
            "rim",
            group=wid,
        )
        disk(
            "Road raised metal hub " + wid,
            (0, side * (width / 2 + 0.029), 0),
            (0, side, 0),
            0.165,
            "silver",
            segments=10,
            depth=0.025,
            group=wid,
        )
        # A single small asymmetric inset makes independent/signed rolling visible.
        disk(
            "Road hub index " + wid,
            (0.085, side * (width / 2 + 0.046), 0.06),
            (0, side, 0),
            0.047,
            "roofEdge",
            segments=6,
            depth=0.002,
            group=wid,
        )

# Rear spare is unambiguously fixed equipment, with no Wheel_* node names or
# motion metadata. Its nearest point is behind the rear shell and its radius
# remains well away from both road tires, proved with all fixed triangles.
cube(
    "STATIC spare rear mount",
    (2.07, 0, 1.21),
    (0.24, 0.34, 0.34),
    "roofEdge",
    bevel=0.03,
)
rubber(
    "STATIC rear mounted spare rubber",
    0.30,
    0.435,
    "body",
    axis="X",
    center=(2.31, 0, 1.21),
)
disk("STATIC spare steel rim", (2.463, 0, 1.21), (1, 0, 0), 0.275, "rim", depth=0.026)
disk(
    "STATIC spare center hub",
    (2.491, 0, 1.21),
    (1, 0, 0),
    0.145,
    "silver",
    segments=10,
    depth=0.025,
)
