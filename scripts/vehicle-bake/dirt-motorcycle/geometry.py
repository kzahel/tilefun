"""Original actual two-wheel classic bike; profile contacts from one measured mount."""


def role_face(ob, face, role):
    idx = keys.index(role)
    for li in face.loop_indices:
        ob.data.uv_layers.active.data[li].uv = (
            ((idx % 16) * 32 + 16) / 512,
            1 - (480 + (idx // 16) * 16 + 8) / 512,
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


# Dirt-family tank, tall seat, exposed engine, high mudguards and long fork.
def loft(name, stations, role="paint", chart=None):
    vv = []
    for x, w, low, high in stations:
        h = high - low
        vv += [
            (x, y, z)
            for y, z in [
                (-0.6 * w, low),
                (0.6 * w, low),
                (w, low + 0.18 * h),
                (w, low + 0.75 * h),
                (0.55 * w, high),
                (-0.55 * w, high),
                (-w, low + 0.75 * h),
                (-w, low + 0.18 * h),
            ]
        ]
    n = len(stations)
    ff = [
        (k * 8 + j, k * 8 + (j + 1) % 8, (k + 1) * 8 + (j + 1) % 8, (k + 1) * 8 + j)
        for k in range(n - 1)
        for j in range(8)
    ] + [tuple(range(7, -1, -1)), tuple((n - 1) * 8 + j for j in range(8))]
    ob = mesh(name, vv, ff, role)
    if chart:
        for f in ob.data.polygons:
            for li in f.loop_indices:
                p = ob.data.vertices[ob.data.loops[li].vertex_index].co
                if chart == "body" and abs(f.normal.y) > 0.55:
                    u = (p.x + 0.70) / 1.40
                    py = (p.z - 0.75) / 0.70 * 256
                else:
                    u = (p.y + 0.25) / 0.50
                    py = 256 + (p.x + 1.75) / 3.5 * 128
                ob.data.uv_layers.active.data[li].uv = (
                    max(0.001, min(0.999, u)),
                    1 - max(0.5, min(383.5, py)) / 512,
                )
    return ob


loft(
    "DIRT narrow raised orange tank shrouds",
    [
        (-0.64, 0.08, 1.12, 1.30),
        (-0.44, 0.13, 1.07, 1.38),
        (-0.30, 0.12, 1.09, 1.36),
        (-0.18, 0.03, 1.165, 1.235),
    ],
    chart="body",
)
loft(
    "DIRT high thin crowned front mudguard",
    [
        (-1.70, 0.06, 1.10, 1.145),
        (-1.48, 0.14, 1.14, 1.185),
        (-1.15, 0.15, 1.195, 1.24),
        (-0.82, 0.14, 1.15, 1.195),
        (-0.60, 0.07, 1.14, 1.185),
    ],
    chart="top",
)
loft(
    "DIRT high upswept rear mudguard",
    [
        (0.40, 0.10, 1.16, 1.205),
        (0.75, 0.15, 1.275, 1.32),
        (1.12, 0.16, 1.335, 1.38),
        (1.48, 0.13, 1.305, 1.35),
        (1.65, 0.055, 1.265, 1.31),
    ],
    chart="top",
)
seat_top = CONTACTS["hip_saddle"].z
cube(
    "Actual dark saddle central hip tangent",
    (0.24, 0, seat_top - 0.043),
    (0.68, 0.16, 0.086),
    "seat",
    bevel=0.025,
)
cube(
    "Actual narrow saddle nose",
    (-0.13, 0, 1.158),
    (0.13, 0.16, 0.065),
    "seat",
    bevel=0.020,
)
cube(
    "DIRT long narrow tall rear saddle",
    (0.52, 0, 1.20),
    (0.36, 0.19, 0.09),
    "seatLight",
    bevel=0.018,
)
cube(
    "DIRT exposed gray crankcase",
    (-0.05, 0, 0.70),
    (0.40, 0.22, 0.30),
    "engine",
    bevel=0.045,
)
cube(
    "DIRT exposed single cylinder",
    (-0.31, 0, 0.94),
    (0.23, 0.20, 0.26),
    "engine",
    bevel=0.020,
)
for z in [0.86, 0.93, 1.00]:
    cube(
        "DIRT broad engine fin " + str(z),
        (-0.31, 0, z),
        (0.28, 0.23, 0.02),
        "engineLight",
    )
for side in [-1, 1]:
    disk(
        "DIRT round crankcase face " + str(side),
        (-0.03, side * 0.115, 0.70),
        (0, side, 0),
        0.13,
        "engineLight",
        12,
        0.014,
    )
    tube(
        "DIRT long front fork " + str(side),
        (-0.64, side * 0.17, 1.40),
        (-1.20, side * 0.17, 0.47),
        0.024,
        "chrome",
        8,
    )
    tube(
        "DIRT lower fork slider " + str(side),
        (-1.02, side * 0.17, 0.77),
        (-1.20, side * 0.17, 0.47),
        0.032,
        "frameLight",
        8,
    )
    tube(
        "DIRT rear swingarm " + str(side),
        (0.0, side * 0.195, 0.55),
        (1.10, side * 0.195, 0.44),
        0.024,
        "frame",
        8,
    )
    tube(
        "DIRT static rear shock " + str(side),
        (0.55, side * 0.21, 1.18),
        (1.03, side * 0.21, 0.49),
        0.025,
        "frameLight",
        8,
    )
    for wid in ["F", "R"]:
        spec = CFG["wheelSpecs"][wid]
        end = spec["width"] / 2 + 0.048
        tube(
            "DIRT axle attachment short of hub " + wid + str(side),
            (spec["axle"], side * (end + 0.032), spec["radius"]),
            (spec["axle"], side * end, spec["radius"]),
            0.020,
            "frameLight",
            8,
        )
for i, (a, b) in enumerate(
    [
        ((-0.64, 0, 1.40), (-0.49, 0, 0.50)),
        ((-0.49, 0, 0.50), (0.50, 0, 0.50)),
        ((0.50, 0, 0.50), (0.50, 0, 1.15)),
        ((0.50, 0, 1.08), (-0.60, 0, 1.12)),
        ((-0.64, 0, 1.40), (-0.02, 0, 0.64)),
    ]
):
    tube("DIRT narrow frame member " + str(i), a, b, 0.028, "frame", 8)
tube(
    "DIRT fixed side exhaust",
    (-0.10, 0.22, 0.60),
    (0.85, 0.22, 0.90),
    0.038,
    "engineLight",
    10,
)
tube("DIRT tall grip riser", (-0.64, 0, 1.40), (-0.55, 0, 1.55), 0.025, "frameLight", 8)
tube(
    "DIRT connected handlebar",
    (-0.55, -0.17, 1.55),
    (-0.55, 0.17, 1.55),
    0.021,
    "frameLight",
    12,
)
for side, label in [(-1, "left"), (1, "right")]:
    hand = CONTACTS["hand_" + label + "_grip"]
    tube(
        "Actual palm wrapped grip " + label,
        (hand.x, hand.y - 0.06, hand.z),
        (hand.x, hand.y + 0.06, hand.z),
        0.026,
        "dark",
        12,
    )
    foot = CONTACTS["foot_" + label + "_support"]
    tube(
        "Actual sole tangent foot peg " + label,
        (foot.x, side * 0.10, foot.z - 0.025),
        (foot.x, side * 0.31, foot.z - 0.025),
        0.025,
        "dark",
        12,
    )
vv = [
    (x + d, y, z)
    for d in [-0.0175, 0.0175]
    for x, z, y in [
        (-0.84, 1.22, -0.15),
        (-0.84, 1.22, 0.15),
        (-0.74, 1.60, 0.22),
        (-0.74, 1.60, -0.22),
    ]
]
plate = mesh(
    "DIRT plain white front plate actual framed skin",
    vv,
    [
        (0, 1, 2, 3),
        (7, 6, 5, 4),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ],
    "ink",
)
for f in plate.data.polygons:
    if abs(f.normal.x) < 0.7:
        continue
    for li in f.loop_indices:
        p = plate.data.vertices[plate.data.loops[li].vertex_index].co
        plate.data.uv_layers.active.data[li].uv = (
            max(0.001, min(0.999, (p.y + 0.225) / 0.45)),
            1 - max(384.5, min(447.5, 384 + 64 * (p.z - 1.22) / 0.38)) / 512,
        )

tube(
    "DIRT fixed mudguard fork crossbrace",
    (-0.78, -0.17, 1.19),
    (-0.78, 0.17, 1.19),
    0.022,
    "frameLight",
    8,
)
tube(
    "DIRT fixed plain plate headstock bracket",
    (-0.64, 0, 1.40),
    (-0.79, 0, 1.41),
    0.022,
    "frame",
    8,
)

# Real independent F/R core tyres, hubs and phase indices follow below.

for wid, spec in CFG["wheelSpecs"].items():
    r, width, nr = spec["radius"], spec["width"], spec["segments"]
    vv = []
    ff = []
    roles = []
    for y, rad in [
        (-width / 2, spec["coreRadius"] * 0.84),
        (-width * 0.36, spec["coreRadius"] * 0.97),
        (0, spec["coreRadius"]),
        (width * 0.36, spec["coreRadius"] * 0.97),
        (width / 2, spec["coreRadius"] * 0.84),
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
    mesh("True motorcycle rounded tire " + wid, vv, ff, roles, wid)
    for side in [-1, 1]:
        disk(
            "Classic broad wheel rim " + wid + " " + str(side),
            (0, side * (width / 2 + 0.002), 0),
            (0, side, 0),
            0.265,
            "rim",
            16,
            0.014,
            wid,
        )
        disk(
            "Chrome wheel hub " + wid + " " + str(side),
            (0, side * (width / 2 + 0.018), 0),
            (0, side, 0),
            0.11,
            "chrome",
            12,
            0.014,
            wid,
        )
        disk(
            "Asymmetric wheel phase index " + wid + " " + str(side),
            (0.13, side * (width / 2 + 0.034), 0.08),
            (0, side, 0),
            0.035,
            "frame",
            8,
            0.003,
            wid,
        )

# Actual staggered three-slice tread blocks. Outer vertices lie at the declared
# total radius, including center-angle contact vertices at top and ground.
for wid, spec in CFG["wheelSpecs"].items():
    for row in range(2):
        for station in range(12):
            center = 2 * math.pi * (station + row * 0.5) / 12
            cy = (-1 if row == 0 else 1) * 0.25 * spec["width"]
            hw = 0.22 * spec["width"]
            vv = [
                (r * math.sin(a), y, r * math.cos(a))
                for a in [center - 0.10, center, center + 0.10]
                for r, y in [
                    (spec["radius"] - 0.05, cy - hw),
                    (spec["radius"] - 0.05, cy + hw),
                    (spec["radius"], cy + hw),
                    (spec["radius"], cy - hw),
                ]
            ]
            ff = [
                (
                    k * 4 + j,
                    k * 4 + (j + 1) % 4,
                    (k + 1) * 4 + (j + 1) % 4,
                    (k + 1) * 4 + j,
                )
                for k in range(2)
                for j in range(4)
            ] + [(3, 2, 1, 0), (8, 9, 10, 11)]
            mesh(
                f"DIRT actual tread block {wid} row{row} station{station}",
                vv,
                ff,
                ["tire", "tireLight", "tireLight", "tire"] * 2 + ["tire", "tire"],
                wid,
            )
